import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import type { AppState, Bot, InstanceInfo, Message } from "@/state/store";
import { t } from "@/lib/i18n";
import type { ApprovalModeSelector } from "./ApprovalModeSelector";
import type { ModelPicker } from "./ModelPicker";

const fixture = vi.hoisted(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  return {
    dispatch: vi.fn(),
    appendComposerDraft: vi.fn(),
    state: {} as Partial<AppState>,
    model: null as ComponentProps<typeof ModelPicker> | null,
    approval: null as ComponentProps<typeof ApprovalModeSelector> | null,
  };
});

vi.mock("@/state/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/store")>();
  return {
    ...original,
    useStore: () => ({
      state: {
        ...original.initialState,
        instances: [{ instanceId: "test", driverKind: "codex", displayName: "Test" } as InstanceInfo],
        ...fixture.state,
      },
      dispatch: fixture.dispatch,
    }),
  };
});

vi.mock("@/lib/drafts", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/drafts")>();
  return {
    ...original,
    appendComposerDraft: fixture.appendComposerDraft,
  };
});

vi.mock("./DesktopCapabilities", async (importOriginal) => ({
  ...await importOriginal<typeof import("./DesktopCapabilities")>(),
  useDesktopCapabilities: () => ({
    capabilities: { dictation: { available: false }, host: { packaged: true } },
    ready: true,
  }),
}));

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

vi.mock("./ModelPicker", () => ({
  ModelPicker: (props: ComponentProps<typeof ModelPicker>) => {
    fixture.model = props;
    return createElement("span", { "data-test-model-control": true });
  },
}));

vi.mock("./ApprovalModeSelector", () => ({
  ApprovalModeSelector: (props: ComponentProps<typeof ApprovalModeSelector>) => {
    fixture.approval = props;
    return createElement("span", { "data-test-approval-control": true });
  },
}));

const { ChatView, STARTER_PROMPTS } = await import("./ChatView");

afterAll(() => vi.unstubAllGlobals());
afterEach(() => {
  fixture.dispatch.mockClear();
  fixture.appendComposerDraft.mockClear();
  fixture.state = {};
  delete window.ogb;
});

const baseBot: Bot = {
  id: "bot",
  threadId: "selected",
  name: "Pepper",
  title: "",
  description: "Helpful companion",
  color: "green",
  notifications: true,
  unread: false,
  busy: false,
  messages: [],
  modelSelection: { instanceId: "test", model: "profile-default" },
  tasks: [
    {
      threadId: "selected",
      title: "Selected",
      createdAt: 1,
      busy: false,
      activity: "idle",
      modelSelection: { instanceId: "test", model: "thread-model" },
      approvalMode: "ask",
    },
  ],
};

const userMessage: Message = {
  id: "m-user-1",
  role: "user",
  kind: "text",
  at: 1700000000000,
  text: "Can you analyze the project structure?",
};

const botMessage: Message = {
  id: "m-bot-1",
  role: "bot",
  kind: "text",
  at: 1700000005000,
  text: "Certainly! The workspace is structured into frontend and backend components.",
};

