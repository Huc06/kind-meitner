import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { writeFileAtomic } from "../atomic.ts";

export interface OkxCredentials {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  baseUrl?: string;
}

export interface OkxSignerConfig {
  credentials?: OkxCredentials;
  webhookSecret?: string;
  requireWebhookSecret?: boolean;
  ledgerFile?: string;
  cliPath?: string;
  fetchFn?: typeof fetch;
  commandRunner?: CommandRunner;
}

export type OkxTaskStatus =
  | "created"
  | "assigned"
  | "in_progress"
  | "delivered"
  | "rejected"
  | "disputed"
  | "resolved"
  | "completed"
  | "failed";

export interface OkxTaskRecord {
  id: string;
  externalTaskId?: string;
  aspId?: string;
  title: string;
  spec: string;
  deliverable?: string;
  rejectionReason?: string;
  status: OkxTaskStatus;
  escrowAmount?: number;
  token?: string;
  invoiceId?: string;
  txHash?: string;
  disputeId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export type OkxWebhookEventType =
  | "user_designated_agent"
  | "task_accepted"
  | "delivery_submitted"
  | "delivery_rejected"
  | "dispute_initiated"
  | "dispute_assigned"
  | "escrow_released";

export interface OkxWebhookEvent {
  id: string;
  type: OkxWebhookEventType;
  timestamp: number;
  data: {
    taskId?: string;
    disputeId?: string;
    aspId?: string;
    buyerId?: string;
    sellerId?: string;
    spec?: string;
    deliverable?: string;
    reason?: string;
    amount?: number;
    token?: string;
    [key: string]: unknown;
  };
}

export type CommandRunner = (
  command: string,
  args: string[],
  options?: { env?: Record<string, string> },
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

/**
 * Generates an OKX Developer Portal compliant HMAC-SHA256 signature.
 * Format: HMAC-SHA256(secretKey, timestamp + METHOD + requestPath + body).base64
 */
export function generateOkxSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  secretKey: string,
): string {
  const message = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  return createHmac("sha256", secretKey).update(message).digest("base64");
}

export interface WebhookVerificationOptions {
  /** Maximum acceptable drift in milliseconds between webhook timestamp and current time (default: 300,000ms / 5 minutes). Set to Infinity to disable drift check. */
  maxDriftMs?: number;
  /** Optional reference timestamp for testing (defaults to Date.now()). */
  now?: number;
}

/**
 * Parses numeric (seconds or milliseconds) or ISO-8601 date strings into epoch milliseconds.
 * Returns null if the timestamp string is invalid, negative, or not a parseable date.
 */
function parseWebhookTimestamp(ts: string): number | null {
  if (!ts || typeof ts !== "string") return null;
  const trimmed = ts.trim();
  if (!trimmed || trimmed.startsWith("-")) return null;

  // Numeric check (seconds or milliseconds)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) return null;
    // Numbers below 1e11 represent epoch seconds (e.g. 1.7e9 in 2026).
    // Convert seconds to milliseconds. Numbers >= 1e11 are already in milliseconds.
    return num < 1e11 ? Math.round(num * 1000) : Math.round(num);
  }

