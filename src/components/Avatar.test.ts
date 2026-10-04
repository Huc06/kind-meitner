import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BotAvatar,
  MausAvatar,
  defaultMascotBodyForBot,
  resolveBotAvatarOutcome,
  type BotAvatarProps,
  type MausAvatarProps,
} from "./Avatar";

const render = (props: Partial<MausAvatarProps>) =>
  renderToStaticMarkup(createElement(MausAvatar, { color: "green", animated: false, ...props }));

const renderBot = (bot: Partial<BotAvatarProps["bot"]>) =>
  renderToStaticMarkup(
    createElement(BotAvatar, { bot: { color: "green", ...bot }, animated: false }),
  );

describe("MausAvatar body", () => {
  it("wears the default logo when no body is given", () => {
    expect(render({})).toContain('data-agent-logo="cursor"');
  });

  it("wears the mapped body it is given", () => {
    expect(render({ bodyId: "star" })).toContain('data-agent-logo="star"');
    expect(render({ bodyId: "squircle" })).toContain('data-agent-logo="squircle"');
    // each body wears a different logo image
    const src = (bodyId: MausAvatarProps["bodyId"]) => render({ bodyId }).match(/<img[^>]*src="([^"]+)"/)?.[1];
    expect(src("star")).not.toBe(src("squircle"));
  });

  it("falls back to the default logo for an unknown body", () => {
    // SAFETY: "hexagram" is deliberately not a valid MascotBodyId — this
    // exercises the runtime fallback for a value that could arrive from
    // persisted/streamed data, which the type system would otherwise rule
    // out at this call site.
    expect(render({ bodyId: "hexagram" as MausAvatarProps["bodyId"] })).toContain(
      'data-agent-logo="cursor"',
    );
  });

  it("marks working agents and bobs only while animated", () => {
    expect(render({ state: "idle" })).toContain('data-state="resting"');
    expect(render({ state: "working" })).toContain('data-state="working"');
    expect(render({ state: "working", animated: true })).toContain("agent-bob");
    expect(render({ state: "working", animated: false })).not.toContain("agent-bob");
    expect(render({ state: "idle", animated: true })).not.toContain("agent-bob");
  });

  it("names the logo for assistive tech only when labelled", () => {
    expect(render({ label: "Eli" })).toContain('aria-label="Eli"');
    expect(render({})).toContain('aria-hidden="true"');
  });
});

describe("BotAvatar's two avatar outcomes", () => {
  it("renders a flat cropped image for circle/rounded/square, with no mascot at all", () => {
    const markup = renderBot({ avatarUrl: "/api/attachments/cat.webp", avatarCrop: "circle" });
    expect(markup).toContain("<img");
    expect(markup).not.toContain("<canvas");
  });

  it("shows the image as it is, with no mascot face painted on it", () => {
    const markup = renderBot({ avatarUrl: "/api/attachments/cat.webp", avatarCrop: "square" });
    expect(markup).toContain("<img");
    expect(markup).not.toContain("data-agent-logo");
  });

  it("renders the mascot when the crop is mascot, image or not", () => {
    const markup = renderBot({ avatarUrl: "/api/attachments/cat.webp", avatarCrop: "mascot" });
    expect(markup).toContain("data-agent-logo");
    expect(markup).not.toContain("cat.webp");
  });

  it("falls back to the mascot when a flat crop has no valid image", () => {
    const markup = renderBot({ avatarUrl: undefined, avatarCrop: "circle" });
    expect(markup).toContain("data-agent-logo");
  });
});

describe("resolveBotAvatarOutcome", () => {
  // `imageFailed` is set by the flat <img>'s own onError, which
  // renderToStaticMarkup never fires — there are no events in a static
  // render. The decision is a pure function precisely so this branch is
  // still testable synchronously.
  it("falls back to the gradient mascot for an image that failed to load", () => {
    expect(
      resolveBotAvatarOutcome({ avatarCrop: "circle", hasUrl: true, imageFailed: true }),
    ).toBe("gradientMascot");
  });

  it("renders a good flat image flat", () => {
    expect(
      resolveBotAvatarOutcome({ avatarCrop: "rounded", hasUrl: true, imageFailed: false }),
    ).toBe("flatImage");
  });

  it("keeps the mascot crop on the gradient mascot even with a loaded image", () => {
    expect(
      resolveBotAvatarOutcome({ avatarCrop: "mascot", hasUrl: true, imageFailed: false }),
    ).toBe("gradientMascot");
  });

  it("falls back to the gradient mascot when there is no image at all", () => {
    expect(
      resolveBotAvatarOutcome({ avatarCrop: "square", hasUrl: false, imageFailed: false }),
    ).toBe("gradientMascot");
  });
});


describe("catalog bot avatars", () => {
  it("renders catalog bots with distinct logos", () => {
    const spend = renderBot({ name: "Spend Scout", okxImport: { kind: "okx-catalog" } });
    const coach = renderBot({ name: "Listing Coach", okxImport: { kind: "okx-catalog" } });
    const markets = renderBot({ name: "Markets", okxImport: { kind: "okx-catalog" } });

    expect(spend).toContain('data-agent-logo="shield"');
    expect(coach).toContain('data-agent-logo="squircle"');
    expect(markets).toContain('data-agent-logo="star"');
  });

  it("maps catalog and local bots deterministically via defaultMascotBodyForBot", () => {
    // Known external catalog IDs
    expect(defaultMascotBodyForBot({ okxImport: { externalAgentId: "okx-market-scout-v1" } })).toBe("star");
    expect(defaultMascotBodyForBot({ okxImport: { externalAgentId: "okx-listing-coach" } })).toBe("squircle");
    expect(defaultMascotBodyForBot({ okxImport: { externalAgentId: "okx-spend-scout" } })).toBe("shield");

    // Known local bot IDs
    expect(defaultMascotBodyForBot({ id: "tuli" })).toBe("cursor");
    expect(defaultMascotBodyForBot({ id: "atlas" })).toBe("capsule");
    expect(defaultMascotBodyForBot({ id: "risk-inspector" })).toBe("hexagon");
    expect(defaultMascotBodyForBot({ id: "approval-agent" })).toBe("diamond");
    expect(defaultMascotBodyForBot({ id: "scheduler-bot" })).toBe("drop");

    // Semantic roles in title or name
    expect(defaultMascotBodyForBot({ name: "Treasury Guard" })).toBe("shield");
    expect(defaultMascotBodyForBot({ title: "Compliance Auditor" })).toBe("hexagon");
    expect(defaultMascotBodyForBot({ name: "Jury Arbitrator" })).toBe("diamond");

    // Stable deterministic fallback
    const shape1 = defaultMascotBodyForBot({ id: "custom-agent-42" });
    const shape2 = defaultMascotBodyForBot({ id: "custom-agent-42" });
    expect(shape1).toBe(shape2);
    expect(typeof shape1).toBe("string");
  });
});
