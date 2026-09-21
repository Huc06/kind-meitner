// Standalone local OKX server — see docs/plans/okx-local-server-hosted-ui-split.md
//
// Runs only the OKX routes that read a real OKX credential
// (OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE) or the x402 testnet
// configuration. Always binds 127.0.0.1, regardless of any environment
// variable that would make the main server (server/index.ts) bind
// publicly — this process must never be reachable from outside the
// machine it runs on. A hosted UI (e.g. on Railway) is expected to call
// into this process from the same machine's browser; the CORS allowlist
// below is what makes that possible without opening the port to anyone
// else.
//
// This file intentionally duplicates route bodies from server/index.ts
// rather than importing them, because those routes are private closures
// inside handleRequest there. It reuses every OKX domain class unchanged
// from server/okx/*.ts so behavior stays identical to the main server.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { join } from "node:path";

import { DATA_DIR } from "./config.ts";
import { OkxGateway } from "./okx/gateway.ts";
import { OkxTreasuryManager } from "./okx/scheduler.ts";
import { OkxWebhookJournal } from "./okx/journal.ts";
import { OkxMarketplaceIntelligence, verifyEip3009Payment } from "./okx/intelligence.ts";
import { OkxDisputeEvaluator } from "./okx/evaluator.ts";
import { X402_TESTNET_RESOURCE_PATH, X402TestnetResource, x402PublicFailure } from "./okx/x402-testnet.ts";
import { okxCredentialsStorePath, readStoredOkxCredentials } from "./okx-credentials-store.ts";

const LOCAL_HOST = "127.0.0.1";
const DEFAULT_PORT = Number(process.env.OKX_LOCAL_SERVER_PORT ?? 8899);
// Tried in order when the requested port is already in use. Mirrors the
// idea (not the exact list) of picking from a small set of known-free
// candidates rather than failing outright on the first busy port.
const PORT_FALLBACKS = [8899, 8898, 8897, 8896, 8009, 8010];

// Printed once at startup, never logged again. Sensitive routes (anything
// that can move funds, write server-only configuration, or accept a
// webhook/payment) require this exact value in the x-okx-pairing-token
// header. Reachability alone (CORS/localhost) is not enough for those —
// anything on this machine that can guess an open port should still not
// be able to drive a payment without the value the human operator saw
// printed in their own terminal.
export const PAIRING_TOKEN = randomUUID().replace(/-/g, "");

const PAIRING_TOKEN_BUFFER = Buffer.from(PAIRING_TOKEN, "utf8");

function requiresPairingToken(method: string, path: string): boolean {
  if (method === "POST" && path === "/api/okx/settings") return true;
  if (method === "POST" && path === "/api/okx/webhook") return true;
  if (method === "POST" && path === "/api/okx/mcp") return true;
  if (method === "POST" && path === X402_TESTNET_RESOURCE_PATH) return true;
  return false;
}

/** Constant-time comparison against the pairing token. A plain `===`
 * short-circuits on the first mismatched byte, and CORS/localhost is not
 * a real access-control layer for these routes (any non-browser client on
 * the machine reaches them regardless of Origin) — this token check is
 * the one gate that actually matters, so it must not leak timing
 * information about how many leading characters an attacker guessed
 * correctly. timingSafeEqual requires equal-length buffers; a length
 * mismatch is rejected immediately, which leaks only "wrong length" —
 * the same thing an attacker already knows from generating the guess. */
function hasValidPairingToken(req: IncomingMessage): boolean {
  const provided = req.headers["x-okx-pairing-token"];
  const value = Array.isArray(provided) ? provided[0] : provided;
  if (typeof value !== "string") return false;
  const providedBuffer = Buffer.from(value, "utf8");
  if (providedBuffer.length !== PAIRING_TOKEN_BUFFER.length) return false;
  return timingSafeEqual(providedBuffer, PAIRING_TOKEN_BUFFER);
}

// Never a wildcard: this process holds real OKX credentials, so only
// origins the user explicitly trusts may call it from a browser.
// KIND_MEITNER_OKX_ALLOWED_ORIGINS is a comma-separated list; localhost
// origins at any port are always allowed since they can only mean "this
// machine" already.
const configuredOrigins = (process.env.KIND_MEITNER_OKX_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (configuredOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin!);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-connect-id, x-payment-from, x-force-rate-limit, x-force-timeout, x-okx-pairing-token");
  }
}

function json(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(data);
}