describe("ChatView Layout & Workspace Refinement", () => {
  describe("Header & Status Subtitle", () => {
    it("renders bot name, hairline bottom border, and sticky backdrop-blur container", () => {
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: baseBot }));
      expect(markup).toContain("Pepper");
      expect(markup).toContain("border-b border-hairline/40");
      expect(markup).toContain("sticky top-0 z-20");
      expect(markup).toContain("backdrop-blur-sm");
      expect(markup).toContain("bg-app/90");
    });

    it("renders 2-line title and status block: Online badge and active model pill when idle", () => {
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: baseBot }));
      expect(markup).toContain("Online");
      expect(markup).toContain("bg-emerald-500");
      expect(markup).toContain("thread-model");
    });

    it("renders Working... status with WorkingDots when bot is busy", () => {
      const busyBot: Bot = {
        ...baseBot,
        busy: true,
        tasks: [{ ...baseBot.tasks![0]!, busy: true, activity: "working" }],
      };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: busyBot }));
      expect(markup).toContain("Working...");
      expect(markup).toContain("animate-status-pulse");
    });

    it("renders Chief of Staff badge with crown icon when chiefOfStaff is true", () => {
      const chiefBot: Bot = { ...baseBot, chiefOfStaff: true };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: chiefBot }));
      expect(markup).toContain(t("chat.chiefOfStaff"));
    });

    it("rationalizes right action cluster with responsive breakpoints to avoid title crowding", () => {
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: baseBot }));
      expect(markup).toContain("@max-3xl/chathead:hidden");
      expect(markup).toContain("@max-2xl/chathead:hidden");
      expect(markup).toContain("@max-xl/chathead:hidden");
      expect(markup).toContain('aria-label="' + t("chat.find") + '"');
      expect(markup).toContain("data-test-model-control");
    });
  });

  describe("Transcript Reading Lane Alignment", () => {
    it("wraps transcript content in mx-auto w-full max-w-3xl px-5 lane directly matching Composer", () => {
      const botWithMessages: Bot = {
        ...baseBot,
        messages: [userMessage, botMessage],
      };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: botWithMessages }));
      expect(markup).toContain('role="log"');
      expect(markup).toContain("mx-auto flex w-full max-w-3xl flex-col gap-3 px-5");
    });

    it("preserves composer dock padding measurement on the transcript container", () => {
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: baseBot }));
      expect(markup).toContain('role="log"');
      expect(markup).toContain('style="padding-bottom:');
    });
  });

  describe("Message Action Toolbars & Directional Bubbles", () => {
    it("renders user bubble with directional corner rounded-tr-sm and action shelf beneath", () => {
      const botWithMessages: Bot = {
        ...baseBot,
        messages: [userMessage],
      };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: botWithMessages }));
      expect(markup).toContain("bg-bubble-user");
      expect(markup).toContain("rounded-tr-sm");
      expect(markup).toContain("mt-1.5 flex items-center justify-end gap-1");
      expect(markup).toContain('aria-label="' + t("chat.editMessage") + '"');
      expect(markup).toContain('aria-label="' + t("chat.copyMessage") + '"');
      expect(markup).toContain('aria-label="' + t("chat.replyToMessage") + '"');
      expect(markup).toContain('aria-label="' + t("chat.pinMessage") + '"');
    });

    it("renders bot bubble with directional corner rounded-tl-sm and unified horizontal action shelf beneath", () => {
      const botWithMessages: Bot = {
        ...baseBot,
        messages: [userMessage, botMessage],
      };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: botWithMessages }));
      expect(markup).toContain("bg-card");
      expect(markup).toContain("rounded-tl-sm");
      expect(markup).toContain("mt-1.5 flex items-center gap-1 text-ink-secondary");
      expect(markup).toContain('aria-label="' + t("chat.copyMessage") + '"');
      expect(markup).toContain('aria-label="' + t("chat.showRawMarkdown") + '"');
      expect(markup).toContain('aria-label="' + t("chat.replyToMessage") + '"');
      expect(markup).toContain('aria-label="' + t("chat.pinMessage") + '"');
      expect(markup).toContain('aria-label="' + t("chat.regenerate") + '"');
    });

    it("hides regenerate button when bot is busy", () => {
      const botWithMessagesBusy: Bot = {
        ...baseBot,
        busy: true,
        tasks: [{ ...baseBot.tasks![0]!, busy: true, activity: "working" }],
        messages: [userMessage, botMessage],
      };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: botWithMessagesBusy }));
      expect(markup).not.toContain('aria-label="' + t("chat.regenerate") + '"');
    });
  });

  describe("Modern Interactive Empty State", () => {
    it("renders vertically centered empty state with avatar, description, and starter prompt chips", () => {
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: baseBot }));
      expect(markup).toContain("min-h-[50vh]");
      expect(markup).toContain("items-center justify-center");
      expect(markup).toContain("Helpful companion");
      for (const prompt of STARTER_PROMPTS) {
        expect(markup).toContain(prompt);
      }
    });

    it("exports standard starter suggestions", () => {
      expect(STARTER_PROMPTS).toContain("Draft a test plan");
      expect(STARTER_PROMPTS).toContain("Analyze project structure");
      expect(STARTER_PROMPTS).toContain("Review git diff");
    });

    it("renders each starter prompt chip as an interactive rounded button", () => {
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: baseBot }));
      for (const prompt of STARTER_PROMPTS) {
        expect(markup).toContain(`type="button"`);
        expect(markup).toContain(prompt);
      }
      expect(markup).toContain("rounded-full border border-hairline/60");
    });
  });

  describe("Remote Client & Day Separators", () => {
    it("hides model control and inspector for remote clients", () => {
      window.ogb = { remoteClient: { active: true } } as NonNullable<Window["ogb"]>;
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: baseBot }));
      expect(markup).not.toContain("data-test-model-control");
      expect(markup).not.toContain('aria-label="' + t("chat.inspector") + '"');
    });

    it("renders day separator with hairline divider rules between different days", () => {
      const day1Message: Message = { id: "m1", role: "user", kind: "text", at: 1700000000000, text: "Day 1" };
      const day2Message: Message = { id: "m2", role: "user", kind: "text", at: 1700200000000, text: "Day 2" };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: { ...baseBot, messages: [day1Message, day2Message] } }));
      expect(markup).toContain("h-px flex-1 bg-hairline/30");
    });
  });
});
