import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState, Bot, Group } from "@/state/store";
import { t } from "@/lib/i18n";
import {
  SIDEBAR_DENSITY_KEY,
  type SidebarDensity,
} from "@/lib/sidebar-preferences";

type ElementProps = {
  children?: ReactNode;
  onClick?: () => void;
  onToggle?: () => void;
  name?: string;
  collapsed?: boolean;
  items?: MoreMenuItem[];
  "aria-label"?: string;
  title?: string;
  className?: string;
  [key: string]: unknown;
};

function findElement(
  tree: ReactNode,
  predicate: (el: ReactElement<ElementProps>) => boolean,
): ReactElement<ElementProps> | undefined {
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<ElementProps>(child)) continue;
    if (predicate(child)) return child;
    const found = findElement(child.props.children, predicate);
    if (found) return found;
  }
}

const botChief: Bot = {
  id: "bot-chief",
  threadId: "thread-chief",
  name: "Chief Bot",
  title: "Chief of Staff Role",
  description: "Primary orchestrator bot",
  notifications: true,
  color: "blue",
  unread: false,
  chiefOfStaff: true,
  modelSelection: { instanceId: "claude", model: "sonnet" },
  messages: [],
};

const botPinned: Bot = {
  id: "bot-pinned",
  threadId: "thread-pinned",
  name: "Pinned Specialist",
  title: "Security Analyst",
  description: "Pinned security bot",
  notifications: true,
  color: "purple",
  unread: false,
  pinned: true,
  modelSelection: { instanceId: "claude", model: "sonnet" },
  messages: [],
};

const botWorker: Bot = {
  id: "bot-worker",
  threadId: "thread-worker",
  name: "Worker Bot",
  title: "Senior Engineer",
  description: "Worker agent",
  notifications: true,
  color: "green",
  unread: true,
  modelSelection: { instanceId: "claude", model: "haiku" },
  messages: [],
  tasks: [
    { threadId: "task-1", title: "Task 1", createdAt: 1, activity: "waiting-on-you" },
    { threadId: "task-2", title: "Task 2", createdAt: 2, busy: true, activity: "working" },
  ],
};

const groupGeneral: Group = {
  id: "group-general",
  threadId: "thread-group-general",
  name: "General Channel",
  memberIds: ["bot-chief", "bot-pinned", "bot-worker"],
  defaultResponder: { kind: "mentions" },
  bulletin: "",
  unread: false,
  createdAt: 1000,
  messages: [],
};

const fixture = vi.hoisted(() => ({
  showThreads: true,
  state: {} as Partial<AppState>,
  dispatch: vi.fn(),
  mockStorage: new Map<string, string>(),
  savedDensities: [] as SidebarDensity[],
  collapsedSections: [] as string[],
}));

vi.mock("@/lib/thread-preferences", () => ({
  useShowThreads: () => fixture.showThreads,
}));

vi.mock("./DesktopCapabilities", () => ({
  useDesktopCapabilities: () => ({
    capabilities: {
      host: { platform: "other", label: "Browser", session: "unknown", packaged: false },
      windowChrome: "native",
      screenPreview: { available: false, interaction: "none", reasonCode: "desktop-app-required" },
      dictation: { available: false, engine: "none", onDevice: false, reasonCode: "desktop-app-required" },
      localComputer: { available: false, support: "unsupported", enabled: false, status: "unavailable", reasonCode: "desktop-app-required" },
    },
    ready: true,
  }),
}));

vi.mock("react-dom", () => ({
  createPortal: (node: ReactNode) => node,
}));