function readRawBody(req: IncomingMessage, limit = 1_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    let done = false;
    req.on("data", (chunk) => {
      if (done) return;
      bytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      if (bytes > limit) {
        done = true;
        reject(Object.assign(new Error("body too large"), { status: 413 }));
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (done) return;
      done = true;
      resolve(data);
    });
    req.on("error", (err) => {
      if (done) return;
      done = true;
      reject(err);
    });
  });
}

async function readJsonBody(req: IncomingMessage, limit = 16384): Promise<any> {
  const raw = await readRawBody(req, limit);
  if (!raw) return {};
  return JSON.parse(raw);
}

function requestSource(req: IncomingMessage): string {
  return (req.headers["x-connect-id"] as string) || req.socket?.remoteAddress || "unknown";
}

// ── OKX domain state, same shape as server/index.ts ──

export type OkxCredentialSource = "env" | "stored" | "missing";

/** Env vars win when set (matches every other OKX_* override in this repo);
 * otherwise falls back to the 0600 file written by `pnpm okx-serve setup`.
 * Returns the source alongside the credentials so the startup banner can
 * say exactly where they came from instead of just "configured or not". */
function resolveOkxCredentials(): { credentials: ReturnType<typeof readStoredOkxCredentials>; source: OkxCredentialSource } {
  const apiKey = process.env.OKX_API_KEY?.trim();
  const secretKey = process.env.OKX_SECRET_KEY?.trim();
  const passphrase = process.env.OKX_PASSPHRASE?.trim();
  if (apiKey && secretKey && passphrase) {
    const baseUrl = process.env.OKX_API_BASE_URL?.trim();
    return { credentials: { apiKey, secretKey, passphrase, ...(baseUrl ? { baseUrl } : {}) }, source: "env" };
  }
  const stored = readStoredOkxCredentials();
  if (stored) return { credentials: stored, source: "stored" };
  return { credentials: undefined, source: "missing" };
}

const { credentials: resolvedOkxCredentials, source: okxCredentialSource } = resolveOkxCredentials();

const okxWebhookJournal = new OkxWebhookJournal(join(DATA_DIR, "okx-webhook-journal.json"));
const okxGateway = new OkxGateway({
  ledgerFile: join(DATA_DIR, "okx-tasks.json"),
  credentials: resolvedOkxCredentials,
  webhookSecret: process.env.OKX_WEBHOOK_SECRET,
});
const okxTreasury = new OkxTreasuryManager({
  balance: 200,
  maxPerRunSpend: 50,
  monthlyBudgetCap: 500,
  file: join(DATA_DIR, "okx-treasury.json"),
});
const okxIntelligence = new OkxMarketplaceIntelligence({
  storageFile: join(DATA_DIR, "okx-intelligence.json"),
  queryFeeUsdt: 0.05,
});
const okxEvaluator = new OkxDisputeEvaluator({
  storageFile: join(DATA_DIR, "okx-evaluator.json"),
});
const okxX402Testnet = new X402TestnetResource({
  enabled: process.env.OKX_X402_TESTNET_ENABLED === "true",
  apiKey: resolvedOkxCredentials?.apiKey,
  secretKey: resolvedOkxCredentials?.secretKey,
  passphrase: resolvedOkxCredentials?.passphrase,
  payTo: process.env.OKX_X402_TESTNET_PAY_TO?.trim(),
  resourceUrl: process.env.OKX_X402_TESTNET_RESOURCE_URL?.trim(),
  price: process.env.OKX_X402_TESTNET_PRICE?.trim(),
});

