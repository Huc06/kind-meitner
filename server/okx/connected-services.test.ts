import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectedServiceRegistry } from "./connected-services.ts";

describe("ConnectedServiceRegistry", () => {
  let tempDir: string;
  let registry: ConnectedServiceRegistry;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "km-connected-services-test-"));
    registry = new ConnectedServiceRegistry(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("lists the two verified built-in connected services with correct metadata", () => {
    const services = registry.listServices();
    expect(services).toHaveLength(2);

    const outdoor = services.find((s) => s.id === "outdoorwindow");
    expect(outdoor).toBeDefined();
    expect(outdoor?.agentId).toBe("6706");
    expect(outdoor?.endpointUrl).toBe("https://outdoorwindow.seriouss.workers.dev/mcp");
    expect(outdoor?.price).toContain("0 USDT");
    expect(outdoor?.tools.map((t) => t.name)).toContain("get_outdoor_windows");

    const plate = services.find((s) => s.id === "plate");
    expect(plate).toBeDefined();
    expect(plate?.agentId).toBe("6708");
    expect(plate?.endpointUrl).toBe("https://plate.seriouss.workers.dev/mcp");
    expect(plate?.tools.map((t) => t.name)).toContain("render_card");
  });

  it("persists disabling and re-enabling a connected service", () => {
    expect(registry.getService("outdoorwindow")?.enabled).toBe(true);

    registry.setServiceEnabled("outdoorwindow", false);
    expect(registry.getService("outdoorwindow")?.enabled).toBe(false);

    // Verify it survives reloading from disk
    const reloaded = new ConnectedServiceRegistry(tempDir);
    expect(reloaded.getService("outdoorwindow")?.enabled).toBe(false);
    expect(reloaded.getService("plate")?.enabled).toBe(true);

    // Re-enable
    reloaded.setServiceEnabled("outdoorwindow", true);
    expect(reloaded.getService("outdoorwindow")?.enabled).toBe(true);
  });

  it("refuses to execute disabled service", async () => {
    registry.setServiceEnabled("outdoorwindow", false);

    const res = await registry.executePinnedTool({
      serviceId: "outdoorwindow",
      toolName: "get_outdoor_windows",
      arguments: { place: "Singapore" },
    });

    expect(res.ok).toBe(false);
    expect(res.error).toContain("disabled in Settings");
  });

  it("refuses unconfigured services or invalid tools", async () => {
    const unknownRes = await registry.executePinnedTool({
      serviceId: "unknown-agent",
      toolName: "some_tool",
      arguments: {},
    });
    expect(unknownRes.ok).toBe(false);
    expect(unknownRes.error).toContain("not configured");

    const badToolRes = await registry.executePinnedTool({
      serviceId: "plate",
      toolName: "non_existent_tool",
      arguments: {},
    });
    expect(badToolRes.ok).toBe(false);
    expect(badToolRes.error).toContain("does not declare tool");
  });

  it("executes pinned tool with proper headers and payload", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        result: {
          content: [{ type: "text", text: "Mock card rendered" }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await registry.executePinnedTool({
      serviceId: "plate",
      toolName: "render_card",
      arguments: { text: "Hello from test" },
    });

    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://plate.seriouss.workers.dev/mcp",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "user-agent": "kind-meitner/1.0",
        }),
        redirect: "error",
      }),
    );
  });
});
