#!/usr/bin/env bash
# Dev Day gate smoke: prove the Free MCP readiness + trust tools are real (not mocked).
# Read-only and bounded: every request is one POST with a 30 s cap. HTTP 200 is
# not success here; each tool result is checked for JSON-RPC errors and isError.
set -euo pipefail

BASE_URL="${BASE_URL:-https://kind-meitner-production.up.railway.app}"
MCP="${BASE_URL%/}/api/okx/free-mcp"
AGENT_ID="${AGENT_ID:-13851}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing command: $1" >&2
    exit 2
  }
}

need_cmd curl
need_cmd jq

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

rpc() {
  jq -nc --arg id "$1" --arg method "$2" --argjson params "${3:-null}" \
    '{jsonrpc:"2.0",id:$id,method:$method} + (if $params == null then {} else {params:$params} end)'
}

post() {
  curl -sS --max-time 30 -X POST "$MCP" -H 'content-type: application/json' -d "$1"
}

# tools/call that must succeed: prints the tool's text payload.
call_ok() {
  local id="$1" name="$2" args="$3" json
  json="$(post "$(rpc "$id" tools/call "$(jq -nc --arg n "$name" --argjson a "$args" '{name:$n,arguments:$a}')")")"
  echo "$json" | jq -e '.error == null' >/dev/null || fail "$name returned JSON-RPC error: $(echo "$json" | jq -c .error)"
  echo "$json" | jq -e '.result.isError != true' >/dev/null || fail "$name returned isError: $(echo "$json" | jq -r '.result.content[0].text')"
  echo "$json" | jq -er '.result.content[0].text' || fail "$name returned no text content"
}

# tools/call that must be refused by the tool: prints the error text.
call_refused() {
  local id="$1" name="$2" args="$3" json
  json="$(post "$(rpc "$id" tools/call "$(jq -nc --arg n "$name" --argjson a "$args" '{name:$n,arguments:$a}')")")"
  if echo "$json" | jq -e '.error != null' >/dev/null; then
    echo "$json" | jq -r '.error.message'
  elif echo "$json" | jq -e '.result.isError == true' >/dev/null; then
    echo "$json" | jq -r '.result.content[0].text'
  else
    fail "$name accepted invalid arguments $args"
  fi
}

echo "MCP: $MCP"
echo "at:  $(date -u +%FT%TZ)"
echo

echo "== 1) initialize =="
INIT="$(post "$(rpc init-1 initialize '{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"dev-day-smoke","version":"1"}}')")"
echo "$INIT" | jq -e '.result.protocolVersion and .result.serverInfo.name' >/dev/null || fail "initialize: $(echo "$INIT" | jq -c .)"
echo "$INIT" | jq -r '"server=\(.result.serverInfo.name) protocol=\(.result.protocolVersion)"'
echo

echo "== 2) tools/list must include gate tools =="
LIST_JSON="$(post "$(rpc list-1 tools/list)")"
echo "$LIST_JSON" | jq -e '.result.tools' >/dev/null || fail "tools/list: $(echo "$LIST_JSON" | jq -c .)"
NAMES="$(echo "$LIST_JSON" | jq -r '.result.tools[].name')"
echo "$NAMES"
echo "$NAMES" | grep -qx 'scan_free_mcp_readiness' || fail "scan_free_mcp_readiness missing from tools/list"
echo "$NAMES" | grep -qx 'get_asp_trust_card' || fail "get_asp_trust_card missing from tools/list"
echo "OK: both gate tools listed"
echo

echo "== 3) vercel.app host must FAIL with remediation =="
VERCEL_TEXT="$(call_ok vercel-1 scan_free_mcp_readiness '{"endpointUrl":"https://demo.vercel.app/api/okx/free-mcp"}')"
VERDICT="$(echo "$VERCEL_TEXT" | jq -r '.data.verdict // empty')"
echo "verdict=$VERDICT"
[[ "$VERDICT" == "FAIL" ]] || fail "expected verdict FAIL for vercel.app host"
echo "$VERCEL_TEXT" | jq -r '.data.remediation // [] | join("\n")' | grep -qi 'vercel' || fail "remediation should mention vercel"
echo "OK: vercel host FAIL with remediation"
echo

echo "== 4) self Free MCP URL must PASS or WARN =="
SELF_TEXT="$(call_ok self-1 scan_free_mcp_readiness "$(jq -nc --arg u "$MCP" '{endpointUrl:$u}')")"
SELF_VERDICT="$(echo "$SELF_TEXT" | jq -r '.data.verdict // empty')"
echo "verdict=$SELF_VERDICT"
[[ "$SELF_VERDICT" == "PASS" || "$SELF_VERDICT" == "WARN" ]] || fail "expected PASS or WARN for self scan"
echo "OK: self scan $SELF_VERDICT"
echo

echo "== 5) trust card for agent #$AGENT_ID + self endpoint =="
TRUST_TEXT="$(call_ok trust-1 get_asp_trust_card "$(jq -nc --arg a "$AGENT_ID" --arg u "$MCP" '{agentId:$a,endpointUrl:$u}')")"
echo "$TRUST_TEXT" | jq -c '{decision: .data.decision, signals: (.data.signals | length), notChecked: .data.notChecked}'
echo "$TRUST_TEXT" | jq -e --arg a "$AGENT_ID" '.data.agentId == $a' >/dev/null || fail "trust card agentId mismatch"
echo "$TRUST_TEXT" | jq -e '.data.decision | IN("GO","CAUTION","NO_GO")' >/dev/null || fail "trust decision not GO|CAUTION|NO_GO"
echo "$TRUST_TEXT" | jq -e '(.data.signals | type) == "array" and (.data.signals | length) > 0' >/dev/null || fail "trust card has no signals"
echo "$TRUST_TEXT" | jq -e '(.data.safeNextStep | type) == "string" and (.data.safeNextStep | length) > 0' >/dev/null || fail "trust card has no safe next step"
# Uncertainty must survive a GO: unchecked evidence is listed, never implied safe.
echo "$TRUST_TEXT" | jq -e '(.data.notChecked | length) >= 3 and (.data.notChecked | index("OKX official endorsement") != null)' >/dev/null \
  || fail "trust card must list unchecked evidence, including OKX endorsement"
echo "$TRUST_TEXT" | jq -e '.resource.provenance | test("not an OKX endorsement")' >/dev/null || fail "trust provenance must disclaim OKX endorsement"
echo "$TRUST_TEXT" | jq -e '.resource.paymentRequired == false and .resource.walletRequired == false' >/dev/null || fail "trust resource must be free and wallet-less"
echo "OK: trust $(echo "$TRUST_TEXT" | jq -r .data.decision) with unchecked evidence listed"
echo

echo "== 6) unknown agent without endpoint must not be GO =="
UNKNOWN_TEXT="$(call_ok trust-2 get_asp_trust_card '{"agentId":"99999999"}')"
UNKNOWN_DECISION="$(echo "$UNKNOWN_TEXT" | jq -r '.data.decision')"
echo "decision=$UNKNOWN_DECISION"
[[ "$UNKNOWN_DECISION" != "GO" ]] || fail "missing evidence produced GO"
echo "OK: unknown agent $UNKNOWN_DECISION"
echo

echo "== 7) invalid arguments are refused as tool errors =="
echo "missing agentId: $(call_refused bad-1 get_asp_trust_card '{}')"
echo "extra argument:  $(call_refused bad-2 get_asp_trust_card "$(jq -nc --arg a "$AGENT_ID" '{agentId:$a,bogus:1}')")"
echo "OK: invalid arguments refused"
echo

echo "All Dev Day gate smoke checks passed."