const legacyEip3009PaidMcpEnabled = process.env.OKX_LEGACY_EIP3009_ENABLED === "true";
const okxMcpRateLimits = new Map<string, number[]>();
function checkOkxMcpRateLimit(caller: string, limit = 60, windowMs = 60_000): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const timestamps = (okxMcpRateLimits.get(caller) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }
  timestamps.push(now);
  okxMcpRateLimits.set(caller, timestamps);
  return { allowed: true, retryAfter: 0 };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  applyCors(req, res);
  const method = req.method ?? "GET";
  const path = (req.url ?? "/").split("?")[0];

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (requiresPairingToken(method, path) && !hasValidPairingToken(req)) {
    return json(res, 401, {
      error: "This action requires the pairing token printed in this server's terminal on startup.",
    });
  }

  try {
    if (method === "GET" && path === "/api/health") {
      return json(res, 200, { ok: true, service: "kind-meitner-okx-local-server" });
    }

    // ── Webhook ingress ──
    if (method === "POST" && path === "/api/okx/webhook") {
      try {
        const rawBody = await readRawBody(req);
        if (process.env.OKX_WEBHOOK_SECRET && !(okxGateway as any).webhookSecret) {
          (okxGateway as any).webhookSecret = process.env.OKX_WEBHOOK_SECRET;
        }
        const flatHeaders: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          flatHeaders[k] = Array.isArray(v) ? v[0] : v;
        }
        const event = okxGateway.handleWebhook(rawBody, flatHeaders, { requireSecret: true });
        if (okxWebhookJournal.has(event.id)) {
          return json(res, 200, { ok: true, status: "duplicate", eventId: event.id });
        }
        okxWebhookJournal.record(event);
        if (typeof (okxGateway as any).emit === "function") {
          (okxGateway as any).emit("webhook", event);
        }
        return json(res, 200, { ok: true, status: "ok", eventId: event.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status =
          (err as any).status ??
          (message.includes("Invalid webhook signature") || message.includes("Webhook secret")
            ? 401
            : message.includes("Invalid JSON")
              ? 400
              : 500);
        return json(res, status, { error: message });
      }
    }

    // ── Legacy custom EIP-3009 paid MCP: disabled by default ──
    if (method === "POST" && path === "/api/okx/mcp") {
      const startTime = Date.now();
      const connectId = (req.headers["x-connect-id"] as string) || randomUUID();
      res.setHeader("x-connect-id", connectId);
      if (!legacyEip3009PaidMcpEnabled) {
        res.setHeader("x-time-to-session", String(Date.now() - startTime));
        return json(res, 410, {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32004,
            message: "Legacy EIP-3009 paid MCP is disabled. Use /api/okx/free-mcp; x402 testnet support is a separate reviewed feature.",
          },
        });
      }

      const callerKey = (req.headers["x-payment-from"] as string) || (req.socket?.remoteAddress ?? "unknown");
      const rateCheck = checkOkxMcpRateLimit(callerKey);
      if (!rateCheck.allowed || req.headers["x-force-rate-limit"] === "true") {
        res.setHeader("retry-after", String(rateCheck.retryAfter || 10));
        res.setHeader("x-time-to-session", String(Date.now() - startTime));
        return json(res, 429, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32000, message: "Too many requests: Rate limit exceeded" },
        });
      }

      if (req.headers["x-force-timeout"] === "true") {
        res.setHeader("x-time-to-session", String(Date.now() - startTime));
        return json(res, 504, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32000, message: "Gateway Timeout: RPC exceeded 90s limit" },
        });
      }

      try {
        const rawBody = await readRawBody(req);
        let rpc: any;
        try {
          rpc = JSON.parse(rawBody);
        } catch {
          res.setHeader("x-time-to-session", String(Date.now() - startTime));
          return json(res, 400, {
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error: Invalid JSON" },
          });
        }

        const flatHeaders: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          flatHeaders[k] = Array.isArray(v) ? v[0] : v;
        }

        if (rpc.method === "tools/list") {
          res.setHeader("x-time-to-session", String(Date.now() - startTime));
          return json(res, 200, {
            jsonrpc: "2.0",
            id: rpc.id ?? null,
            result: { tools: okxIntelligence.getToolDeclarations() },
          });
        }

        if (rpc.method === "ping" || rpc.method === "initialize") {
          res.setHeader("x-time-to-session", String(Date.now() - startTime));
          return json(res, 200, {
            jsonrpc: "2.0",
            id: rpc.id ?? null,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { name: "okx-intelligence", version: "1.0.0" },
            },
          });
        }

        if (rpc.method === "tools/call") {
          const payCheck = verifyEip3009Payment(flatHeaders);
          if (!payCheck.valid) {
            res.setHeader("x-time-to-session", String(Date.now() - startTime));
            return json(res, payCheck.status ?? 402, {
              jsonrpc: "2.0",
              id: rpc.id ?? null,
              error: { code: -32002, message: payCheck.error },
              requiredFee: 0.05,
              token: "USDT",
            });
          }

          const nonce = payCheck.payment!.nonce;
          if (!okxIntelligence.redeemNonce(nonce)) {
            res.setHeader("x-time-to-session", String(Date.now() - startTime));
            return json(res, 400, {
              jsonrpc: "2.0",
              id: rpc.id ?? null,
              error: { code: -32602, message: "Payment nonce has already been redeemed" },
            });
          }

          const toolName = rpc.params?.name;
          const toolArgs = (rpc.params?.arguments as Record<string, unknown>) ?? {};
          const result = await okxIntelligence.handleMcpToolCall(toolName, toolArgs, payCheck.payment!.from);

          res.setHeader("x-time-to-session", String(Date.now() - startTime));
          return json(res, 200, {
            jsonrpc: "2.0",
            id: rpc.id ?? null,
            result,
          });
        }

        res.setHeader("x-time-to-session", String(Date.now() - startTime));
        return json(res, 400, {
          jsonrpc: "2.0",
          id: rpc.id ?? null,
          error: { code: -32601, message: `Method not found: ${rpc.method}` },
        });
      } catch (err) {
        res.setHeader("x-time-to-session", String(Date.now() - startTime));
        const message = err instanceof Error ? err.message : String(err);
        const isTimeout = message.includes("timeout") || message.includes("504") || (err as any).status === 504;
        const statusCode = isTimeout ? 504 : 500;
        return json(res, statusCode, {
          jsonrpc: "2.0",
          id: null,
          error: { code: isTimeout ? -32000 : -32603, message },
        });
      }
    }

    // ── OKX subsystem REST APIs ──
    if (method === "GET" && path === "/api/okx/intelligence") {
      const overview = okxIntelligence.getMarketOverview();
      const asps = okxIntelligence.listAsps();
      const benchmarks = okxIntelligence.getCategoryBenchmarks();
      return json(res, 200, { overview, asps, benchmarks });
    }

    if (method === "GET" && path === "/api/okx/disputes") {
      const deliberations = [...((okxEvaluator as any).deliberations?.values?.() ?? [])];
      return json(res, 200, {
        disputes: deliberations,
        okbStaked: okxEvaluator.getOkbStake(),
        totalFeesEarned: okxEvaluator.getFeeRecords().reduce((acc, f) => acc + f.feeAmount, 0),
      });
    }

    if (method === "GET" && path === "/api/okx/treasury") {
      const reservations = [...((okxTreasury as any).reservations?.values?.() ?? [])];
      return json(res, 200, {
        balance: okxTreasury.getBalance(),
        availableBalance: okxTreasury.getAvailableBalance(),
        monthlySpent: okxTreasury.getMonthlySpend(),
        monthlyBudgetCap: okxTreasury.getMonthlyBudgetCap(),
        maxPerRunSpend: okxTreasury.getMaxPerRunSpend(),
        reservations,
      });
    }

    if (method === "POST" && path === "/api/okx/settings") {
      const body = await readJsonBody(req);
      if (body && typeof body === "object") {
        const secretFields = ["apiKey", "secretKey", "passphrase", "webhookSecret", "baseUrl"]
          .filter((field) => Object.prototype.hasOwnProperty.call(body, field));
        if (secretFields.length) {
          return json(res, 400, {
            error: `OKX credentials are server-only and cannot be set at runtime (${secretFields.join(", ")}). Configure this local server's own environment instead.`,
          });
        }
        if (typeof body.treasuryBalance === "number") {
          okxTreasury.deposit(body.treasuryBalance);
        }
        return json(res, 200, { ok: true });
      }
      return json(res, 400, { error: "Invalid settings format" });
    }

    if (method === "GET" && path === "/api/okx/settings") {
      const creds = okxGateway.credentials;
      return json(res, 200, {
        credentialsConfigured: Boolean(creds?.apiKey && creds.secretKey && creds.passphrase),
        webhookSecretConfigured: Boolean((okxGateway as any).webhookSecret),
        treasuryBalance: okxTreasury.getBalance(),
        maxPerRunSpend: okxTreasury.getMaxPerRunSpend(),
        monthlyBudgetCap: okxTreasury.getMonthlyBudgetCap(),
      });
    }

    // ── Official x402 testnet resource: disabled by default ──
    if (method === "POST" && path === X402_TESTNET_RESOURCE_PATH) {
      const startTime = Date.now();
      const connectId = (req.headers["x-connect-id"] as string) || randomUUID();
      res.setHeader("x-connect-id", connectId);
      const respond = (statusCode: number, body: unknown) => {
        res.setHeader("x-time-to-session", String(Date.now() - startTime));
        return json(res, statusCode, body);
      };
      const status = okxX402Testnet.status();
      if (!status.enabled) {
        return respond(404, { error: "x402 testnet is disabled", traceId: connectId });
      }
      if (!status.ready) {
        console.warn("x402 testnet configuration is incomplete", { traceId: connectId });
        return respond(503, { error: "x402 testnet is unavailable", traceId: connectId });
      }
      const rateCheck = checkOkxMcpRateLimit(`x402:${requestSource(req)}`, 60, 60_000);
      if (!rateCheck.allowed) {
        res.setHeader("retry-after", String(rateCheck.retryAfter));
        return respond(429, { error: "Too many requests: Rate limit exceeded", traceId: connectId });
      }

      try {
        const rawBody = await readRawBody(req);
        let parsedBody: unknown = undefined;
        if (rawBody) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            return respond(400, { error: "x402 testnet resource expects a JSON request body", traceId: connectId });
          }
        }
        const adapter = {
          getHeader: (name: string) => {
            const value = req.headers[name.toLowerCase()];
            return Array.isArray(value) ? value[0] : value;
          },
          getMethod: () => method,
          getPath: () => path,
          getUrl: () => okxX402Testnet.resourceUrl() || path,
          getAcceptHeader: () => String(req.headers.accept ?? ""),
          getUserAgent: () => String(req.headers["user-agent"] ?? ""),
          getBody: () => parsedBody,
        };
        const processed = await okxX402Testnet.process(adapter);
        if (processed.type === "payment-error") {
          for (const [name, value] of Object.entries(processed.response.headers)) res.setHeader(name, value);
          return respond(processed.response.status, processed.response.body ?? {});
        }
        if (processed.type !== "payment-verified") {
          console.warn("x402 testnet route unexpectedly skipped payment", { traceId: connectId });
          return respond(500, x402PublicFailure(connectId));
        }

        const resource = {
          mode: "x402-testnet",
          network: "eip155:1952",
          provenance: "kind-meitner local registry and public OKX.AI setup guidance",
          data: { benchmarks: okxIntelligence.getCategoryBenchmarks() },
        };
        const settlement = await okxX402Testnet.settle(adapter, processed, Buffer.from(JSON.stringify(resource)));
        if (!settlement.success) {
          for (const [name, value] of Object.entries(settlement.response.headers)) res.setHeader(name, value);
          return respond(settlement.response.status, settlement.response.body ?? {});
        }
        for (const [name, value] of Object.entries(settlement.headers)) res.setHeader(name, value);
        return respond(200, {
          ...resource,
          settlement: {
            status: settlement.status,
            transaction: settlement.transaction,
            network: settlement.network,
            amount: settlement.amount,
          },
        });
      } catch (err) {
        console.warn("x402 testnet processing failed", {
          traceId: connectId,
          errorType: err instanceof Error ? err.name : typeof err,
        });
        return respond(502, x402PublicFailure(connectId));
      }
    }

    return json(res, 404, { error: "not found" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = (err as any).status ?? 500;
    return json(res, status, { error: message });
  }
}

