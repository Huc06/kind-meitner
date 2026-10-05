import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DATA_DIR } from "./config.ts";
import { newEventId } from "./contracts.ts";
import type {
  DriverCreateInput,
  InstanceConfigMap,
  ModelCatalog,
  ProviderAdapter,
  ProviderDriver,
  ProviderInstance,
  ProviderSnapshot,
  RequestOutcome,
  RuntimeEvent,
  RuntimeEventBase,
  RuntimeEventListener,
  SendTurnInput,
  ThreadId,
  TurnId,
  TurnStartResult,
} from "./contracts.ts";
import { claudeAuthFailure, firstText, STATIC_CLAUDE_MODELS } from "./drivers/claude.ts";
import { commandSummary, toolDetailPreview } from "./tool-summary.ts";

export interface RelayTokenRecord {
  id: string;
  name: string;
  tokenHash: string;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface RelayTokenView {
  id: string;
  name: string;
  createdAt: string;
  lastSeenAt: string | null;
  connected: boolean;
}

export interface RelayJobPayload {
  id: string;
  prompt: string;
  system?: string;
  model?: string;
  resumeSessionId?: string;
}

interface RelayJob {
  id: string;
  instanceId: string;
  threadId: string;
  turnId: string;
  prompt: string;
  system?: string;
  model?: string;
  resumeSessionId?: string;
  sent: boolean;
  cancelled: boolean;
  settled: boolean;
  sawStreamDelta: boolean;
  authFailed: boolean;
  sessionId?: string;
  lastLeaseAt: number;
  runnerTokenHash?: string;
  emit: (event: RuntimeEvent) => void;
}

interface PollWaiter {
  tokenHash: string;
  resolve: (job: RelayJobPayload | null) => void;
  timer: NodeJS.Timeout;
}

class RelayRateLimiter {
  private requests = new Map<string, { count: number; resetAt: number }>();
  private failures = new Map<string, { count: number; resetAt: number }>();

  check(ip: string): boolean {
    const now = Date.now();
    const fail = this.failures.get(ip);
    if (fail && fail.resetAt > now && fail.count >= 10) {
      return false;
    }
    const req = this.requests.get(ip);
    if (req && req.resetAt > now) {
      if (req.count >= 120) return false;
      req.count++;
    } else {
      this.requests.set(ip, { count: 1, resetAt: now + 60_000 });
    }
    return true;
  }

  recordFailure(ip: string): void {
    const now = Date.now();
    const fail = this.failures.get(ip);
    if (fail && fail.resetAt > now) {
      fail.count++;
    } else {
      this.failures.set(ip, { count: 1, resetAt: now + 60_000 });
    }
  }

  cleanup(): void {
    const now = Date.now();
    for (const [k, v] of this.requests) if (v.resetAt <= now) this.requests.delete(k);
    for (const [k, v] of this.failures) if (v.resetAt <= now) this.failures.delete(k);
  }
}

/** Claude Code session ids are UUIDs; the runner refuses anything else. */
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isClaudeSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_RE.test(value);
}

/** Relayed turns run with every tool disabled; say so, so the model never
 * claims to have run a command or written a file. */
const RELAY_NO_TOOLS_NOTE =
  "You are running through Laptop Claude with all tools disabled: you cannot run commands, read or write files, browse, or call MCP tools. If a request needs any of that, say plainly that you cannot do it here instead of saying you will.";

export class EngineRelayManager {
  private tokens = new Map<string, RelayTokenRecord>();
  private threadSessions = new Map<string, string>();
  private activeJobs = new Map<string, RelayJob>();
  private jobsByThread = new Map<string, string>();
  private pollWaiters: PollWaiter[] = [];
  private lastRunnerPollAt = 0;
  private rateLimiter = new RelayRateLimiter();
  private readonly tokensFile: string;
  private readonly sessionsFile: string;
  private watchdogTimer?: NodeJS.Timeout;

