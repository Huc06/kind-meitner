import { describe, expect, it } from "vitest";
import { EMPTY_ONBOARDING } from "./onboarding";
import {
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
  it("consists of exactly 4 steps: room, agents, readiness, trust", () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      "tour.room",
      "tour.agents",
      "tour.readiness",
      "tour.trust",
    ]);
    expect(currentStep(undefined)?.id).toBe("tour.room");
    expect(step("tour.room").anchor).toBe("composer");
    expect(step("tour.agents").anchor).toBe("nav-apps");
    expect(step("tour.readiness").anchor).toBe("starter-readiness");
    expect(step("tour.trust").anchor).toBe("starter-trust");
  });

  it("resumes at the first unfinished step", () => {
    expect(currentStep(withDone(["tour.room"]))?.id).toBe("tour.agents");
    expect(currentStep(withDone(["tour.room", "tour.agents"]))?.id).toBe("tour.readiness");
    expect(currentStep(withDone(TOUR_STEPS.map((s) => s.id)))).toBeNull();
    expect(currentStep(withDone(["spot.composer"]))?.id).toBe("tour.room");
  });

  it("numbers steps 1 to 4 accurately", () => {
    expect(stepNumber(TOUR_STEPS[0]!)).toEqual({ current: 1, total: 4 });
    expect(stepNumber(TOUR_STEPS[1]!)).toEqual({ current: 2, total: 4 });
    expect(stepNumber(TOUR_STEPS[2]!)).toEqual({ current: 3, total: 4 });
    expect(stepNumber(TOUR_STEPS[3]!)).toEqual({ current: 4, total: 4 });
  });

  it("resets and finishes without touching other hints", () => {
    const record = withDone(["spot.approval", "tour.room"]);
    expect(withTourReset(record)).toEqual(["spot.approval"]);
    const finished = withTourFinished(record);
    expect(finished).toContain("spot.approval");
    for (const s of TOUR_STEPS) expect(finished).toContain(s.id);
    expect(new Set(finished).size).toBe(finished.length);
  });
  it("points Agent Hub at real nav-apps anchor with apps-panel fallback", () => {
    const agentsStep = step("tour.agents");
    expect(agentsStep.anchor).toBe("nav-apps");
    expect(agentsStep.fallbackAnchor).toBe("apps-panel");
    expect(agentsStep.skipIfMissing).toBe(true);
    expect(agentsStep.placement).toBe("right");
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

  it("provides backward compatibility for legacy tour completions", () => {
    // Legacy user who completed the old tour has "tour.done" in hintsSeen
    const legacyDone = withDone(["tour.done"]);
    expect(isTourCompleted(legacyDone)).toBe(true);
    expect(currentStep(legacyDone)).toBeNull();
    expect(
      isTourEligible({
        remoteClient: false,
        completedAt: "2026-09-01T00:00:00Z",
        welcomeOpen: false,
        hintsSeen: ["tour.done"],
      }),
    ).toBe(false);

    // Resetting tour removes legacy steps as well
    const withLegacy = withDone(["spot.approval", "tour.composer", "tour.done"]);
    expect(withTourReset(withLegacy)).toEqual(["spot.approval"]);
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