  // Plausible ISO-8601 or RFC-2822 date string starting with 4-digit year
  if (!/^\d{4}-\d{2}/.test(trimmed)) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Verifies webhook payload integrity and authenticity.
 * Employs timingSafeEqual to guard against timing attacks, strips format prefixes (sha256=, v1=),
 * supports uppercase/lowercase/mixed-case hex digests and base64 digests, and enforces timestamp replay tolerance.
 */
export function verifyWebhookSignature(
  signature: string,
  timestamp: string,
  rawBody: string,
  secret: string,
  options?: WebhookVerificationOptions,
): boolean {
  if (!signature || !timestamp || !secret) return false;
  try {
    // 1. Replay protection: validate timestamp freshness
    const tsMs = parseWebhookTimestamp(timestamp);
    if (tsMs === null) return false;

    const maxDriftMs = options?.maxDriftMs ?? 300_000;
    if (maxDriftMs >= 0 && Number.isFinite(maxDriftMs)) {
      const now = options?.now ?? Date.now();
      const drift = Math.abs(now - tsMs);
      if (drift > maxDriftMs) {
        return false;
      }
    }

    // 2. Strip format prefixes (e.g. sha256= or v1=) and trim whitespace
    let cleanSig = signature.trim();
    while (/^(?:sha256|v1)=/i.test(cleanSig)) {
      cleanSig = cleanSig.replace(/^(?:sha256|v1)=/i, "").trim();
    }
    if (!cleanSig) return false;

    const payload = `${timestamp}${rawBody}`;
    const expectedDigest = createHmac("sha256", secret).update(payload).digest();

    // 3. Test hex digest (case-insensitive: supports lowercase, uppercase, and mixed-case hex)
    const expectedHex = expectedDigest.toString("hex");
    const bufExpectedHex = Buffer.from(expectedHex, "utf8");
    const bufSigHex = Buffer.from(cleanSig.toLowerCase(), "utf8");
    if (bufExpectedHex.length === bufSigHex.length && timingSafeEqual(bufExpectedHex, bufSigHex)) {
      return true;
    }

    // 4. Test base64 digest (preserving original case)
    const expectedBase64 = expectedDigest.toString("base64");
    const bufExpectedBase64 = Buffer.from(expectedBase64, "utf8");
    const bufSigBase64 = Buffer.from(cleanSig, "utf8");
    if (bufExpectedBase64.length === bufSigBase64.length && timingSafeEqual(bufExpectedBase64, bufSigBase64)) {
      return true;
    }

    // 5. Test base64url digest if applicable
    const expectedBase64Url = expectedDigest.toString("base64url");
    const bufExpectedBase64Url = Buffer.from(expectedBase64Url, "utf8");
    if (bufExpectedBase64Url.length === bufSigBase64.length && timingSafeEqual(bufExpectedBase64Url, bufSigBase64)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Isolated Atomic Ledger for persisting OKX task and dispute states.
 */
export class OkxLedger {
  private readonly file?: string;
  private readonly tasks = new Map<string, OkxTaskRecord>();

  constructor(file?: string) {
    this.file = file;
    if (file && existsSync(file)) {
      try {
        const raw = readFileSync(file, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item.id === "string") {
              this.tasks.set(item.id, item);
            }
          }
        }
      } catch {
        // Fallback gracefully to clean in-memory state
      }
    }
  }

  private save(): void {
    if (!this.file) return;
    const dir = dirname(this.file);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data = JSON.stringify([...this.tasks.values()], null, 2);
    writeFileAtomic(this.file, data, { mode: 0o600 });
  }

  recordTask(task: OkxTaskRecord): void {
    this.tasks.set(task.id, { ...task, updatedAt: Date.now() });
    this.save();
  }

  getTask(idOrExternalId: string): OkxTaskRecord | undefined {
    const direct = this.tasks.get(idOrExternalId);
    if (direct) return direct;
    for (const t of this.tasks.values()) {
      if (t.externalTaskId === idOrExternalId) return t;
    }
    return undefined;
  }

  listTasks(filter?: { status?: OkxTaskStatus; aspId?: string }): OkxTaskRecord[] {
    const all = [...this.tasks.values()];
    return all.filter((t) => {
      if (filter?.status && t.status !== filter.status) return false;
      if (filter?.aspId && t.aspId !== filter.aspId) return false;
      return true;
    });
  }

  updateTaskStatus(
    id: string,
    status: OkxTaskStatus,
    patch?: Partial<Omit<OkxTaskRecord, "id" | "status" | "createdAt">>,
  ): OkxTaskRecord {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`OKX Task with ID ${id} not found in ledger`);
    }
    const updated: OkxTaskRecord = {
      ...existing,
      ...patch,
      status,
      updatedAt: Date.now(),
    };
    this.tasks.set(id, updated);
    this.save();
    return updated;
  }
}

/**
 * CLI Signer Wrapper for executing onchainos commands with isolated keys.
 */
export class OkxCliSigner {
  private readonly cliPath: string;
  private readonly runner: CommandRunner;

