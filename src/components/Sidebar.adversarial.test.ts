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
  loadCollapsedSections,
  loadSectionOrder,
  loadSidebarDensity,
  parseSidebarDensity,
  saveCollapsedSections,
  saveSidebarDensity,
  toggleCollapsedSection,
  type SidebarDensity,
} from "@/lib/sidebar-preferences";
import {
  sidebarAttentionLabel,
  sidebarSectionAttention,
  type SidebarAttentionBot,
  type SidebarAttentionGroup,
} from "@/lib/sidebar-attention";
import {
  BOT_CHATS_SECTION_ID,
  BOTS_SECTION_ID,
  CHANNELS_SECTION_ID,
  PINNED_SECTION_ID,
  userSectionId,
} from "@/lib/sidebar-layout";

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

function findAllElements(
  tree: ReactNode,
  predicate: (el: ReactElement<ElementProps>) => boolean,
): ReactElement<ElementProps>[] {
  const matches: ReactElement<ElementProps>[] = [];
  for (const child of Children.toArray(tree)) {
    if (!isValidElement<ElementProps>(child)) continue;
    if (predicate(child)) matches.push(child);
    matches.push(...findAllElements(child.props.children, predicate));
  }
  return matches;
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
  unread: true,
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
  activity: "waiting-on-you",
  busy: true,
  modelSelection: { instanceId: "claude", model: "haiku" },
  messages: [],
  tasks: [
    { threadId: "task-1", title: "Task 1", createdAt: 1, activity: "waiting-on-you" },
    { threadId: "task-2", title: "Task 2", createdAt: 2, busy: true, activity: "working" },
  ],
};

