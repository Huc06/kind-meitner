import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Group, Bot, InstanceInfo } from "@/state/store";
import type * as AgentHubModule from "@/lib/agent-hub";
import type { CatalogAgent, HubAgent, HubService, ImportHubAgentResult } from "@/lib/agent-hub";

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
    instances: [] as InstanceInfo[],
    selectedId: "room-general",
    catalogResult: { agents: [marketScout], stale: false },
    freeMcpResult: freeMcpService,
    importResult: { kind: "added" as ImportHubAgentResult["kind"], room: "room-general" },
    existingDrafts: {} as Record<string, string>,
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
      instances: fixture.instances,
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
  getDraft: (_store: unknown, id: string) => fixture.existingDrafts[id] ?? "",
  setComposerDraft: (id: string, text: string) => {
    fixture.existingDrafts[id] = text;
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
    expect(html).toContain("Local catalog for OKX.AI");
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
  it("switching to MCP tab keeps surface as hub and opens mcp tab", () => {
    const { nodes: treeNodes } = render();
    const mcpTabBtn = treeNodes.find(
      (n) => n.props.role === "tab" && n.props.children === "MCP servers",
    );
    expect(mcpTabBtn).toBeDefined();
    mcpTabBtn?.props.onClick?.();
    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: "togglePlugins",
      open: true,
      surface: "hub",
      hubTab: "mcp",
    });
  });

  it("removes in-room agents from catalog section and disables active invite", () => {
    const inRoomBot: Bot = {
      id: "bot-markets-1",
      name: "Markets",
      okxImport: {
        externalAgentId: "okx-market-scout-v1",
        provider: "OKX.ai",
      },
    } as unknown as Bot;
    fixture.bots = [inRoomBot];
    fixture.groups = [
      {
        id: "room-general",
        name: "General",
        threadId: "thread-general-1",
        memberIds: ["bot-markets-1"],
        dm: false,
        messages: [],
      } as unknown as Group,
    ];

    const { html } = render();
    expect(html).toContain("Imported into this room");
    expect(html).not.toContain("Available from OKX.AI catalog");
  });

  it("prefills @Name when draft is empty and preserves non-empty draft", () => {
    const agent: HubAgent = {
      id: "okx-market-scout-v1",
      name: "Markets",
      summary: "Market scanner",
      provider: "OKX.ai",
      capabilities: ["chat"],
      rooms: [{ id: "room-general", name: "General" }],
    };

    let cardTree!: ReactElement;
    function CaptureCard() {
      cardTree = AgentCard({ agent, currentRoomId: "room-general" }) as ReactElement;
      return cardTree;
    }
    renderToStaticMarkup(createElement(CaptureCard));

    const useInChannelBtn = findButtonWithText(cardTree, "Use in channel");
    expect(useInChannelBtn).toBeDefined();

    // 1. With empty draft: prefills
    fixture.existingDrafts = {};
    (useInChannelBtn?.props.onClick as () => void)?.();
    expect(fixture.setComposerDraftMock).toHaveBeenCalledWith(
      "group:room-general:thread-general-1",
      "@Markets ",
    );
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "togglePlugins", open: false });
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "select", id: "room-general" });

    // 2. With existing non-empty draft: preserves
    fixture.setComposerDraftMock.mockReset();
    fixture.dispatch.mockReset();
    fixture.existingDrafts["group:room-general:thread-general-1"] = "My existing draft";

    (useInChannelBtn?.props.onClick as () => void)?.();
    expect(fixture.setComposerDraftMock).not.toHaveBeenCalled();
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "togglePlugins", open: false });
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "select", id: "room-general" });
  });

  it("labels catalog agent with local catalog provenance and does not claim imported agent", () => {
    const uninvitedAgent: HubAgent = {
      id: "okx-market-scout-v1",
      name: "Markets",
      summary: "Market scanner",
      provider: "OKX.ai",
      capabilities: ["chat"],
      rooms: [],
    };

    let cardTree!: ReactElement;
    function CaptureCard() {
      cardTree = AgentCard({ agent: uninvitedAgent }) as ReactElement;
      return cardTree;
    }
    const html = renderToStaticMarkup(createElement(CaptureCard));

    expect(html).toContain("Local catalog for OKX.AI");
    expect(html).not.toContain("Imported agent");
    expect(html).not.toContain("In this room");
  });

  it("stacks room row and wraps action buttons without overflowing card", () => {
    const agent: HubAgent = {
      id: "okx-market-scout-v1",
      name: "Markets",
      summary: "Market scanner",
      provider: "OKX.ai",
      capabilities: ["chat"],
      rooms: [{ id: "room-general", name: "General" }],
    };

    let cardTree!: ReactElement;
    function CaptureCard() {
      cardTree = AgentCard({ agent }) as ReactElement;
      return cardTree;
    }
    const html = renderToStaticMarkup(createElement(CaptureCard));

    // Contains room name and action buttons
    expect(html).toContain("#General");
    expect(html).toContain("Open room");
    expect(html).toContain("Use in channel");
    // Uses vertical stacking for room item and flex-wrap for action buttons
    expect(html).toContain("flex flex-col gap-1.5 border border-hairline bg-inset p-2");
    expect(html).toContain("flex flex-wrap items-center gap-1.5");
  });

  it("never shows 'Imported agent' for local agent Tuli, and shows 'In this room' only when member", () => {
    const tuliBot: Bot = {
      id: "tuli",
      name: "Tuli",
      description: "Local assistant",
      title: "Assistant",
      color: "green",
      messages: [],
      threadId: "thread-tuli",
      modelSelection: { instanceId: "inst-test", model: "default" },
      notifications: true,
      unread: false,
    } as Bot;

    const tuliAgent: HubAgent = {
      id: "tuli",
      name: "Tuli",
      summary: "Local assistant",
      provider: "Local workspace",
      capabilities: [],
      importedBotId: "tuli",
      rooms: [{ id: "room-general", name: "General" }],
    };

    // 1. Tuli when viewing a different room: neither "Imported agent" nor "In this room"
    let notInRoomTree!: ReactElement;
    function CaptureNotInRoom() {
      notInRoomTree = AgentCard({
        agent: tuliAgent,
        bot: tuliBot,
        currentRoomId: "room-other",
      }) as ReactElement;
      return notInRoomTree;
    }
    const notInRoomHtml = renderToStaticMarkup(createElement(CaptureNotInRoom));
    expect(notInRoomHtml).not.toContain("Imported agent");
    expect(notInRoomHtml).not.toContain("In this room");
    expect(notInRoomHtml).toContain("Local workspace agent");

    // 2. Tuli when viewing room-general (where Tuli is a member): shows "In this room", never "Imported agent"
    let inRoomTree!: ReactElement;
    function CaptureInRoom() {
      inRoomTree = AgentCard({
        agent: tuliAgent,
        bot: tuliBot,
        currentRoomId: "room-general",
      }) as ReactElement;
      return inRoomTree;
    }
    const inRoomHtml = renderToStaticMarkup(createElement(CaptureInRoom));
    expect(inRoomHtml).toContain("In this room");
    expect(inRoomHtml).not.toContain("Imported agent");
  });

  it("shows 'Available' and never 'Test engine' for uninvited catalog entries when engine is in test mode", () => {
    fixture.instances = [
      {
        instanceId: "inst-test",
        driverKind: "claude",
        displayName: "Test engine",
        simulated: true,
        testEngine: true,
        snapshot: { state: "available", simulated: true, testEngine: true },
        models: { default: "test", options: [] },
      },
    ];

    const uninvitedAgent: HubAgent = {
      id: "okx-market-scout-v1",
      name: "Markets",
      summary: "Market scanner",
      provider: "OKX.ai",
      capabilities: ["chat"],
      rooms: [],
    };

    let cardTree!: ReactElement;
    function CaptureCard() {
      cardTree = AgentCard({ agent: uninvitedAgent }) as ReactElement;
      return cardTree;
    }
    const html = renderToStaticMarkup(createElement(CaptureCard));

    // Uninvited catalog entry must show catalog availability, not runtime connectivity
    expect(html).toContain("Available");
    expect(html).not.toContain("Test engine");
    expect(html).not.toContain("TEST ENGINE");

    // But an imported bot in the workspace shows Test engine
    const importedAgent: HubAgent = {
      ...uninvitedAgent,
      importedBotId: "bot-markets",
      rooms: [{ id: "room-general", name: "General" }],
    };
    let importedTree!: ReactElement;
    function CaptureImportedCard() {
      importedTree = AgentCard({
        agent: importedAgent,
        bot: {
          id: "bot-markets",
          name: "Markets",
          okxImport: { kind: "okx-catalog", externalAgentId: "okx-market-scout-v1" },
          modelSelection: { instanceId: "inst-test" },
        },
      }) as ReactElement;
      return importedTree;
    }
    const importedHtml = renderToStaticMarkup(createElement(CaptureImportedCard));
    expect(importedHtml).toContain("Test engine");
  });
});