  constructor(cliPath = "onchainos", runner?: CommandRunner) {
    this.cliPath = cliPath;
    this.runner = runner ?? (async (cmd, args) => {
      throw new Error(
        `CLI runner unconfigured. Attempted to run: ${cmd} ${args.join(" ")}`,
      );
    });
  }

  async agentCreate(
    name: string,
    description: string,
    options?: { privateKey?: string; category?: string },
  ): Promise<{ agentId: string; address: string; stdout: string }> {
    const args = ["agent", "create", "--name", name, "--desc", description];
    if (options?.category) {
      args.push("--category", options.category);
    }
    const env: Record<string, string> = {};
    if (options?.privateKey) {
      env.ONCHAINOS_PRIVATE_KEY = options.privateKey;
    }
    const res = await this.runner(this.cliPath, args, { env });
    if (res.exitCode !== 0) {
      throw new Error(`Failed to create agent: ${res.stderr || res.stdout}`);
    }
    let agentId = "";
    let address = "";
    try {
      const parsed = JSON.parse(res.stdout);
      agentId = parsed.agentId ?? "";
      address = parsed.address ?? "";
    } catch {
      // Parse plain text output if CLI returns formatted strings
      const idMatch = res.stdout.match(/agent\s*id[:=]\s*([a-zA-Z0-9_-]+)/i);
      const addrMatch = res.stdout.match(/address[:=]\s*(0x[a-fA-F0-9]{40})/i);
      agentId = idMatch?.[1] ?? "";
      address = addrMatch?.[1] ?? "";
    }
    if (!agentId || !address) {
      throw new Error(`Failed to create agent: could not parse agentId or address from output: ${res.stdout}`);
    }
    return { agentId, address, stdout: res.stdout };
  }

