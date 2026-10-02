import { describe, expect, it, vi, afterAll } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal("window", {
    ogb: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    location: { href: "http://localhost:3000/" },
    history: { replaceState: vi.fn() },
    document: { body: {}, referrer: "" },
  });
});

vi.mock("@/lib/analytics", () => ({
  initAnalytics: vi.fn(),
  emailGateDone: vi.fn(() => true),
}));

import { handleInitialNavigation } from "./App";

describe("handleInitialNavigation deep links", () => {
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("opens agent hub and strips ?panel=agent-hub from url", () => {
    const dispatch = vi.fn();
    const replaceState = vi.fn();

    handleInitialNavigation("http://localhost:3000/?panel=agent-hub", dispatch, replaceState);

    expect(dispatch).toHaveBeenCalledWith({
      type: "togglePlugins",
      open: true,
      surface: "hub",
    });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/");
  });

  it("preserves other query parameters while stripping panel=agent-hub", () => {
    const dispatch = vi.fn();
    const replaceState = vi.fn();

    handleInitialNavigation("http://localhost:3000/?tab=logs&panel=agent-hub#anchor", dispatch, replaceState);

    expect(dispatch).toHaveBeenCalledWith({
      type: "togglePlugins",
      open: true,
      surface: "hub",
    });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/?tab=logs#anchor");
  });

  it("does nothing when panel parameter is not agent-hub", () => {
    const dispatch = vi.fn();
    const replaceState = vi.fn();

    handleInitialNavigation("http://localhost:3000/?panel=settings", dispatch, replaceState);

    expect(dispatch).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("opens team-map and strips view param", () => {
    const dispatch = vi.fn();
    const replaceState = vi.fn();

    handleInitialNavigation("http://localhost:3000/?view=team-map", dispatch, replaceState);

    expect(dispatch).toHaveBeenCalledWith({
      type: "showTeamMap",
    });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/");
  });
});