/** What this specific process can actually do right now, given the
 * environment it was started with. Printed at startup so "why doesn't
 * X work" has an immediate, honest answer instead of a silent 404/503
 * discovered later through the browser. */
function describeRouteReadiness(): { line: string; ready: boolean }[] {
  const hasCreds = okxCredentialSource !== "missing";
  const credentialSourceLabel =
    okxCredentialSource === "env" ? "from OKX_API_KEY/SECRET/PASSPHRASE env vars" :
    okxCredentialSource === "stored" ? `from ${okxCredentialsStorePath()} (run \`pnpm okx-setup\` to change)` :
    "not set — run `pnpm okx-setup` or export OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE";
  const x402Status = okxX402Testnet.status();
  return [
    { line: `GET  /api/health                              always available`, ready: true },
    { line: `GET  /api/okx/settings                          always available (read-only)`, ready: true },
    { line: `GET  /api/okx/intelligence                      always available (read-only)`, ready: true },
    { line: `GET  /api/okx/disputes                          always available (read-only)`, ready: true },
    { line: `GET  /api/okx/treasury                          always available (read-only)`, ready: true },
    {
      line: hasCreds
        ? `POST /api/okx/webhook                           ready (credentials ${credentialSourceLabel})`
        : `POST /api/okx/webhook                           NOT ready — credentials ${credentialSourceLabel}`,
      ready: hasCreds,
    },
    {
      line: legacyEip3009PaidMcpEnabled
        ? `POST /api/okx/mcp (legacy)                      enabled (OKX_LEGACY_EIP3009_ENABLED=true)`
        : `POST /api/okx/mcp (legacy)                      off by default — this is expected, not an error`,
      ready: true,
    },
    {
      line: x402Status.enabled
        ? x402Status.ready
          ? `POST ${X402_TESTNET_RESOURCE_PATH.padEnd(30)} ready (testnet, all config present)`
          : `POST ${X402_TESTNET_RESOURCE_PATH.padEnd(30)} enabled but NOT ready — ${x402Status.reason ?? "missing config"}`
        : `POST ${X402_TESTNET_RESOURCE_PATH.padEnd(30)} off by default — this is expected, not an error`,
      ready: x402Status.enabled ? x402Status.ready : true,
    },
    {
      line: `POST /api/okx/settings                          requires the pairing token below`,
      ready: true,
    },
  ];
}

