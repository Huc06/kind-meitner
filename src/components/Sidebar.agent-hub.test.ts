import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { AppState, Bot } from "@/state/store";
import type { SidebarMenuItem } from "./SidebarPopoverMenu";

const fixture = vi.hoisted(() => ({
  state: {} as Partial<AppState>,
  dispatch: vi.fn(),
  density: "comfortable" as "comfortable" | "compact" | "icons",
  capturedMoreMenuItems: [] as SidebarMenuItem[],
}));

vi.mock("@/state/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/store")>();
  return {
    ...original,
    useStore: () => ({
      state: { ...original.initialState, ...fixture.state },
      dispatch: fixture.dispatch,
    }),
  };
});

vi.mock("@/lib/sidebar-preferences", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/sidebar-preferences")>();
  return {
    ...original,
    loadSidebarDensity: () => fixture.density,
    useSidebarDensity: () => fixture.density,
    useSidebarExpanded: () => [new Set<string>(), vi.fn()],
    useSidebarPreferences: () => ({
      density: fixture.density,
      setDensity: vi.fn(),
      showArchived: false,
      setShowArchived: vi.fn(),
      collapsedSections: new Set(),
      toggleSection: vi.fn(),
    }),
  };
});

vi.mock("@/lib/thread-preferences", () => ({
  useShowThreads: () => true,
}));

vi.mock("./DesktopCapabilities", () => ({
  useDesktopCapabilities: () => ({ capabilities: {} }),
}));

vi.mock("react-dom", () => ({
  createPortal: (node: ReactNode) => node,
}));

vi.mock("./SidebarMoreMenu", () => ({
  SidebarMoreMenu: ({ items, active, label = "More" }: { items: SidebarMenuItem[]; active?: boolean; label?: string }) => {
    fixture.capturedMoreMenuItems = items;
    return createElement("button", {
      "data-testid": "more-menu",
      "aria-label": label,
      "aria-current": active ? "page" : undefined,
    });
  },
}));

import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";

function findElement(tree: ReactNode, prop: string, value: unknown): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<Record<string, unknown>>(child)) continue;
    if (child.props[prop] === value) return child;
    const found = findElement(child.props.children as ReactNode, prop, value);
    if (found) return found;
  }
}

function findButtonWithText(tree: ReactNode, text: string): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<Record<string, unknown>>(child)) continue;
    if (child.type === "button" && child.props.onClick) {
      const json = JSON.stringify(child.props);
      if (json.includes(text)) return child;
    }
    const found = findButtonWithText(child.props.children as ReactNode, text);
    if (found) return found;
  }
}

