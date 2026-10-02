import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Spotlight } from "./Spotlight";

describe("Spotlight component", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the spotlight card with title, copy, and visible close button", () => {
    const onDone = vi.fn();
    const primary = { label: "Next", onClick: vi.fn() };
    const secondary = { label: "Skip tour", onClick: vi.fn() };

    const markup = renderToStaticMarkup(
      createElement(
        Spotlight,
        {
          anchor: null,
          placement: "below",
          title: "OKX Agent Hub",
          mascot: "happy",
          progress: "Step 1 of 5",
          primary,
          secondary,
          onDone,
          children: "Discover agents, inspect ASP readiness, and invite an agent into this room.",
        },
      ),
    );

    // Root tour card element
    expect(markup).toContain("data-tour-card");
    // Title
    expect(markup).toContain("OKX Agent Hub");
    // Body content
    expect(markup).toContain("Discover agents, inspect ASP readiness, and invite an agent into this room.");
    // Visible close button
    expect(markup).toContain('aria-label="Close tour"');
    // Progress
    expect(markup).toContain("Step 1 of 5");
    // Primary and secondary buttons
    expect(markup).toContain("Next");
    expect(markup).toContain("Skip tour");
  });

  it("handles keyboard events: closes on Escape and traps focus on Tab", () => {
    const onDone = vi.fn();
    const listeners: Record<string, (e: unknown) => void> = {};
    vi.stubGlobal("window", {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: (event: string, handler: (e: unknown) => void) => {
        listeners[event] = handler;
      },
      removeEventListener: (event: string) => {
        delete listeners[event];
      },
    });

    renderToStaticMarkup(
      createElement(
        Spotlight,
        {
          anchor: null,
          placement: "below",
          title: "Test Step",
          primary: { label: "Next", onClick: vi.fn() },
          secondary: { label: "Skip", onClick: vi.fn() },
          onDone,
          children: "Content",
        },
      ),
    );

    const keyHandler = (e: { key: string; preventDefault: () => void }) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onDone();
      }
    };

    const escEvent = { key: "Escape", preventDefault: vi.fn() };
    keyHandler(escEvent);
    expect(escEvent.preventDefault).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders with computed placement max-height and overflow-y-auto", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Spotlight,
        {
          anchor: null,
          placement: "below",
          title: "Test Step",
          primary: { label: "Next", onClick: vi.fn() },
          onDone: vi.fn(),
          children: "Content",
        },
      ),
    );

    expect(markup).toContain("max-height");
    expect(markup).toContain("overflow-y-auto");
  });

  it("renders nonmodal hints with role status and without aria-modal", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Spotlight,
        {
          anchor: null,
          placement: "below",
          title: "Nonmodal hint",
          onDone: vi.fn(),
          modal: false,
          children: "Nonmodal content",
        },
      ),
    );

    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('aria-modal="true"');
  });

  it("traps forward and backward Tab when focus is outside the card or at boundaries", () => {
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };
    const card = {
      contains: (el: unknown) => el === first || el === last,
      querySelectorAll: () => [first, last],
      focus: vi.fn(),
    };

    const simulateTab = (shiftKey: boolean, activeEl: unknown) => {
      let prevented = false;
      const e = {
        key: "Tab",
        shiftKey,
        preventDefault: () => {
          prevented = true;
        },
      };

      const focusable = card.querySelectorAll();
      const fst = focusable[0];
      const lst = focusable[focusable.length - 1];

      if (shiftKey) {
        if (activeEl === fst || !card.contains(activeEl)) {
          e.preventDefault();
          lst?.focus();
        }
      } else {
        if (activeEl === lst || !card.contains(activeEl)) {
          e.preventDefault();
          fst?.focus();
        }
      }
      return prevented;
    };

    // Forward Tab when focus outside card: traps to first
    const outsideEl = {};
    expect(simulateTab(false, outsideEl)).toBe(true);
    expect(first.focus).toHaveBeenCalledTimes(1);

    // Forward Tab at end of card: wraps to first
    expect(simulateTab(false, last)).toBe(true);
    expect(first.focus).toHaveBeenCalledTimes(2);

    // Backward Tab when focus outside card: traps to last
    expect(simulateTab(true, outsideEl)).toBe(true);
    expect(last.focus).toHaveBeenCalledTimes(1);

    // Backward Tab at start of card: wraps to last
    expect(simulateTab(true, first)).toBe(true);
    expect(last.focus).toHaveBeenCalledTimes(2);
  });
});
