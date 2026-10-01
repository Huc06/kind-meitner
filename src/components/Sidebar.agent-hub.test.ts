import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { AppState } from "@/state/store";
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
  SidebarMoreMenu: ({ items }: { items: SidebarMenuItem[] }) => {
    fixture.capturedMoreMenuItems = items;
    return createElement("div", { "data-testid": "more-menu" });
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

  it("renders ASP Directory in main nav and opens hub surface with asps tab", () => {
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    renderToStaticMarkup(createElement(Capture));

    const aspButton = findElement(tree, "aria-label", "ASP Directory");
    expect(aspButton).toBeDefined();
    (aspButton?.props.onClick as () => void)?.();
    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: "togglePlugins",
      open: true,
      surface: "hub",
      hubTab: "asps",
    });
  });

  it("renders Activity in main nav and dispatches toggleActivity", () => {
    let tree: ReactNode;
    function Capture() {
      tree = Sidebar({ open: true, onClose: vi.fn() });
      return tree;
    }
    renderToStaticMarkup(createElement(Capture));

    const actButton = findElement(tree, "aria-label", "Activity");
    expect(actButton).toBeDefined();
    (actButton?.props.onClick as () => void)?.();
    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: "toggleActivity",
    });
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
    expect(html).toContain("Open Agent Hub");

    const cmdButton = findButtonWithText(tree, "Open Agent Hub");
    expect(cmdButton).toBeDefined();
    (cmdButton?.props.onClick as () => void)?.();

    expect(fixture.dispatch).toHaveBeenCalledWith({
      type: "togglePlugins",
      open: true,
      surface: "hub",
    });
  });
});