describe("Sidebar Agent Hub entry", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { innerWidth: 1024, innerHeight: 768, ogb: {} });
    vi.stubGlobal("document", { body: {} });
    fixture.state = {
      bots: [],
      groups: [],
      routineRuns: [],
      activeDisputesCount: 0,
      pluginsOpen: false,
      pluginsSurface: "hub",
    };
    fixture.dispatch.mockClear();
    fixture.capturedMoreMenuItems = [];
    fixture.density = "comfortable";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders Agent Hub entry with tourId 'nav-apps' in main nav and opens hub surface", () => {
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    renderToStaticMarkup(createElement(Capture));

    const hubButton = findElement(tree, "data-tour", "nav-apps");
    expect(hubButton).toBeDefined();
    expect(hubButton?.props["aria-label"]).toContain("Agent Hub");
    expect(hubButton?.props["aria-current"]).toBeUndefined();

    (hubButton?.props.onClick as () => void)?.();
    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: "togglePlugins",
      open: true,
      surface: "hub",
      hubTab: "agents",
    });
  });

  it("marks Agent Hub active when pluginsOpen is true and surface is hub", () => {
    fixture.state = {
      pluginsOpen: true,
      pluginsSurface: "hub",
    };
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    renderToStaticMarkup(createElement(Capture));

    const hubButton = findElement(tree, "data-tour", "nav-apps");
    expect(hubButton?.props["aria-current"]).toBe("page");
  });

  it("renders Agent Hub icon button with data-tour='nav-apps' in icons density", () => {
    fixture.density = "icons";
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    renderToStaticMarkup(createElement(Capture));

    const button = findElement(tree, "data-tour", "nav-apps");
    expect(button).toBeDefined();
    expect(button?.props["aria-label"]).toContain("Agent Hub");

    (button?.props.onClick as () => void)?.();
    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: "togglePlugins",
      open: true,
      surface: "hub",
      hubTab: "agents",
    });
  });

  it("does not render separate ASP Directory in main nav (Hub replaces it)", () => {
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    renderToStaticMarkup(createElement(Capture));

    const aspButton = findElement(tree, "aria-label", "ASP Directory");
    expect(aspButton).toBeUndefined();
  });

  it("renders Activity in main nav and switches to chat with activityOpen", () => {
    fixture.state = {
      activeView: "routines",
      activityOpen: false,
      groups: [{ id: "room-1", threadId: "t-1", name: "Room 1", memberIds: [], defaultResponder: { kind: "everyone" }, bulletin: "", unread: false, createdAt: 1000, messages: [] }],
    };
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    renderToStaticMarkup(createElement(Capture));

    const actButton = findElement(tree, "aria-label", "Activity");
    expect(actButton).toBeDefined();
    (actButton?.props.onClick as () => void)?.();
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "showChat" });
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "select", id: "room-1" });
    expect(fixture.dispatch).toHaveBeenCalledWith({ type: "toggleActivity", open: true });
  });

  it("renders More menu with Routines and Evaluator badge, plus Settings and Help in main nav", () => {
    fixture.state = {
      activeDisputesCount: 3,
    };
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    renderToStaticMarkup(createElement(Capture));

    const settingsButton = findElement(tree, "aria-label", "Settings");
    expect(settingsButton).toBeDefined();

    const helpButton = findElement(tree, "aria-label", "Help");
    expect(helpButton).toBeDefined();

    expect(fixture.capturedMoreMenuItems).toHaveLength(2);
    expect(fixture.capturedMoreMenuItems[0]?.key).toBe("routines");
    expect(fixture.capturedMoreMenuItems[1]?.key).toBe("evaluator");
  });

  it("guarantees exactly one aria-current in main nav across all views", () => {
    const views: Array<{
      activeView: AppState["activeView"];
      activityOpen?: boolean;
      pluginsOpen?: boolean;
      pluginsSurface?: "hub" | "apps" | "mcp";
      appSettingsOpen?: boolean;
      expected: string;
    }> = [
      { activeView: "chat", activityOpen: false, pluginsOpen: false, expected: "Rooms" },
      { activeView: "chat", activityOpen: true, pluginsOpen: false, expected: "Activity" },
      { activeView: "chat", activityOpen: false, pluginsOpen: true, pluginsSurface: "hub", expected: "OKX Agent Hub" },
      { activeView: "routines", activityOpen: false, pluginsOpen: false, expected: "More" },
      { activeView: "okx-evaluator", activityOpen: false, pluginsOpen: false, expected: "More" },
      { activeView: "chat", activityOpen: false, appSettingsOpen: true, pluginsOpen: false, expected: "Settings" },
    ];

    for (const v of views) {
      fixture.state = {
        activeView: v.activeView,
        activityOpen: v.activityOpen,
        pluginsOpen: v.pluginsOpen,
        pluginsSurface: v.pluginsSurface,
        appSettingsOpen: v.appSettingsOpen,
      };

      let tree: ReactNode;
      function Capture() {
        tree = Sidebar({ open: true, onClose: vi.fn() });
        return tree;
      }
      renderToStaticMarkup(createElement(Capture));

      const currentButtons: string[] = [];
      function collectCurrent(node: ReactNode) {
        for (const child of Children.toArray(node)) {
          if (!isValidElement<Record<string, unknown>>(child)) continue;
          const isCurrent = child.props["aria-current"] === "page" || child.props.active === true;
          const label = child.props["aria-label"] ?? child.props.label;
          if (isCurrent && typeof label === "string") {
            currentButtons.push(label);
          }
          collectCurrent(child.props.children as ReactNode);
        }
      }

      // Inspect main nav
      const nav = findElement(tree, "aria-label", "Main");
      expect(nav).toBeDefined();
      collectCurrent(nav);
      expect(currentButtons).toHaveLength(1);
      expect(currentButtons[0]).toBe(v.expected);
    }
  });

  it("renders connection status with text", () => {
    fixture.state = { connected: true };
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    const html = renderToStaticMarkup(createElement(Capture));
    expect(html).toContain("Connected");
  });
  it("renders collapsed rail with aria-label and title tooltips for all main nav items", () => {
    fixture.density = "icons";
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    renderToStaticMarkup(createElement(Capture));

    const nav = findElement(tree, "aria-label", "Main");
    expect(nav).toBeDefined();

    const expectedLabels = ["Rooms", "OKX Agent Hub", "Activity", "Settings", "Help"];
    for (const label of expectedLabels) {
      const btn = findElement(nav, "aria-label", label);
      expect(btn).toBeDefined();
      expect(btn?.props.title).toBe(label);
    }
  });

  it("renders room avatar stack as a bounded group with +N for groups with >2 members", () => {
    fixture.state = {
      bots: [
        { id: "b1", threadId: "t1", name: "Bot 1", title: "", color: "cyan", messages: [] },
        { id: "b2", threadId: "t2", name: "Bot 2", title: "", color: "magenta", messages: [] },
        { id: "b3", threadId: "t3", name: "Bot 3", title: "", color: "yellow", messages: [] },
        { id: "b4", threadId: "t4", name: "Bot 4", title: "", color: "green", messages: [] },
      ] as unknown as Bot[],
      groups: [
        {
          id: "g1",
          threadId: "gt1",
          name: "Trading Room",
          memberIds: ["b1", "b2", "b3", "b4"],
          defaultResponder: { kind: "everyone" },
          bulletin: "",
          unread: false,
          createdAt: 1000,
          messages: [],
        },
      ],
    };
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    const html = renderToStaticMarkup(createElement(Capture));
    expect(html).toContain("Trading Room");
    expect(html).toContain("+2");
    expect(html).toContain("w-10");
  });
});

describe("CommandPalette Open Agent Hub", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("document", { body: {} });
    fixture.state = {
      bots: [],
      groups: [],
    };
    fixture.dispatch.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders Open Agent Hub command in CommandPalette and opens hub surface on click", () => {
    let tree: ReactNode;
    function Capture() {
      tree = CommandPalette({ initialOpen: true });
      return tree;
    }
    const html = renderToStaticMarkup(createElement(Capture));

    expect(html).toContain("Commands");
    expect(html).toContain("Open OKX Agent Hub");

    const cmdButton = findButtonWithText(tree, "Open OKX Agent Hub");
    expect(cmdButton).toBeDefined();
    (cmdButton?.props.onClick as () => void)?.();

    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: "togglePlugins",
      open: true,
      surface: "hub",
    });
  });
});
