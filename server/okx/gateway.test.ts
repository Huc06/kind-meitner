import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  generateOkxSignature,
  OkxCliSigner,
  OkxGateway,
  OkxLedger,
  verifyWebhookSignature,
} from "./gateway.ts";

const dirs: string[] = [];

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "kind-meitner-okx-gateway-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of dirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  dirs.length = 0;
});

describe("OKX Gateway & Identity Bridge", () => {
  describe("HMAC Request Authentication", () => {
    it("generates deterministic HMAC-SHA256 signatures matching Developer Portal spec", () => {
      const timestamp = "2026-09-14T12:00:00.000Z";
      const method = "POST";
      const path = "/api/v5/agent/tasks/create";
      const body = JSON.stringify({ title: "Audit Task", budget: 50 });
      const secret = "test-secret-key-123";

      const sign1 = generateOkxSignature(timestamp, method, path, body, secret);
      const sign2 = generateOkxSignature(timestamp, method, path, body, secret);

      expect(sign1).toBe(sign2);
      expect(typeof sign1).toBe("string");
      expect(sign1.length).toBeGreaterThan(20);

      // Altering method or body produces distinct signature
      const signDiffMethod = generateOkxSignature(timestamp, "GET", path, body, secret);
      expect(signDiffMethod).not.toBe(sign1);

      const signDiffBody = generateOkxSignature(timestamp, method, path, "{}", secret);
      expect(signDiffBody).not.toBe(sign1);
    });

    it("verifies webhook signatures correctly and rejects forged signatures", () => {
      const secret = "whsec-webhook-secret-999";
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const rawBody = JSON.stringify({ event: "task_accepted", taskId: "task-1" });

      const validSig = createHmac("sha256", secret)
        .update(`${timestamp}${rawBody}`)
        .digest("hex");

      expect(verifyWebhookSignature(validSig, timestamp, rawBody, secret)).toBe(true);
      expect(verifyWebhookSignature("invalid-sig", timestamp, rawBody, secret)).toBe(false);
      expect(verifyWebhookSignature(validSig, timestamp, rawBody + "tampered", secret)).toBe(false);
    });
  });

  describe("Webhook Signature Verification & Replay Protection", () => {
    const secret = "whsec-hardening-test-secret-42";
    const rawBody = JSON.stringify({ event: "task_status_changed", taskId: "task-abc", status: "completed" });

    it("supports uppercase, lowercase, and mixed-case hex signatures", () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}${rawBody}`;
      const lowerHex = createHmac("sha256", secret).update(payload).digest("hex");
      const upperHex = lowerHex.toUpperCase();
      const mixedHex = lowerHex
        .split("")
        .map((ch, idx) => (idx % 2 === 0 ? ch.toUpperCase() : ch.toLowerCase()))
        .join("");

      expect(verifyWebhookSignature(lowerHex, timestamp, rawBody, secret)).toBe(true);
      expect(verifyWebhookSignature(upperHex, timestamp, rawBody, secret)).toBe(true);
      expect(verifyWebhookSignature(mixedHex, timestamp, rawBody, secret)).toBe(true);
    });

    it("strips sha256= and v1= format prefixes", () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}${rawBody}`;
      const hexSig = createHmac("sha256", secret).update(payload).digest("hex");
      const base64Sig = createHmac("sha256", secret).update(payload).digest("base64");

      // sha256= prefix (both lowercase and uppercase prefix)
      expect(verifyWebhookSignature(`sha256=${hexSig}`, timestamp, rawBody, secret)).toBe(true);
      expect(verifyWebhookSignature(`SHA256=${hexSig}`, timestamp, rawBody, secret)).toBe(true);
      expect(verifyWebhookSignature(`sha256=${hexSig.toUpperCase()}`, timestamp, rawBody, secret)).toBe(true);

      // v1= prefix (both lowercase and uppercase prefix)
      expect(verifyWebhookSignature(`v1=${hexSig}`, timestamp, rawBody, secret)).toBe(true);
      expect(verifyWebhookSignature(`V1=${hexSig}`, timestamp, rawBody, secret)).toBe(true);
      expect(verifyWebhookSignature(`v1=${base64Sig}`, timestamp, rawBody, secret)).toBe(true);
      expect(verifyWebhookSignature(`sha256=${base64Sig}`, timestamp, rawBody, secret)).toBe(true);
    });

    it("verifies base64 digests and preserves case sensitivity", () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}${rawBody}`;
      const base64Sig = createHmac("sha256", secret).update(payload).digest("base64");

      expect(verifyWebhookSignature(base64Sig, timestamp, rawBody, secret)).toBe(true);
      expect(verifyWebhookSignature(`  ${base64Sig}  `, timestamp, rawBody, secret)).toBe(true);

      // Inverted case on base64 must fail because base64 is case-sensitive
      const invertedBase64 = base64Sig
        .split("")
        .map((c) => (c >= "a" && c <= "z" ? c.toUpperCase() : c >= "A" && c <= "Z" ? c.toLowerCase() : c))
        .join("");
      expect(verifyWebhookSignature(invertedBase64, timestamp, rawBody, secret)).toBe(false);
    });

    it("enforces timestamp replay protection and drift tolerance window", () => {
      const now = 1789365000000; // Reference epoch ms
      const secretKey = "drift-secret-123";

      // 1. Fresh timestamp within default 5-minute (300,000ms) window passes
      const freshTsSec = Math.floor(now / 1000).toString();
      const freshSig = createHmac("sha256", secretKey).update(`${freshTsSec}${rawBody}`).digest("hex");
      expect(verifyWebhookSignature(freshSig, freshTsSec, rawBody, secretKey, { now })).toBe(true);

      // Millisecond timestamp passes
      const freshTsMs = now.toString();
      const freshMsSig = createHmac("sha256", secretKey).update(`${freshTsMs}${rawBody}`).digest("hex");
      expect(verifyWebhookSignature(freshMsSig, freshTsMs, rawBody, secretKey, { now })).toBe(true);

      // ISO string timestamp passes
      const isoTs = new Date(now).toISOString();
      const isoSig = createHmac("sha256", secretKey).update(`${isoTs}${rawBody}`).digest("hex");
      expect(verifyWebhookSignature(isoSig, isoTs, rawBody, secretKey, { now })).toBe(true);

      // 2. Timestamp exactly at tolerance boundary (300,000ms drift) passes
      const boundaryPastTs = (now - 300_000).toString();
      const boundarySig = createHmac("sha256", secretKey).update(`${boundaryPastTs}${rawBody}`).digest("hex");
      expect(verifyWebhookSignature(boundarySig, boundaryPastTs, rawBody, secretKey, { now })).toBe(true);

      // 3. Stale timestamp > 5 minutes past fails (replay attack)
      const staleTs = (now - 300_001).toString();
      const staleSig = createHmac("sha256", secretKey).update(`${staleTs}${rawBody}`).digest("hex");
      expect(verifyWebhookSignature(staleSig, staleTs, rawBody, secretKey, { now })).toBe(false);

      // 4. Future timestamp drifted > 5 minutes fails
      const futureTs = (now + 300_001).toString();
      const futureSig = createHmac("sha256", secretKey).update(`${futureTs}${rawBody}`).digest("hex");
      expect(verifyWebhookSignature(futureSig, futureTs, rawBody, secretKey, { now })).toBe(false);

      // 5. Configurable maxDriftMs (e.g. 60,000ms / 1 minute)
      const customDriftOpts = { now, maxDriftMs: 60_000 };
      const ts90sAgo = (now - 90_000).toString();
      const sig90s = createHmac("sha256", secretKey).update(`${ts90sAgo}${rawBody}`).digest("hex");
      expect(verifyWebhookSignature(sig90s, ts90sAgo, rawBody, secretKey, customDriftOpts)).toBe(false);

      const ts30sAgo = (now - 30_000).toString();
      const sig30s = createHmac("sha256", secretKey).update(`${ts30sAgo}${rawBody}`).digest("hex");
      expect(verifyWebhookSignature(sig30s, ts30sAgo, rawBody, secretKey, customDriftOpts)).toBe(true);

      // 6. Invalid / unparseable / negative timestamps fail immediately
      expect(verifyWebhookSignature(freshSig, "invalid-timestamp", rawBody, secretKey)).toBe(false);
      expect(verifyWebhookSignature(freshSig, "", rawBody, secretKey)).toBe(false);
      expect(verifyWebhookSignature(freshSig, "-500", rawBody, secretKey)).toBe(false);
      expect(verifyWebhookSignature(freshSig, "0", rawBody, secretKey)).toBe(false);
    });

    it("rejects forged or tampered signatures and inputs cleanly", () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const validSig = createHmac("sha256", secret).update(`${timestamp}${rawBody}`).digest("hex");

      // Corrupt one character in hex
      const tamperedSig = validSig.slice(0, -1) + (validSig.endsWith("0") ? "1" : "0");
      expect(verifyWebhookSignature(tamperedSig, timestamp, rawBody, secret)).toBe(false);

      // Truncated signature (length mismatch)
      expect(verifyWebhookSignature(validSig.slice(0, 32), timestamp, rawBody, secret)).toBe(false);

      // Over-length signature
      expect(verifyWebhookSignature(validSig + "aa", timestamp, rawBody, secret)).toBe(false);

      // Altered body
      expect(verifyWebhookSignature(validSig, timestamp, rawBody + ',"tamper":true', secret)).toBe(false);

      // Wrong secret
      expect(verifyWebhookSignature(validSig, timestamp, rawBody, "wrong-secret")).toBe(false);

      // Empty parameters
      expect(verifyWebhookSignature("", timestamp, rawBody, secret)).toBe(false);
      expect(verifyWebhookSignature(validSig, "", rawBody, secret)).toBe(false);
      expect(verifyWebhookSignature(validSig, timestamp, rawBody, "")).toBe(false);
    });
  });

  describe("Isolated Atomic Ledger", () => {
    it("persists task records atomically and restores from disk", () => {
      const dir = tempDir();
      const ledgerFile = join(dir, "okx-tasks.json");

      const ledger1 = new OkxLedger(ledgerFile);
      ledger1.recordTask({
        id: "task-101",
        title: "Smart Contract Audit",
        spec: "Audit Solidity vault",
        status: "created",
        escrowAmount: 75,
        token: "USDT",
        createdAt: 1000,
        updatedAt: 1000,
      });

      expect(ledger1.getTask("task-101")?.title).toBe("Smart Contract Audit");

      // Verify persistence across instances
      const ledger2 = new OkxLedger(ledgerFile);
      const restored = ledger2.getTask("task-101");
      expect(restored).toBeDefined();
      expect(restored?.escrowAmount).toBe(75);

      // Update status
      ledger2.updateTaskStatus("task-101", "in_progress", { txHash: "0x123abc" });
      expect(ledger2.getTask("task-101")?.status).toBe("in_progress");
      expect(ledger2.getTask("task-101")?.txHash).toBe("0x123abc");
    });

    it("filters tasks by status and aspId", () => {
      const ledger = new OkxLedger();
      ledger.recordTask({
        id: "t1",
        title: "T1",
        spec: "S1",
        status: "created",
        aspId: "asp-A",
        createdAt: 1,
        updatedAt: 1,
      });
      ledger.recordTask({
        id: "t2",
        title: "T2",
        spec: "S2",
        status: "completed",
        aspId: "asp-B",
        createdAt: 2,
        updatedAt: 2,
      });
      ledger.recordTask({
        id: "t3",
        title: "T3",
        spec: "S3",
        status: "created",
        aspId: "asp-B",
        createdAt: 3,
        updatedAt: 3,
      });

      expect(ledger.listTasks({ status: "created" })).toHaveLength(2);
      expect(ledger.listTasks({ aspId: "asp-B" })).toHaveLength(2);
      expect(ledger.listTasks({ status: "completed", aspId: "asp-B" })).toHaveLength(1);
    });
  });

  describe("CLI Signer Wrapper", () => {
    it("executes agent lifecycle commands through pluggable runner", async () => {
      const runs: Array<{ cmd: string; args: string[]; env?: Record<string, string> }> = [];
      const runner = async (cmd: string, args: string[], opts?: { env?: Record<string, string> }) => {
        runs.push({ cmd, args, env: opts?.env });
        if (args[0] === "agent" && args[1] === "create") {
          return { exitCode: 0, stdout: JSON.stringify({ agentId: "agent-okx-1", address: "0x1111222233334444555566667777888899990000" }), stderr: "" };
        }
        if (args[0] === "agent" && args[1] === "payment") {
          return { exitCode: 0, stdout: "Payment settled tx: 0x9999aaaa8888bbbb7777cccc6666dddd5555eeee4444ffff3333000022221111", stderr: "" };
        }
        return { exitCode: 0, stdout: "ok", stderr: "" };
      };

      const signer = new OkxCliSigner("custom-onchainos", runner);
      const created = await signer.agentCreate("MyEvaluator", "Dispute resolver", {
        privateKey: "0xprivatesecret",
        category: "evaluator",
      });

      expect(created.agentId).toBe("agent-okx-1");
      expect(runs[0].env?.ONCHAINOS_PRIVATE_KEY).toBe("0xprivatesecret");
      expect(runs[0].args).toContain("create");

      const payment = await signer.agentPayment("inv-123", 50, "USDT");
      expect(payment.success).toBe(true);
      expect(payment.txHash).toContain("0x9999");
    });

    it("executes agentAccept and parses transaction hash correctly", async () => {
      const executed: string[] = [];
      const runner = async (cmd: string, args: string[]) => {
        executed.push(`${cmd} ${args.join(" ")}`);
        return {
          exitCode: 0,
          stdout: "Agent task accepted tx: 0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
          stderr: "",
        };
      };

      const signer = new OkxCliSigner("onchainos", runner);
      const res = await signer.agentAccept("task-accept-1");
      expect(res.success).toBe(true);
      expect(res.txHash).toBe("0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff");
      expect(executed[0]).toBe("onchainos agent accept --task-id task-accept-1");
    });

    it("executes agentReject with reason and parses transaction hash correctly", async () => {
      const executed: string[] = [];
      const runner = async (cmd: string, args: string[]) => {
        executed.push(`${cmd} ${args.join(" ")}`);
        return {
          exitCode: 0,
          stdout: "Agent task rejected tx=0x2222333344445555666677778888999900001111aaaabbbbccccddddeeeeffff",
          stderr: "",
        };
      };

      const signer = new OkxCliSigner("onchainos", runner);
      const res = await signer.agentReject("task-reject-1", "BUILD FAILED: SyntaxError");
      expect(res.success).toBe(true);
      expect(res.txHash).toBe("0x2222333344445555666677778888999900001111aaaabbbbccccddddeeeeffff");
      expect(executed[0]).toBe("onchainos agent reject --task-id task-reject-1 --reason BUILD FAILED: SyntaxError");
    });

    it("executes evaluatorClaim and parses txHash and claimed reward amount", async () => {
      // Test 1: Plain text CLI output
      const runnerText = async (cmd: string, args: string[]) => {
        expect(cmd).toBe("onchainos");
        expect(args).toEqual(["evaluator", "claim", "--dispute-id", "disp-456"]);
        return {
          exitCode: 0,
          stdout: "Arbitration fee claimed tx: 0x3333444455556666777788889999000011112222aaaabbbbccccddddeeeeffff reward: 12.5 USDT",
          stderr: "",
        };
      };
      const signerText = new OkxCliSigner("onchainos", runnerText);
      const resText = await signerText.evaluatorClaim("disp-456");
      expect(resText.success).toBe(true);
      expect(resText.txHash).toBe("0x3333444455556666777788889999000011112222aaaabbbbccccddddeeeeffff");
      expect(resText.amount).toBe(12.5);

      // Test 2: JSON CLI output
      const runnerJson = async () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          txHash: "0x4444555566667777888899990000111122223333aaaabbbbccccddddeeeeffff",
          amount: 25.0,
        }),
        stderr: "",
      });
      const signerJson = new OkxCliSigner("onchainos", runnerJson);
      const resJson = await signerJson.evaluatorClaim("disp-789");
      expect(resJson.success).toBe(true);
      expect(resJson.txHash).toBe("0x4444555566667777888899990000111122223333aaaabbbbccccddddeeeeffff");
      expect(resJson.amount).toBe(25.0);
    });

    it("executes walletBalance and parses OKB and USDT balances correctly", async () => {
      // Test 1: JSON balances
      const runnerJson = async (cmd: string, args: string[]) => {
        expect(cmd).toBe("onchainos");
        expect(args).toEqual(["wallet", "balance", "--address", "0x0123456789012345678901234567890123456789"]);
        return {
          exitCode: 0,
          stdout: JSON.stringify({ okb: 0.15, usdt: 250.75 }),
          stderr: "",
        };
      };
      const signerJson = new OkxCliSigner("onchainos", runnerJson);
      const balJson = await signerJson.walletBalance("0x0123456789012345678901234567890123456789");
      expect(balJson.okb).toBe(0.15);
      expect(balJson.usdt).toBe(250.75);

      // Test 2: Plain text balances without explicit address
      const runnerText = async (cmd: string, args: string[]) => {
        expect(cmd).toBe("onchainos");
        expect(args).toEqual(["wallet", "balance"]);
        return {
          exitCode: 0,
          stdout: "OKB: 1.25\nUSDT: 500.00",
          stderr: "",
        };
      };
      const signerText = new OkxCliSigner("onchainos", runnerText);
      const balText = await signerText.walletBalance();
      expect(balText.okb).toBe(1.25);
      expect(balText.usdt).toBe(500.0);
    });

    it("strictly throws errors when CLI fails without generating fake mock UUID fallbacks", async () => {
      // 1. agentPayment throws when CLI exits with non-zero code
      const failingRunner = async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "Insufficient funds in signer account",
      });
      const failingSigner = new OkxCliSigner("onchainos", failingRunner);
      await expect(failingSigner.agentPayment("inv-err", 50)).rejects.toThrow(
        "Payment for invoice inv-err failed: Insufficient funds in signer account",
      );

      // 2. agentPayment throws when stdout contains no valid tx hash (no silent randomUUID fallback!)
      const noHashRunner = async () => ({
        exitCode: 0,
        stdout: "Payment attempted but no transaction hash emitted",
        stderr: "",
      });
      const noHashSigner = new OkxCliSigner("onchainos", noHashRunner);
      await expect(noHashSigner.agentPayment("inv-nohash", 50)).rejects.toThrow(
        "no valid transaction hash found in CLI output",
      );

      // 3. agentCreate throws on non-zero exit code without 0x000 fallback
      await expect(failingSigner.agentCreate("AgentFail", "Desc")).rejects.toThrow(
        "Failed to create agent: Insufficient funds in signer account",
      );

      // 4. agentCreate throws when stdout cannot be parsed into agentId and address
      const unparseableRunner = async () => ({
        exitCode: 0,
        stdout: "Unformatted unexpected garbage output",
        stderr: "",
      });
      const unparseableSigner = new OkxCliSigner("onchainos", unparseableRunner);
      await expect(unparseableSigner.agentCreate("AgentUnparseable", "Desc")).rejects.toThrow(
        "could not parse agentId or address",
      );

      // 5. agentAccept throws on non-zero exit code
      await expect(failingSigner.agentAccept("task-fail")).rejects.toThrow(
        "Failed to accept agent task task-fail",
      );

      // 6. agentReject throws on non-zero exit code
      await expect(failingSigner.agentReject("task-fail", "Reason")).rejects.toThrow(
        "Failed to reject agent task task-fail",
      );

      // 7. evaluatorClaim throws on non-zero exit code
      await expect(failingSigner.evaluatorClaim("disp-fail")).rejects.toThrow(
        "Failed to claim evaluator fee for dispute disp-fail",
      );

      // 8. walletBalance throws on non-zero exit code
      await expect(failingSigner.walletBalance()).rejects.toThrow(
        "Failed to fetch wallet balance",
      );
    });
  });

  describe("Gateway Client & Webhooks", () => {
    it("handles incoming webhook events and updates ledger status", () => {
      const dir = tempDir();
      const ledgerFile = join(dir, "tasks.json");
      const gateway = new OkxGateway({ ledgerFile });

      gateway.ledger.recordTask({
        id: "task-test-1",
        title: "Test",
        spec: "Spec",
        status: "created",
        createdAt: 1,
        updatedAt: 1,
      });

      // 1. Task accepted
      gateway.handleWebhook(
        JSON.stringify({
          type: "task_accepted",
          data: { taskId: "task-test-1" },
        }),
      );
      expect(gateway.ledger.getTask("task-test-1")?.status).toBe("in_progress");

      // 2. Delivery submitted
      gateway.handleWebhook(
        JSON.stringify({
          type: "delivery_submitted",
          data: { taskId: "task-test-1", deliverable: "https://deliverable.link" },
        }),
      );
      expect(gateway.ledger.getTask("task-test-1")?.status).toBe("delivered");
      expect(gateway.ledger.getTask("task-test-1")?.deliverable).toBe("https://deliverable.link");

      // 3. Delivery rejected / Dispute initiated
      gateway.handleWebhook(
        JSON.stringify({
          type: "delivery_rejected",
          data: { taskId: "task-test-1", reason: "Missing tests" },
        }),
      );
      expect(gateway.ledger.getTask("task-test-1")?.status).toBe("rejected");
      expect(gateway.ledger.getTask("task-test-1")?.rejectionReason).toBe("Missing tests");
    });

    it("matches tasks by externalTaskId on remote webhook arrival", () => {
      const gateway = new OkxGateway();
      gateway.ledger.recordTask({
        id: "local-task-42",
        externalTaskId: "okx-remote-task-999",
        title: "Remote Contract Audit",
        spec: "Audit",
        status: "created",
        createdAt: 1,
        updatedAt: 1,
      });

      // Look up by externalTaskId
      const found = gateway.ledger.getTask("okx-remote-task-999");
      expect(found).toBeDefined();
      expect(found?.id).toBe("local-task-42");

      // Remote webhook specifies okx-remote-task-999
      gateway.handleWebhook(
        JSON.stringify({
          type: "delivery_submitted",
          data: { taskId: "okx-remote-task-999", deliverable: "https://okx.remote/audit.pdf" },
        }),
      );

      const updated = gateway.ledger.getTask("local-task-42");
      expect(updated?.status).toBe("delivered");
      expect(updated?.deliverable).toBe("https://okx.remote/audit.pdf");
    });

    it("supports case-insensitive headers and base64 webhook signatures", () => {
      const secret = "my-secret-key-123";
      const gateway = new OkxGateway({ webhookSecret: secret });

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const rawBody = JSON.stringify({ event: "task_accepted", data: { taskId: "dummy" } });

      // Generate base64 signature
      const base64Sig = createHmac("sha256", secret)
        .update(`${timestamp}${rawBody}`)
        .digest("base64");

      // Pass uppercase headers
      const evt = gateway.handleWebhook(rawBody, {
        "X-OKX-SIGNATURE": base64Sig,
        "X-OKX-TIMESTAMP": timestamp,
      });

      expect(evt).toBeDefined();
      expect(evt.data.taskId).toBe("dummy");
    });

    it("rejects unauthenticated webhooks when secret is required or missing", () => {
      const rawBody = JSON.stringify({ event: "task_accepted", data: { taskId: "dummy" } });

      // 1. Gateway with requireWebhookSecret: true rejects if secret unset
      const strictGateway = new OkxGateway({ requireWebhookSecret: true });
      expect(() => strictGateway.handleWebhook(rawBody)).toThrow("Webhook secret is not configured");

      // 2. Gateway without secret rejects if signature headers are provided
      const openGateway = new OkxGateway();
      expect(() =>
        openGateway.handleWebhook(rawBody, { "x-okx-signature": "some-signature" }),
      ).toThrow("Webhook secret is not configured");

      // 3. Option requireSecret: true forces rejection when secret is missing
      expect(() =>
        openGateway.handleWebhook(rawBody, {}, { requireSecret: true }),
      ).toThrow("Webhook secret is not configured");

      // 4. Production environment rejects webhooks without secret
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        expect(() => openGateway.handleWebhook(rawBody)).toThrow("Webhook secret is not configured");
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it("rejects webhooks with invalid or stale signatures when secret is configured", () => {
      const secret = "sec-prod-secret";
      const gateway = new OkxGateway({ webhookSecret: secret });
      const rawBody = JSON.stringify({ event: "task_accepted", data: { taskId: "dummy" } });

      // Missing signature header throws
      expect(() => gateway.handleWebhook(rawBody, {})).toThrow("Invalid webhook signature");

      // Forged signature throws
      const freshTs = Math.floor(Date.now() / 1000).toString();
      expect(() =>
        gateway.handleWebhook(rawBody, {
          "x-okx-signature": "bad-signature",
          "x-okx-timestamp": freshTs,
        }),
      ).toThrow("Invalid webhook signature");

      // Stale timestamp (> 5 minutes) throws
      const staleTs = (Date.now() - 400_000).toString();
      const staleSig = createHmac("sha256", secret).update(`${staleTs}${rawBody}`).digest("hex");
      expect(() =>
        gateway.handleWebhook(rawBody, {
          "x-okx-signature": staleSig,
          "x-okx-timestamp": staleTs,
        }),
      ).toThrow("Invalid webhook signature");
    });

    it("executes evaluatorVote via OkxCliSigner and submitDisputeResolution via gateway", async () => {
      const executed: string[] = [];
      const runner = async (cmd: string, args: string[]) => {
        executed.push(`${cmd} ${args.join(" ")}`);
        return {
          exitCode: 0,
          stdout: "Vote submitted tx: 0x888877776666555544443333222211110000aaaa",
          stderr: "",
        };
      };

      const signer = new OkxCliSigner("custom-onchainos", runner);
      const voteRes = await signer.evaluatorVote("disp-123", "PASS", '{"score": 90}');
      expect(voteRes.success).toBe(true);
      expect(voteRes.txHash).toContain("0x88887777");
      expect(executed[0]).toContain("evaluator vote --dispute-id disp-123 --verdict PASS");

      // Test submitDisputeResolution via gateway
      const gateway = new OkxGateway({ commandRunner: runner, cliPath: "custom-onchainos" });
      const dispRes = await gateway.submitDisputeResolution({
        disputeId: "disp-123",
        verdict: "PASS",
        rubricScore: 90,
        refundRatio: 0,
        rationale: "Approved",
      });
      expect(dispRes.success).toBe(true);
      expect(dispRes.txHash).toContain("0x88887777");
    });

    it("emits domain events and records delivery metadata via EventEmitter", () => {
      const gateway = new OkxGateway();
      gateway.ledger.recordTask({
        id: "task-evt-1",
        title: "Event Test",
        spec: "Spec",
        status: "in_progress",
        createdAt: 1000,
        updatedAt: 1000,
      });

      const eventsReceived: any[] = [];
      gateway.on("delivery_submitted", (evt) => {
        eventsReceived.push(evt);
      });

      const webhookTs = 1789365123000;
      gateway.handleWebhook(
        JSON.stringify({
          type: "delivery_submitted",
          timestamp: webhookTs,
          data: {
            taskId: "task-evt-1",
            deliverable: "https://github.com/org/repo/pull/1",
          },
        }),
      );

      expect(eventsReceived).toHaveLength(1);
      expect(eventsReceived[0].type).toBe("delivery_submitted");
      expect(eventsReceived[0].data.taskId).toBe("task-evt-1");

      const task = gateway.ledger.getTask("task-evt-1");
      expect(task?.status).toBe("delivered");
      expect(task?.deliverable).toBe("https://github.com/org/repo/pull/1");
      expect(task?.metadata?.deliveredAt).toBe(webhookTs);
    });
  });
});
