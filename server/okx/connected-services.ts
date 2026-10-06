import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUILTIN_CONNECTED_SERVICES,
  type ConnectedService,
  type ConnectedServiceTool,
} from "../../shared/connected-services.ts";

export {
  BUILTIN_CONNECTED_SERVICES,
  type ConnectedService,
  type ConnectedServiceTool,
};

export class ConnectedServiceRegistry {
  private readonly dataDir: string;
  private readonly overrides: Map<string, { enabled?: boolean }> = new Map();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.load();
  }

  private load(): void {
    const file = join(this.dataDir, "connected-services.json");
    if (!existsSync(file)) return;
    try {
      const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, { enabled?: boolean }>;
      for (const [id, override] of Object.entries(data)) {
        if (typeof override?.enabled === "boolean") {
          this.overrides.set(id, { enabled: override.enabled });
        }
      }
    } catch {
      // Ignore parse errors on corrupted override file
    }
  }

  private save(): void {
    const file = join(this.dataDir, "connected-services.json");
    const data: Record<string, { enabled?: boolean }> = {};
    for (const [id, override] of this.overrides.entries()) {
      data[id] = override;
    }
    writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  }

  listServices(): ConnectedService[] {
    return BUILTIN_CONNECTED_SERVICES.map((s) => {
      const override = this.overrides.get(s.id);
      return {
        ...s,
        enabled: override?.enabled !== undefined ? override.enabled : s.enabled,
      };
    });
  }

  getService(id: string): ConnectedService | undefined {
    return this.listServices().find((s) => s.id === id || s.agentId === id);
  }

  setServiceEnabled(id: string, enabled: boolean): ConnectedService {
    const service = BUILTIN_CONNECTED_SERVICES.find((s) => s.id === id || s.agentId === id);
    if (!service) {
      throw new Error(`Connected service not found: ${id}`);
    }
    this.overrides.set(service.id, { enabled });
    this.save();
    return { ...service, enabled };
  }

  async executePinnedTool(params: {
    serviceId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  }): Promise<{
    ok: boolean;
    result?: unknown;
    error?: string;
    durationMs: number;
    service: ConnectedService;
  }> {
    const service = this.getService(params.serviceId);
    if (!service) {
      return {
        ok: false,
        error: `Service ${params.serviceId} is not configured`,
        durationMs: 0,
        service: {
          id: params.serviceId,
          agentId: "",
          name: params.serviceId,
          description: "",
          listingUrl: "",
          endpointUrl: "",
          price: "0 USDT",
          enabled: false,
          provider: "okx.ai",
          tools: [],
        },
      };
    }

    if (!service.enabled) {
      return {
        ok: false,
        error: `Service ${service.name} (${service.agentId}) is disabled in Settings`,
        durationMs: 0,
        service,
      };
    }

    const tool = service.tools.find((t) => t.name === params.toolName);
    if (!tool) {
      return {
        ok: false,
        error: `Service ${service.name} does not declare tool ${params.toolName}`,
        durationMs: 0,
        service,
      };
    }

    // Security pinning: endpoint is strictly pinned to configured service.endpointUrl
    const pinnedEndpoint = service.endpointUrl;
    const start = Date.now();

    // Call server-side MCP executor with size cap, timeout, no redirects, custom user-agent
    try {
      const response = await fetch(pinnedEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "kind-meitner/1.0",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `km-${Date.now()}`,
          method: "tools/call",
          params: {
            name: params.toolName,
            arguments: params.arguments,
          },
        }),
        redirect: "error", // No redirects allowed
        signal: AbortSignal.timeout(15_000), // 15-second timeout
      });

      const durationMs = Date.now() - start;

      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          durationMs,
          service,
        };
      }

      // Check size cap (1MB max)
      const MAX_BYTES = 1024 * 1024;
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
        return {
          ok: false,
          error: "Response exceeded maximum size cap of 1MB",
          durationMs,
          service,
        };
      }

      const text = await response.text();
      if (text.length > MAX_BYTES) {
        return {
          ok: false,
          error: "Response body exceeded maximum size cap of 1MB",
          durationMs,
          service,
        };
      }

      const data = JSON.parse(text) as {
        error?: { message?: string };
        result?: { isError?: boolean; content?: Array<{ text?: string }> };
      };

      if (data.error) {
        return {
          ok: false,
          error: data.error.message ?? "Tool execution failed",
          durationMs,
          service,
        };
      }

      if (data.result?.isError) {
        return {
          ok: false,
          error: data.result.content?.[0]?.text ?? "Tool execution reported error",
          durationMs,
          service,
        };
      }

      return {
        ok: true,
        result: data.result,
        durationMs,
        service,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `${service.name} returned error: ${message}`,
        durationMs,
        service,
      };
    }
  }
}
