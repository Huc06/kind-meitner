import {
  createElement,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  reducer,
  initialState,
  type Action,
  type AppState,
} from "@/state/store";

// Mock dependencies for Sidebar component testing
const fixture = vi.hoisted(() => ({
  showThreads: true,
  state: {} as Partial<AppState>,
  dispatch: vi.fn(),
  density: "icons" as "comfortable" | "compact" | "icons",
}));

vi.mock("@/lib/thread-preferences", () => ({
  useShowThreads: () => fixture.showThreads,
}));

vi.mock("@/components/DesktopCapabilities", () => ({
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
    loadSidebarDensity: () => fixture.density,
    loadCollapsedSections: () => [],
    loadSectionOrder: () => [],
  };
});

vi.mock("@/state/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/store")>();
  return {
    ...original,
    useStore: () => ({
      state: {
        ...original.initialState,
        bots: [
          {
            id: "bot-default",
            threadId: "thread-default",
            name: "Default Bot",
            title: "",
            description: "",
            notifications: true,
            color: "blue",
            unread: false,
            modelSelection: { instanceId: "default", model: "default" },
            messages: [],
          },
        ],
        selectedId: "bot-default",
        ...fixture.state,
      },
      dispatch: fixture.dispatch,
    }),
  };
});

import { Sidebar } from "@/components/Sidebar";

