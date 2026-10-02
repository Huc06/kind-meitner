import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  surface: "hub" as "hub" | "apps" | "mcp",
  hubTab: undefined as "agents" | "asps" | "mcp" | undefined,
  dispatch: vi.fn(),
}));
vi.mock("@/state/store", () => ({
  api: vi.fn(),
  useStore: () => ({
    state: {
      pluginsSurface: fixture.surface,
      hubTab: fixture.hubTab,
      bots: [],
      groups: [],
    },
    dispatch: fixture.dispatch,
  }),
}));
vi.mock("./McpServersPanel", () => ({ McpServersPanel: () => createElement("div", null, "MCP inventory") }));
import { PluginsPanel } from "./PluginsPanel";

type Node = ReactElement<{ children?: ReactNode; role?: string; "aria-selected"?: boolean; onClick?: () => void }>;
function nodes(value: ReactNode): Node[] {
  if (!isValidElement(value)) return [];
  const node = value as Node;
  return [node, ...Children.toArray(node.props.children).flatMap(nodes)];
}
function render() {
  let tree: ReactNode = null;
  function Capture() {
    tree = PluginsPanel();
    return tree;
  }
  const html = renderToStaticMarkup(createElement(Capture));
  return { html, tree, nodes: nodes(tree) };
}
beforeEach(() => {
  vi.stubGlobal("window", {});
  fixture.surface = "hub";
  fixture.hubTab = undefined;
  fixture.dispatch.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("Plugins surface navigation", () => {
  it("renders the default hub surface (AgentHubPanel) with OKX Agent Hub title", () => {
    const initial = render();
    expect(initial.html).toContain("OKX Agent Hub");
    expect(initial.html).not.toContain("MCP inventory");
  });

  it("renders AgentHubPanel and keeps hub shell when surface is mcp", () => {
    fixture.surface = "mcp";
    const initial = render();
    expect(initial.html).toContain("OKX Agent Hub");
    expect(initial.html).toContain("MCP inventory");
  });

  it("renders legacy apps panel only when surface is apps", () => {
    fixture.surface = "apps";
    const legacyView = render();
    expect(legacyView.html).not.toContain("OKX Agent Hub");
    expect(legacyView.html).toContain("Connected apps");
  });
});
