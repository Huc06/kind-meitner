import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import type * as StoreModule from "@/state/store";

import { LaptopClaudeRelaySettings, type LaptopClaudeRelaySettingsProps } from "./LaptopClaudeRelaySettings";
const fixture = vi.hoisted(() => ({
  tokens: [
    {
      id: "tok-1",
      name: "MacBook Pro",
      createdAt: "2026-10-04T12:00:00.000Z",
      lastSeenAt: "2026-10-04T12:05:00.000Z",
      connected: true,
    },
  ],
}));

vi.mock("@/state/store", async (importOriginal) => ({
  ...await importOriginal<typeof StoreModule>(),
  api: vi.fn(async (url: string) => {
    if (url === "/api/engine-relay/tokens") return fixture.tokens;
    return {};
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("renders the Run on my laptop section with command line and setup prompt", () => {
  const markup = renderToStaticMarkup(createElement<LaptopClaudeRelaySettingsProps>(LaptopClaudeRelaySettings, { initialTokens: fixture.tokens }));
  expect(markup).toContain("Run on my laptop");
  expect(markup).toContain("Start command");
  expect(markup).toContain("curl -fsSL");
  expect(markup).toContain("~/.kind-meitner-runner.mjs");
  expect(markup).toContain("Setup prompt for your agent");
  expect(markup).toContain("MacBook Pro");
  expect(markup).toContain("Connected");
});