beforeEach(() => {
  fixture.showThreads = true;
  fixture.density = "icons";
  fixture.state = {
    selectedId: "bot-default",
    activeView: "chat",
    activeDisputesCount: 0,
  };
  fixture.dispatch.mockClear();
  vi.stubGlobal("window", {
    innerWidth: 1024,
    innerHeight: 768,
    ogb: { remoteClient: { active: false } },
  });
  vi.stubGlobal("document", { body: {} });
  vi.stubGlobal("HTMLInputElement", class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Challenger M5-2: UI Routing & Dispute Badge Counters", () => {
  describe("1. View Transitions and closeCalendar Origin Restoration", () => {
    /**
     * Replicates the exact state machine & hook mechanics in src/App.tsx:80-84, 153-158, 180-194.
     */
    function simulateAppNavigationLifecycle(
      originView: "chat" | "team-map",
      botId = "bot-default",
    ) {
      let state: AppState = {
        ...initialState,
        selectedId: botId,
        activeView: originView,
      };

      const previousViewRef = { current: state.activeView };
      const calendarOriginRef = { current: "chat" as "chat" | "team-map" };

      const runActiveViewEffect = (newView: AppState["activeView"]) => {
        state = { ...state, activeView: newView };
        if (state.activeView === "routines" && previousViewRef.current !== "routines") {
          calendarOriginRef.current = previousViewRef.current;
        }
        previousViewRef.current = state.activeView;
      };

      const closeCalendar = (dispatchSpy?: (action: Action) => void): Action => {
        let action: Action;
        if (calendarOriginRef.current === "team-map") {
          action = { type: "showTeamMap" };
        } else {
          action = { type: "select", id: state.selectedId };
        }
        dispatchSpy?.(action);
        state = reducer(state, action);
        return action;
      };

      return {
        getState: () => state,
        getOrigin: () => calendarOriginRef.current,
        navigateToRoutines: () => {
          state = reducer(state, { type: "showRoutines" });
          runActiveViewEffect("routines");
        },
        navigateToView: (view: "team-map" | "chat") => {
          const actionMap: Record<string, Action> = {
            "team-map": { type: "showTeamMap" },
            chat: { type: "showChat" },
          };
          state = reducer(state, actionMap[view]);
          runActiveViewEffect(view);
        },
        closeCalendar,
      };
    }

    it("navigates from team-map to routines and closeCalendar restores team-map", () => {
      const nav = simulateAppNavigationLifecycle("team-map");
      expect(nav.getState().activeView).toBe("team-map");

      // Navigate to routines
      nav.navigateToRoutines();
      expect(nav.getState().activeView).toBe("routines");
      expect(nav.getOrigin()).toBe("team-map");

      // Close calendar
      const dispatched = nav.closeCalendar();
      expect(dispatched).toEqual({ type: "showTeamMap" });
      expect(nav.getState().activeView).toBe("team-map");
    });

    it("navigates from chat to routines and closeCalendar restores chat", () => {
      const nav = simulateAppNavigationLifecycle("chat", "bot-default");
      expect(nav.getState().activeView).toBe("chat");

      // Navigate to routines
      nav.navigateToRoutines();
      expect(nav.getState().activeView).toBe("routines");
      expect(nav.getOrigin()).toBe("chat");

      // Close calendar
      const dispatched = nav.closeCalendar();
      expect(dispatched).toEqual({ type: "select", id: "bot-default" });
      expect(nav.getState().activeView).toBe("chat");
    });

    it("handles complex multi-view transitions without clobbering origin", () => {
      // Start in chat -> switch to team-map -> open routines -> close routines
      const nav = simulateAppNavigationLifecycle("chat");
      nav.navigateToView("team-map");
      expect(nav.getState().activeView).toBe("team-map");

      nav.navigateToRoutines();
      expect(nav.getState().activeView).toBe("routines");
      expect(nav.getOrigin()).toBe("team-map");

      nav.closeCalendar();
      expect(nav.getState().activeView).toBe("team-map");

      // Switch to chat -> open routines -> close routines
      nav.navigateToView("chat");
      expect(nav.getState().activeView).toBe("chat");

      nav.navigateToRoutines();
      expect(nav.getState().activeView).toBe("routines");
      expect(nav.getOrigin()).toBe("chat");

      nav.closeCalendar();
      expect(nav.getState().activeView).toBe("chat");
    });

    it("does not corrupt calendarOriginRef if showRoutines is dispatched consecutively while already in routines", () => {
      const nav = simulateAppNavigationLifecycle("team-map");
      nav.navigateToRoutines();
      expect(nav.getOrigin()).toBe("team-map");

      // Redundant navigation to routines
      nav.navigateToRoutines();
      // Should STILL remember team-map, NOT "routines"
      expect(nav.getOrigin()).toBe("team-map");

      nav.closeCalendar();
      expect(nav.getState().activeView).toBe("team-map");
    });

    it("executes the React hook lifecycle inside a rendered component", () => {
      let returnedAction: Action | null = null;
      let hookOrigin: string = "";

      function Harness({
        view,
      }: {
        view: "chat" | "team-map" | "routines";
      }) {
        const previousViewRef = useRef<AppState["activeView"]>("team-map");
        const calendarOriginRef = useRef<"chat" | "team-map">("chat");

        if (view === "routines" && previousViewRef.current !== "routines") {
          calendarOriginRef.current = previousViewRef.current;
        }
        previousViewRef.current = view;
        hookOrigin = calendarOriginRef.current;

        const closeCalendar = useCallback(() => {
          if (calendarOriginRef.current === "team-map") {
            returnedAction = { type: "showTeamMap" };
          } else {
            returnedAction = { type: "select", id: "bot-default" };
          }
        }, []);

        closeCalendar();
        return createElement("div", null, `view:${view}`);
      }

      // Initial render in team-map
      renderToStaticMarkup(createElement(Harness, { view: "team-map" }));
      // Transition to routines
      renderToStaticMarkup(createElement(Harness, { view: "routines" }));

      expect(hookOrigin).toBe("team-map");
      expect(returnedAction).toEqual({ type: "showTeamMap" });
    });
  });

  describe("2. Mock Surface Removal & Dispute Badge Counter Suppression", () => {
    it("strictly does not render Evaluator Disputes or Bloomberg Terminal buttons in icons mode", () => {
      fixture.density = "icons";
      fixture.state = {
        activeDisputesCount: 5,
        activeView: "chat",
      };

      const html = renderToStaticMarkup(
        createElement(Sidebar, { open: true, onClose: vi.fn() }),
      );

      // Must not render Bloomberg or Evaluator buttons or labels
      expect(html).not.toContain('aria-label="Bloomberg Terminal"');
      expect(html).not.toContain('aria-label="Evaluator Disputes"');
      expect(html).not.toContain("Bloomberg Terminal");
      expect(html).not.toContain("Evaluator Disputes");
      expect(html).not.toContain('data-tour="nav-bloomberg"');
      expect(html).not.toContain('data-tour="nav-evaluator"');
    });

    it('strictly suppresses and does NOT render <span data-testid="disputes-badge"> even when activeDisputesCount > 0', () => {
      fixture.density = "icons";
      fixture.state = {
        activeDisputesCount: 5,
        activeView: "chat",
      };

      const html = renderToStaticMarkup(
        createElement(Sidebar, { open: true, onClose: vi.fn() }),
      );

      // Badge must NOT exist in the DOM
      expect(html).not.toContain('data-testid="disputes-badge"');
    });

    it("does not render dispute badge or mock triggers when activeDisputesCount is 1", () => {
      fixture.density = "icons";
      fixture.state = {
        activeDisputesCount: 1,
        activeView: "chat",
      };

      const html = renderToStaticMarkup(
        createElement(Sidebar, { open: true, onClose: vi.fn() }),
      );

      expect(html).not.toContain('data-testid="disputes-badge"');
      expect(html).not.toContain('aria-label="Evaluator Disputes"');
      expect(html).not.toContain('aria-label="Bloomberg Terminal"');
    });

    it("strictly suppresses and hides dispute badge and mock surfaces when activeDisputesCount === 0", () => {
      fixture.density = "icons";
      fixture.state = {
        activeDisputesCount: 0,
        activeView: "chat",
      };

      const html = renderToStaticMarkup(
        createElement(Sidebar, { open: true, onClose: vi.fn() }),
      );

      expect(html).not.toContain('data-testid="disputes-badge"');
      expect(html).not.toContain('aria-label="Evaluator Disputes"');
      expect(html).not.toContain('aria-label="Bloomberg Terminal"');
    });

    it("strictly suppresses dispute badge when activeDisputesCount is undefined", () => {
      fixture.density = "icons";
      fixture.state = {
        activeDisputesCount: undefined,
        activeView: "chat",
      };

      const html = renderToStaticMarkup(
        createElement(Sidebar, { open: true, onClose: vi.fn() }),
      );

      expect(html).not.toContain('data-testid="disputes-badge"');
      expect(html).not.toContain('aria-label="Evaluator Disputes"');
      expect(html).not.toContain('aria-label="Bloomberg Terminal"');
    });

    it("does not include okx-bloomberg or okx-evaluator items in sidebar popover tools menu in expanded mode", () => {
      fixture.density = "comfortable";
      fixture.state = {
        activeDisputesCount: 4,
        activeView: "chat",
      };

      const html = renderToStaticMarkup(
        createElement(Sidebar, { open: true, onClose: vi.fn() }),
      );

      // Popover trigger and comfortable menu must not contain mock views
      expect(html).not.toContain("Bloomberg Terminal");
      expect(html).not.toContain("Evaluator Disputes");
      expect(html).not.toContain('data-testid="disputes-badge"');
    });

    it("maintains state predictability for setActiveDisputesCount without leaking to UI", () => {
      let state: AppState = {
        ...initialState,
        activeDisputesCount: 0,
      };

      // 1. Initial 0 count
      expect(state.activeDisputesCount).toBe(0);

      // 2. Dispatch setActiveDisputesCount = 4
      state = reducer(state, { type: "setActiveDisputesCount", count: 4 });
      expect(state.activeDisputesCount).toBe(4);

      // 3. Clear disputes -> 0
      state = reducer(state, { type: "setActiveDisputesCount", count: 0 });
      expect(state.activeDisputesCount).toBe(0);
    });
  });
});