vi.mock("@/lib/sidebar-preferences", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/sidebar-preferences")>();
  return {
    ...original,
    loadSidebarDensity: (storage?: Pick<Storage, "getItem"> | null) => {
      const target = storage === undefined
        ? { getItem: (k: string) => fixture.mockStorage.get(k) ?? null }
        : storage;
      return original.loadSidebarDensity(target);
    },
    saveSidebarDensity: (density: SidebarDensity, storage?: Pick<Storage, "setItem"> | null) => {
      fixture.savedDensities.push(density);
      fixture.mockStorage.set("kind-meitner.sidebarDensity", density);
      const target = storage === undefined
        ? { setItem: (k: string, v: string) => fixture.mockStorage.set(k, v) }
        : storage;
      original.saveSidebarDensity(density, target);
    },
    loadCollapsedSections: () => fixture.collapsedSections,
    saveCollapsedSections: (sections: string[]) => {
      fixture.collapsedSections = sections;
    },
  };
});

vi.mock("@/state/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/store")>();
  return {
    ...original,
    useStore: () => ({
      state: {
        ...original.initialState,
        bots: fixture.state.bots ?? [botChief, botPinned, botWorker],
        groups: fixture.state.groups ?? [groupGeneral],
        selectedId: fixture.state.selectedId ?? "bot-chief",
        activeView: fixture.state.activeView ?? "chat",
        ...fixture.state,
      },
      dispatch: fixture.dispatch,
    }),
  };
});

import { Sidebar } from "./Sidebar";
import { SidebarSectionHeader } from "./SidebarSectionHeader";
import { SidebarMoreMenu, type MoreMenuItem } from "./SidebarMoreMenu";
import { SidebarProfileMenu } from "./SidebarProfileMenu";

