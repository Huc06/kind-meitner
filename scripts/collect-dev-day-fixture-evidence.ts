#!/usr/bin/env node --experimental-strip-types
/**
 * Collect reproducible, local-only evidence for the Dev Day judge pack.
 *
 * This deliberately launches the repository's disposable fake-engine fixture;
 * it never targets Railway, OKX, a wallet, or a developer's running app.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { launchVerificationServer } from "./control-kind-meitner.ts";

type Json = Record<string, any>;

const outputFlag = process.argv.indexOf("--out");
const output = outputFlag >= 0 ? process.argv[outputFlag + 1] : undefined;
if (!output || process.argv.length !== 4) {
  throw new Error("Usage: node --experimental-strip-types scripts/collect-dev-day-fixture-evidence.ts --out docs/evidence/dev-day/fixture-free-mcp.json");
}

const rpc = (id: string, method: string, params?: Record<string, unknown>) => ({
  jsonrpc: "2.0",
  id,
  method,
  ...(params ? { params } : {}),
});

const fixture = await launchVerificationServer();
try {
  const request = async (body: Json) => {
    const response = await fetch(`${fixture.info.url}/api/okx/free-mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  const toolsList = await request(rpc("fixture-tools-list", "tools/list"));
  const tools = toolsList.body.result?.tools;
  if (toolsList.status !== 200 || !Array.isArray(tools)) throw new Error("fixture tools/list did not return HTTP 200 with result.tools");

  const vercel = await request(rpc("fixture-vercel-fail", "tools/call", {
    name: "scan_free_mcp_readiness",
    arguments: { endpointUrl: "https://demo.vercel.app/api/okx/free-mcp" },
  }));
  const readiness = JSON.parse(vercel.body.result?.content?.[0]?.text ?? "null");
  if (vercel.status !== 200 || readiness?.data?.verdict !== "FAIL") throw new Error("fixture Vercel pitfall did not return FAIL");

  const missingReadiness = await request(rpc("fixture-readiness-missing", "tools/call", {
    name: "scan_free_mcp_readiness",
    arguments: {},
  }));
  if (missingReadiness.body.result?.isError !== true) throw new Error("fixture missing readiness input was unexpectedly accepted");

  const missingTrust = await request(rpc("fixture-trust-missing", "tools/call", {
    name: "get_asp_trust_card",
    arguments: {},
  }));
  if (missingTrust.body.result?.isError !== true) throw new Error("fixture missing trust input was unexpectedly accepted");

  const gate = await fetch(`${fixture.info.url}/api/okx/dev-day-gate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const gateBody = await gate.json();
  if (gate.status !== 201 || gateBody.room?.name !== "#dev-day-gate") throw new Error("fixture Dev Day gate was not created");

  const artifact = {
    schemaVersion: 1,
    collectedAt: new Date().toISOString(),
    command: "node --experimental-strip-types scripts/collect-dev-day-fixture-evidence.ts --out docs/evidence/dev-day/fixture-free-mcp.json",
    environment: {
      kind: "isolated local fixture",
      launcher: "launchVerificationServer from scripts/control-kind-meitner.ts",
      fixtureDataDisposedAfterCollection: true,
      externalNetworkAccess: false,
    },
    assertions: {
      toolsList: {
        httpStatus: toolsList.status,
        names: tools.map((tool: Json) => tool.name),
        allReadOnly: tools.every((tool: Json) => JSON.stringify(tool.annotations) === JSON.stringify({ readOnlyHint: true, destructiveHint: false, openWorldHint: false })),
      },
      vercelPitfall: {
        httpStatus: vercel.status,
        verdict: readiness.data.verdict,
        check: readiness.data.checks.find((check: Json) => check.id === "host_pitfall_vercel"),
        remediation: readiness.data.remediation,
      },
      invalidInput: {
        readiness: missingReadiness.body.result.content?.[0]?.text,
        trustCard: missingTrust.body.result.content?.[0]?.text,
      },
      devDayGate: {
        httpStatus: gate.status,
        name: gateBody.room.name,
        section: gateBody.room.section,
        memberCount: gateBody.room.memberIds?.length,
        bulletin: gateBody.room.bulletin,
      },
    },
    limits: [
      "The disposable fixture is HTTP on loopback; it cannot and does not prove a public HTTPS PASS scan.",
      "No Railway endpoint, live curl, OKX listing, wallet, payment, screenshot, video, or external agent was contacted.",
      "Trust-card positive decisions require public listing/endpoint probes and are not claimed by this artifact.",
    ],
  };

  const target = resolve(output);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({ output: target, assertions: artifact.assertions }, null, 2));
} finally {
  await fixture.close();
}