function printBanner(port: number): void {
  const line = "─".repeat(64);
  console.log(line);
  console.log("  OKX local server");
  console.log(line);
  console.log("");
  console.log(`  Open in your browser's hosted UI, or call directly at:`);
  console.log(`    http://${LOCAL_HOST}:${port}`);
  console.log("");
  console.log(`  Data directory: ${DATA_DIR}`);
  console.log(
    configuredOrigins.length
      ? `  Allowed hosted origins: ${configuredOrigins.join(", ")}`
      : `  Allowed hosted origins: (none configured) — only http(s)://localhost and http(s)://127.0.0.1 origins are accepted.`,
  );
  console.log("  Set KIND_MEITNER_OKX_ALLOWED_ORIGINS to add a hosted UI's origin, e.g.:");
  console.log(`    KIND_MEITNER_OKX_ALLOWED_ORIGINS=https://your-app.example.com pnpm okx-serve`);
  console.log("");
  console.log("  What this process can do right now:");
  for (const { line: routeLine, ready } of describeRouteReadiness()) {
    console.log(`    ${ready ? "✓" : "✗"} ${routeLine}`);
  }
  console.log("");
  console.log("  Pairing token (required to save settings, receive webhooks, or use paid MCP/x402 routes):");
  console.log("");
  console.log(`     ${PAIRING_TOKEN}`);
  console.log("");
  console.log("  Paste this into the web UI when prompted. Shown only here, once, and never logged again.");
  console.log(line);
}

