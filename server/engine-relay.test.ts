import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RuntimeEvent } from "./contracts.ts";
import { ClaudeRelayDriver, EngineRelayManager } from "./engine-relay.ts";
import { validateJob, validateServerUrl } from "../scripts/engine-relay-runner.mjs";

describe("Laptop Claude Engine Relay", () => {
  let scratch: string;
  let tokensFile: string;
  let sessionsFile: string;
  let manager: EngineRelayManager;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "km-relay-test-"));
    tokensFile = join(scratch, "tokens.json");
    sessionsFile = join(scratch, "sessions.json");
    manager = new EngineRelayManager({ tokensFile, sessionsFile });
  });

  afterEach(() => {
    manager.close();
    rmSync(scratch, { recursive: true, force: true });
  });

  describe("Token hashing, verification, and revocation", () => {
    it("stores only SHA-256 hashes on disk and verifies bearer tokens in constant time", () => {
      const created = manager.createToken("Work MacBook");
      expect(created.id).toBeDefined();
      expect(created.token).toMatch(/^[a-f0-9]{64}$/);

      // Verify that disk storage contains only the token hash, never the raw secret
      const diskContent = readFileSync(tokensFile, "utf8");
      expect(diskContent).not.toContain(created.token);
      expect(diskContent).toContain("Work MacBook");

      // Valid token succeeds
      const valid = manager.verifyBearerToken(`Bearer ${created.token}`, "127.0.0.1");
      expect(valid.ok).toBe(true);
      if (valid.ok) {
        expect(valid.record.id).toBe(created.id);
        expect(valid.record.name).toBe("Work MacBook");
      }

      // Invalid token fails with 401
      const invalid = manager.verifyBearerToken("Bearer not-the-right-token", "127.0.0.1");
      expect(invalid.ok).toBe(false);
      if (!invalid.ok) {
        expect(invalid.status).toBe(401);
      }

      // Malformed header fails with 401
      const malformed = manager.verifyBearerToken("Basic xyz", "127.0.0.1");
      expect(malformed.ok).toBe(false);
      if (!malformed.ok) {
        expect(malformed.status).toBe(401);
      }
    });

    it("rate-limits repeated authentication failures", () => {
      const created = manager.createToken("Laptop");
      const badToken = "Bearer " + "0".repeat(64);

      for (let i = 0; i < 10; i++) {
        manager.verifyBearerToken(badToken, "10.0.0.5");
      }

      const blocked = manager.verifyBearerToken(`Bearer ${created.token}`, "10.0.0.5");
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.status).toBe(429);
      }
    });

    it("revokes tokens immediately and excludes them from listing and verification", () => {
      const token1 = manager.createToken("Laptop 1");
      const token2 = manager.createToken("Laptop 2");

      let list = manager.listTokens();
      expect(list).toHaveLength(2);

      const revoked = manager.revokeToken(token1.id);
      expect(revoked).toBe(true);

      list = manager.listTokens();
      expect(list).toHaveLength(1);
      expect(list[0]!.id).toBe(token2.id);

      const authRevoked = manager.verifyBearerToken(`Bearer ${token1.token}`, "127.0.0.1");
      expect(authRevoked.ok).toBe(false);
      if (!authRevoked.ok) {
        expect(authRevoked.status).toBe(401);
      }

      const authActive = manager.verifyBearerToken(`Bearer ${token2.token}`, "127.0.0.1");
      expect(authActive.ok).toBe(true);
    });
  });

  describe("Job lifecycle", () => {
    it("handles enqueue → poll → events → done, emitting delta, item, turn completed, and resumes session", async () => {
      const created = manager.createToken("Laptop");
      const auth = manager.verifyBearerToken(`Bearer ${created.token}`, "127.0.0.1");
      expect(auth.ok).toBe(true);
      const tokenRecord = (auth as { ok: true; record: { tokenHash: string } }).record;

      const events: RuntimeEvent[] = [];
      const emit = (event: RuntimeEvent) => events.push(event);

      // Start turn 1
      const sendPromise = manager.sendTurn(
        "laptopClaude",
        {
          threadId: "thread-xyz",
          botId: "bot-1",
          text: "What is 2+2?",
          model: "claude-sonnet-5",
        },
        emit,
      );

      const turnResult = await sendPromise;
      expect(turnResult.turnId).toBeDefined();

      // Runner polls and gets the job
      const job = await manager.poll(tokenRecord.tokenHash);
      expect(job).not.toBeNull();
      expect(job!.prompt).toBe("What is 2+2?");
      expect(job!.model).toBe("claude-sonnet-5");
      expect(job!.resumeSessionId).toBeUndefined();

      // Runner sends stream-json lines
      const lines = [
        JSON.stringify({ type: "system", subtype: "init", session_id: "00000000-0000-0000-0000-000000000001", model: "claude-sonnet-5" }),
        JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "4" } } }),
        JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "4" }] } }),
        JSON.stringify({ type: "result", is_error: false, stop_reason: "end_turn", total_cost_usd: 0.005 }),
      ];

      manager.handleEvents(job!.id, lines);
      manager.handleDone(job!.id, 0, "00000000-0000-0000-0000-000000000001");

      // Verify emitted events
      const sessionStarted = events.find((e) => e.type === "session.started");
      expect(sessionStarted).toMatchObject({ sessionId: "00000000-0000-0000-0000-000000000001", model: "claude-sonnet-5" });

      const contentDelta = events.find((e) => e.type === "content.delta");
      expect(contentDelta).toMatchObject({ streamKind: "assistant_text", delta: "4" });

      const itemCompleted = events.find((e) => e.type === "item.completed");
      expect(itemCompleted).toMatchObject({ itemType: "assistant_text", text: "4" });

      const turnCompleted = events.find((e) => e.type === "turn.completed");
      expect(turnCompleted).toMatchObject({ ok: true, stopReason: "end_turn", cost: 0.005 });

      // Follow-up turn 2 on the same thread should automatically pass resumeSessionId
      await manager.sendTurn(
        "laptopClaude",
        {
          threadId: "thread-xyz",
          botId: "bot-1",
          text: "And plus 3?",
          model: "claude-sonnet-5",
        },
        emit,
      );

      const job2 = await manager.poll(tokenRecord.tokenHash);
      expect(job2).not.toBeNull();
      expect(job2!.resumeSessionId).toBe("00000000-0000-0000-0000-000000000001");
    });
  });

  describe("Cancellation via lease", () => {
    it("reports cancelled on lease when turn is interrupted", async () => {
      const created = manager.createToken("Laptop");
      const auth = manager.verifyBearerToken(`Bearer ${created.token}`, "127.0.0.1");
      const tokenRecord = (auth as { ok: true; record: { tokenHash: string } }).record;

      const events: RuntimeEvent[] = [];
      await manager.sendTurn(
        "laptopClaude",
        {
          threadId: "thread-cancel",
          botId: "bot-1",
          text: "Long running task",
        },
        (e) => events.push(e),
      );

      const job = await manager.poll(tokenRecord.tokenHash);
      expect(job).not.toBeNull();

      // Lease active before interrupt
      const initialLease = manager.lease(job!.id, tokenRecord.tokenHash);
      expect(initialLease.cancelled).toBe(false);

      // Interrupt turn
      manager.interruptTurn("thread-cancel");

      // Subsequent lease reports cancelled
      const cancelledLease = manager.lease(job!.id, tokenRecord.tokenHash);
      expect(cancelledLease.cancelled).toBe(true);

      const interrupted = events.find((e) => e.type === "turn.completed");
      expect(interrupted).toMatchObject({ ok: false, stopReason: "interrupted" });
    });
  });

  describe("No-runner turn fails without fallback", () => {
    it("fails immediately with clear runtime.error when no runner is connected", async () => {
      const driver = new ClaudeRelayDriver();
      const instance = await driver.create({
        instanceId: "laptopClaude",
        displayName: "Laptop Claude",
        environment: {},
        enabled: true,
        config: {},
      });

      // No runner has polled, so snapshot is unavailable
      const snapshot = await instance.snapshot();
      expect(snapshot.state).toBe("unavailable");
      expect(snapshot.reason).toContain("Laptop Claude is not connected");

      const events: RuntimeEvent[] = [];
      let resolveCompleted!: () => void;
      const completedPromise = new Promise<void>((res) => {
        resolveCompleted = res;
      });
      instance.adapter.onEvent((e) => {
        events.push(e);
        if (e.type === "turn.completed") resolveCompleted();
      });

      const result = await instance.adapter.sendTurn({
        threadId: "offline-thread",
        botId: "bot-1",
        text: "Are you there?",
      });

      expect(result.turnId).toBeDefined();
      await completedPromise;
      const err = events.find((e) => e.type === "runtime.error");
      expect(err).toBeDefined();
      expect((err as { message: string }).message).toBe(
        "Laptop Claude is not connected. Start the runner from Settings → Engines → Claude.",
      );

      const completed = events.find((e) => e.type === "turn.completed");
      expect(completed).toMatchObject({ ok: false, stopReason: "not_connected" });
    });
  });

  describe("Runner parameter validation", () => {
    it("rejects invalid model IDs", () => {
      expect(validateJob({ prompt: "hi", model: "claude-sonnet-5" }).ok).toBe(true);
      expect(validateJob({ prompt: "hi", model: "claude-3.5-haiku" }).ok).toBe(true);
      expect(validateJob({ prompt: "hi", model: "claude; rm -rf /" }).ok).toBe(false);
      expect(validateJob({ prompt: "hi", model: "foo bar" }).ok).toBe(false);
      expect(validateJob({ prompt: "hi", model: "model`whoami`" }).ok).toBe(false);
    });

    it("rejects invalid resume session IDs", () => {
      expect(
        validateJob({
          prompt: "hi",
          resumeSessionId: "12345678-1234-1234-1234-123456789abc",
        }).ok,
      ).toBe(true);

      expect(
        validateJob({
          prompt: "hi",
          resumeSessionId: "not-a-uuid",
        }).ok,
      ).toBe(false);

      expect(
        validateJob({
          prompt: "hi",
          resumeSessionId: "12345678-1234-1234-1234-123456789abc; ls",
        }).ok,
      ).toBe(false);
    });

    it("enforces HTTPS except for localhost / 127.0.0.1", () => {
      expect(validateServerUrl("https://km.example.com")).toBe("https://km.example.com");
      expect(validateServerUrl("http://127.0.0.1:8810")).toBe("http://127.0.0.1:8810");
      expect(validateServerUrl("http://localhost:3000")).toBe("http://localhost:3000");

      expect(() => validateServerUrl("http://km.example.com")).toThrow(/Insecure server URL/);
      expect(() => validateServerUrl("ftp://localhost:8810")).toThrow(/Insecure server URL/);
      expect(() => validateServerUrl("not a url")).toThrow(/Invalid server URL/);
    });
  });
});