beforeEach(() => {
  fixture.showThreads = true;
  fixture.state = {
    bots: [botChief, botPinned, botWorker],
    groups: [groupGeneral],
    selectedId: "bot-chief",
    activeView: "chat",
  };
  fixture.dispatch.mockClear();
  fixture.mockStorage.clear();
  fixture.savedDensities = [];
  fixture.collapsedSections = [];
  vi.stubGlobal("window", {
    innerWidth: 1024,
    innerHeight: 768,
    ogb: { remoteClient: { active: false } },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("document", { body: {}, querySelector: vi.fn(() => null) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSidebar(props: {
  open?: boolean;
  onClose?: () => void;
  initialDensity?: SidebarDensity;
} = {}) {
  let tree: ReactNode;
  function Capture() {
    tree = Sidebar({
      open: props.open ?? true,
      onClose: props.onClose ?? vi.fn(),
      initialDensity: props.initialDensity,
    });
    return tree;
  }
  const html = renderToStaticMarkup(createElement(Capture));
  return { html, tree };
}

describe("Sidebar Layout & Expansion Polish (M2)", () => {
  describe("Default Expansion & Anti-Entrapment", () => {
    it("mounts in full comfortable expanded mode by default when no preference is stored", () => {
      const { html, tree } = renderSidebar();

      // Root container width is 320px for comfortable expanded mode
      expect(html).toContain("w-[320px]");
      expect(html).not.toContain("w-[80px]");
      // Root container contains overflow-hidden to prevent animation scrollbars/spillover
      expect(html).toContain("overflow-hidden");

      // Expand/collapse button is present with collapse aria-label and title
      expect(html).toContain(t("sidebar.density.collapseAria"));
      expect(html).toContain(t("sidebar.density.collapse"));

      // Verify root element in tree has overflow-hidden and w-[320px]
      const aside = findElement(tree, (el) => Boolean(el.props["data-sidebar"]));
      expect(aside).toBeDefined();
      expect(aside?.props.className).toContain("overflow-hidden");
      expect(aside?.props.className).toContain("w-[320px]");
    });

    it("mounts in full compact expanded mode when compact density is stored", () => {
      fixture.mockStorage.set(SIDEBAR_DENSITY_KEY, "compact");
      const { html, tree } = renderSidebar();

      expect(html).toContain("w-[272px]");
      expect(html).not.toContain("w-[80px]");
      expect(html).toContain("overflow-hidden");

      const aside = findElement(tree, (el) => Boolean(el.props["data-sidebar"]));
      expect(aside?.props.className).toContain("w-[272px]");
    });

    it("maps previously persisted icons density to comfortable on startup to prevent narrow-rail entrapment", () => {
      // Simulate user previously collapsed sidebar to icons
      fixture.mockStorage.set(SIDEBAR_DENSITY_KEY, "icons");

      const { html, tree } = renderSidebar();

      // Must open in full expanded mode (comfortable: 320px), NOT 80px rail
      expect(html).toContain("w-[320px]");
      expect(html).not.toContain("w-[80px]");
      expect(html).toContain("overflow-hidden");
      expect(html).toContain(t("sidebar.density.collapseAria"));

      const aside = findElement(tree, (el) => Boolean(el.props["data-sidebar"]));
      expect(aside?.props.className).toContain("w-[320px]");
    });

    it("includes max-md:w-[288px] so mobile drawers render expanded width even if icons mode is active", () => {
      const { html, tree } = renderSidebar();

      // Mobile responsive class is present on aside
      expect(html).toContain("max-md:w-[288px]");

      const aside = findElement(tree, (el) => Boolean(el.props["data-sidebar"]));
      expect(aside?.props.className).toContain("max-md:w-[288px]");
    });
  });

  describe("Bot Roster & Channels Prominence", () => {
    it("prominently renders bot roster with names, roles, avatars, and search input", () => {
      const { html } = renderSidebar();

      // Bot names are visible
      expect(html).toContain("Chief Bot");
      expect(html).toContain("Pinned Specialist");
      expect(html).toContain("Worker Bot");

      // Chief of staff badge and bot role titles are visible
      expect(html).toContain("Chief of Staff");
      expect(html).toContain("Senior Engineer");
      expect(html).toContain("Security Analyst");

      // Search bar is rendered and visible in expanded mode
      expect(html).toContain(t("sidebar.searchAria"));
      expect(html).toContain(t("sidebar.search"));

      // Bot rows have action menus
      expect(html).toContain('aria-label="Actions for Chief Bot"');
      expect(html).toContain('aria-label="Actions for Worker Bot"');
    });

    it("prominently renders channels with names and previews", () => {
      const { html } = renderSidebar();

      expect(html).toContain("General Channel");
    });

    it("enforces whitespace-nowrap and truncate on bot names, titles, and channel labels to prevent wrapping spasms", () => {
      const { html } = renderSidebar();

      // Check for whitespace-nowrap in bot and channel rows
      expect(html).toContain("whitespace-nowrap");
      expect(html).toContain("truncate");
    });
  });

  describe("Toggle Collapsed Behavior", () => {
    it("toggles collapse state from expanded to icons, saving preferences and adapting aria labels", () => {
      const { tree } = renderSidebar();

      // Locate collapse button
      const collapseButton = findElement(tree, (el) =>
        el.type === "button" && el.props["aria-label"] === t("sidebar.density.collapseAria"),
      );
      expect(collapseButton).toBeDefined();

      // Click collapse button
      collapseButton?.props.onClick?.();

      // Density is saved as "icons"
      expect(fixture.savedDensities).toContain("icons");
    });

    it("renders high-contrast prominent expand button with accessible label and title when in icons density", () => {
      // Render Sidebar directly in icons density to verify prominent styling & labels on genuine component
      const { html, tree } = renderSidebar({ initialDensity: "icons" });

      // In icons mode, root aside container is 80px narrow strip
      expect(html).toContain("w-[80px]");
      expect(html).not.toContain("w-[320px]");

      // Renders PanelLeftOpen icon in markup
      expect(html).toContain("lucide-panel-left-open");

      // Expand button rendered in the actual Sidebar markup with accessible label and title
      expect(html).toContain(`aria-label="${t("sidebar.density.expand")}"`);
      expect(html).toContain(`title="${t("sidebar.density.expand")}"`);
      expect(html).toContain("bg-raised/80");
      expect(html).toContain("border-hairline/60");
      expect(html).toContain("shadow-xs");
      expect(html).toContain("focus-visible:ring-2");
      expect(html).toContain("focus-visible:ring-accent");

      // Verify button element in the Sidebar React tree
      const expandButton = findElement(tree, (el) =>
        el.type === "button" && el.props["aria-label"] === t("sidebar.density.expand"),
      );
      expect(expandButton).toBeDefined();
      expect(expandButton?.props.title).toBe(t("sidebar.density.expand"));
      expect(expandButton?.props.className).toContain("bg-raised/80");
      expect(expandButton?.props.className).toContain("border-hairline/60");
      expect(expandButton?.props.className).toContain("shadow-xs");
      expect(expandButton?.props.className).toContain("focus-visible:ring-2");

      // Clicking expand button triggers toggleCollapsed, persisting restored expanded density
      expandButton?.props.onClick?.();
      expect(fixture.savedDensities).toContain("comfortable");
    });
  });

  describe("Navigation Integrity & Absence of Mock Surfaces (R1/R2)", () => {
    it("strictly verifies that no elements render Bloomberg Terminal", () => {
      const { html } = renderSidebar();

      expect(html).not.toContain("Bloomberg Terminal");
      expect(html).not.toContain('aria-label="Bloomberg Terminal"');
      expect(html).not.toContain('data-tour="nav-bloomberg"');
    });

    it("strictly verifies that no elements render Evaluator Disputes or disputes badge", () => {
      const { html } = renderSidebar();

      expect(html).not.toContain("Evaluator Disputes");
      expect(html).not.toContain('aria-label="Evaluator Disputes"');
      expect(html).not.toContain('data-tour="nav-evaluator"');
      expect(html).not.toContain('data-testid="disputes-badge"');
    });

    it("renders valid functional navigation points for Chat, Team Map, and Automations via Tools menu", () => {
      const { html, tree } = renderSidebar();

      // Expanded mode renders Tools popover menu trigger
      expect(html).toContain(t("sidebar.tools"));

      // Find SidebarMoreMenu in tree and verify its items contain all active surfaces
      const moreMenu = findElement(tree, (el) => el.type === SidebarMoreMenu);
      expect(moreMenu).toBeDefined();
      const items: MoreMenuItem[] = moreMenu?.props.items ?? [];
      const keys = items.map((it) => it.key);
      expect(keys).toEqual(["chat", "team-map", "routines", "plugins"]);

      // Verify profile menu exists
      const profileMenu = findElement(tree, (el) => el.type === SidebarProfileMenu);
      expect(profileMenu).toBeDefined();
    });
  });

  describe("Section Expansion & Collapse", () => {
    it("renders section headers with expand/collapse chevrons", () => {
      const { html } = renderSidebar();

      // Section headers like Pinned, Group chats, and Bots are visible
      expect(html).toContain("Pinned");
      expect(html).toContain("Group chats");
      expect(html).toContain("Bots");
      expect(html).toContain('data-section="Pinned"');
      expect(html).toContain('data-section="Bots"');
    });

    it("allows expanding and collapsing section headers", () => {
      const { tree } = renderSidebar();

      // Find a section header element in tree
      const sectionHeader = findElement(tree, (el) =>
        el.type === SidebarSectionHeader && el.props.name === "Pinned",
      );
      expect(sectionHeader).toBeDefined();
      expect(sectionHeader?.props.collapsed).toBe(false);

      // Invoking onToggle updates collapsed state without throwing
      expect(() => sectionHeader?.props.onToggle?.()).not.toThrow();
      expect(fixture.collapsedSections).toContain("builtin:pinned");
    });

    it("renders collapsed section summary when a section is collapsed", () => {
      fixture.collapsedSections = ["builtin:pinned"];
      const { html } = renderSidebar();

      // The Pinned section header reflects collapsed state (aria-expanded="false")
      expect(html).toContain('data-section="Pinned"');
      expect(html).toContain('aria-expanded="false"');
    });
  });
});
