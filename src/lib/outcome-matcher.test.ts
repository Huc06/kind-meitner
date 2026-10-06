import { describe, expect, it } from "vitest";
import { BUILTIN_CONNECTED_SERVICES } from "../../shared/connected-services";
import {
  diffOutdoorWindows,
  matchTaskToService,
  type OutdoorWindowItem,
} from "./outcome-matcher";

describe("outcome-matcher", () => {
  const services = BUILTIN_CONNECTED_SERVICES;

  it("matches demo OutdoorWindow task and parses place, activity, and duration", () => {
    const prompt = "When's the best time for a 45-minute run in Singapore over the next two days?";
    const result = matchTaskToService(prompt, services);

    expect(result.matched).toBe(true);
    expect(result.serviceId).toBe("outdoorwindow");
    expect(result.agentId).toBe("6706");
    expect(result.toolName).toBe("get_outdoor_windows");
    expect(result.matchReason).toContain("Matched to OutdoorWindow (okx.ai #6706)");
    expect(result.parsed.inputs).toEqual({
      place: "Singapore",
      activity: "run",
      duration_minutes: 45,
    });
    expect(result.parsed.missingInputs).toHaveLength(0);
  });

  it("detects missing location and flags required missing input", () => {
    const prompt = "When is the best time for a 30-minute run?";
    const result = matchTaskToService(prompt, services);

    expect(result.matched).toBe(true);
    expect(result.serviceId).toBe("outdoorwindow");
    expect(result.parsed.inputs.place).toBeUndefined();
    expect(result.parsed.inputs.activity).toBe("run");
    expect(result.parsed.inputs.duration_minutes).toBe(30);
    expect(result.parsed.missingInputs).toHaveLength(1);
    expect(result.parsed.missingInputs[0].name).toBe("place");
  });

  it("matches 'right now' query to check_outdoor_now tool", () => {
    const prompt = "Is it safe to go outside right now in London?";
    const result = matchTaskToService(prompt, services);

    expect(result.matched).toBe(true);
    expect(result.serviceId).toBe("outdoorwindow");
    expect(result.toolName).toBe("check_outdoor_now");
    expect(result.parsed.inputs.place).toBe("London");
  });

  it("matches social card rendering task to Plate", () => {
    const prompt = "Render a social card for our Q3 milestone";
    const result = matchTaskToService(prompt, services);

    expect(result.matched).toBe(true);
    expect(result.serviceId).toBe("plate");
    expect(result.agentId).toBe("6708");
    expect(result.toolName).toBe("render_card");
    expect(result.matchReason).toContain("Matched to Plate (okx.ai #6708)");
    expect(result.parsed.inputs.text).toBeTruthy();
    expect(result.parsed.missingInputs).toHaveLength(0);
  });

  it("declines unmatched task honestly without fake outputs or invented answers", () => {
    const prompt = "Can you write an essay about quantum computing?";
    const result = matchTaskToService(prompt, services);

    expect(result.matched).toBe(false);
    expect(result.matchReason).toContain("No connected service fits this task");
    expect(result.matchReason).toContain("OutdoorWindow (#6706)");
  });

  describe("diffOutdoorWindows", () => {
    it("reports 'No change since last run' when windows have identical scores and factors", () => {
      const window1: OutdoorWindowItem = {
        rank: 1,
        start: "2026-10-08T05:00:00+08:00",
        end: "2026-10-08T05:45:00+08:00",
        score: 83,
        limiting_factor: "PM2.5 AQI 147, Unhealthy for Sensitive Groups",
      };

      const diff = diffOutdoorWindows([window1], [window1]);
      expect(diff).toBe("No change since last run");
    });

    it("reports score and limiter changes accurately", () => {
      const window1: OutdoorWindowItem = {
        rank: 1,
        start: "2026-10-08T05:00:00+08:00",
        end: "2026-10-08T05:45:00+08:00",
        score: 83,
        limiting_factor: "PM2.5 AQI 147, Unhealthy for Sensitive Groups",
      };
      const window2: OutdoorWindowItem = {
        rank: 1,
        start: "2026-10-08T05:00:00+08:00",
        end: "2026-10-08T05:45:00+08:00",
        score: 87,
        limiting_factor: "PM2.5 AQI 120, Moderate",
      };

      const diff = diffOutdoorWindows([window1], [window2]);
      expect(diff).toContain("Suitability score: 83 → 87");
      expect(diff).toContain("Limiting factor: PM2.5 AQI 120, Moderate");
    });
  });
});