  constructor(options?: { tokensFile?: string; sessionsFile?: string }) {
    this.tokensFile = options?.tokensFile ?? join(DATA_DIR, "engine-relay-tokens.json");
    this.sessionsFile = options?.sessionsFile ?? join(DATA_DIR, "engine-relay-sessions.json");
    this.loadTokens();
    this.loadSessions();
    this.startWatchdog();
  }

  private loadTokens(): void {
    try {
      if (existsSync(this.tokensFile)) {
        const raw = readFileSync(this.tokensFile, "utf8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && typeof item.id === "string" && typeof item.tokenHash === "string") {
              this.tokens.set(item.id, {
                id: item.id,
                name: typeof item.name === "string" ? item.name : "Laptop",
                tokenHash: item.tokenHash,
                createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
                lastSeenAt: typeof item.lastSeenAt === "string" ? item.lastSeenAt : null,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("[engine-relay] Failed to load tokens:", err);
    }
  }

  private saveTokens(): void {
    try {
      mkdirSync(dirname(this.tokensFile), { recursive: true });
      const data = JSON.stringify(Array.from(this.tokens.values()), null, 2);
      writeFileSync(this.tokensFile, data, { mode: 0o600 });
    } catch (err) {
      console.error("[engine-relay] Failed to save tokens:", err);
    }
  }

  private loadSessions(): void {
    try {
      if (existsSync(this.sessionsFile)) {
        const raw = readFileSync(this.sessionsFile, "utf8");
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          for (const [k, v] of Object.entries(obj)) {
            if (isClaudeSessionId(v)) this.threadSessions.set(k, v);
          }
        }
      }
    } catch (err) {
      console.error("[engine-relay] Failed to load sessions:", err);
    }
  }

  private saveSessions(): void {
    try {
      mkdirSync(dirname(this.sessionsFile), { recursive: true });
      const obj = Object.fromEntries(this.threadSessions.entries());
      writeFileSync(this.sessionsFile, JSON.stringify(obj, null, 2), { mode: 0o600 });
    } catch (err) {
      console.error("[engine-relay] Failed to save sessions:", err);
    }
  }

  private startWatchdog(): void {
    this.watchdogTimer = setInterval(() => {
      this.rateLimiter.cleanup();
      const now = Date.now();
      for (const [jobId, job] of this.activeJobs.entries()) {
        if (job.sent && !job.settled && now - job.lastLeaseAt > 20_000) {
          const base: RuntimeEventBase = {
            eventId: newEventId(),
            provider: "claudeRelay",
            providerInstanceId: job.instanceId,
            threadId: job.threadId,
            turnId: job.turnId,
            createdAt: new Date().toISOString(),
          };
          job.emit({
            ...base,
            type: "runtime.error",
            message: "Laptop runner disconnected while processing turn.",
          });
          job.emit({
            ...base,
            type: "turn.completed",
            ok: false,
            stopReason: "runner_disconnected",
          });
          job.settled = true;
          this.activeJobs.delete(jobId);
          if (this.jobsByThread.get(job.threadId) === jobId) {
            this.jobsByThread.delete(job.threadId);
          }
        } else if (!job.sent && !job.settled && (now - job.lastLeaseAt > 10_000 || !this.isRunnerConnected())) {
          const base: RuntimeEventBase = {
            eventId: newEventId(),
            provider: "claudeRelay",
            providerInstanceId: job.instanceId,
            threadId: job.threadId,
            turnId: job.turnId,
            createdAt: new Date().toISOString(),
          };
          job.emit({
            ...base,
            type: "runtime.error",
            message: "Laptop Claude is not connected. Start the runner from Settings → Engines → Laptop Claude.",
            setup: true,
          });
          job.emit({
            ...base,
            type: "turn.completed",
            ok: false,
            stopReason: "not_connected",
          });
          job.settled = true;
          this.activeJobs.delete(jobId);
          if (this.jobsByThread.get(job.threadId) === jobId) {
            this.jobsByThread.delete(job.threadId);
          }
        }
      }
    }, 4_000);
    this.watchdogTimer.unref?.();
  }

  close(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = undefined;
    }
    for (const waiter of this.pollWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
    this.pollWaiters = [];
    this.activeJobs.clear();
    this.jobsByThread.clear();
  }

  getRunnerScript(): string {
    const runnerPath = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "engine-relay-runner.mjs");
    return readFileSync(runnerPath, "utf8");
  }

  createToken(name = "Laptop"): { id: string; token: string; createdAt: string } {
    const id = randomUUID();
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const createdAt = new Date().toISOString();
    const record: RelayTokenRecord = {
      id,
      name: name.slice(0, 80) || "Laptop",
      tokenHash,
      createdAt,
      lastSeenAt: null,
    };
    this.tokens.set(id, record);
    this.saveTokens();
    return { id, token, createdAt };
  }

  listTokens(): RelayTokenView[] {
    const isConnected = this.isRunnerConnected();
    return Array.from(this.tokens.values())
      .map((t) => {
        const tokenSeenRecent = t.lastSeenAt ? Date.now() - new Date(t.lastSeenAt).getTime() < 30_000 : false;
        return {
          id: t.id,
          name: t.name,
          createdAt: t.createdAt,
          lastSeenAt: t.lastSeenAt,
          connected: isConnected && tokenSeenRecent,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  revokeToken(id: string): boolean {
    const existing = this.tokens.get(id);
    if (!existing) return false;
    this.tokens.delete(id);
    this.saveTokens();

    // Cancel any active poll waiters using this token
    this.pollWaiters = this.pollWaiters.filter((w) => {
      if (w.tokenHash === existing.tokenHash) {
        clearTimeout(w.timer);
        w.resolve(null);
        return false;
      }
      return true;
    });

    return true;
  }

  private constantTimeHashEqual(aHex: string, bHex: string): boolean {
    if (aHex.length !== bHex.length) return false;
    try {
      return timingSafeEqual(Buffer.from(aHex, "hex"), Buffer.from(bHex, "hex"));
    } catch {
      return false;
    }
  }

  verifyBearerToken(
    authHeader: string | undefined,
    clientIp: string,
  ): { ok: true; record: RelayTokenRecord } | { ok: false; status: number; error: string } {
    if (!this.rateLimiter.check(clientIp)) {
      return { ok: false, status: 429, error: "Rate limit exceeded" };
    }

    if (!authHeader) {
      this.rateLimiter.recordFailure(clientIp);
      return { ok: false, status: 401, error: "Missing Authorization header" };
    }

    const match = authHeader.match(/^Bearer\s+([A-Za-z0-9+/=_-]+)$/i);
    if (!match) {
      this.rateLimiter.recordFailure(clientIp);
      return { ok: false, status: 401, error: "Invalid Authorization header format" };
    }

    const rawToken = match[1];
    const presentedHash = createHash("sha256").update(rawToken).digest("hex");

    for (const record of this.tokens.values()) {
      if (this.constantTimeHashEqual(presentedHash, record.tokenHash)) {
        record.lastSeenAt = new Date().toISOString();
        this.lastRunnerPollAt = Date.now();
        return { ok: true, record };
      }
    }

    this.rateLimiter.recordFailure(clientIp);
    return { ok: false, status: 401, error: "Invalid runner token" };
  }

  isRunnerConnected(): boolean {
    if (this.tokens.size === 0) return false;
    return Date.now() - this.lastRunnerPollAt < 30_000;
  }

  hasSession(threadId: string): boolean {
    return this.threadSessions.has(threadId) || this.jobsByThread.has(threadId);
  }

  async poll(tokenHash: string, req?: { on: (event: string, listener: () => void) => void }): Promise<RelayJobPayload | null> {
    this.lastRunnerPollAt = Date.now();

    // Check if an unsent job is queued
    for (const job of this.activeJobs.values()) {
      if (!job.sent && !job.cancelled && !job.settled) {
        job.sent = true;
        job.runnerTokenHash = tokenHash;
        job.lastLeaseAt = Date.now();
        return {
          id: job.id,
          prompt: job.prompt,
          system: job.system,
          model: job.model,
          resumeSessionId: job.resumeSessionId,
        };
      }
    }

    // Hold connection up to 20s
    return new Promise<RelayJobPayload | null>((resolve) => {
      const waiterObj: PollWaiter = {
        tokenHash,
        resolve: (payload) => {
          clearTimeout(waiterObj.timer);
          this.removePollWaiter(waiterObj);
          resolve(payload);
        },
        timer: setTimeout(() => {
          this.removePollWaiter(waiterObj);
          resolve(null);
        }, 20_000),
      };
      this.pollWaiters.push(waiterObj);

      req?.on("close", () => {
        clearTimeout(waiterObj.timer);
        this.removePollWaiter(waiterObj);
      });
    });
  }

  private removePollWaiter(waiter: PollWaiter): void {
    const idx = this.pollWaiters.indexOf(waiter);
    if (idx !== -1) this.pollWaiters.splice(idx, 1);
  }

  lease(jobId: string, _tokenHash: string): { cancelled: boolean } {
    const job = this.activeJobs.get(jobId);
    if (!job || job.settled || job.cancelled) {
      return { cancelled: true };
    }
    job.lastLeaseAt = Date.now();
    this.lastRunnerPollAt = Date.now();
    return { cancelled: false };
  }

  handleEvents(jobId: string, lines: string[]): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job || job.settled) return false;
    this.lastRunnerPollAt = Date.now();
    job.lastLeaseAt = Date.now();

    const base: RuntimeEventBase = {
      eventId: newEventId(),
      provider: "claudeRelay",
      providerInstanceId: job.instanceId,
      threadId: job.threadId,
      turnId: job.turnId,
      createdAt: new Date().toISOString(),
    };

      type JsonStreamEvent = {
        type: "stream_event";
        parent_tool_use_id?: string;
        event?: {
          type?: string;
          delta?: {
            type?: string;
            text?: string;
            thinking?: string;
          };
        };
      };
      type JsonAssistant = {
        type: "assistant";
        message?: {
          content?: unknown;
          usage?: {
            input_tokens?: number;
            cache_read_input_tokens?: number;
            output_tokens?: number;
          };
        };
      };
      type JsonUser = {
        type: "user";
        message?: {
          content?: Array<{
            type?: string;
            tool_use_id?: string;
            is_error?: boolean;
            content?: unknown;
          }>;
        };
      };
      type JsonResult = {
        type: "result";
        is_error?: boolean;
        stop_reason?: string | null;
        terminal_reason?: string | null;
        total_cost_usd?: number | null;
        origin?: { kind?: string };
        usage?: {
          input_tokens?: number;
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
          output_tokens?: number;
        };
      };
      type JsonInit = {
        type: "system";
        subtype: "init";
        session_id?: string;
        model?: string;
      };
      type JsonThinking = {
        type: "system";
        subtype: "thinking_tokens";
        estimated_tokens?: number;
      };
    for (const line of lines) {
      if (!line || !line.trim()) continue;
      let record: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(line);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
        record = parsed as Record<string, unknown>;
      } catch {
        continue;
      }
      const frameType = typeof record.type === "string" ? record.type : "";

      if (frameType === "system") {
        const subtype = typeof record.subtype === "string" ? record.subtype : "";
        if (subtype === "init") {
          const init = record as unknown as JsonInit;
          if (isClaudeSessionId(init.session_id)) {
            job.sessionId = init.session_id;
            this.threadSessions.set(job.threadId, init.session_id);
            this.saveSessions();
          }
          job.emit({
            ...base,
            type: "session.started",
            sessionId: typeof init.session_id === "string" ? init.session_id : null,
            model: typeof init.model === "string" ? init.model : null,
          });
        } else if (subtype === "thinking_tokens") {
          const thinking = record as unknown as JsonThinking;
          job.emit({
            ...base,
            type: "item.updated",
            itemType: "reasoning",
            tokens: typeof thinking.estimated_tokens === "number" ? thinking.estimated_tokens : null,
          });
        }
      } else if (frameType === "stream_event") {
        const ev = record as unknown as JsonStreamEvent;
        if (!ev.parent_tool_use_id && ev.event?.type === "content_block_delta") {
          const d = ev.event.delta;
          if (d?.type === "text_delta" && typeof d.text === "string" && d.text) {
            job.sawStreamDelta = true;
            job.emit({ ...base, type: "content.delta", streamKind: "assistant_text", delta: d.text });
          } else if (d?.type === "thinking_delta" && typeof d.thinking === "string" && d.thinking) {
            job.emit({ ...base, type: "content.delta", streamKind: "reasoning_text", delta: d.thinking });
          }
        }
      } else if (frameType === "assistant") {
        const ast = record as unknown as JsonAssistant;
        const msg = ast.message ?? {};
        const text = firstText(msg.content);
        if (claudeAuthFailure(record as { error?: unknown; is_api_error_message?: unknown }, text)) {
          job.authFailed = true;
          job.emit({ ...base, type: "runtime.error", message: text, setup: true });
          continue;
        }
        if (text.trim()) {
          if (!job.sawStreamDelta) {
            job.emit({ ...base, type: "content.delta", streamKind: "assistant_text", delta: text });
          }
          job.sawStreamDelta = false;
          job.emit({ ...base, type: "item.completed", itemType: "assistant_text", text });
        }
        if (Array.isArray(msg.content)) {
          for (const b of msg.content) {
            if (b && typeof b === "object" && "type" in b && (b as { type: unknown }).type === "tool_use") {
              const tu = b as { id?: string; name?: string; input?: unknown };
              job.emit({
                ...base,
                type: "item.started",
                itemType: "tool",
                itemId: tu.id,
                title: tu.name,
                summary: commandSummary(tu.input),
                input: toolDetailPreview(tu.input),
              });
            }
          }
        }
        if (msg.usage) {
          job.emit({
            ...base,
            type: "thread.token-usage.updated",
            input: (msg.usage.input_tokens || 0) + (msg.usage.cache_read_input_tokens || 0),
            output: msg.usage.output_tokens || 0,
            ...(typeof msg.usage.cache_read_input_tokens === "number" ? { cachedInput: msg.usage.cache_read_input_tokens } : {}),
          });
        }
      } else if (frameType === "user") {
        const usr = record as unknown as JsonUser;
        const list = usr.message?.content;
        if (Array.isArray(list)) {
          for (const b of list) {
            if (b?.type === "tool_result") {
              job.emit({
                ...base,
                type: "item.completed",
                itemType: "tool",
                itemId: b.tool_use_id,
                ok: !b.is_error,
                output: toolDetailPreview(b.content),
              });
            }
          }
        }
      } else if (frameType === "result") {
        const res = record as unknown as JsonResult;
        if (res.origin?.kind === "task-notification") continue;
        const ok = res.is_error !== true && !job.authFailed;
        const stopReason = job.authFailed ? "auth_required" : res.stop_reason ?? res.terminal_reason ?? null;
        const cost = typeof res.total_cost_usd === "number" ? res.total_cost_usd : null;
        const usage = res.usage
          ? {
              input:
                (res.usage.input_tokens || 0) +
                (res.usage.cache_read_input_tokens || 0) +
                (res.usage.cache_creation_input_tokens || 0),
              output: res.usage.output_tokens || 0,
              ...(typeof res.usage.cache_read_input_tokens === "number" ? { cachedInput: res.usage.cache_read_input_tokens } : {}),
            }
          : undefined;
        job.settled = true;
        job.emit({ ...base, type: "turn.completed", ok, stopReason, cost, ...(usage ? { usage } : {}) });
      }
    }
    return true;
  }

  handleDone(jobId: string, exitCode: number, sessionId?: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;
    this.lastRunnerPollAt = Date.now();

    const finalSessionId = isClaudeSessionId(sessionId) ? sessionId : job.sessionId;
    if (finalSessionId) {
      this.threadSessions.set(job.threadId, finalSessionId);
      this.saveSessions();
    }

    if (!job.settled) {
      const base: RuntimeEventBase = {
        eventId: newEventId(),
        provider: "claudeRelay",
        providerInstanceId: job.instanceId,
        threadId: job.threadId,
        turnId: job.turnId,
        createdAt: new Date().toISOString(),
      };
      const ok = exitCode === 0 && !job.authFailed;
      if (exitCode !== 0 && !job.authFailed) {
        job.emit({
          ...base,
          type: "runtime.error",
          message: `Claude CLI exited with code ${exitCode}`,
        });
      }
      job.emit({
        ...base,
        type: "turn.completed",
        ok,
        stopReason: ok ? "end_turn" : "cli_exit",
      });
      job.settled = true;
    }

    this.activeJobs.delete(jobId);
    if (this.jobsByThread.get(job.threadId) === jobId) {
      this.jobsByThread.delete(job.threadId);
    }
    return true;
  }

  async sendTurn(
    instanceId: string,
    turnInput: SendTurnInput,
    emit: (event: RuntimeEvent) => void,
  ): Promise<TurnStartResult> {
    const turnId = randomUUID();
    const base: RuntimeEventBase = {
      eventId: newEventId(),
      provider: "claudeRelay",
      providerInstanceId: instanceId,
      threadId: turnInput.threadId,
      turnId,
      createdAt: new Date().toISOString(),
    };

    if (!this.isRunnerConnected()) {
      queueMicrotask(() => {
        emit({
          ...base,
          type: "runtime.error",
          message: "Laptop Claude is not connected. Start the runner from Settings → Engines → Laptop Claude.",
          setup: true,
        });
        emit({
          ...base,
          type: "turn.completed",
          ok: false,
          stopReason: "not_connected",
        });
      });
      return { turnId };
    }

    // Cancel any previous in-flight job on this thread
    const oldJobId = this.jobsByThread.get(turnInput.threadId);
    if (oldJobId) {
      const oldJob = this.activeJobs.get(oldJobId);
      if (oldJob && !oldJob.settled) {
        oldJob.cancelled = true;
        oldJob.settled = true;
        this.activeJobs.delete(oldJobId);
      }
    }

    const jobId = randomUUID();
    // Only a real Claude session id (a UUID) is ever sent to the runner; the
    // runner refuses anything else, which would otherwise fail every turn.
    const candidateResume = typeof turnInput.resumeCursor === "string" ? turnInput.resumeCursor : this.threadSessions.get(turnInput.threadId);
    const resumeSessionId = isClaudeSessionId(candidateResume) ? candidateResume : undefined;

    const job: RelayJob = {
      id: jobId,
      instanceId,
      threadId: turnInput.threadId,
      turnId,
      prompt: turnInput.text,
      system: [turnInput.system, RELAY_NO_TOOLS_NOTE].filter(Boolean).join("\n\n"),
      model: turnInput.model,
      resumeSessionId,
      sent: false,
      cancelled: false,
      settled: false,
      sawStreamDelta: false,
      authFailed: false,
      lastLeaseAt: Date.now(),
      emit,
    };

    this.activeJobs.set(jobId, job);
    this.jobsByThread.set(turnInput.threadId, jobId);

    // If runner is polling right now, dispatch immediately
    if (this.pollWaiters.length > 0) {
      const waiter = this.pollWaiters.shift()!;
      job.sent = true;
      job.runnerTokenHash = waiter.tokenHash;
      job.lastLeaseAt = Date.now();
      waiter.resolve({
        id: job.id,
        prompt: job.prompt,
        system: job.system,
        model: job.model,
        resumeSessionId: job.resumeSessionId,
      });
    }

    return { turnId };
  }

  interruptTurn(threadId: string): void {
    const jobId = this.jobsByThread.get(threadId);
    if (!jobId) return;
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.cancelled = true;
    if (!job.settled) {
      const base: RuntimeEventBase = {
        eventId: newEventId(),
        provider: "claudeRelay",
        providerInstanceId: job.instanceId,
        threadId: job.threadId,
        turnId: job.turnId,
        createdAt: new Date().toISOString(),
      };
      job.emit({
        ...base,
        type: "turn.completed",
        ok: false,
        stopReason: "interrupted",
      });
      job.settled = true;
    }
    this.activeJobs.delete(jobId);
    this.jobsByThread.delete(threadId);
  }

  stopAll(): void {
    for (const threadId of Array.from(this.jobsByThread.keys())) {
      this.interruptTurn(threadId);
    }
  }
}

export const engineRelay = new EngineRelayManager();

export class ClaudeRelayDriver implements ProviderDriver {
  readonly driverKind = "claudeRelay";
  readonly metadata = {
    displayName: "Laptop Claude",
    access: "subscription" as const,
  };

  decodeConfig(_raw: unknown): unknown {
    return {};
  }

  defaultConfig(): unknown {
    return {};
  }

  readonly models: ModelCatalog = STATIC_CLAUDE_MODELS;

  async create(input: DriverCreateInput<unknown>): Promise<ProviderInstance> {
    const instanceId = input.instanceId;
    const displayName = input.displayName ?? "Laptop Claude";
    const models = STATIC_CLAUDE_MODELS;
    const listeners = new Set<RuntimeEventListener>();

    const emit = (event: RuntimeEvent) => {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {}
      }
    };

    const adapter: ProviderAdapter = {
      provider: "claudeRelay",
      capabilities: {
        sessionModelSwitch: "in-session",
        agentsMcp: false,
        computerMcp: false,
        composioMcp: false,
        phoneMcp: false,
        browserMcp: false,
        images: false,
        customMcp: false,
        localComputerMcp: false,
      },
      async sendTurn(turnInput: SendTurnInput): Promise<TurnStartResult> {
        return engineRelay.sendTurn(instanceId, turnInput, emit);
      },
      async interruptTurn(threadId: ThreadId, _turnId?: TurnId): Promise<void> {
        engineRelay.interruptTurn(threadId);
      },
      async respondToRequest(): Promise<RequestOutcome> {
        return "unavailable";
      },
      hasSession(threadId: ThreadId): boolean {
        return engineRelay.hasSession(threadId);
      },
      async stopAll(): Promise<void> {
        engineRelay.stopAll();
      },
      onEvent(listener: RuntimeEventListener): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };

    return {
      instanceId,
      driverKind: "claudeRelay",
      displayName,
      enabled: input.enabled,
      models,
      adapter,
      async snapshot(): Promise<ProviderSnapshot> {
        if (engineRelay.isRunnerConnected()) {
          return { state: "available" };
        }
        return {
          state: "unavailable",
          reason: "Laptop Claude is not connected. Start the runner from Settings → Engines → Laptop Claude.",
        };
      },
      async dispose(): Promise<void> {
        listeners.clear();
      },
    };
  }
}

export function withRelayInstance(configs: InstanceConfigMap): InstanceConfigMap {
  if (configs.laptopClaude || configs["laptop-claude"]) return configs;
  return {
    ...configs,
    laptopClaude: { driver: "claudeRelay", displayName: "Laptop Claude" },
  };
}
