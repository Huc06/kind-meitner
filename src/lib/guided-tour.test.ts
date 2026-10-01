import { describe, expect, it } from "vitest";
import { EMPTY_ONBOARDING } from "./onboarding";
import {
  ANCHOR_EFFECTS,
  currentStep,
  isTourCompleted,
  isTourEligible,
  stepNumber,
  TOUR_STEPS,
  withTourFinished,
  withTourReset,
} from "./guided-tour";

const withDone = (ids: string[]) => ({ ...EMPTY_ONBOARDING, hintsSeen: ids });
const step = (id: string) => TOUR_STEPS.find((s) => s.id === id)!;

describe("guided tour", () => {
  it("starts at the composer and ends back on the chat", () => {
    expect(currentStep(undefined)?.id).toBe("tour.composer");
    expect(TOUR_STEPS.at(-1)?.id).toBe("tour.done");
    expect(TOUR_STEPS.at(-1)?.anchor).toBe("composer");
  });

  it("resumes at the first unfinished step", () => {
    expect(currentStep(withDone(["tour.composer", "tour.model"]))?.id).toBe("tour.computer");
    expect(currentStep(withDone(TOUR_STEPS.map((s) => s.id)))).toBeNull();
    expect(currentStep(withDone(["spot.composer"]))?.id).toBe("tour.composer");
  });

  it("numbers steps without counting the closing card", () => {
    expect(stepNumber(TOUR_STEPS[0]!)).toEqual({ current: 1, total: TOUR_STEPS.length - 1 });
    expect(stepNumber(TOUR_STEPS.at(-1)!).current).toBe(TOUR_STEPS.length - 1);
  });

  it("resets and finishes without touching other hints", () => {
    const record = withDone(["spot.approval", "tour.composer"]);
    expect(withTourReset(record)).toEqual(["spot.approval"]);
    const finished = withTourFinished(record);
    expect(finished).toContain("spot.approval");
    for (const s of TOUR_STEPS) expect(finished).toContain(s.id);
    expect(new Set(finished).size).toBe(finished.length);
  });

  it("goes through the Tools menu rather than straight to the pages", () => {
    expect(step("tour.tools").onExit).toBe("openTools");
    expect(step("tour.apps").onExit).toBe("openApps");
    expect(step("tour.automations").onEnter).toBe("openTools");
    expect(step("tour.automations").onExit).toBe("openAutomations");
    for (const s of TOUR_STEPS.filter((x) => x.anchor?.startsWith("nav-"))) expect(s.skipIfMissing).toBe(true);
  });

  it("points Agent Hub at real nav-apps and apps-panel anchors", () => {
    const appsStep = step("tour.apps");
    expect(appsStep.anchor).toBe("nav-apps");
    expect(appsStep.skipIfMissing).toBe(true);
    expect(appsStep.onEnter).toBe("openTools");
    expect(appsStep.onExit).toBe("openApps");

    const appsPanelStep = step("tour.apps-panel");
    expect(appsPanelStep.anchor).toBe("apps-panel");
    expect(appsPanelStep.onEnter).toBe("openApps");
    expect(appsPanelStep.onExit).toBe("closeApps");
  });

  it("targets readiness and trust starter chips with skipIfMissing anchors", () => {
    const readiness = step("tour.readiness");
    expect(readiness.anchor).toBe("starter-readiness");
    expect(readiness.fallbackAnchor).toBe("starters");
    expect(readiness.skipIfMissing).toBe(true);
    expect(readiness.placement).toBe("above");

    const trust = step("tour.trust");
    expect(trust.anchor).toBe("starter-trust");
    expect(trust.fallbackAnchor).toBe("starters");
    expect(trust.skipIfMissing).toBe(true);
    expect(trust.placement).toBe("above");
  });

  it("rebuilds the scene on enter so a reload mid-tour resumes cleanly", () => {
    expect(step("tour.computer-browser").onEnter).toBe("openComputer");
    expect(step("tour.computer-browser").fallbackAnchor).toBe("computer-tabs");
    expect(step("tour.apps").onEnter).toBe("openTools");
    expect(step("tour.apps-panel").onEnter).toBe("openApps");
    expect(step("tour.automations-page").onEnter).toBe("openAutomations");
  });

  it("closes everything it opened and returns to the chat", () => {
    expect(step("tour.computer").onExit).toBe("openComputer");
    expect(step("tour.computer-browser").onExit).toBe("closeComputer");
    expect(step("tour.apps-panel").onExit).toBe("closeApps");
    expect(step("tour.automations-page").onExit).toBe("backToChat");
  });

  it("knows which effects the control's own click performs", () => {
    for (const s of TOUR_STEPS) {
      if (s.onExit && ANCHOR_EFFECTS.has(s.onExit)) expect(s.anchor).not.toBeNull();
    }
    expect(ANCHOR_EFFECTS.has("closeApps")).toBe(false);
  });

  describe("dismissal persistence and eligibility", () => {
    it("gates tour eligibility against remote clients, welcome flow state, and completion", () => {
      expect(isTourEligible({ remoteClient: true, completedAt: "2026-10-01T00:00:00Z", welcomeOpen: false })).toBe(false);
      expect(isTourEligible({ remoteClient: false, completedAt: undefined, welcomeOpen: false })).toBe(false);
      expect(isTourEligible({ remoteClient: false, completedAt: "2026-10-01T00:00:00Z", welcomeOpen: true })).toBe(false);
      expect(isTourEligible({ remoteClient: false, completedAt: "2026-10-01T00:00:00Z", welcomeOpen: false })).toBe(true);
    });

    it("identifies when the tour is completed via isTourCompleted", () => {
      expect(isTourCompleted(undefined)).toBe(false);
      expect(isTourCompleted(withDone(["tour.composer"]))).toBe(false);
      const allDone = withDone(TOUR_STEPS.map((s) => s.id));
      expect(isTourCompleted(allDone)).toBe(true);
    });

    it("never re-shows the tour when all steps are present in hintsSeen", () => {
      const allDone = TOUR_STEPS.map((s) => s.id);
      expect(
        isTourEligible({
          remoteClient: false,
          completedAt: "2026-10-01T00:00:00Z",
          welcomeOpen: false,
          hintsSeen: allDone,
        }),
      ).toBe(false);

      expect(currentStep(withDone(allDone))).toBeNull();
    });

    it("remembers dismissed/completed state across reloads via hintsSeen", () => {
      const initial = withDone(["spot.approval"]);
      const finished = withTourFinished(initial);
      const updatedRecord = withDone(finished);

      expect(isTourCompleted(updatedRecord)).toBe(true);
      expect(currentStep(updatedRecord)).toBeNull();
      expect(
        isTourEligible({
          remoteClient: false,
          completedAt: "2026-10-01T00:00:00Z",
          welcomeOpen: false,
          hintsSeen: updatedRecord.hintsSeen,
        }),
      ).toBe(false);
    });
  });

  it("caps withTourFinished to at most 100 items for server schema validation", () => {
    const longHints = Array.from({ length: 120 }, (_, i) => `hint.${i}`);
    const finished = withTourFinished(withDone(longHints));
    expect(finished.length).toBeLessThanOrEqual(100);
  });
});