/** Tries the requested port, then each fallback in order, so a busy
 * default port fails softly with a clear "used X instead" message
 * rather than crashing on EADDRINUSE with no guidance. Creates a fresh
 * server for each attempt — reusing one after a failed listen() risks a
 * stale "listening" event racing the next attempt and reporting the
 * wrong port. */
function listenOnFirstFreePort(
  candidates: number[],
  requestHandler: (req: IncomingMessage, res: ServerResponse) => void,
  onListening: (server: ReturnType<typeof createServer>, port: number) => void,
  onExhausted: (err: Error) => void,
): void {
  const [first, ...rest] = candidates;
  if (first === undefined) {
    const message = "No candidate port was free. Set OKX_LOCAL_SERVER_PORT to an explicit free port and try again.";
    console.error(message);
    onExhausted(new Error(message));
    return;
  }
  const server = createServer(requestHandler);
  server.once("error", (err: NodeJS.ErrnoException) => {
    server.close();
    if (err.code !== "EADDRINUSE") {
      onExhausted(err);
      return;
    }
    if (rest.length === 0) {
      const message = `Port ${first} is in use and no fallback ports were free either. Set OKX_LOCAL_SERVER_PORT to an explicit free port and try again.`;
      console.error(message);
      onExhausted(new Error(message));
      return;
    }
    console.log(`Port ${first} is in use — trying ${rest[0]} instead…`);
    listenOnFirstFreePort(rest, requestHandler, onListening, onExhausted);
  });
  server.listen(first, LOCAL_HOST, () => onListening(server, first));
}

export function startOkxLocalServer(port?: number): Promise<ReturnType<typeof createServer>> {
  // Bind loopback only, unconditionally. Unlike server/index.ts, nothing
  // here ever switches to 0.0.0.0 based on an environment variable —
  // this process holds real credentials and must never be reachable from
  // outside this machine.
  const candidates = port !== undefined ? [port] : [DEFAULT_PORT, ...PORT_FALLBACKS.filter((p) => p !== DEFAULT_PORT)];
  return new Promise((resolve, reject) => {
    listenOnFirstFreePort(
      candidates,
      (req, res) => void handleRequest(req, res),
      (server, boundPort) => {
        printBanner(boundPort);
        resolve(server);
      },
      reject,
    );
  });
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  startOkxLocalServer().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
