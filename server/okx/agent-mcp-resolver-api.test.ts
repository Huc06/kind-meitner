import { expect, it } from "vitest";

import { launchVerificationServer } from "../../scripts/control-kind-meitner.ts";

type ApiResponse = { response: Response; body: any };

async function api(baseUrl: string, path: string, method = "GET", body?: unknown): Promise<ApiResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20_000),
  });
  return { response, body: await response.json() };
}

it("resolves catalog tools, posts a gate card, and schedules an okx-tool routine", async () => {
  const fixture = await launchVerificationServer();
  try {
    const gate = await api(fixture.info.url, "/api/okx/dev-day-gate", "POST", {});
    expect(gate.response.ok).toBe(true);
    const threadId = gate.body.room.threadId as string;
    const beforeCount = (gate.body.room.messages as unknown[]).length;

    const missing = await api(fixture.info.url, "/api/okx/resolve-agent", "POST", {});
    expect(missing.response.status).toBe(400);

    const unknown = await api(fixture.info.url, "/api/okx/resolve-agent", "POST", { agentIdOrUrl: "99999" });
    expect(unknown.response.status).toBe(200);
    expect(unknown.body).toMatchObject({ agentId: "99999", status: "offline", tools: [] });

    const resolved = await api(fixture.info.url, "/api/okx/resolve-agent", "POST", { agentIdOrUrl: "13837" });
    expect(resolved.response.status).toBe(200);
    expect(resolved.body.status).toBe("available");
    expect(resolved.body.name).toBe("Markets");
    expect(resolved.body.tools.map((tool: { name: string }) => tool.name)).toEqual(expect.arrayContaining([
      "scan_free_mcp_readiness",
      "get_asp_trust_card",
    ]));

    const executed = await api(fixture.info.url, "/api/okx/execute-agent-tool", "POST", {
      endpointUrl: "/api/okx/free-mcp",
      toolName: "scan_free_mcp_readiness",
      arguments: { endpointUrl: "https://demo.vercel.app/api/okx/free-mcp", agentId: "13837" },
      targetThreadId: threadId,
    });
    expect(executed.response.status).toBe(200);
    expect(executed.body.ok).toBe(true);

    const afterRun = await api(fixture.info.url, "/api/okx/dev-day-gate", "POST", {});
    const messages = afterRun.body.room.messages as Array<{
      role: string;
      kind: string;
      tool?: { name?: string; ok?: boolean; output?: string };
    }>;
    expect(messages.length).toBeGreaterThan(beforeCount);
    const card = [...messages].reverse().find((message) => message.tool?.name === "scan_free_mcp_readiness");
    expect(card).toMatchObject({ role: "bot", kind: "activity", tool: { name: "scan_free_mcp_readiness", ok: true } });
    expect(card?.tool?.output).toContain("verdict");

    const bots = (await api(fixture.info.url, "/api/bots")).body.bots as Array<{ id: string; name: string }>;
    const markets = bots.find((bot) => bot.name === "Markets");
    expect(markets).toBeTruthy();

    const created = await api(fixture.info.url, "/api/routines", "POST", {
      name: "OKX: scan_free_mcp_readiness (15m)",
      prompt: `okx-tool:${JSON.stringify({
        toolName: "get_asp_trust_card",
        endpointUrl: "/api/okx/free-mcp",
        arguments: { agentId: "13837" },
      })}`,
      target: "okx-task",
      botId: markets!.id,
      runOn: "maus",
      schedule: { type: "interval", everyMinutes: 15, anchorAt: Date.now() + 60_000 },
      durationMinutes: 5,
      enabled: true,
    });
    expect(created.response.status).toBe(201);
    expect(created.body.routine.target).toBe("okx-task");

    const launched = await api(fixture.info.url, `/api/routines/${created.body.routine.id}/run`, "POST");
    expect(launched.response.status).toBe(201);

    await expect.poll(async () => {
      const calendar = await api(fixture.info.url, "/api/routines");
      const run = calendar.body.runs.find((item: { id: string }) => item.id === launched.body.run.id);
      return run?.status ?? "missing";
    }, { timeout: 25_000, interval: 200 }).toBe("completed");

    const afterSchedule = await api(fixture.info.url, "/api/okx/dev-day-gate", "POST", {});
    const trustCard = [...afterSchedule.body.room.messages as typeof messages]
      .reverse()
      .find((message) => message.tool?.name === "get_asp_trust_card");
    expect(trustCard).toMatchObject({ role: "bot", kind: "activity", tool: { name: "get_asp_trust_card", ok: true } });
    expect(trustCard?.tool?.output).toContain("decision");
  } finally {
    await fixture.close();
  }
}, 60_000);
