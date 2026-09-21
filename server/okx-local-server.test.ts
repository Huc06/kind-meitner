import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dataDir: string;
let server: Server;
let baseUrl: string;
let pairingToken: string;

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "okx-local-server-test-"));
  process.env.KIND_MEITNER_DATA_DIR = dataDir;
  delete process.env.OKX_API_KEY;
  delete process.env.OKX_SECRET_KEY;
  delete process.env.OKX_PASSPHRASE;
  delete process.env.OKX_X402_TESTNET_ENABLED;
  delete process.env.OKX_LEGACY_EIP3009_ENABLED;
  process.env.KIND_MEITNER_OKX_ALLOWED_ORIGINS = "https://hosted.example.com";

  const mod = await import("./okx-local-server.ts");
  pairingToken = mod.PAIRING_TOKEN;
  server = await mod.startOkxLocalServer(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
}, 30_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dataDir, { recursive: true, force: true });
});

describe("OKX local server", () => {
  it("answers a basic health check", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("kind-meitner-okx-local-server");
  });

  it("reports no OKX credentials configured without leaking any secret value", async () => {
    const res = await fetch(`${baseUrl}/api/okx/settings`);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ credentialsConfigured: false, webhookSecretConfigured: false });
    expect(JSON.stringify(body)).not.toMatch(/apiKey|secretKey|passphrase/i);
  });

  it("rejects any attempt to set a credential field at runtime", async () => {
    const res = await fetch(`${baseUrl}/api/okx/settings`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-okx-pairing-token": pairingToken },
      body: JSON.stringify({ apiKey: "sneaky" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: string };
    expect(body.error).toMatch(/server-only/);
  });

  it("keeps the legacy EIP-3009 MCP path disabled by default", async () => {
    const res = await fetch(`${baseUrl}/api/okx/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-okx-pairing-token": pairingToken },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(410);
  });

  it("keeps the official x402 testnet route disabled by default", async () => {
    const res = await fetch(`${baseUrl}/api/okx/x402-testnet/market-intelligence`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-okx-pairing-token": pairingToken },
      body: "{}",
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("x402 testnet is disabled");
  });

  it("returns 404 for a route this server does not mount", async () => {
    const res = await fetch(`${baseUrl}/api/okx/free-mcp`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  describe("pairing token", () => {
    it("rejects a sensitive route with no token", async () => {
      const res = await fetch(`${baseUrl}/api/okx/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ treasuryBalance: 100 }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects a sensitive route with an incorrect token", async () => {
      const res = await fetch(`${baseUrl}/api/okx/settings`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-okx-pairing-token": "not-the-real-token" },
        body: JSON.stringify({ treasuryBalance: 100 }),
      });
      expect(res.status).toBe(401);
    });

    it("accepts a sensitive route with the correct token", async () => {
      const res = await fetch(`${baseUrl}/api/okx/settings`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-okx-pairing-token": pairingToken },
        body: JSON.stringify({ treasuryBalance: 100 }),
      });
      expect(res.status).toBe(200);
    });

    it("never requires a token for read-only routes", async () => {
      const health = await fetch(`${baseUrl}/api/health`);
      const settings = await fetch(`${baseUrl}/api/okx/settings`);
      const intelligence = await fetch(`${baseUrl}/api/okx/intelligence`);
      expect(health.status).toBe(200);
      expect(settings.status).toBe(200);
      expect(intelligence.status).toBe(200);
    });
  });

  describe("CORS allowlist", () => {
    it("always allows a localhost origin", async () => {
      const res = await fetch(`${baseUrl}/api/health`, { headers: { origin: "http://localhost:5173" } });
      expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    });

    it("allows an origin listed in KIND_MEITNER_OKX_ALLOWED_ORIGINS", async () => {
      const res = await fetch(`${baseUrl}/api/health`, { headers: { origin: "https://hosted.example.com" } });
      expect(res.headers.get("access-control-allow-origin")).toBe("https://hosted.example.com");
    });

    it("never reflects an origin that is not allowlisted", async () => {
      const res = await fetch(`${baseUrl}/api/health`, { headers: { origin: "https://not-allowed.example.com" } });
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });

    it("answers an OPTIONS preflight with no content", async () => {
      const res = await fetch(`${baseUrl}/api/okx/settings`, {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      });
      expect(res.status).toBe(204);
    });
  });
});