  async agentActivate(agentId: string): Promise<{ success: boolean; txHash?: string }> {
    const args = ["agent", "activate", "--agent-id", agentId];
    const res = await this.runner(this.cliPath, args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to activate agent ${agentId}: ${res.stderr || res.stdout}`);
    }
    const txMatch = res.stdout.match(/tx[:=]\s*(0x[a-fA-F0-9]{64})/i);
    return { success: true, txHash: txMatch?.[1] };
  }

  async agentAccept(taskId: string): Promise<{ success: boolean; txHash?: string }> {
    const args = ["agent", "accept", "--task-id", taskId];
    const res = await this.runner(this.cliPath, args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to accept agent task ${taskId}: ${res.stderr || res.stdout}`);
    }
    const txMatch = res.stdout.match(/tx[:=]\s*(0x[a-fA-F0-9]{64})/i);
    return { success: true, txHash: txMatch?.[1] };
  }

  async agentReject(taskId: string, reason: string): Promise<{ success: boolean; txHash?: string }> {
    const args = ["agent", "reject", "--task-id", taskId, "--reason", reason];
    const res = await this.runner(this.cliPath, args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to reject agent task ${taskId}: ${res.stderr || res.stdout}`);
    }
    const txMatch = res.stdout.match(/tx[:=]\s*(0x[a-fA-F0-9]{64})/i);
    return { success: true, txHash: txMatch?.[1] };
  }

  async agentDeliver(
    taskId: string,
    deliverableContent: string,
  ): Promise<{ success: boolean; txHash?: string }> {
    const args = ["agent", "deliver", "--task-id", taskId, "--data", deliverableContent];
    const res = await this.runner(this.cliPath, args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to deliver task ${taskId}: ${res.stderr || res.stdout}`);
    }
    const txMatch = res.stdout.match(/tx[:=]\s*(0x[a-fA-F0-9]{64})/i);
    return { success: true, txHash: txMatch?.[1] };
  }

  async agentPayment(
    invoiceId: string,
    amount: number,
    token = "USDT",
  ): Promise<{ success: boolean; txHash: string }> {
    const args = [
      "agent",
      "payment",
      "--invoice-id",
      invoiceId,
      "--amount",
      String(amount),
      "--token",
      token,
    ];
    const res = await this.runner(this.cliPath, args);
    if (res.exitCode !== 0) {
      throw new Error(`Payment for invoice ${invoiceId} failed: ${res.stderr || res.stdout}`);
    }
    const txMatch = res.stdout.match(/tx[:=]\s*(0x[a-fA-F0-9]{64})/i);
    const txHash = txMatch?.[1];
    if (!txHash) {
      throw new Error(`Payment for invoice ${invoiceId} failed: no valid transaction hash found in CLI output: ${res.stdout}`);
    }
    return { success: true, txHash };
  }

  async evaluatorVote(
    disputeId: string,
    verdict: string,
    rationaleOrData: string,
  ): Promise<{ success: boolean; txHash?: string }> {
    const args = [
      "evaluator",
      "vote",
      "--dispute-id",
      disputeId,
      "--verdict",
      verdict,
      "--data",
      rationaleOrData,
    ];
    const res = await this.runner(this.cliPath, args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to submit evaluator vote for dispute ${disputeId}: ${res.stderr || res.stdout}`);
    }
    const txMatch = res.stdout.match(/tx[:=]\s*(0x[a-fA-F0-9]{40,64})/i);
    return { success: true, txHash: txMatch?.[1] };
  }

  async evaluatorClaim(disputeId: string): Promise<{ success: boolean; txHash?: string; amount?: number }> {
    const args = ["evaluator", "claim", "--dispute-id", disputeId];
    const res = await this.runner(this.cliPath, args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to claim evaluator fee for dispute ${disputeId}: ${res.stderr || res.stdout}`);
    }
    let txHash: string | undefined;
    let amount: number | undefined;
    try {
      const parsed = JSON.parse(res.stdout);
      if (parsed.txHash) txHash = parsed.txHash;
      if (typeof parsed.amount === "number") amount = parsed.amount;
      else if (typeof parsed.amount === "string") amount = parseFloat(parsed.amount);
    } catch {
      // Fallback to text parsing
    }
    if (!txHash) {
      const txMatch = res.stdout.match(/tx[:=]\s*(0x[a-fA-F0-9]{64})/i);
      txHash = txMatch?.[1];
    }
    if (amount === undefined) {
      const amountMatch = res.stdout.match(/(?:amount|reward|fee)[:=]\s*(\d+(?:\.\d+)?)/i);
      if (amountMatch) amount = parseFloat(amountMatch[1]);
    }
    return { success: true, txHash, amount };
  }

  async walletBalance(address?: string): Promise<{ okb: number; usdt: number }> {
    const args = ["wallet", "balance", ...(address ? ["--address", address] : [])];
    const res = await this.runner(this.cliPath, args);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to fetch wallet balance${address ? ` for ${address}` : ""}: ${res.stderr || res.stdout}`);
    }
    let okb = 0;
    let usdt = 0;
    try {
      const parsed = JSON.parse(res.stdout);
      if (typeof parsed.okb === "number") okb = parsed.okb;
      else if (typeof parsed.OKB === "number") okb = parsed.OKB;
      else if (parsed.balances) {
        if (typeof parsed.balances.okb === "number") okb = parsed.balances.okb;
        if (typeof parsed.balances.OKB === "number") okb = parsed.balances.OKB;
      }

      if (typeof parsed.usdt === "number") usdt = parsed.usdt;
      else if (typeof parsed.USDT === "number") usdt = parsed.USDT;
      else if (parsed.balances) {
        if (typeof parsed.balances.usdt === "number") usdt = parsed.balances.usdt;
        if (typeof parsed.balances.USDT === "number") usdt = parsed.balances.USDT;
      }
      return { okb, usdt };
    } catch {
      const okbMatch = res.stdout.match(/okb[:=\s]+(\d+(?:\.\d+)?)/i);
      const usdtMatch = res.stdout.match(/usdt[:=\s]+(\d+(?:\.\d+)?)/i);
      if (okbMatch) okb = parseFloat(okbMatch[1]);
      if (usdtMatch) usdt = parseFloat(usdtMatch[1]);
      return { okb, usdt };
    }
  }
}

/**
 * OKX Developer Portal Gateway Client.
 * Bridges authenticated API interactions, webhooks, and ledger tracking.
 */
export class OkxGateway extends EventEmitter {
  readonly credentials?: OkxCredentials;
  readonly ledger: OkxLedger;
  readonly cli: OkxCliSigner;
  public handshakeErrorCount = 0;
  private readonly webhookSecret?: string;
  private readonly requireWebhookSecret: boolean;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: OkxSignerConfig = {}) {
    super();
    this.credentials = config.credentials;
    this.webhookSecret = config.webhookSecret;
    this.requireWebhookSecret = config.requireWebhookSecret ?? false;
    this.baseUrl = config.credentials?.baseUrl ?? "https://web3.okx.com";
    this.ledger = new OkxLedger(config.ledgerFile);
    this.cli = new OkxCliSigner(config.cliPath, config.commandRunner);
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  /**
   * Generates authorization headers for an OKX Developer Portal API call.
   */
  getAuthHeaders(method: string, path: string, body = ""): Record<string, string> {
    if (!this.credentials) {
      throw new Error("OKX credentials missing. Configure apiKey, secretKey, and passphrase.");
    }
    const timestamp = new Date().toISOString();
    const sign = generateOkxSignature(
      timestamp,
      method,
      path,
      body,
      this.credentials.secretKey,
    );
    return {
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": this.credentials.apiKey,
      "OK-ACCESS-SIGN": sign,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": this.credentials.passphrase,
    };
  }

  /**
   * Authenticated API request execution with 90s timeout cap and 429 Retry-After backoff.
   */
  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    bodyData?: unknown,
    options?: { timeoutMs?: number; connectId?: string; maxRetries?: number },
  ): Promise<T> {
    const timeoutMs = options?.timeoutMs ?? 90_000;
    const maxRetries = options?.maxRetries ?? 3;
    const connectId = options?.connectId ?? randomUUID();
    const deadline = Date.now() + timeoutMs;
    const bodyStr = bodyData ? JSON.stringify(bodyData) : "";
    const url = `${this.baseUrl}${path}`;

    let attempt = 0;

    while (true) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        throw new Error("RPC timeout exceeded 90s limit");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort(new Error("RPC timeout exceeded 90s limit"));
      }, remainingMs);

      try {
        const headers = {
          ...this.getAuthHeaders(method, path, bodyStr),
          "x-connect-id": connectId,
        };

        const res = await this.fetchFn(url, {
          method,
          headers,
          body: method !== "GET" ? bodyStr : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.status === 429 || res.status === 503) {
          this.handshakeErrorCount++;
          attempt++;
          if (attempt > maxRetries || Date.now() >= deadline) {
            throw new Error(`OKX RPC rate limited (${res.status}) after ${attempt} retries`);
          }

          const retryAfter = res.headers?.get?.("retry-after");
          let delayMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 0;
          if (!delayMs || Number.isNaN(delayMs)) {
            delayMs = Math.min(10_000, 500 * Math.pow(2, attempt) + Math.random() * 200);
          }

          if (Date.now() + delayMs >= deadline) {
            throw new Error("RPC timeout exceeded 90s limit during 429 backoff");
          }

          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`OKX API error ${res.status} on ${path}: ${errText}`);
        }

        return (await res.json()) as T;
      } catch (err) {
        clearTimeout(timer);
        if (
          (err instanceof Error && (err.name === "AbortError" || err.message.includes("RPC timeout"))) ||
          controller.signal.aborted
        ) {
          throw new Error("RPC timeout exceeded 90s limit");
        }
        throw err;
      }
    }
  }

  /**
   * Posts a new task to the OKX Onchain OS marketplace.
   */
  async postTask(params: {
    title: string;
    spec: string;
    budget: number;
    token?: string;
    targetAspId?: string;
  }): Promise<OkxTaskRecord> {
    const taskId = `okx-task-${randomUUID().slice(0, 8)}`;
    const invoiceId = `inv-${randomUUID().slice(0, 8)}`;

    const record: OkxTaskRecord = {
      id: taskId,
      title: params.title,
      spec: params.spec,
      aspId: params.targetAspId,
      status: "created",
      escrowAmount: params.budget,
      token: params.token ?? "USDT",
      invoiceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // If credentials are provided, register with remote Developer Portal
    if (this.credentials) {
      try {
        const response = await this.request<{ externalTaskId?: string }>(
          "POST",
          "/api/v5/agent/tasks/create",
          {
            title: params.title,
            spec: params.spec,
            aspId: params.targetAspId,
            budget: params.budget,
            token: params.token ?? "USDT",
          },
        );
        if (response.externalTaskId) {
          record.externalTaskId = response.externalTaskId;
        }
      } catch {
        // Fallback to local ledger in offline or test mode
      }
    }

    this.ledger.recordTask(record);
    return record;
  }

  /**
   * Submits an Evaluator dispute resolution vote to the OKX Developer Portal or CLI.
   */
  async submitDisputeResolution(params: {
    disputeId: string;
    verdict: string;
    rubricScore: number;
    refundRatio: number;
    rationale: string;
  }): Promise<{ success: boolean; txHash?: string }> {
    if (this.credentials) {
      try {
        const response = await this.request<{ txHash?: string }>(
          "POST",
          "/api/v5/agent/disputes/vote",
          params,
        );
        if (response?.txHash) {
          return { success: true, txHash: response.txHash };
        }
      } catch {
        // Fallback to CLI signer or offline test double
      }
    }
    return this.cli.evaluatorVote(
      params.disputeId,
      params.verdict,
      JSON.stringify(params),
    );
  }

  /**
   * Webhook Ingress processor. Validates and normalizes events.
   * Enforces webhook signature authentication when secret is configured, required, or outside dev/test mode.
   */
  handleWebhook(
    rawBody: string,
    headers: Record<string, string | undefined> = {},
    options?: { requireSecret?: boolean; maxDriftMs?: number },
  ): OkxWebhookEvent {
    const lowerHeaders: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(headers)) {
      lowerHeaders[k.toLowerCase()] = v;
    }
    const sig = lowerHeaders["x-okx-signature"] ?? lowerHeaders["ok-webhook-signature"] ?? "";
    const ts = lowerHeaders["x-okx-timestamp"] ?? lowerHeaders["ok-webhook-timestamp"] ?? "";

    if (this.webhookSecret) {
      if (!verifyWebhookSignature(sig, ts, rawBody, this.webhookSecret, { maxDriftMs: options?.maxDriftMs })) {
        throw new Error("Invalid webhook signature");
      }
    } else {
      const isTestOrDev = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
      const hasSignature = Boolean(sig || ts);
      if (this.requireWebhookSecret || options?.requireSecret || !isTestOrDev || hasSignature) {
        throw new Error("Webhook secret is not configured");
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error("Invalid JSON in webhook payload");
    }

    const event: OkxWebhookEvent = {
      id: payload.id ?? `evt-${randomUUID().slice(0, 8)}`,
      type: payload.type ?? payload.event ?? "user_designated_agent",
      timestamp: payload.timestamp ?? Date.now(),
      data: payload.data ?? payload,
    };

    // Reflect state changes into local ledger
    if (event.data.taskId) {
      const existing = this.ledger.getTask(event.data.taskId);
      if (existing) {
        if (event.type === "task_accepted") {
          this.ledger.updateTaskStatus(existing.id, "in_progress");
        } else if (event.type === "delivery_submitted") {
          this.ledger.updateTaskStatus(existing.id, "delivered", {
            deliverable: event.data.deliverable,
            metadata: {
              ...existing.metadata,
              deliveredAt: event.timestamp || Date.now(),
            },
          });
        } else if (event.type === "delivery_rejected") {
          this.ledger.updateTaskStatus(existing.id, "rejected", {
            rejectionReason: event.data.reason,
          });
        } else if (event.type === "dispute_assigned" || event.type === "dispute_initiated") {
          this.ledger.updateTaskStatus(existing.id, "disputed", {
            disputeId: event.data.disputeId,
          });
        } else if (event.type === "escrow_released") {
          this.ledger.updateTaskStatus(existing.id, "completed");
        }
      }
    }

    this.emit(event.type, event);
    this.emit("webhook_event", event);

    return event;
  }
}
