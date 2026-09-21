#!/usr/bin/env bash
# Dev Day gate smoke: prove Free MCP readiness + trust tools are real (not mocked).
# Exit 0 only if list/discovery, vercel FAIL, and self PASS|WARN all look healthy.
set -euo pipefail

BASE_URL="${BASE_URL:-https://kind-meitner-production.up.railway.app}"
MCP="${BASE_URL%/}/api/okx/free-mcp"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing command: $1" >&2
    exit 2
  }
}

need_cmd curl
need_cmd jq

rpc() {
  local id="$1"
  local method="$2"
  local params="${3:-}"
  if [[ -n "$params" ]]; then
    printf '{"jsonrpc":"2.0","id":"%s","method":"%s","params":%s}' "$id" "$method" "$params"
  else
    printf '{"jsonrpc":"2.0","id":"%s","method":"%s"}' "$id" "$method"
  fi
}

post() {
  local body="$1"
  curl -sS --max-time 30 -X POST "$MCP" \
    -H 'content-type: application/json' \
    -d "$body"
}

echo "MCP: $MCP"
echo

echo "== 1) tools/list must include gate tools =="
LIST_JSON="$(post "$(rpc list-1 tools/list)")"
echo "$LIST_JSON" | jq -e '.result.tools' >/dev/null
NAMES="$(echo "$LIST_JSON" | jq -r '.result.tools[].name')"
echo "$NAMES"
echo "$NAMES" | grep -qx 'scan_free_mcp_readiness' || {
  echo "FAIL: scan_free_mcp_readiness missing from tools/list" >&2
  exit 1
}
echo "$NAMES" | grep -qx 'get_asp_trust_card' || {
  echo "FAIL: get_asp_trust_card missing from tools/list" >&2
  exit 1
}
echo "OK: both gate tools listed"
echo

echo "== 2) vercel.app host must FAIL (no live vercel required) =="
VERCEL_PARAMS='{"name":"scan_free_mcp_readiness","arguments":{"endpointUrl":"https://demo.vercel.app/api/okx/free-mcp"}}'
VERCEL_JSON="$(post "$(rpc vercel-1 tools/call "$VERCEL_PARAMS")")"
VERCEL_TEXT="$(echo "$VERCEL_JSON" | jq -r '.result.content[0].text // empty')"
if [[ -z "$VERCEL_TEXT" ]]; then
  echo "$VERCEL_JSON" | jq . >&2 || true
  echo "FAIL: no tool result text for vercel scan" >&2
  exit 1
fi
VERDICT="$(echo "$VERCEL_TEXT" | jq -r '.data.verdict // empty')"
echo "verdict=$VERDICT"
if [[ "$VERDICT" != "FAIL" ]]; then
  echo "$VERCEL_TEXT" | jq . >&2 || echo "$VERCEL_TEXT" >&2
  echo "FAIL: expected verdict FAIL for vercel.app host" >&2
  exit 1
fi
echo "$VERCEL_TEXT" | jq -r '.data.remediation // [] | join("\n")' | grep -qi 'vercel' || {
  echo "FAIL: remediation should mention vercel" >&2
  exit 1
}
echo "OK: vercel host FAIL with remediation"
echo

echo "== 3) self Free MCP URL must PASS or WARN =="
SELF_URL="${MCP}"
SELF_PARAMS="$(jq -nc --arg u "$SELF_URL" '{name:"scan_free_mcp_readiness",arguments:{endpointUrl:$u}}')"
SELF_JSON="$(post "$(rpc self-1 tools/call "$SELF_PARAMS")")"
SELF_TEXT="$(echo "$SELF_JSON" | jq -r '.result.content[0].text // empty')"
if [[ -z "$SELF_TEXT" ]]; then
  echo "$SELF_JSON" | jq . >&2 || true
  echo "FAIL: no tool result text for self scan" >&2
  exit 1
fi
SELF_VERDICT="$(echo "$SELF_TEXT" | jq -r '.data.verdict // empty')"
echo "verdict=$SELF_VERDICT"
if [[ "$SELF_VERDICT" != "PASS" && "$SELF_VERDICT" != "WARN" ]]; then
  echo "$SELF_TEXT" | jq . >&2 || echo "$SELF_TEXT" >&2
  echo "FAIL: expected PASS or WARN for self scan" >&2
  exit 1
fi
echo "OK: self scan $SELF_VERDICT"
echo

echo "All Dev Day gate smoke checks passed."
