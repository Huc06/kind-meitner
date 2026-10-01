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
    name: "Kind Meitner Markets Free A2MCP",
    endpoint: "/api/okx/free-mcp",
    tools: [
      { name: "scan_free_mcp_readiness", description: "Scan readiness of Free MCP" },
      { name: "get_asp_trust_card", description: "Get ASP trust card" },
    ],
    provenance: "kind-meitner local registry and public OKX.AI setup guidance",
    okxAgentId: "13851",
  };

  const mockRoom = {
    id: "room-general",
    name: "General",
    threadId: "thread-general-1",
    memberIds: [],
    dm: false,
    messages: [],
  } as unknown as Group;

  const fixture = {
    surface: "hub" as "hub" | "apps" | "mcp",
    hubTab: undefined as "agents" | "asps" | "mcp" | undefined,
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
      hubTab: fixture.hubTab,
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

import { Button } from "@/components/ui/button";
import { AgentHubPanel } from "./AgentHubPanel";
import { AgentCard } from "./agent-hub/AgentCard";
import { AspServiceCard } from "./agent-hub/AspServiceCard";

type Node = ReactElement<{
  children?: ReactNode;
  role?: string;
  "aria-selected"?: boolean;
  "data-tour"?: string;
  type?: string;
  onClick?: () => void;
}>;

function nodes(value: ReactNode): Node[] {
  if (!isValidElement(value)) return [];
  const node = value as Node;
  return [node, ...Children.toArray(node.props.children).flatMap(nodes)];
}

function hasText(children: ReactNode, text: string): boolean {
  if (typeof children === "string" && children.includes(text)) return true;
  if (Array.isArray(children)) return children.some((c) => hasText(c, text));
  if (isValidElement(children)) {
    return hasText((children as ReactElement<{ children?: ReactNode }>).props.children, text);
  }
  return false;
}

function findButtonWithText(tree: ReactNode, text: string): ReactElement<Record<string, unknown>> | undefined {
  return nodes(tree).find(
    (n) =>
      (n.type === "button" || n.type === Button || (n.props as { type?: string }).type === "button") &&
      hasText(n.props.children, text),
  );
}

function render(component: () => ReactNode = () => AgentHubPanel({ initialCatalog: [marketScout], initialServices: [freeMcpService] })) {
  let tree!: ReactNode;
  function Capture() {
    tree = component();
    return tree;
  }
  const html = renderToStaticMarkup(createElement(Capture));
  return { html, nodes: nodes(tree) };
}

describe("AgentHubPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { ogb: {} });
    vi.stubGlobal("document", { activeElement: null });
    fixture.surface = "hub";
    fixture.hubTab = undefined;
    fixture.groups = [
      {
        id: "room-general",
        name: "General",
        threadId: "thread-general-1",
        memberIds: [],
        dm: false,
        messages: [],
      } as unknown as Group,
    ];
    fixture.bots = [];
    fixture.selectedId = "room-general";
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

  it("renders hub with Agents active and required headers/labels", () => {
    const { html, nodes: treeNodes } = render();

    // Dialog title & subtitle
    expect(html).toContain("Agent Hub");
    expect(html).toContain("Discover agents and explore ASP services for your workspace.");

    // Panel root data-tour anchor
    expect(html).toContain('data-tour="apps-panel"');

    // Agents tab is active
    const agentsTab = treeNodes.find(
      (n) => n.props.role === "tab" && n.props.children === "Agents",
    );
    expect(agentsTab).toBeDefined();
    expect(agentsTab?.props["aria-selected"]).toBe(true);

    // ASPs & MCP servers tabs exist
    const aspsTab = treeNodes.find(
      (n) => n.props.role === "tab" && n.props.children === "ASPs",
    );
    expect(aspsTab).toBeDefined();
    expect(aspsTab?.props["aria-selected"]).toBe(false);

    const mcpTab = treeNodes.find(
      (n) => n.props.role === "tab" && n.props.children === "MCP servers",
    );
    expect(mcpTab).toBeDefined();
    expect(mcpTab?.props["aria-selected"]).toBe(false);

    // Search placeholder
    expect(html).toContain('placeholder="Search OKX agents or ASPs"');

    // App integrations link
    expect(html).toContain("App integrations");

    // Agents section
    expect(html).toContain("Available from OKX.AI catalog");
    expect(html).toContain("OKX.AI catalog · local registry");
    expect(html).toContain("Markets");
  });

  it("renders catalog loading state", () => {
    const { html } = render(() => AgentHubPanel());
    expect(html).toContain("Loading OKX agents and ASP services…");
  });

  it("handles invite success message and duplicate message in AgentCard", async () => {
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
    expect(html).toContain("Invite to room");

    const inviteButton = findButtonWithText(treeNode, "Invite to room");
    expect(inviteButton).toBeDefined();
    await (inviteButton?.props.onClick as () => Promise<void>)?.();

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

  it("renders unavailable state with exact copy and retry action", () => {
    const errorHtml = renderToStaticMarkup(
      createElement(() => AgentHubPanel({ initialError: "Failed to load catalog" })),
    );
    expect(errorHtml).toContain("The OKX catalog is temporarily unavailable.");
    expect(errorHtml).toContain("Your imported agents and local ASP data are still available.");
    expect(errorHtml).toContain("Retry");
  });

  it("renders McpServersPanel on MCP servers tab and allows switching surface to apps", () => {
    fixture.surface = "mcp";
    const { html, nodes: treeNodes } = render();

    // McpServersPanel is rendered
    expect(html).toContain("MCP inventory");

    // MCP servers tab has aria-selected=true
    const mcpTab = treeNodes.find(
      (n) => n.props.role === "tab" && n.props.children === "MCP servers",
    );
    expect(mcpTab?.props["aria-selected"]).toBe(true);

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

  it("renders ASP card without prior result", () => {
    let cardTree!: ReactElement;
    function CaptureCard() {
      cardTree = AspServiceCard({ service: freeMcpService }) as ReactElement;
      return cardTree;
    }
    const html = renderToStaticMarkup(createElement(CaptureCard));

    expect(html).toContain("Kind Meitner Markets Free A2MCP");
    expect(html).toContain("#13851");
    expect(html).toContain("Not checked yet");
    expect(html).toContain("Free");
    expect(html).toContain("Wallet: No");
    expect(html).toContain("Mainnet: No");

    // Copy evidence button is disabled when there is no prior result
    const copyEvidenceBtn = findButtonWithText(cardTree, "Copy evidence");
    expect(copyEvidenceBtn).toBeDefined();
    expect(copyEvidenceBtn?.props.disabled).toBe(true);
  });

  it("renders ASP card with prior result from room messages", () => {
    const roomWithScan = {
      id: "room-general",
      name: "General",
      threadId: "thread-general-1",
      memberIds: [],
      dm: false,
      messages: [
        {
          id: "msg-1",
          at: 1727780000000,
          tool: {
            name: "scan_free_mcp_readiness",
            ok: true,
            output: JSON.stringify({
              endpointUrl: "/api/okx/free-mcp",
              verdict: "PASS",
              checks: [{ id: "c1", status: "pass", detail: "ok" }],
              remediation: ["none"],
            }),
          },
        },
        {
          id: "msg-2",
          at: 1727785000000,
          tool: {
            name: "get_asp_trust_card",
            ok: true,
            output: JSON.stringify({
              agentId: "13851",
              decision: "GO",
              summary: "Verified",
              signals: [{ id: "s1", status: "pass", detail: "ok" }],
              notChecked: ["none"],
              remediation: ["none"],
              safeNextStep: "ready",
            }),
          },
        },
      ],
    } as unknown as Group;

    fixture.groups = [roomWithScan];

    let cardTree!: ReactElement;
    function CaptureCard() {
      cardTree = AspServiceCard({ service: freeMcpService }) as ReactElement;
      return cardTree;
    }
    const html = renderToStaticMarkup(createElement(CaptureCard));

    expect(html).toContain("PASS");
    expect(html).toContain("GO");
    expect(html).not.toContain("Not checked yet");

    // Copy evidence button is enabled when evidence is available
    const copyEvidenceBtn = findButtonWithText(cardTree, "Copy evidence");
    expect(copyEvidenceBtn).toBeDefined();
    expect(copyEvidenceBtn?.props.disabled).toBeFalsy();
  });

  it("fills composer draft on readiness check without sending and closes panel", () => {
    let cardTree!: ReactElement;
    function CaptureCard() {
      cardTree = AspServiceCard({ service: freeMcpService }) as ReactElement;
      return cardTree;
    }
    const html = renderToStaticMarkup(createElement(CaptureCard));
    expect(html).toContain("Run readiness scan");

    const readinessBtn = findButtonWithText(cardTree, "Run readiness scan");
    expect(readinessBtn).toBeDefined();

    (readinessBtn?.props.onClick as () => void)?.();

    expect(fixture.setComposerDraftMock).toHaveBeenCalledWith(
      "group:room-general:thread-general-1",
      "@Markets run scan_free_mcp_readiness for /api/okx/free-mcp",
    );
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "togglePlugins", open: false });
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "select", id: "room-general" });

    const sendCalls = fixture.dispatch.mock.calls.filter(
      ([action]) => action.type === "send" || action.type === "sendGroup",
    );
    expect(sendCalls).toHaveLength(0);
  });
});
