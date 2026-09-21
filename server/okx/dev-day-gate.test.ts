import { expect, it } from "vitest";

import { launchVerificationServer } from "../../scripts/control-kind-meitner.ts";

type ApiResponse = { response: Response; body: any };

async function api(baseUrl: string, path: string, method = "GET", body?: unknown): Promise<ApiResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5_000),
  });
  return { response, body: await response.json() };
}

it("seeds and repairs #dev-day-gate idempotently in an isolated fixture", async () => {
  const fixture = await launchVerificationServer();
  try {
    const first = await api(fixture.info.url, "/api/okx/dev-day-gate", "POST", {});
    expect(first.response.status).toBe(201);
    expect(first.body.room).toMatchObject({
      name: "#dev-day-gate",
      section: "Dev Day",
      bulletin: "Gate before list. Gate before spend. Free MCP only.",
      defaultResponder: { kind: "mentions" },
    });

    const bots = (await api(fixture.info.url, "/api/bots")).body.bots as Array<{ id: string; name: string; okxImport?: { externalAgentId?: string } }>;
    const expectedMembers = [
      ["okx-market-scout-v1", "Markets"],
      ["okx-listing-coach", "Listing Coach"],
      ["okx-spend-scout", "Spend Scout"],
    ] as const;
    const memberIds = expectedMembers.map(([externalAgentId, name]) => {
      const bot = bots.find((candidate) => candidate.okxImport?.externalAgentId === externalAgentId);
      expect(bot).toMatchObject({ name });
      return bot!.id;
    });
    expect(first.body.room.memberIds).toEqual(memberIds);
    expect(first.body.room.messages.filter((message: { kind: string; tool?: { name?: string; system?: boolean } }) =>
      message.kind === "activity" && message.tool?.system === true,
    )).toHaveLength(3);
    expect(first.body.room.messages.map((message: { tool?: { name?: string } }) => message.tool?.name)).toEqual(expect.arrayContaining([
      "Markets joined #dev-day-gate from OKX.ai.",
      "Listing Coach joined #dev-day-gate from OKX.ai.",
      "Spend Scout joined #dev-day-gate from OKX.ai.",
    ]));

    const repeat = await api(fixture.info.url, "/api/okx/dev-day-gate", "POST", {});
    expect(repeat.response.status).toBe(200);
    expect(repeat.body.room.id).toBe(first.body.room.id);
    expect(repeat.body.room.memberIds).toEqual(memberIds);

    const keptMembers = memberIds.slice(0, 2);
    const removed = await api(fixture.info.url, `/api/groups/${first.body.room.id}`, "PATCH", { memberIds: keptMembers });
    expect(removed.response.status).toBe(200);
    const repaired = await api(fixture.info.url, "/api/okx/dev-day-gate", "POST", {});
    expect(repaired.response.status).toBe(201);
    expect(repaired.body.room.id).toBe(first.body.room.id);
    expect(repaired.body.room.memberIds).toEqual(memberIds);
    expect(repaired.body.room.messages.filter((message: { kind: string; tool?: { name?: string; system?: boolean } }) =>
      message.kind === "activity" && message.tool?.system === true,
    )).toHaveLength(3);
  } finally {
    await fixture.close();
  }
}, 30_000);