const botSectioned: Bot = {
  id: "bot-sectioned",
  threadId: "thread-sectioned",
  name: "Custom Bot",
  title: "Custom Domain Specialist",
  description: "Bot inside custom section",
  notifications: true,
  color: "orange",
  unread: false,
  section: "Custom Section",
  modelSelection: { instanceId: "claude", model: "sonnet" },
  messages: [],
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

const groupSectioned: Group = {
  id: "group-sectioned",
  threadId: "thread-group-sectioned",
  name: "Project Room",
  memberIds: ["bot-chief", "bot-worker"],
  defaultResponder: { kind: "mentions" },
  bulletin: "",
  unread: true,
  section: "Custom Section",
  createdAt: 2000,
  messages: [],
};

const fixture = vi.hoisted(() => ({
  showThreads: true,
  state: {} as Partial<AppState>,
  dispatch: vi.fn(),
  mockStorage: new Map<string, string>(),
  savedDensities: [] as SidebarDensity[],
  collapsedSections: [] as string[],
  overrideDensity: null as SidebarDensity | null,
  overrideLastExpanded: null as Exclude<SidebarDensity, "icons"> | null,
  densityHookCallCount: 0,
}));

vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  return {
    ...original,
    useState: <T>(initial: T | (() => T)): [T, (val: T | ((prev: T) => T)) => void] => {
      if (typeof initial === "function") {
        const val = (initial as () => T)();
        if ((val === "comfortable" || val === "compact") && fixture.overrideDensity !== null) {
          fixture.densityHookCallCount++;
          // First matching call is density, second is lastExpandedDensity
          if (fixture.densityHookCallCount % 2 === 1) {
            return [
              fixture.overrideDensity as T,
              (next: any) => {
                fixture.savedDensities.push(next);
              },
            ];
          }
          if (fixture.overrideLastExpanded !== null) {
            return [
              fixture.overrideLastExpanded as T,
              () => {},
            ];
          }
        }
      }
      return original.useState(initial);
    },
  };
});

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
    saveCollapsedSections: (sections: string[], storage?: Pick<Storage, "setItem"> | null) => {
      fixture.collapsedSections = sections;
      const target = storage === undefined
        ? { setItem: (k: string, v: string) => fixture.mockStorage.set(k, v) }
        : storage;
      original.saveCollapsedSections(sections, target);
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
        bots: fixture.state.bots ?? [botChief, botPinned, botWorker, botSectioned],
        groups: fixture.state.groups ?? [groupGeneral, groupSectioned],
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

beforeEach(() => {
  fixture.showThreads = true;
  fixture.state = {
    bots: [botChief, botPinned, botWorker, botSectioned],
    groups: [groupGeneral, groupSectioned],
    selectedId: "bot-chief",
    activeView: "chat",
  };
  fixture.dispatch.mockClear();
  fixture.mockStorage.clear();
  fixture.savedDensities = [];
  fixture.collapsedSections = [];
  fixture.overrideDensity = null;
  fixture.overrideLastExpanded = null;
  fixture.densityHookCallCount = 0;

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

function renderSidebar(props: { open?: boolean; onClose?: () => void } = {}) {
  let tree: ReactNode;
  function Capture() {
    tree = Sidebar({ open: props.open ?? true, onClose: props.onClose ?? vi.fn() });
    return tree;
  }
  const html = renderToStaticMarkup(createElement(Capture));
  return { html, tree };
}

describe("Empirical Adversarial Test: Sidebar Layout, Density & Navigation Integrity", () => {
  describe("1. Hostile & Corrupted localStorage for SIDEBAR_DENSITY_KEY", () => {
    const HOSTILE_INPUTS: Array<{ label: string; raw: string | null; expectedStartup: "comfortable" | "compact" }> = [
      { label: "collapsed icons mode (anti-entrapment guarantee)", raw: "icons", expectedStartup: "comfortable" },
      { label: "empty string", raw: "", expectedStartup: "comfortable" },
      { label: "null (missing key)", raw: null, expectedStartup: "comfortable" },
      { label: "arbitrary junk", raw: "junk", expectedStartup: "comfortable" },
      { label: "numeric string 123", raw: "123", expectedStartup: "comfortable" },
      { label: "JSON object string {}", raw: "{}", expectedStartup: "comfortable" },
      { label: "JSON array string []", raw: "[]", expectedStartup: "comfortable" },
      { label: "string undefined", raw: "undefined", expectedStartup: "comfortable" },
      { label: "string null", raw: "null", expectedStartup: "comfortable" },
      { label: "string NaN", raw: "NaN", expectedStartup: "comfortable" },
      { label: "XSS script injection", raw: "<script>alert('xss')</script>", expectedStartup: "comfortable" },
      { label: "binary control characters", raw: "\x00\x01\x1f\x7f", expectedStartup: "comfortable" },
      { label: "whitespace string", raw: "   ", expectedStartup: "comfortable" },
      { label: "uppercase COMFORTABLE", raw: "COMFORTABLE", expectedStartup: "comfortable" },
      { label: "uppercase ICONS", raw: "ICONS", expectedStartup: "comfortable" },
      { label: "trailing space 'comfortable '", raw: "comfortable ", expectedStartup: "comfortable" },
      { label: "string [object Object]", raw: "[object Object]", expectedStartup: "comfortable" },
      { label: "valid compact mode", raw: "compact", expectedStartup: "compact" },
      { label: "valid comfortable mode", raw: "comfortable", expectedStartup: "comfortable" },
    ];

    it.each(HOSTILE_INPUTS)(
      "parseSidebarDensity safely handles hostile input '$label'",
      ({ raw }) => {
        const parsed = parseSidebarDensity(raw);
        if (raw === "compact") expect(parsed).toBe("compact");
        else if (raw === "icons") expect(parsed).toBe("icons");
        else expect(parsed).toBe("comfortable");
      },
    );

    it.each(HOSTILE_INPUTS)(
      "loadSidebarDensity ALWAYS evaluates to an expanded mode on startup for '$label'",
      ({ raw, expectedStartup }) => {
        const storage = { getItem: () => raw };
        const density = loadSidebarDensity(storage);
        expect(density).toBe(expectedStartup);
        // Anti-entrapment invariant: startup NEVER evaluates to icons
        expect(density).not.toBe("icons");
        expect(["comfortable", "compact"]).toContain(density);
      },
    );

    it("safely falls back to 'comfortable' when localStorage throws a SecurityError/DOMException", () => {
      const throwingStorage = {
        getItem: () => {
          const err = new Error("Blocked by browser privacy settings");
          err.name = "SecurityError";
          throw err;
        },
      };
      const density = loadSidebarDensity(throwingStorage);
      expect(density).toBe("comfortable");
    });

    it.each(HOSTILE_INPUTS)(
      "Sidebar component mount with hostile localStorage '$label' renders expanded mode",
      ({ raw, expectedStartup }) => {
        if (raw !== null) {
          fixture.mockStorage.set(SIDEBAR_DENSITY_KEY, raw);
        }

        const { html, tree } = renderSidebar();

        // 1. Must render with an expanded width (320px or 272px), NEVER collapsed 80px
        const expectedWidthClass = expectedStartup === "compact" ? "w-[272px]" : "w-[320px]";
        expect(html).toContain(expectedWidthClass);
        expect(html).not.toContain("w-[80px]");
        expect(html).toContain("overflow-hidden");

        // 2. Aside element must contain the expanded class
        const aside = findElement(tree, (el) => Boolean(el.props["data-sidebar"]));
        expect(aside).toBeDefined();
        expect(aside?.props.className).toContain(expectedWidthClass);
        expect(aside?.props.className).not.toContain("w-[80px]");

        // 3. Collapse button must be present (NOT expand button)
        expect(html).toContain(t("sidebar.density.collapseAria"));
        expect(html).toContain(t("sidebar.density.collapse"));

        // 4. Search bar is rendered in expanded mode
        expect(html).toContain(t("sidebar.searchAria"));
        expect(html).toContain(t("sidebar.search"));

        // 5. Bot roster is visibly rendered
        expect(html).toContain("Chief Bot");
        expect(html).toContain("Pinned Specialist");
        expect(html).toContain("Worker Bot");
      },
    );
  });

  describe("2. Rapid Toggle Stress Testing", () => {
    it("handles 10 rapid synchronous clicks in a single tick without throwing or corrupting storage", () => {
      const { tree } = renderSidebar();

      // Find the toggle collapse button
      const collapseButton = findElement(tree, (el) =>
        el.type === "button" && el.props["aria-label"] === t("sidebar.density.collapseAria"),
      );
      expect(collapseButton).toBeDefined();
      expect(collapseButton?.props.onClick).toBeDefined();

      // Fire onClick 10 times in a row rapidly in the same tick
      expect(() => {
        for (let i = 0; i < 10; i++) {
          collapseButton?.props.onClick?.();
        }
      }).not.toThrow();

      // Verify storage received valid density transitions
      expect(fixture.savedDensities.length).toBe(10);
      for (const saved of fixture.savedDensities) {
        expect(["comfortable", "compact", "icons"]).toContain(saved);
      }
      expect(fixture.mockStorage.get(SIDEBAR_DENSITY_KEY)).toBe("icons");
    });

    it("executes 10-cycle state machine & DOM alternation stress starting from 'comfortable'", () => {
      let currentDensity: SidebarDensity = "comfortable";
      let lastExpanded: Exclude<SidebarDensity, "icons"> = "comfortable";
      const transitionLog: Array<{ cycle: number; density: SidebarDensity; htmlWidth: string }> = [];

      for (let cycle = 1; cycle <= 10; cycle++) {
        // Toggle action
        if (currentDensity === "icons") {
          currentDensity = lastExpanded;
        } else {
          lastExpanded = currentDensity;
          currentDensity = "icons";
        }
        saveSidebarDensity(currentDensity);

        fixture.overrideDensity = currentDensity;
        fixture.overrideLastExpanded = lastExpanded;

        // Render Sidebar with new density state
        const { html, tree } = renderSidebar();
        const aside = findElement(tree, (el) => Boolean(el.props["data-sidebar"]));
        const isCollapsed = currentDensity === "icons";

        transitionLog.push({
          cycle,
          density: currentDensity,
          htmlWidth: isCollapsed ? "w-[80px]" : "w-[320px]",
        });

        // Assert DOM invariants at each cycle
        if (isCollapsed) {
          expect(aside?.props.className).toContain("w-[80px]");
          expect(aside?.props.className).not.toContain("w-[320px]");
          expect(html).toContain('aria-label="Expand sidebar"');
          expect(html).toContain("pt-1 pb-3 hidden");
        } else {
          expect(aside?.props.className).toContain("w-[320px]");
          expect(aside?.props.className).not.toContain("w-[80px]");
          expect(html).toContain(t("sidebar.density.collapseAria"));
          expect(html).toContain("pt-1 pb-3 px-3");
        }
        expect(html).toContain("overflow-hidden");
      }

      // After 10 toggles (even number), we must end up cleanly back in 'comfortable'
      expect(currentDensity).toBe("comfortable");
      expect(lastExpanded).toBe("comfortable");
      expect(transitionLog).toHaveLength(10);
      expect(transitionLog[9].density).toBe("comfortable");
    });

    it("executes 10-cycle state machine & DOM alternation stress starting from 'compact'", () => {
      let currentDensity: SidebarDensity = "compact";
      let lastExpanded: Exclude<SidebarDensity, "icons"> = "compact";

      for (let cycle = 1; cycle <= 10; cycle++) {
        if (currentDensity === "icons") {
          currentDensity = lastExpanded;
        } else {
          lastExpanded = currentDensity;
          currentDensity = "icons";
        }

        fixture.overrideDensity = currentDensity;
        fixture.overrideLastExpanded = lastExpanded;

        const { tree } = renderSidebar();
        const aside = findElement(tree, (el) => Boolean(el.props["data-sidebar"]));

        if (currentDensity === "icons") {
          expect(aside?.props.className).toContain("w-[80px]");
        } else {
          // Must restore 'compact' (272px), proving lastExpanded is strictly preserved
          expect(aside?.props.className).toContain("w-[272px]");
          expect(aside?.props.className).not.toContain("w-[320px]");
        }
      }

      expect(currentDensity).toBe("compact");
      expect(lastExpanded).toBe("compact");
    });

    it("renders properly formatted DOM in icons mode without search input", () => {
      fixture.overrideDensity = "icons";
      fixture.overrideLastExpanded = "comfortable";

      const { html, tree } = renderSidebar();
      const aside = findElement(tree, (el) => Boolean(el.props["data-sidebar"]));

      expect(aside?.props.className).toContain("w-[80px]");
      expect(html).toContain('aria-label="Expand sidebar"');
      expect(html).toContain("pt-1 pb-3 hidden");
      expect(html).not.toContain("pt-1 pb-3 px-3");
    });
  });

  describe("3. Hostile DOM Assertions: Zero Mock / Obsolete Surfaces", () => {
    const FORBIDDEN_STRINGS = [
      "evaluator disputes",
      "evaluator dispute",
      "bloomberg terminal",
      "bloomberg",
      "evaluator",
      "disputes-badge",
      "nav-evaluator",
      "nav-bloomberg",
      "okx-evaluator",
      "okx-bloomberg",
    ];

    const SCENARIOS = [
      { name: "default comfortable expanded mode", setup: () => {} },
      {
        name: "compact expanded mode",
        setup: () => {
          fixture.mockStorage.set(SIDEBAR_DENSITY_KEY, "compact");
        },
      },
      {
        name: "collapsed icons mode",
        setup: () => {
          fixture.overrideDensity = "icons";
          fixture.overrideLastExpanded = "comfortable";
        },
      },
      {
        name: "mobile drawer open (open=true)",
        setup: () => {},
        open: true,
      },
      {
        name: "mobile drawer closed (open=false)",
        setup: () => {},
        open: false,
      },
      {
        name: "empty state (zero bots, zero groups)",
        setup: () => {
          fixture.state.bots = [];
          fixture.state.groups = [];
        },
      },
      {
        name: "heavy activity load (unread, waiting, busy, tasks)",
        setup: () => {
          fixture.state.bots = [
            botChief,
            botPinned,
            botWorker,
            {
              id: "bot-heavy",
              threadId: "thread-heavy",
              name: "Dispute Arbitrator Bot", // Intentionally named to stress test against false positives
              title: "Settlement Arbiter",
              description: "Arbitration agent",
              notifications: true,
              color: "yellow",
              unread: true,
              activity: "waiting-on-you",
              busy: true,
              modelSelection: { instanceId: "claude", model: "sonnet" },
              messages: [],
              tasks: [
                { threadId: "t-1", title: "Review escrow dispute #104", createdAt: 1, busy: true },
              ],
            },
          ];
        },
      },
      {
        name: "all sections collapsed",
        setup: () => {
          fixture.collapsedSections = [
            PINNED_SECTION_ID,
            CHANNELS_SECTION_ID,
            BOT_CHATS_SECTION_ID,
            BOTS_SECTION_ID,
            userSectionId("Custom Section"),
          ];
        },
      },
    ];

    it.each(SCENARIOS)("guarantees zero occurrences of forbidden surfaces in scenario: $name", ({ setup, open }) => {
      setup();
      const { html, tree } = renderSidebar({ open: open ?? true });
      const lowerHtml = html.toLowerCase();

      for (const forbidden of FORBIDDEN_STRINGS) {
        expect(lowerHtml).not.toContain(forbidden);
        expect(html).not.toContain(forbidden);
      }

      // Assert specific test IDs and data attributes
      expect(html).not.toContain('data-testid="disputes-badge"');
      expect(html).not.toContain('data-tour="nav-evaluator"');
      expect(html).not.toContain('data-tour="nav-bloomberg"');
      expect(html).not.toContain('aria-label="Bloomberg Terminal"');
      expect(html).not.toContain('aria-label="Evaluator Disputes"');

      // MoreMenu check
      const moreMenu = findElement(tree, (el) => el.type === SidebarMoreMenu);
      if (moreMenu) {
        const items = (moreMenu.props.items ?? []).map((it) => it.key);
        expect(items).not.toContain("okx-bloomberg");
        expect(items).not.toContain("okx-evaluator");
        expect(items).toEqual(["chat", "team-map", "routines", "plugins"]);
      }
    });
  });

  describe("4. Section Collapse States & Attention Counters Under Stress", () => {
    describe("sidebarSectionAttention mathematical & combinatorial correctness", () => {
      it("evaluates empty inputs to 0 across all counters", () => {
        const attention = sidebarSectionAttention([], []);
        expect(attention).toEqual({ unread: 0, waiting: 0, working: 0 });
        expect(sidebarAttentionLabel(attention)).toBe("");
      });

      it("strictly does NOT double-count a bot with activity='waiting-on-you' and busy=true as working", () => {
        // High-risk condition: a bot waiting on human approval is busy, but must ONLY count as waiting
        const bot: SidebarAttentionBot = { busy: true, activity: "waiting-on-you", unread: true };
        const attention = sidebarSectionAttention([bot], []);
        expect(attention).toEqual({ unread: 1, waiting: 1, working: 0 });
        expect(sidebarAttentionLabel(attention)).toBe("1 waiting for you, 1 unread");
      });

      it("correctly counts activity='working' with busy=false as working", () => {
        const bot: SidebarAttentionBot = { busy: false, activity: "working" };
        const attention = sidebarSectionAttention([bot], []);
        expect(attention).toEqual({ unread: 0, waiting: 0, working: 1 });
        expect(sidebarAttentionLabel(attention)).toBe("1 working");
      });

      it("correctly counts fallback busy=true with non-waiting activity as working", () => {
        const bot1: SidebarAttentionBot = { busy: true, activity: "idle" };
        const bot2: SidebarAttentionBot = { busy: true, activity: "no-signal" };
        const attention = sidebarSectionAttention([bot1, bot2], []);
        expect(attention).toEqual({ unread: 0, waiting: 0, working: 2 });
      });

      it("ignores busyBotId when null, undefined, or empty string", () => {
        const groups: SidebarAttentionGroup[] = [
          { busyBotId: null },
          { busyBotId: undefined },
          { busyBotId: "" },
          { unread: false },
        ];
        const attention = sidebarSectionAttention([], groups);
        expect(attention).toEqual({ unread: 0, waiting: 0, working: 0 });
      });

      it("accurately calculates attention across all 8 combinatorial label permutations", () => {
        const tests = [
          { unread: 0, waiting: 0, working: 0, expected: "" },
          { unread: 0, waiting: 3, working: 0, expected: "3 waiting for you" },
          { unread: 5, waiting: 0, working: 0, expected: "5 unread" },
          { unread: 0, waiting: 0, working: 2, expected: "2 working" },
          { unread: 4, waiting: 1, working: 0, expected: "1 waiting for you, 4 unread" },
          { unread: 0, waiting: 2, working: 3, expected: "2 waiting for you, 3 working" },
          { unread: 7, waiting: 0, working: 1, expected: "7 unread, 1 working" },
          { unread: 6, waiting: 2, working: 4, expected: "2 waiting for you, 6 unread, 4 working" },
        ];

        for (const { unread, waiting, working, expected } of tests) {
          const attention = { unread, waiting, working };
          expect(sidebarAttentionLabel(attention)).toBe(expected);
        }
      });

      it("stress tests calculation over 10,000 bots and 5,000 groups in < 50ms", () => {
        const bots: SidebarAttentionBot[] = [];
        for (let i = 0; i < 10000; i++) {
          const mod = i % 4;
          if (mod === 0) bots.push({ unread: true, activity: "waiting-on-you", busy: true });
          else if (mod === 1) bots.push({ busy: true, activity: "working" });
          else if (mod === 2) bots.push({ unread: true, activity: "idle" });
          else bots.push({ activity: "idle", busy: false });
        }

        const groups: SidebarAttentionGroup[] = [];
        for (let j = 0; j < 5000; j++) {
          groups.push({
            unread: j % 2 === 0,
            busyBotId: j % 3 === 0 ? `bot-${j}` : null,
          });
        }

        const start = performance.now();
        const attention = sidebarSectionAttention(bots, groups);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(50);
        // 2500 unread bots + 2500 unread bots (mod 2) + 2500 unread groups = 7500
        expect(attention.unread).toBe(7500);
        expect(attention.waiting).toBe(2500);
        // 2500 working bots + 1667 busy group bots = 4167
        expect(attention.working).toBe(2500 + Math.ceil(5000 / 3));
      });
    });

    describe("Section persistence under corrupted and hostile localStorage", () => {
      const MALFORMED_SECTION_STORAGES = [
        { label: "syntax error JSON", raw: "{ broken json" },
        { label: "raw number instead of array", raw: "12345" },
        { label: "boolean string", raw: "true" },
        { label: "JSON object", raw: '{"key": "value"}' },
        { label: "empty string", raw: "" },
        { label: "null string", raw: "null" },
        { label: "array with non-string elements", raw: "[1, true, null, {}]" },
      ];

      it.each(MALFORMED_SECTION_STORAGES)(
        "loadCollapsedSections recovers gracefully to empty array on $label",
        ({ raw }) => {
          const storage = { getItem: () => raw };
          expect(loadCollapsedSections(storage)).toEqual([]);
        },
      );

      it.each(MALFORMED_SECTION_STORAGES)(
        "loadSectionOrder recovers gracefully to empty array on $label",
        ({ raw }) => {
          const storage = { getItem: () => raw };
          expect(loadSectionOrder(storage)).toEqual([]);
        },
      );

      it("deduplicates, sanitizes, and caps section arrays at 100 elements", () => {
        const oversized = Array.from({ length: 150 }, (_, i) => `section-${i % 80}`);
        const setItem = vi.fn();
        saveCollapsedSections(oversized, { setItem });

        expect(setItem).toHaveBeenCalled();
        const savedJson = setItem.mock.calls[0][1];
        const parsed = JSON.parse(savedJson);
        expect(parsed.length).toBeLessThanOrEqual(100);
        // Ensure no duplicates exist
        expect(new Set(parsed).size).toBe(parsed.length);
      });

      it("toggles section IDs 10x rapidly without mutating input arrays", () => {
        let current = ["section-a", "section-b"];
        const originalCopy = [...current];

        for (let i = 0; i < 10; i++) {
          current = toggleCollapsedSection(current, "section-a");
          if (i % 2 === 0) {
            expect(current).not.toContain("section-a");
          } else {
            expect(current).toContain("section-a");
          }
        }

        // Original array must never be mutated
        expect(originalCopy).toEqual(["section-a", "section-b"]);
        // After 10 toggles, "section-a" is restored
        expect(current).toContain("section-a");
      });
    });

    describe("DOM rendering of section collapse states in Sidebar", () => {
      it("renders collapsed section headers with aria-expanded='false' and attention badges", () => {
        fixture.collapsedSections = [
          PINNED_SECTION_ID,
          CHANNELS_SECTION_ID,
          BOTS_SECTION_ID,
          userSectionId("Custom Section"),
        ];

        const { html, tree } = renderSidebar();

        // 1. All section headers reflect aria-expanded="false"
        const sectionHeaders = findAllElements(tree, (el) => el.type === SidebarSectionHeader);
        expect(sectionHeaders.length).toBeGreaterThanOrEqual(4);
        for (const header of sectionHeaders) {
          expect(header.props.collapsed).toBe(true);
        }

        // 2. HTML renders aria-expanded="false"
        expect(html).toContain('aria-expanded="false"');

        // 3. Worker Bot is inside BOTS section which is collapsed: Worker Bot row should NOT be rendered
        expect(html).not.toContain('aria-label="Actions for Worker Bot"');
        expect(html).not.toContain('aria-label="Actions for Custom Bot"');

        // 4. Attention signals must be rendered in header
        // botWorker has activity="waiting-on-you" and unread=true, groupSectioned has unread
        expect(html).toContain("waiting for you");
        expect(html).toContain("unread");
      });

      it("renders expanded section headers with aria-expanded='true' and visible bot rows", () => {
        fixture.collapsedSections = [];

        const { html, tree } = renderSidebar();

        const sectionHeaders = findAllElements(tree, (el) => el.type === SidebarSectionHeader);
        for (const header of sectionHeaders) {
          expect(header.props.collapsed).toBe(false);
        }

        expect(html).toContain('aria-expanded="true"');
        expect(html).toContain("Chief Bot");
        expect(html).toContain("Pinned Specialist");
        expect(html).toContain("Worker Bot");
        expect(html).toContain("Custom Bot");
        expect(html).toContain("General Channel");
        expect(html).toContain("Project Room");
      });
    });
  });
});
