import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Group, Bot } from "@/state/store";
import type * as AgentHubModule from "@/lib/agent-hub";
import type { CatalogAgent, HubService, ImportHubAgentResult } from "@/lib/agent-hub";

const { marketScout, freeMcpService, fixture } = vi.hoisted(() => {
  const marketScout: CatalogAgent = {
    id: "okx-market-scout-v1",
    name: "Markets",
    description: "Summarizes OKX marketplace demand, pricing and active task categories.",
    provider: "OKX.ai",
    capabilities: ["chat", "market-intelligence"],
  };

  const freeMcpService: HubService = {
    id: "okx-free-mcp",
    name: "Free A2MCP",
    endpoint: "/api/okx/free-mcp",
    tools: [
      { name: "scan_free_mcp_readiness", description: "Scan readiness of Free MCP" },
      { name: "get_asp_trust_card", description: "Get ASP trust card" },
    ],
    provenance: "kind-meitner local registry and public OKX.AI setup guidance",
    okxAgentId: "okx-market-scout-v1",
  };

  const mockRoom = {
    id: "room-general",
    name: "General",
    threadId: "thread-general-1",
    memberIds: [],
    dm: false,
  } as unknown as Group;

  const fixture = {
    surface: "hub" as "hub" | "apps" | "mcp",
    dispatch: vi.fn(),
    groups: [mockRoom],
    bots: [] as Bot[],
    selectedId: "room-general",
    catalogResult: { agents: [marketScout], stale: false },
    freeMcpResult: freeMcpService,
    importResult: { kind: "added" as ImportHubAgentResult["kind"], room: "room-general" },
    setComposerDraftMock: vi.fn(),
    apiFetchMock: vi.fn(),
  };

  return { marketScout, freeMcpService, fixture };
});

vi.mock("@/state/store", () => ({
  api: (url: string, ...args: unknown[]) => {
    fixture.apiFetchMock(url, ...args);
    return Promise.resolve({});
  },
  useStore: () => ({
    state: {
      pluginsSurface: fixture.surface,
      groups: fixture.groups,
      bots: fixture.bots,
      selectedId: fixture.selectedId,
    },
    dispatch: fixture.dispatch,
  }),
}));

vi.mock("@/lib/agent-hub", async (importOriginal) => {
  const original = await importOriginal<typeof AgentHubModule>();
  return {
    ...original,
    loadHubCatalog: vi.fn(async () => fixture.catalogResult),
    loadFreeMcpService: vi.fn(async () => fixture.freeMcpResult),
    importHubAgent: vi.fn(async () => fixture.importResult),
  };
});

vi.mock("@/lib/drafts", () => ({
  setComposerDraft: (id: string, text: string) => {
    fixture.setComposerDraftMock(id, text);
  },
}));

vi.mock("./McpServersPanel", () => ({
  McpServersPanel: () => createElement("div", { "data-testid": "mcp-inventory" }, "MCP inventory"),
}));

import { AgentHubPanel } from "./AgentHubPanel";
import { PluginsPanel } from "./PluginsPanel";
import { AgentCard } from "./agent-hub/AgentCard";
import { AspServiceCard } from "./agent-hub/AspServiceCard";

type Node = ReactElement<{
  children?: ReactNode;
  role?: string;
  "aria-selected"?: boolean;
  "data-tour"?: string;
  onClick?: () => void | Promise<void>;
  [key: string]: unknown;
}>;

function nodes(value: ReactNode): Node[] {
  if (!isValidElement(value)) return [];
  const node = value as Node;
  return [node, ...Children.toArray(node.props.children).flatMap(nodes)];
}
function findButtonWithText(tree: ReactNode, text: string): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<Record<string, unknown>>(child)) continue;
    if (child.props.onClick) {
      const json = JSON.stringify(child.props);
      if (json.includes(text)) return child;
    }
    const found = findButtonWithText(child.props.children as ReactNode, text);
    if (found) return found;
  }
}

function render(component: () => ReactNode = () => AgentHubPanel({ initialCatalog: [marketScout], initialServices: [freeMcpService] })) {
  let tree!: ReactNode;
  function Capture() {
    tree = component();
    return tree;
  }
  const html = renderToStaticMarkup(createElement(Capture));
  return { html, nodes: nodes(tree), tree };
}

