import { describe, expect, it } from "vitest";
import { resolveLandingAppUrl } from "../apps/docs/components/landing-home";

describe("resolveLandingAppUrl", () => {
  it("resolves to local companion app URL when browsing from localhost or 127.0.0.1", () => {
    expect(resolveLandingAppUrl("http://localhost:3000")).toBe("http://localhost:5199/");
    expect(resolveLandingAppUrl("http://127.0.0.1:3005")).toBe("http://127.0.0.1:5199/");
    expect(resolveLandingAppUrl("http://127.0.0.1:5199")).toBe("http://127.0.0.1:5199");
  });

  it("falls back to GitHub releases when on non-local origin and no env URL is configured", () => {
    expect(resolveLandingAppUrl("https://docs.kind-meitner.com")).toBe(
      "https://github.com/harrymove-ctrl/kind-meitner/releases/latest",
    );
  });

  it("safely handles undefined or malformed origins", () => {
    expect(resolveLandingAppUrl(undefined)).toBe(
      "https://github.com/harrymove-ctrl/kind-meitner/releases/latest",
    );
    expect(resolveLandingAppUrl("not-a-valid-url")).toBe(
      "https://github.com/harrymove-ctrl/kind-meitner/releases/latest",
    );
  });
});
