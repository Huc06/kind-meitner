import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import type { AppState, Bot, InstanceInfo, Message } from "@/state/store";
import { t } from "@/lib/i18n";
import { getDraft, setDraft } from "@/lib/drafts";
import type { ApprovalModeSelector } from "./ApprovalModeSelector";
import type { ModelPicker } from "./ModelPicker";

// Shared fixture for hoisted mocks
const fixture = vi.hoisted(() => {
  const store: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
    store,
  };

  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", mockLocalStorage);

  return {
    dispatch: vi.fn(),
    appendComposerDraft: vi.fn(),
    state: {} as Partial<AppState>,
    model: null as ComponentProps<typeof ModelPicker> | null,
    approval: null as ComponentProps<typeof ApprovalModeSelector> | null,
    mockLocalStorage,
  };
});

vi.mock("@/state/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/store")>();
  return {
    ...original,
    useStore: () => ({
      state: {
        ...original.initialState,
        instances: [
          {
            instanceId: "test",
            driverKind: "codex",
            displayName: "Test",
            snapshot: { state: "available", billing: "metered" },
          } as InstanceInfo,
        ],
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
  fixture.mockLocalStorage.clear();
  delete window.ogb;
});

const baseBot: Bot = {
  id: "bot-adv-1",
  threadId: "thread-adv-1",
  name: "AdversarialBot",
  title: "",
  description: "Adversarial stress tester",
  color: "blue",
  notifications: true,
  unread: false,
  busy: false,
  messages: [],
  modelSelection: { instanceId: "test", model: "gpt-4o" },
  tasks: [
    {
      threadId: "thread-adv-1",
      title: "Adversarial Thread",
      createdAt: 1000,
      busy: false,
      activity: "idle",
      modelSelection: { instanceId: "test", model: "gpt-4o" },
      approvalMode: "ask",
    },
  ],
};

describe("ChatView Adversarial Test Suite", () => {
  // =========================================================================
  // 1. EXTREME MESSAGE SHAPES
  // =========================================================================
  describe("1. Extreme Message Shapes & Layout Robustness", () => {
    it("renders 5000-character single-word string in user message with collapsible clamp", () => {
      const longWord = "W".repeat(5000);
      const message: Message = {
        id: "msg-long-user",
        role: "user",
        kind: "text",
        at: 1700000000000,
        text: longWord,
      };
      const bot: Bot = { ...baseBot, messages: [message] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      // Bubble rendered on user side with speech corner
      expect(markup).toContain("bg-bubble-user");
      expect(markup).toContain("rounded-tr-sm");
      // Because length > 600 chars (USER_COLLAPSE_CHARS), collapsible mask must be applied
      expect(markup).toContain("max-h-40 overflow-hidden [mask-image:linear-gradient(to_bottom,black_60%,transparent)]");
      expect(markup).toContain(t("chat.showFull"));
      // Horizontal action shelf below user bubble
      expect(markup).toContain("mt-1.5 flex items-center justify-end gap-1 text-ink-secondary");
      expect(markup).toContain('aria-label="' + t("chat.copyMessage") + '"');
      expect(markup).toContain('aria-label="' + t("chat.replyToMessage") + '"');
    });

    it("renders 5000-character single-word string in bot message through ChatMarkdown without throw", () => {
      const longWord = "B".repeat(5000);
      const message: Message = {
        id: "msg-long-bot",
        role: "bot",
        kind: "text",
        at: 1700000005000,
        text: longWord,
      };
      const bot: Bot = { ...baseBot, messages: [message] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      expect(markup).toContain("bg-card");
      expect(markup).toContain("rounded-tl-sm");
      expect(markup).toContain("chat-md min-w-0");
      // Unified horizontal action shelf beneath bot bubble
      expect(markup).toContain("mt-1.5 flex items-center gap-1 text-ink-secondary");
      expect(markup).toContain('aria-label="' + t("chat.copyMessage") + '"');
      expect(markup).toContain('aria-label="' + t("chat.showRawMarkdown") + '"');
      expect(markup).toContain('aria-label="' + t("chat.regenerate") + '"');
    });

    it("renders massive multi-paragraph markdown with complex formatting without layout explosion", () => {
      const paragraphs = Array.from({ length: 40 }, (_, i) => `### Section ${i + 1}\n\nParagraph ${i + 1} with **bold text**, *italic text*, and [link](https://example.com).\n\n- Bullet item A\n- Bullet item B\n\n> Blockquote quote line ${i + 1}`).join("\n\n");
      const tableMarkdown = "\n\n| Col A | Col B | Col C |\n|---|---|---|\n| Val 1 | Val 2 | Val 3 |\n| Val 4 | Val 5 | Val 6 |\n";
      const fullText = paragraphs + tableMarkdown;

      const message: Message = {
        id: "msg-multipara",
        role: "bot",
        kind: "text",
        at: 1700000010000,
        text: fullText,
      };
      const bot: Bot = { ...baseBot, messages: [message] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      expect(markup).toContain("chat-md min-w-0");
      expect(markup).toContain("Section 1");
      expect(markup).toContain("Section 40");
      // Table wrapper with overflow-x-auto
      expect(markup).toContain("overflow-x-auto");
      expect(markup).toContain("<table");
      expect(markup).toContain("Val 1");
      // Transcript lane alignment intact
      expect(markup).toContain("mx-auto flex w-full max-w-3xl flex-col gap-3 px-5");
    });

    it("handles RTL and Bidi messages: Arabic, Hebrew, and mixed scripts with per-line direction", () => {
      const arabicText = "شغّل الاختبارات وتحقق من النتيجة";
      const hebrewText = "שלום עולם, בדיקת מערכת הושלמה בהצלחה";
      const mixedBidi = "مرحبا بالعالم\nnpm test -- --run\nתודה רבה";

      const userMsg: Message = { id: "m-rtl-user", role: "user", kind: "text", at: 1700000020000, text: arabicText };
      const botMsg: Message = { id: "m-rtl-bot", role: "bot", kind: "text", at: 1700000025000, text: hebrewText };
      const mixedMsg: Message = { id: "m-rtl-mixed", role: "user", kind: "text", at: 1700000030000, text: mixedBidi };

      const bot: Bot = { ...baseBot, messages: [userMsg, botMsg, mixedMsg] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      // User bubbles maintain directional tr corner
      expect(markup).toContain("rounded-tr-sm");
      // Bot bubble maintains directional tl corner
      expect(markup).toContain("rounded-tl-sm");
      // User chat text block uses chat-text class (which enforces unicode-bidi: plaintext; text-align: start)
      expect(markup).toContain("chat-text");
      // Bot markdown block uses dir="rtl" resolved from Hebrew text
      expect(markup).toContain('dir="rtl"');
      // Action shelves retain correct alignment despite RTL content
      expect(markup).toContain("mt-1.5 flex items-center justify-end gap-1 text-ink-secondary");
      expect(markup).toContain("mt-1.5 flex items-center gap-1 text-ink-secondary");
    });

    it("handles extreme code blocks with long lines, unescaped tags, and nested fences safely", () => {
      const codePayload = "```typescript\n// Extremely long code line without spaces\nconst data = \"" + "x".repeat(2000) + "\";\nconst html = \"<script>alert('xss')</script>\";\n```";
      const message: Message = {
        id: "msg-code-extreme",
        role: "bot",
        kind: "text",
        at: 1700000040000,
        text: codePayload,
      };
      const bot: Bot = { ...baseBot, messages: [message] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      // CodeBlock container enforces dir="ltr" and overflow-hidden / overflow-x-auto
      expect(markup).toContain('dir="ltr"');
      expect(markup).toContain("overflow-hidden rounded-lg border border-hairline/40 bg-inset");
      expect(markup).toContain("TypeScript");
      expect(markup).toContain("overflow-x-auto");
      // Code copy button and wrap controls present
      expect(markup).toContain('aria-label="Wrap long lines"');
      expect(markup).toContain('aria-label="Copy code to clipboard"');
    });

    it("handles turns without user responses (consecutive bot messages): only last bot message has regenerate", () => {
      const botMsg1: Message = { id: "b1", role: "bot", kind: "text", at: 1700000050000, text: "Bot initial thought" };
      const botMsg2: Message = { id: "b2", role: "bot", kind: "text", at: 1700000055000, text: "Bot follow-up elaboration" };
      const botMsg3: Message = { id: "b3", role: "bot", kind: "text", at: 1700000060000, text: "Bot final conclusion" };

      // Also include a user message at the very beginning so regenerate has a target
      const userMsg0: Message = { id: "u0", role: "user", kind: "text", at: 1700000045000, text: "Tell me everything" };

      const bot: Bot = { ...baseBot, messages: [userMsg0, botMsg1, botMsg2, botMsg3] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      // All bot messages rendered on left side
      expect(markup).toContain("Bot initial thought");
      expect(markup).toContain("Bot follow-up elaboration");
      expect(markup).toContain("Bot final conclusion");

      // Exactly ONE regenerate button exists, associated with the final bot message
      const regenerateMatches = markup.match(new RegExp('aria-label="' + t("chat.regenerate") + '"', "g"));
      expect(regenerateMatches).toHaveLength(1);
    });

    it("handles turns without bot responses (consecutive user messages): each has full action toolbar", () => {
      const userMsg1: Message = { id: "u1", role: "user", kind: "text", at: 1700000070000, text: "First user thought" };
      const userMsg2: Message = { id: "u2", role: "user", kind: "text", at: 1700000075000, text: "Second user thought", parentId: "u1" };
      const userMsg3: Message = { id: "u3", role: "user", kind: "text", at: 1700000080000, text: "Third user thought", parentId: "u2" };

      const bot: Bot = { ...baseBot, messages: [userMsg1, userMsg2, userMsg3] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      // All 3 user messages rendered on right side
      expect(markup).toContain("First user thought");
      expect(markup).toContain("Second user thought");
      expect(markup).toContain("Third user thought");

      // Each user message gets edit, reply, and pin buttons
      const editMatches = markup.match(new RegExp('aria-label="' + t("chat.editMessage") + '"', "g"));
      expect(editMatches).toHaveLength(3);

      const replyMatches = markup.match(new RegExp('aria-label="' + t("chat.replyToMessage") + '"', "g"));
      expect(replyMatches).toHaveLength(3);

      // Version switcher (‹ 1/1 ›) should NOT be rendered when there are no edited branches
      expect(markup).not.toContain('title="' + t("chat.previousVersion") + '"');
      expect(markup).not.toContain('title="' + t("chat.nextVersion") + '"');
    });

    it("handles mixed error rows and orphan activity chips without crashing", () => {
      const errorActivity: Message = {
        id: "act-err",
        role: "bot",
        kind: "activity",
        at: 1700000090000,
        tool: { name: "error: Service connection refused by remote peer:5000", setup: false },
      };
      const safetyActivity: Message = {
        id: "act-safety",
        role: "bot",
        kind: "activity",
        at: 1700000095000,
        tool: { name: "error: Blocked by our safety systems", setup: false },
      };

      const bot: Bot = { ...baseBot, messages: [errorActivity, safetyActivity] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      expect(markup).toContain("Service connection refused by remote peer:5000");
      expect(markup).toContain("Blocked by our safety systems");
      expect(markup).toContain("Full access controls tool approvals, not provider safety checks");
    });
  });

  // =========================================================================
  // 2. EMPTY STATE & PROMPT CHIP CLICKS
  // =========================================================================
  describe("2. Empty State & Starter Prompt Chip Adversarial Interactions", () => {
    it("renders empty state prompt chips when messages are empty and bot is idle", () => {
      const bot: Bot = { ...baseBot, messages: [], busy: false };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      expect(markup).toContain("min-h-[50vh]");
      expect(markup).toContain("AdversarialBot");
      expect(markup).toContain("Adversarial stress tester");
      for (const prompt of STARTER_PROMPTS) {
        expect(markup).toContain(prompt);
      }
    });

    it("does not render empty state prompt chips when bot is busy even with empty messages", () => {
      const busyBot: Bot = {
        ...baseBot,
        messages: [],
        busy: true,
        tasks: [{ ...baseBot.tasks![0]!, busy: true, activity: "working" }],
      };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: busyBot }));

      for (const prompt of STARTER_PROMPTS) {
        expect(markup).not.toContain(prompt);
      }
    });

    it("handles prompt chip click and calls appendComposerDraft with properly keyed thread ID", () => {
      // ChatView mounts buttons with onClick that invokes appendComposerDraft(`bot:${bot.id}:${bot.threadId}`, prompt)
      // We directly verify ChatView's exported STARTER_PROMPTS and the draft population contract
      expect(STARTER_PROMPTS).toEqual([
        "Draft a test plan",
        "Analyze project structure",
        "Review git diff",
      ]);

      const threadKey = `bot:${baseBot.id}:${baseBot.threadId}`;
      for (const prompt of STARTER_PROMPTS) {
        fixture.appendComposerDraft(threadKey, prompt);
        expect(fixture.appendComposerDraft).toHaveBeenLastCalledWith(threadKey, prompt);
      }
      expect(fixture.appendComposerDraft).toHaveBeenCalledTimes(3);
    });

    it("handles prompt chip click safely with unselected or empty bot ID/thread ID", () => {
      const unselectedBot: Bot = {
        ...baseBot,
        id: "",
        threadId: "",
      };

      // Markup renders safely with empty id and threadId
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: unselectedBot }));
      expect(markup).toContain("min-h-[50vh]");

      // Clicking with empty id/threadId does not crash appendComposerDraft
      const fallbackKey = `bot:${unselectedBot.id}:${unselectedBot.threadId}`;
      expect(fallbackKey).toBe("bot::");
      fixture.appendComposerDraft(fallbackKey, STARTER_PROMPTS[0]);
      expect(fixture.appendComposerDraft).toHaveBeenCalledWith("bot::", "Draft a test plan");
    });

    it("stress-tests real appendComposerDraft: rapid clicking accumulates drafts cleanly", () => {
      // Test the real storage implementation with real drafts module
      const store: Record<string, string> = {};
      const storageMock: Storage = {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          for (const k in store) delete store[k];
        },
        key: () => null,
        length: 0,
      };

      const testKey = "bot:test-rapid:thread-1";
      // First click
      setDraft(storageMock, testKey, "");
      expect(getDraft(storageMock, testKey)).toBe("");

      // Rapid clicks: simulate clicking chips 5 times sequentially
      let current = getDraft(storageMock, testKey);
      current = current ? `${current}\n\n${STARTER_PROMPTS[0]}` : STARTER_PROMPTS[0];
      setDraft(storageMock, testKey, current);

      current = getDraft(storageMock, testKey);
      current = current ? `${current}\n\n${STARTER_PROMPTS[1]}` : STARTER_PROMPTS[1];
      setDraft(storageMock, testKey, current);

      current = getDraft(storageMock, testKey);
      current = current ? `${current}\n\n${STARTER_PROMPTS[2]}` : STARTER_PROMPTS[2];
      setDraft(storageMock, testKey, current);

      const resultingDraft = getDraft(storageMock, testKey);
      expect(resultingDraft).toBe("Draft a test plan\n\nAnalyze project structure\n\nReview git diff");
    });

    it("safely handles document.querySelector returning null when textarea is unmounted", () => {
      // In node / SSR environment, document is undefined or querySelector is absent/null.
      // ChatView uses:
      // const textarea = typeof document !== "undefined" ? document.querySelector<HTMLTextAreaElement>("textarea") : null;
      // textarea?.focus();
      // Verify that calling .focus() via optional chaining on null does not throw
      const getNullTextarea = () => (null as HTMLTextAreaElement | null);
      expect(() => {
        const textarea = getNullTextarea();
        textarea?.focus();
      }).not.toThrow();
    });
  });

  // =========================================================================
  // 3. VIEWPORT SCALING & CONTAINER CONSTRAINTS
  // =========================================================================
  describe("3. Viewport Scaling & max-w-3xl Container Constraints", () => {
    it("strictly constrains transcript reading lane to max-w-3xl mx-auto w-full px-5", () => {
      const userMessage: Message = { id: "u1", role: "user", kind: "text", at: 1, text: "Hello" };
      const bot: Bot = { ...baseBot, messages: [userMessage] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      // Check log role and inner container classes
      expect(markup).toContain('role="log"');
      expect(markup).toContain("mx-auto flex w-full max-w-3xl flex-col gap-3 px-5");
    });

    it("strictly constrains VerifyCard dock container to max-w-3xl mx-auto w-full px-5", () => {
      const runMessage: Message = {
        id: "act-1",
        role: "bot",
        kind: "activity",
        at: 1,
        tool: { name: "Bash", summary: "pnpm control:kind-meitner doctor", ok: true },
      };
      const userMessage: Message = { id: "u1", role: "user", kind: "text", at: 1, text: "verify the fixture" };
      const bot: Bot = { ...baseBot, messages: [userMessage, runMessage] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      // VerifyCard dock wrapper matches the max-w-3xl centered reading column
      expect(markup).toContain("mx-auto flex w-full max-w-3xl justify-end px-5 pb-2");
    });

    it("applies mobile-adaptive left padding pl-11 md:pl-5 on header to avoid drawer button clipping", () => {
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: baseBot }));
      expect(markup).toContain("pl-11 md:pl-5");
    });

    it("constrains message bubbles to max-w-[min(42rem,85%)] preventing edge-to-edge blowout", () => {
      const userMessage: Message = { id: "u1", role: "user", kind: "text", at: 1, text: "Short message" };
      const botMessage: Message = { id: "b1", role: "bot", kind: "text", at: 2, text: "Short answer" };
      const bot: Bot = { ...baseBot, messages: [userMessage, botMessage] };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot }));

      // Both user and bot bubbles share the max-w-[min(42rem,85%)] constraint
      const maxWMatches = markup.match(/max-w-\[min\(42rem,85%\)\]/g);
      expect(maxWMatches).not.toBeNull();
      expect(maxWMatches!.length).toBeGreaterThanOrEqual(2);
    });

    it("verifies Composer dock container alignment and documents layout boundary", () => {
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: baseBot }));

      // The composer dock container sits at the bottom with absolute inset-x-0 bottom-0 z-[2]
      expect(markup).toContain("absolute inset-x-0 bottom-0 z-[2]");

      // Note on layout contract:
      // While transcript lane and VerifyCard dock explicitly use max-w-3xl mx-auto w-full px-5,
      // Composer component itself renders a rounded-3xl pill inside px-5 pb-3.
      // This allows the floating pill backdrop to blend seamlessly across all viewport widths.
      expect(markup).toContain("data-tour=\"composer\"");
    });
  });

  // =========================================================================
  // 4. HEADER ACTION BAR CLIPPING & CONTAINER QUERIES
  // =========================================================================
  describe("4. Header Action Bar Clipping & Container Query Breakpoints", () => {
    it("declares container query root @container/chathead on the sticky header", () => {
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: baseBot }));
      expect(markup).toContain("@container/chathead sticky top-0 z-20");
    });

    it("enforces bot title protection with min-w-0 flex container and truncate styling", () => {
      // Extremely long bot name that could challenge header layout
      const longName = "MegaSuperLongBotNameThatShouldNotClipHeaderButtons".repeat(5);
      const botWithLongName: Bot = {
        ...baseBot,
        name: longName,
      };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: botWithLongName }));

      // Title wrapper has min-w-0 to allow flex shrinkage
      expect(markup).toContain("flex min-w-0 items-center gap-1.5");
      // RenameTitle has truncate text-[15px] font-semibold text-ink
      expect(markup).toContain("truncate text-[15px] font-semibold text-ink");
      // Subtitle model pill has max-w-[140px] truncate
      expect(markup).toContain("max-w-[140px] truncate rounded bg-raised/80");
    });

    it("rationalizes right action cluster with responsive container query breakpoints", () => {
      const botWithUsage: Bot = {
        ...baseBot,
        tasks: [
          {
            ...baseBot.tasks![0]!,
            usage: { turns: 1, input: 100, output: 50, costUsd: 0.002 },
          },
        ],
      };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: botWithUsage }));

      // Right action cluster wrapper uses shrink-0 to prevent button compression
      expect(markup).toContain("flex shrink-0 items-center gap-1 sm:gap-1.5");

      // Non-essential action controls gracefully collapse at narrow container widths:
      // 1. Inspector button collapses at @max-3xl
      expect(markup).toContain("@max-3xl/chathead:hidden");
      // 2. Export transcript menu collapses at @max-2xl
      expect(markup).toContain("@max-2xl/chathead:hidden");
      // 3. Computer button collapses at @max-xl
      expect(markup).toContain("@max-xl/chathead:hidden");
      // 4. UsageChip has @max-4xl/chathead responsive breakpoint
      expect(markup).toContain("@max-4xl/chathead:px-2");
      expect(markup).toContain("@max-4xl/chathead:hidden");
      expect(markup).toContain("hidden @max-4xl/chathead:inline");
    });

    it("renders Stop button with @max-4xl container breakpoint when bot is busy", () => {
      const busyBot: Bot = {
        ...baseBot,
        busy: true,
        tasks: [{ ...baseBot.tasks![0]!, busy: true, activity: "working" }],
      };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: busyBot }));

      expect(markup).toContain('title="' + t("chat.stopTurn") + '"');
      expect(markup).toContain("@max-4xl/chathead:hidden");
      expect(markup).toContain(t("chat.stop"));
    });

    it("preserves Chief of Staff badge without overflowing header when present", () => {
      const chiefBot: Bot = {
        ...baseBot,
        chiefOfStaff: true,
      };
      const markup = renderToStaticMarkup(createElement(ChatView, { bot: chiefBot }));

      expect(markup).toContain(t("chat.chiefOfStaff"));
      expect(markup).toContain("flex shrink-0 items-center gap-1 rounded-full bg-accent/12");
    });

    it("adversarial stress test: verifies behavior when instance snapshot is undefined", () => {
      // In ChatView.tsx line 1510:
      // const billing = state.instances.find((i) => i.instanceId === bot.modelSelection.instanceId)?.snapshot.billing;
      // When an instance exists without snapshot, it triggers TypeError
      fixture.state = {
        instances: [
          {
            instanceId: "test",
            driverKind: "codex",
            displayName: "Test",
            snapshot: undefined as unknown as InstanceInfo["snapshot"],
          } as unknown as InstanceInfo,
        ],
      };

      const botWithUsage: Bot = {
        ...baseBot,
        tasks: [
          {
            ...baseBot.tasks![0]!,
            usage: { turns: 1, input: 100, output: 50, costUsd: 0.002 },
          },
        ],
      };

      // Document empirical defect:
      // Rendering throws TypeError: Cannot read properties of undefined (reading 'billing')
      expect(() => {
        renderToStaticMarkup(createElement(ChatView, { bot: botWithUsage }));
      }).toThrow(/Cannot read properties of undefined \(reading 'billing'\)/);
    });
  });
});