describe("AgentHubPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { ogb: {} });
    vi.stubGlobal("document", { activeElement: null });
    fixture.surface = "hub";
    fixture.dispatch.mockReset();
    fixture.setComposerDraftMock.mockReset();
    fixture.apiFetchMock.mockReset();
    fixture.importResult = { kind: "added", room: "room-general" };
    fixture.catalogResult = { agents: [marketScout], stale: false };
    fixture.freeMcpResult = freeMcpService;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders hub with Discover active and required headers/labels", () => {
    const { html, nodes: treeNodes } = render();

    // Dialog title & subtitle
    expect(html).toContain("Agent Hub");
    expect(html).toContain("Discover agents and explore ASP services for your workspace.");

    // Panel root data-tour anchor
    expect(html).toContain('data-tour="apps-panel"');

    // Discover tab is active
    const discoverTab = treeNodes.find(
      (n) => n.props.role === "tab" && n.props.children === "Discover",
    );
    expect(discoverTab).toBeDefined();
    expect(discoverTab?.props["aria-selected"]).toBe(true);

    // Workspace & Custom MCP tabs exist
    const workspaceTab = treeNodes.find(
      (n) => n.props.role === "tab" && n.props.children === "In this workspace",
    );
    expect(workspaceTab).toBeDefined();
    expect(workspaceTab?.props["aria-selected"]).toBe(false);

    const customMcpTab = treeNodes.find(
      (n) => n.props.role === "tab" && n.props.children === "Custom MCP",
    );
    expect(customMcpTab).toBeDefined();
    expect(customMcpTab?.props["aria-selected"]).toBe(false);

    // Search placeholder
    expect(html).toContain('placeholder="Search OKX agents or ASPs"');

    // App integrations link
    expect(html).toContain("App integrations");

    // Discover content: agents section and ASP services section
    expect(html).toContain("Source: kind-meitner local catalog (not live OKX discovery)");
    expect(html).toContain("Markets");
    expect(html).toContain("OKX.ai");
    expect(html).toContain("Free A2MCP");
    expect(html).toContain("Free · read-only · no wallet · no payment · not an OKX endorsement");
  });

  it("renders catalog loading state", () => {
    // When catalog is not yet loaded, render shows loading state
    const { html } = render(() => AgentHubPanel());
    expect(html).toContain("Loading OKX agents and ASP services…");
  });

  it("handles import success message and duplicate message in AgentCard", async () => {
    fixture.importResult = { kind: "added", room: "room-general" };
    const agent = {
      ...marketScout,
      summary: marketScout.description,
      rooms: [],
    };
    let treeNode!: ReactElement;
    function Capture() {
      treeNode = AgentCard({ agent }) as ReactElement;
      return treeNode;
    }
    const html = renderToStaticMarkup(createElement(Capture));
    expect(html).toContain("Markets");
    expect(html).toContain("Add to channel");

    const addButton = findButtonWithText(treeNode, "Add to channel");
    expect(addButton).toBeDefined();
    await (addButton?.props.onClick as () => Promise<void>)?.();

    // Renders success message
    const htmlSuccess = renderToStaticMarkup(
      createElement(() =>
        AgentCard({
          agent,
          resultMessage: { kind: "added", message: "Added to #General" },
        }) as ReactElement,
      ),
    );
    expect(htmlSuccess).toContain("Added to #General");

    // Renders duplicate message
    const htmlDup = renderToStaticMarkup(
      createElement(() =>
        AgentCard({
          agent,
          resultMessage: { kind: "already", message: "Already in #General" },
        }) as ReactElement,
      ),
    );
    expect(htmlDup).toContain("Already in #General");
  });

  it("fills composer draft on readiness check without sending and closes panel", () => {
    let cardTree!: ReactElement;
    function CaptureCard() {
      cardTree = AspServiceCard({ service: freeMcpService }) as ReactElement;
      return cardTree;
    }
    const html = renderToStaticMarkup(createElement(CaptureCard));
    expect(html).toContain("Check readiness");
    expect(html).toContain("Check trust");

    const readinessBtn = findButtonWithText(cardTree, "Check readiness");
    expect(readinessBtn).toBeDefined();

    // Trigger check readiness
    (readinessBtn?.props.onClick as () => void)?.();

    // Draft filled for chosen room
    expect(fixture.setComposerDraftMock).toHaveBeenCalledWith(
      "group:room-general:thread-general-1",
      "@Markets run scan_free_mcp_readiness for /api/okx/free-mcp",
    );

    // Panel closed
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "togglePlugins", open: false });

    // Room selected
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "select", id: "room-general" });

    // NEVER sent a message
    const sendCalls = fixture.dispatch.mock.calls.filter(
      ([action]) => action.type === "send" || action.type === "sendGroup",
    );
    expect(sendCalls).toHaveLength(0);
  });

  it("fills composer draft on trust check (with okxAgentId) without sending", () => {
    let cardTree!: ReactElement;
    function CaptureCard() {
      cardTree = AspServiceCard({ service: freeMcpService }) as ReactElement;
      return cardTree;
    }
    renderToStaticMarkup(createElement(CaptureCard));

    const trustBtn = findButtonWithText(cardTree, "Check trust");
    expect(trustBtn).toBeDefined();

    // Trigger check trust
    (trustBtn?.props.onClick as () => void)?.();

    // Draft filled
    expect(fixture.setComposerDraftMock).toHaveBeenCalledWith(
      "group:room-general:thread-general-1",
      "@Markets run get_asp_trust_card for agentId okx-market-scout-v1 with endpointUrl /api/okx/free-mcp",
    );
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "togglePlugins", open: false });
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "select", id: "room-general" });

    // No message send
    const sendCalls = fixture.dispatch.mock.calls.filter(
      ([action]) => action.type === "send" || action.type === "sendGroup",
    );
    expect(sendCalls).toHaveLength(0);
  });

  it("renders McpServersPanel on Custom MCP tab and allows switching surface to apps", () => {
    fixture.surface = "mcp";
    const { html, nodes: treeNodes } = render();

    // McpServersPanel is rendered
    expect(html).toContain("MCP inventory");

    // Custom MCP tab has aria-selected=true
    const customMcpTab = treeNodes.find(
      (n) => n.props.role === "tab" && n.props.children === "Custom MCP",
    );
    expect(customMcpTab?.props["aria-selected"]).toBe(true);

    // App integrations link exists
    const appIntegrationsBtn = treeNodes.find(
      (n) =>
        n.type === "button" &&
        nodes(n).some((child) => child.props.children === "App integrations"),
    );
    expect(appIntegrationsBtn).toBeDefined();
    appIntegrationsBtn?.props.onClick?.();
    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: "togglePlugins",
      open: true,
      surface: "apps",
    });
  });

  it("ensures Composio is not fetched on hub surface", () => {
    fixture.surface = "hub";
    render(PluginsPanel);

    // Verifies that neither /api/connectors nor /api/connectors/catalog is called on hub surface
    const connectorCalls = fixture.apiFetchMock.mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("/api/connectors"),
    );
    expect(connectorCalls).toHaveLength(0);
  });
});
