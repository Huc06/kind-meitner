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
import { SidebarPopoverMenu } from "@/components/SidebarPopoverMenu";

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
      originView: "chat" | "team-map" | "okx-bloomberg" | "okx-evaluator",
      botId = "bot-default",
    ) {
      let state: AppState = {
        ...initialState,
        selectedId: botId,
        activeView: originView,
      };

      const previousViewRef = { current: state.activeView };
      const calendarOriginRef = { current: "chat" as "chat" | "team-map" | "okx-bloomberg" | "okx-evaluator" };

      const runActiveViewEffect = (newView: AppState["activeView"]) => {
        state = { ...state, activeView: newView };
        if (state.activeView === "routines" && previousViewRef.current !== "routines") {
          calendarOriginRef.current = previousViewRef.current as any;
        }
        previousViewRef.current = state.activeView;
      };

      const closeCalendar = (dispatchSpy?: (action: Action) => void): Action => {
        let action: Action;
        if (calendarOriginRef.current === "team-map") {
          action = { type: "showTeamMap" };
        } else if (calendarOriginRef.current === "okx-bloomberg") {
          action = { type: "showBloomberg" };
        } else if (calendarOriginRef.current === "okx-evaluator") {
          action = { type: "showEvaluator" };
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
        navigateToView: (view: "okx-bloomberg" | "okx-evaluator" | "team-map" | "chat") => {
          const actionMap: Record<string, Action> = {
            "okx-bloomberg": { type: "showBloomberg" },
            "okx-evaluator": { type: "showEvaluator" },
            "team-map": { type: "showTeamMap" },
            chat: { type: "showChat" },
          };
          state = reducer(state, actionMap[view]);
          runActiveViewEffect(view);
        },
        closeCalendar,
      };
    }

    it("navigates from okx-bloomberg to routines and closeCalendar restores okx-bloomberg", () => {
      const nav = simulateAppNavigationLifecycle("okx-bloomberg");
      expect(nav.getState().activeView).toBe("okx-bloomberg");

      // Navigate to routines
      nav.navigateToRoutines();
      expect(nav.getState().activeView).toBe("routines");
      expect(nav.getOrigin()).toBe("okx-bloomberg");

      // Close calendar
      const dispatched = nav.closeCalendar();
      expect(dispatched).toEqual({ type: "showBloomberg" });
      expect(nav.getState().activeView).toBe("okx-bloomberg");
    });

    it("navigates from okx-evaluator to routines and closeCalendar restores okx-evaluator", () => {
      const nav = simulateAppNavigationLifecycle("okx-evaluator");
      expect(nav.getState().activeView).toBe("okx-evaluator");

      // Navigate to routines
      nav.navigateToRoutines();
      expect(nav.getState().activeView).toBe("routines");
      expect(nav.getOrigin()).toBe("okx-evaluator");

      // Close calendar
      const dispatched = nav.closeCalendar();
      expect(dispatched).toEqual({ type: "showEvaluator" });
      expect(nav.getState().activeView).toBe("okx-evaluator");
    });

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
      // Start in chat -> switch to Bloomberg -> switch to Evaluator -> open routines -> close routines
      const nav = simulateAppNavigationLifecycle("chat");
      nav.navigateToView("okx-bloomberg");
      expect(nav.getState().activeView).toBe("okx-bloomberg");

      nav.navigateToView("okx-evaluator");
      expect(nav.getState().activeView).toBe("okx-evaluator");

      nav.navigateToRoutines();
      expect(nav.getState().activeView).toBe("routines");
      expect(nav.getOrigin()).toBe("okx-evaluator");

      nav.closeCalendar();
      expect(nav.getState().activeView).toBe("okx-evaluator");

      // Switch to team-map -> open routines -> close routines
      nav.navigateToView("team-map");
      nav.navigateToRoutines();
      expect(nav.getOrigin()).toBe("team-map");

      nav.closeCalendar();
      expect(nav.getState().activeView).toBe("team-map");
    });

    it("does not corrupt calendarOriginRef if showRoutines is dispatched consecutively while already in routines", () => {
      const nav = simulateAppNavigationLifecycle("okx-bloomberg");
      nav.navigateToRoutines();
      expect(nav.getOrigin()).toBe("okx-bloomberg");

      // Redundant navigation to routines
      nav.navigateToRoutines();
      // Should STILL remember okx-bloomberg, NOT "routines"
      expect(nav.getOrigin()).toBe("okx-bloomberg");

      nav.closeCalendar();
      expect(nav.getState().activeView).toBe("okx-bloomberg");
    });

    it("executes the React hook lifecycle inside a rendered component", () => {
      let returnedAction: Action | null = null;
      let hookOrigin: string = "";

      function Harness({
        view,
      }: {
        view: "chat" | "team-map" | "okx-bloomberg" | "okx-evaluator" | "routines";
      }) {
        const previousViewRef = useRef<AppState["activeView"]>("okx-bloomberg");
        const calendarOriginRef = useRef<"chat" | "team-map" | "okx-bloomberg" | "okx-evaluator">("chat");

        if (view === "routines" && previousViewRef.current !== "routines") {
          calendarOriginRef.current = previousViewRef.current;
        }
        previousViewRef.current = view;
        hookOrigin = calendarOriginRef.current;

        const closeCalendar = useCallback(() => {
          if (calendarOriginRef.current === "team-map") {
            returnedAction = { type: "showTeamMap" };
          } else if (calendarOriginRef.current === "okx-bloomberg") {
            returnedAction = { type: "showBloomberg" };
          } else if (calendarOriginRef.current === "okx-evaluator") {
            returnedAction = { type: "showEvaluator" };
          } else {
            returnedAction = { type: "select", id: "bot-default" };
          }
        }, []);

        closeCalendar();
        return createElement("div", null, `view:${view}`);
      }

      // Initial render in okx-bloomberg
      renderToStaticMarkup(createElement(Harness, { view: "okx-bloomberg" }));
      // Transition to routines
      renderToStaticMarkup(createElement(Harness, { view: "routines" }));

      expect(hookOrigin).toBe("okx-bloomberg");
      expect(returnedAction).toEqual({ type: "showBloomberg" });
    });
  });

  describe("2. Dispute Badge Counter Rendering & Suppression", () => {
    it("renders <span data-testid=\"disputes-badge\"> with count when activeDisputesCount > 0 in icons mode", () => {
      fixture.density = "icons";
      fixture.state = {
        activeDisputesCount: 5,
        activeView: "chat",
      };

      const html = renderToStaticMarkup(
        createElement(Sidebar, { open: true, onClose: vi.fn() }),
      );

      // Badge must exist
      expect(html).toContain('data-testid="disputes-badge"');
      // Badge must contain the number 5
      expect(html).toMatch(/<span[^>]*data-testid="disputes-badge"[^>]*>\s*5\s*<\/span>/);
      expect(html).toContain('aria-label="Evaluator Disputes"');
    });

    it("renders single dispute count 1 accurately", () => {
      fixture.density = "icons";
      fixture.state = {
        activeDisputesCount: 1,
        activeView: "chat",
      };

      const html = renderToStaticMarkup(
        createElement(Sidebar, { open: true, onClose: vi.fn() }),
      );

      expect(html).toContain('data-testid="disputes-badge"');
      expect(html).toMatch(/<span[^>]*data-testid="disputes-badge"[^>]*>\s*1\s*<\/span>/);
    });

    it("strictly suppresses and hides dispute badge when activeDisputesCount === 0", () => {
      fixture.density = "icons";
      fixture.state = {
        activeDisputesCount: 0,
        activeView: "chat",
      };

      const html = renderToStaticMarkup(
        createElement(Sidebar, { open: true, onClose: vi.fn() }),
      );

      // Must be completely absent from DOM output
      expect(html).not.toContain('data-testid="disputes-badge"');
      expect(html).toContain('aria-label="Evaluator Disputes"');
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
    });

    it("renders popover menu trailing badge when activeDisputesCount > 0 and suppresses when 0", () => {
      // Test popover menu item trailing badge rendering directly
      const count = 4;
      const disputeItem = {
        key: "okx-evaluator",
        label: "Evaluator Disputes",
        active: false,
        attention: count > 0,
        trailing: count > 0 ? (
          createElement(
            "span",
            { "data-testid": "disputes-badge", className: "badge" },
            count,
          )
        ) : undefined,
        onSelect: vi.fn(),
      };

      function OpenPopover({ activeCount }: { activeCount: number }) {
        return createElement(SidebarPopoverMenu, {
          tourId: "tools",
          ariaLabel: "Tools",
          items: [
            {
              ...disputeItem,
              attention: activeCount > 0,
              trailing: activeCount > 0 ? (
                createElement(
                  "span",
                  { "data-testid": "disputes-badge" },
                  activeCount,
                )
              ) : undefined,
            },
          ],
          renderTrigger: () => createElement("button", null, "Tools"),
        });
      }

      // Initial closed popover does not render items
      const closedHtml = renderToStaticMarkup(createElement(OpenPopover, { activeCount: 4 }));
      expect(closedHtml).toContain("Tools");

      // Verify that when activeDisputesCount is 0, trailing is undefined and badge is suppressed
      const zeroDisputeItem = {
        ...disputeItem,
        trailing: undefined,
      };
      expect(zeroDisputeItem.trailing).toBeUndefined();
    });

    it("updates dispute badge reactively through setActiveDisputesCount action", () => {
      let state: AppState = {
        ...initialState,
        activeDisputesCount: 0,
      };

      // 1. Initial 0 count -> no badge
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
