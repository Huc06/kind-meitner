// Focused Dev Day visual gate evidence: the real React renderer in the
// repository's pinned agent-browser, against disposable fake-engine fixtures.
// Tool outputs are pinned LIVE production Free-MCP envelopes from
// scripts/testing/issue66-evidence/. No wallet/payment/mainnet calls.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { resolveAgentBrowserBinary } from "../../server/browser-engine.ts";
import { removeTempDir, waitForExit } from "../../server/testing/cleanup.ts";
import { runControlKindMeitner } from "../control-kind-meitner.ts";
import { UI_TOOLS_DIR } from "./control-kind-meitner-ui.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CLI = join(ROOT, "scripts", "control-kind-meitner.ts");
const forced = process.env.KIND_MEITNER_UI_E2E === "1";
const binary = resolveAgentBrowserBinary({ dataDir: UI_TOOLS_DIR, env: process.env });
const enabled = forced || Boolean(binary);
const run = enabled ? it : it.skip;
const LAUNCH_TIMEOUT_MS = forced ? 600_000 : 180_000;
const configuredEvidence = process.env.KIND_MEITNER_UI_EVIDENCE_DIR;
const evidenceDir = configuredEvidence
  ? join(resolve(ROOT, configuredEvidence), "dev-day-gate")
  : mkdtempSync(join(tmpdir(), "kind-meitner-dev-day-gate-evidence-"));
const ownsEvidenceDir = !configuredEvidence;

if (!enabled) {
  console.log("skipping Dev Day gate visual e2e: no agent-browser; set KIND_MEITNER_UI_E2E=1 to install the pinned release");
}

const evidenceRoot = join(ROOT, "scripts", "testing", "issue66-evidence");
const readinessOutput = readFileSync(join(evidenceRoot, "scan-vercel-envelope.json"), "utf8");
const readinessPassOutput = readFileSync(join(evidenceRoot, "scan-self-envelope.json"), "utf8");
const trustOutput = JSON.parse(readFileSync(join(evidenceRoot, "trust-99999.json"), "utf8")).result.content[0].text as string;
const trustGoOutput = JSON.parse(readFileSync(join(evidenceRoot, "trust-go-13851.json"), "utf8")).result.content[0].text as string;
const trust13837Output = JSON.parse(readFileSync(join(evidenceRoot, "trust-13837-ep.json"), "utf8")).result.content[0].text as string;

type Launched = {
  child: ChildProcess;
  info: { ui: string; url: string; dataDir: string; logPath: string };
  stderr: () => string;
};

function launch(toolCalls?: Array<{ name: string; input?: Record<string, unknown>; ok?: boolean; output?: string }>): Promise<Launched> {
  return new Promise((done, fail) => {
    const args = ["--experimental-strip-types", CLI, "ui", "launch"];
    if (toolCalls) args.push("--tool-calls", JSON.stringify(toolCalls));
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const terminate = (signal: NodeJS.Signals) => {
      if (child.pid && process.platform !== "win32") {
        try { process.kill(-child.pid, signal); return; } catch { /* already stopped */ }
      }
      child.kill(signal);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      terminate("SIGINT");
      setTimeout(() => terminate("SIGKILL"), 10_000).unref();
      fail(new Error(`Dev Day UI launch printed no handle within ${LAUNCH_TIMEOUT_MS}ms\nstderr:\n${stderr}`));
    }, LAUNCH_TIMEOUT_MS);
    child.stderr!.on("data", (chunk: Buffer) => { stderr += String(chunk); });
    child.stdout!.on("data", (chunk: Buffer) => {
      stdout += String(chunk);
      if (settled) return;
      const start = stdout.startsWith("{") ? 0 : stdout.indexOf("\n{") + 1;
      if (start <= 0 && !stdout.startsWith("{")) return;
      try {
        const info = JSON.parse(stdout.slice(start));
        settled = true;
        clearTimeout(timer);
        done({ child, info, stderr: () => stderr });
      } catch { /* pretty-printed handle is still arriving */ }
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fail(new Error(`Dev Day UI launch exited ${code} before printing a handle\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });
  });
}

const ui = (verb: string, handle: string, ...args: string[]) =>
  runControlKindMeitner(["ui", verb, "--ui", handle, ...args]) as Promise<Record<string, any>>;

async function openDevDayGate(handle: string): Promise<void> {
  await ui("click", handle, "--name", "New or share");
  await ui("click", handle, "--name", "Open Dev Day Gate");
  await expect.poll(async () => (await ui("snapshot", handle)).snapshot as string, { timeout: 15_000 })
    .toContain('log "Group chat #dev-day-gate"');
}

async function composer(handle: string): Promise<string> {
  return (await ui("eval", handle, "--js", "document.querySelector('textarea')?.value" )).result as string;
}

async function assertNoConsoleErrors(handle: string): Promise<void> {
  const logs = await ui("console", handle);
  expect(logs.ok).toBe(true);
  expect((logs.messages as Array<{ type: string; text: string }>).filter((message) => message.type === "error")).toEqual([]);
}

async function assertPng(path: string): Promise<void> {
  const bytes = readFileSync(path);
  expect(bytes.length).toBeGreaterThan(1_000);
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

describe("Dev Day gate visual E2E", () => {
  const launched: Launched[] = [];

  afterAll(async () => {
    await Promise.all(launched.map(async ({ child }) => {
      if (child.exitCode === null && child.signalCode === null) await waitForExit(child, { signal: "SIGINT", graceMs: 30_000 });
    }));
    if (ownsEvidenceDir) await removeTempDir(evidenceDir);
  });

  run("renders the seeded empty gate, real chart marks, bulletin, and fill-only starters", async () => {
    const fixture = await launch();
    launched.push(fixture);
    await openDevDayGate(fixture.info.ui);

    const empty = await ui("snapshot", fixture.info.ui);
    const tree = empty.snapshot as string;
    expect(tree).toContain("Gate before list. Gate before spend. Free MCP only.");
    expect(tree).toContain("Markets, Listing Coach, and Spend Scout gate every listing and spend.");
    for (const starter of ["Scan a vercel URL", "Scan our Railway Free MCP", "Trust agent 99999", "Trust agent 13851"]) {
      expect(tree).toContain(`button "${starter}"`);
    }
    const chartMarks = await ui("eval", fixture.info.ui, "--js", "(() => { const marks = [...document.querySelectorAll('button[aria-label=\"Manage members — 3 bots in this group\"] [aria-label$=\"OKX.AI catalog agent\"]')]; return { count: marks.length, labels: marks.map(el => el.getAttribute('aria-label')), paths: marks.reduce((count, mark) => count + mark.querySelectorAll('svg path').length, 0) }; })()");
    expect(chartMarks.result).toEqual({
      count: 3,
      labels: [
        "Markets, OKX.AI catalog agent",
        "Listing Coach, OKX.AI catalog agent",
        "Spend Scout, OKX.AI catalog agent",
      ],
      paths: 6,
    });

    const messagesBefore = await ui("eval", fixture.info.ui, "--js", "document.querySelectorAll('[data-mid]').length");
    await ui("click", fixture.info.ui, "--name", "Scan a vercel URL");
    expect(await composer(fixture.info.ui)).toBe("@Markets run scan_free_mcp_readiness for https://demo.vercel.app/api/okx/free-mcp");
    expect((await ui("eval", fixture.info.ui, "--js", "document.querySelectorAll('[data-mid]').length")).result).toBe(messagesBefore.result);

    mkdirSync(evidenceDir, { recursive: true });
    const emptyPng = join(evidenceDir, "empty.png");
    expect(await ui("screenshot", fixture.info.ui, "--out", emptyPng)).toMatchObject({ ok: true, path: emptyPng });
    await assertPng(emptyPng);
    await assertNoConsoleErrors(fixture.info.ui);
  }, LAUNCH_TIMEOUT_MS + 120_000);

  run("renders the synthetic readiness failure as an accessible card and preserves fill-only re-scan", async () => {
    const fixture = await launch([{ name: "mcp__markets__scan_free_mcp_readiness", input: { endpointUrl: "https://demo.vercel.app/api/okx/free-mcp" }, output: readinessOutput }]);
    launched.push(fixture);
    await openDevDayGate(fixture.info.ui);
    await ui("click", fixture.info.ui, "--name", "Scan a vercel URL");
    await ui("click", fixture.info.ui, "--name", "Send message");
    await expect.poll(async () => (await ui("snapshot", fixture.info.ui)).snapshot as string, { timeout: 60_000 })
      .toContain('region "Readiness result: FAIL"');

    const card = await ui("snapshot", fixture.info.ui);
    const tree = card.snapshot as string;
    expect(tree).toContain('region "Readiness result: FAIL"');
    expect((await ui("eval", fixture.info.ui, "--js", "document.querySelector('section[aria-label=\"Readiness result: FAIL\"] span[aria-label]')?.getAttribute('aria-label')")).result).toBe("Readiness verdict FAIL");
    expect(tree).toContain('list "Readiness checks"');
    expect(tree).toContain("Vercel host");
    expect(tree).toContain("Copy fixes");
    const rowsBefore = await ui("eval", fixture.info.ui, "--js", "document.querySelectorAll('[data-mid]').length");
    await ui("click", fixture.info.ui, "--name", "Re-scan");
    await expect.poll(() => composer(fixture.info.ui), { timeout: 10_000 }).toBe("@Markets scan again: https://demo.vercel.app/api/okx/free-mcp");
    expect((await ui("eval", fixture.info.ui, "--js", "document.querySelectorAll('[data-mid]').length")).result).toBe(rowsBefore.result);

    const readinessPng = join(evidenceDir, "readiness.png");
    expect(await ui("screenshot", fixture.info.ui, "--out", readinessPng)).toMatchObject({ ok: true, path: readinessPng });
    await assertPng(readinessPng);
    await assertNoConsoleErrors(fixture.info.ui);
  }, LAUNCH_TIMEOUT_MS + 120_000);

  run("renders the synthetic trust no-go as an accessible card", async () => {
    const fixture = await launch([{ name: "mcp__markets__get_asp_trust_card", input: { agentId: "99999" }, output: trustOutput }]);
    launched.push(fixture);
    await openDevDayGate(fixture.info.ui);
    await ui("click", fixture.info.ui, "--name", "Trust agent 99999");
    await ui("click", fixture.info.ui, "--name", "Send message");
    await expect.poll(async () => (await ui("snapshot", fixture.info.ui)).snapshot as string, { timeout: 60_000 })
      .toContain('region "Trust result: NO_GO"');

    const card = await ui("snapshot", fixture.info.ui);
    const tree = card.snapshot as string;
    expect(tree).toContain('region "Trust result: NO_GO"');
    expect((await ui("eval", fixture.info.ui, "--js", "document.querySelector('section[aria-label=\"Trust result: NO_GO\"] span[aria-label]')?.getAttribute('aria-label')")).result).toBe("Trust decision NO_GO");
    expect(tree).toContain('list "Trust signals"');
    expect(tree).toContain('list "Not checked"');
    expect(tree).toContain("Do not call pay/x402 tools. Fix listing or endpoint first.");
    expect(tree).toContain("Copy next step");

    const trustPng = join(evidenceDir, "trust.png");
    expect(await ui("screenshot", fixture.info.ui, "--out", trustPng)).toMatchObject({ ok: true, path: trustPng });
    await assertPng(trustPng);
    await assertNoConsoleErrors(fixture.info.ui);
  }, LAUNCH_TIMEOUT_MS + 120_000);

  run("applies Railway host from live FAIL card without auto-sending", async () => {
    const fixture = await launch([{ name: "mcp__markets__scan_free_mcp_readiness", input: { endpointUrl: "https://demo.vercel.app/api/okx/free-mcp" }, ok: true, output: readinessOutput }]);
    launched.push(fixture);
    await openDevDayGate(fixture.info.ui);
    await ui("click", fixture.info.ui, "--name", "Scan a vercel URL");
    await expect.poll(() => composer(fixture.info.ui), { timeout: 10_000 })
      .toContain("demo.vercel.app");
    await ui("click", fixture.info.ui, "--name", "Message #dev-day-gate");
    await ui("click", fixture.info.ui, "--name", "Send message");
    await expect.poll(async () => (await ui("snapshot", fixture.info.ui)).snapshot as string, { timeout: 60_000 })
      .toContain('region "Readiness result: FAIL"');
    const rowsBefore = await ui("eval", fixture.info.ui, "--js", "document.querySelectorAll('[data-mid]').length");
    await ui("click", fixture.info.ui, "--name", "Apply host");
    await expect.poll(() => composer(fixture.info.ui), { timeout: 10_000 })
      .toContain("https://kind-meitner-production.up.railway.app/api/okx/free-mcp");
    expect((await ui("eval", fixture.info.ui, "--js", "document.querySelectorAll('[data-mid]').length")).result).toBe(rowsBefore.result);
    const png = join(evidenceDir, "loop-a-fail-apply.png");
    expect(await ui("screenshot", fixture.info.ui, "--out", png)).toMatchObject({ ok: true, path: png });
    await assertPng(png);
  }, LAUNCH_TIMEOUT_MS + 120_000);

  run("blocks spend from live NO_GO trust card and keeps Continue disabled", async () => {
    const fixture = await launch([{ name: "mcp__markets__get_asp_trust_card", input: { agentId: "99999" }, ok: true, output: trustOutput }]);
    launched.push(fixture);
    await openDevDayGate(fixture.info.ui);
    await ui("click", fixture.info.ui, "--name", "Trust agent 99999");
    await ui("click", fixture.info.ui, "--name", "Send message");
    await expect.poll(async () => (await ui("snapshot", fixture.info.ui)).snapshot as string, { timeout: 60_000 })
      .toContain('region "Trust result: NO_GO"');
    const tree = (await ui("snapshot", fixture.info.ui)).snapshot as string;
    expect(tree).toContain('button "Block spend"');
    // Continue should exist but be disabled in a11y tree as disabled button naming varies; check via eval
    const continueDisabled = await ui("eval", fixture.info.ui, "--js", "(() => { const b=[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label')==='Continue free tools'); return !b || b.disabled; })()");
    expect(continueDisabled.result).toBe(true);
    const rowsBefore = await ui("eval", fixture.info.ui, "--js", "document.querySelectorAll('[data-mid]').length");
    await ui("click", fixture.info.ui, "--name", "Block spend");
    await expect.poll(() => composer(fixture.info.ui), { timeout: 10_000 })
      .toContain("@Spend Scout refuse pay for agent 99999");
    expect((await ui("eval", fixture.info.ui, "--js", "document.querySelectorAll('[data-mid]').length")).result).toBe(rowsBefore.result);
    const png = join(evidenceDir, "loop-b-99999-block.png");
    expect(await ui("screenshot", fixture.info.ui, "--out", png)).toMatchObject({ ok: true, path: png });
    await assertPng(png);
  }, LAUNCH_TIMEOUT_MS + 120_000);

  run("enables Continue on live Kind Meitner Markets GO card (#13851)", async () => {
    const fixture = await launch([{ name: "mcp__markets__get_asp_trust_card", input: { agentId: "13851", endpointUrl: "https://kind-meitner-production.up.railway.app/api/okx/free-mcp" }, ok: true, output: trustGoOutput }]);
    launched.push(fixture);
    await openDevDayGate(fixture.info.ui);
    await ui("click", fixture.info.ui, "--name", "Trust agent 13851");
    await ui("click", fixture.info.ui, "--name", "Send message");
    await expect.poll(async () => (await ui("snapshot", fixture.info.ui)).snapshot as string, { timeout: 60_000 })
      .toContain('region "Trust result: GO"');
    const continueDisabled = await ui("eval", fixture.info.ui, "--js", "(() => { const b=[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label')==='Continue free tools'); return !b || b.disabled; })()");
    expect(continueDisabled.result).toBe(false);
    const rowsBefore = await ui("eval", fixture.info.ui, "--js", "document.querySelectorAll('[data-mid]').length");
    await ui("click", fixture.info.ui, "--name", "Continue free tools");
    await expect.poll(() => composer(fixture.info.ui), { timeout: 10_000 })
      .toContain("get_free_a2mcp_launch_checklist");
    expect((await ui("eval", fixture.info.ui, "--js", "document.querySelectorAll('[data-mid]').length")).result).toBe(rowsBefore.result);
    const png = join(evidenceDir, "loop-b-go-13851-continue.png");
    expect(await ui("screenshot", fixture.info.ui, "--out", png)).toMatchObject({ ok: true, path: png });
    await assertPng(png);
  }, LAUNCH_TIMEOUT_MS + 120_000);

  run("shows honest NO_GO for live #13837 listing 404 + endpoint PASS", async () => {
    const fixture = await launch([{ name: "mcp__markets__get_asp_trust_card", input: { agentId: "13837", endpointUrl: "https://kind-meitner-production.up.railway.app/api/okx/free-mcp" }, ok: true, output: trust13837Output }]);
    launched.push(fixture);
    await openDevDayGate(fixture.info.ui);
    await ui("click", fixture.info.ui, "--name", "Trust agent 13837");
    await ui("click", fixture.info.ui, "--name", "Send message");
    await expect.poll(async () => (await ui("snapshot", fixture.info.ui)).snapshot as string, { timeout: 60_000 })
      .toContain('region "Trust result: NO_GO"');
    const png = join(evidenceDir, "loop-b-13837-nogo.png");
    expect(await ui("screenshot", fixture.info.ui, "--out", png)).toMatchObject({ ok: true, path: png });
    await assertPng(png);
  }, LAUNCH_TIMEOUT_MS + 120_000);

  run("picks Railway PASS after vercel FAIL in one fixture (latest User: line only)", async () => {
    const fixture = await launch([
      { name: "mcp__markets__scan_free_mcp_readiness", input: { endpointUrl: "https://demo.vercel.app/api/okx/free-mcp" }, ok: true, output: readinessOutput },
      { name: "mcp__markets__scan_free_mcp_readiness", input: { endpointUrl: "https://kind-meitner-production.up.railway.app/api/okx/free-mcp" }, ok: true, output: readinessPassOutput },
    ]);
    launched.push(fixture);
    await openDevDayGate(fixture.info.ui);
    await ui("click", fixture.info.ui, "--name", "Scan a vercel URL");
    await ui("click", fixture.info.ui, "--name", "Send message");
    await expect.poll(async () => (await ui("snapshot", fixture.info.ui)).snapshot as string, { timeout: 60_000 })
      .toContain('region "Readiness result: FAIL"');
    await ui("click", fixture.info.ui, "--name", "Scan our Railway Free MCP");
    await ui("click", fixture.info.ui, "--name", "Send message");
    await expect.poll(async () => (await ui("snapshot", fixture.info.ui)).snapshot as string, { timeout: 60_000 })
      .toContain('region "Readiness result: PASS"');
    const endpoint = await ui("eval", fixture.info.ui, "--js", "document.querySelector('section[aria-label=\"Readiness result: PASS\"]')?.textContent ?? ''");
    expect(String(endpoint.result)).toContain("kind-meitner-production.up.railway.app");
    expect(String(endpoint.result)).not.toContain("demo.vercel.app");
    const png = join(evidenceDir, "loop-a-fail-then-pass.png");
    expect(await ui("screenshot", fixture.info.ui, "--out", png)).toMatchObject({ ok: true, path: png });
    await assertPng(png);
  }, LAUNCH_TIMEOUT_MS + 180_000);

});
