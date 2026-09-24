// Bot avatar — Libraries.dev bot-avatars, wrapped in the app's historical
// MausAvatar API so call sites keep passing color, state, body, and motion.
// ChartAvatar stays the OKX catalog mark. CursorAvatar is no longer rendered
// here; one-shot motion beats still borrow a library state for a moment.
import { forwardRef, memo, useEffect, useState } from "react";
import { BotAvatar as LibBotAvatar } from "bot-avatars";
import { MAUS_COLORS, type MausColor, type MausMotion, type MausState } from "@/lib/mascot";
import { mascotBodyToType, mausColorToHex, mausStateToBotState } from "@/lib/bot-avatar-bridge";
import { botAvatarProfile, type BotAvatarCrop } from "../../shared/bot-avatar";
import { MASCOT_BODY_IDS, type MascotBodyId } from "../../shared/mascot-bodies";

/**
 * What a one-shot motion does while it plays. bot-avatars has no imperative
 * blink/spin, so a beat only borrows a state.
 */
interface MotionFaces extends Partial<Record<Exclude<MausMotion, "none">, { state?: MausState }>> {}

const MOTION_FACE: MotionFaces = {
  arrive: { state: "spawning" },
  switch: { state: "waking" },
  customize: { state: "proud" },
  alert: { state: "alerting" },
  thinking: { state: "thinking" },
  working: { state: "working" },
  launch: { state: "loading" },
  success: { state: "happy" },
  celebrate: { state: "celebrate" },
  blink: {},
  surprise: { state: "surprised" },
  failure: { state: "sad" },
};

/** How long a one-shot motion holds its state before the bot's own returns. */
const MOTION_FACE_MS = 1400;

function motionStateFromMotion(motion: MausMotion): MausState | undefined {
  if (motion === "none") return undefined;
  return MOTION_FACE[motion]?.state;
}

/** Channel-wise mix of a hex color toward another, t in 0..1. */
function mix(hex: string, toward: string, t: number): string {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const channel = (shift: number) => {
    const va = (a >> shift) & 0xff;
    const vb = (b >> shift) & 0xff;
    return Math.round(va + (vb - va) * t);
  };
  return `#${[channel(16), channel(8), channel(0)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Bot color -> the chart mark's two-stop wash. Kept for ChartAvatar, which
 * is still the OKX catalog path.
 */
const gradientFor = (color: MausColor): [string, string, string] => {
  const fill = MAUS_COLORS[color] ?? MAUS_COLORS.green;
  return [mix(fill, "#ffffff", 0.55), fill, mix(fill, "#000000", 0.42)];
};

export type MausAvatarHandle = Record<string, never>;

export type MausAvatarProps = {
  color: MausColor;
  /** Named behaviour — collapsed onto the library's three states. */
  state?: MausState;
  size?: number;
  label?: string;
  motion?: MausMotion;
  motionKey?: number;
  /** Run the animation. Off freezes the avatar on its current frame. */
  animated?: boolean;
  /** Pointer follow and click-to-hop. Off unless a callsite asks for it. */
  interactive?: boolean;
  /** Which body the bot wears. Unknown values fall back to the ghost. */
  bodyId?: MascotBodyId;
};

function MausAvatarComponent(
  {
    color,
    state = "idle",
    size = 44,
    label,
    animated = true,
    interactive = false,
    bodyId,
    motion = "none",
    motionKey = 0,
  }: MausAvatarProps,
  ref: React.Ref<MausAvatarHandle>,
) {
  void ref;
  const [motionState, setMotionState] = useState<MausState | null>(null);
  useEffect(() => {
    if (motion === "none" || !animated) {
      setMotionState(null);
      return;
    }
    const next = motionStateFromMotion(motion);
    if (!next) {
      setMotionState(null);
      return;
    }
    setMotionState(next);
    const timer = window.setTimeout(() => setMotionState(null), MOTION_FACE_MS);
    return () => window.clearTimeout(timer);
  }, [motion, motionKey, animated]);

  const botState = mausStateToBotState(motionState ?? state);
  const botType = mascotBodyToType(bodyId);
  const hex = mausColorToHex(color);

  return (
    // The library draws at 1.5x and pulls the overflow back with negative
    // margins, so its own box is not the layout size callers asked for.
    // Pin the wrapper to `size` and let the mark bleed outside it.
    <span className="inline-flex shrink-0" style={{ width: size, height: size }}>
      <LibBotAvatar
        type={botType}
        state={botState}
        size={size}
        color={hex}
        interactive={interactive}
        paused={!animated}
        {...(label ? { "aria-label": label, title: label } : {})}
      />
    </span>
  );
}

export const MausAvatar = memo(forwardRef(MausAvatarComponent));

export function ChartAvatar({
  color,
  size = 44,
  name,
  label = "OKX.AI catalog agent",
}: {
  color: MausColor;
  size?: number;
  name?: string;
  label?: string;
}) {
  const [highlight, fill] = gradientFor(color);
  const isSpend = name && /spend|scout|risk|vault/i.test(name);
  const isCoach = name && /coach|listing|terms/i.test(name);

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-app-bg/70 text-ink shadow-sm"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${highlight}99, ${fill}66)` }}
    >
      {isSpend ? (
        /* Shield / Treasury gatekeeper icon for Spend Scout */
        <svg aria-hidden="true" width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ) : isCoach ? (
        /* Quality / Coach verification mark for Listing Coach */
        <svg aria-hidden="true" width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="m9 14 2 2 4-4" />
        </svg>
      ) : (
        /* Financial market trend line for Markets / Intelligence */
        <svg aria-hidden="true" width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17 9 11l4 4 8-9" />
          <path d="M15 6h6v6" />
        </svg>
      )}
    </span>
  );
}

export type BotAvatarProps = Omit<MausAvatarProps, "color"> & {
  bot: {
    name?: string;
    color: MausColor;
    avatarUrl?: string | null;
    avatarCrop?: BotAvatarCrop;
    mascotBody?: MascotBodyId | null;
    okxImport?: { kind?: string };
  };
};

export type BotAvatarOutcome = "flatImage" | "gradientMascot";

/**
 * Pick which of the two ways to render a bot's avatar, given the parsed
 * profile plus whether the image has already failed to load. Kept as a pure
 * function — independent of React state and effects — so both arms can be
 * unit-tested directly: `imageFailed` is set by the `<img>`'s own `onError`,
 * which `renderToStaticMarkup` never fires, so the failure fallback is
 * unreachable from a synchronous render test.
 *
 * The iOS half of this decision is `resolveBotAvatarOutcome` in
 * `ios/Sources/CompanionCore/BotAvatarRendering.swift`, which mirrors this
 * union name for name so the two renderers can be read side by side.
 */
export function resolveBotAvatarOutcome(params: {
  avatarCrop: BotAvatarCrop;
  hasUrl: boolean;
  imageFailed: boolean;
}): BotAvatarOutcome {
  const { avatarCrop, hasUrl, imageFailed } = params;
  if (!hasUrl) return "gradientMascot";
  if (avatarCrop === "mascot") return "gradientMascot";
  if (imageFailed) return "gradientMascot";
  return "flatImage";
}

/**
 * The one renderer for a bot's chosen profile image. Malformed persisted
 * values and images that fail to load both fall back to the animated mascot,
 * so an old/corrupt profile can never leave a broken-image icon in the app.
 */
function stableHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function defaultMascotBodyForBot(bot: {
  id?: string;
  name?: string;
  title?: string;
  mascotBody?: MascotBodyId | null;
  okxImport?: { kind?: string; externalAgentId?: string };
}): MascotBodyId {
  if (bot.mascotBody) return bot.mascotBody;

  // 1. Known external OKX catalog IDs
  const extId = bot.okxImport?.externalAgentId ?? "";
  if (extId === "okx-market-scout-v1") return "star";
  if (extId === "okx-listing-coach") return "squircle";
  if (extId === "okx-spend-scout") return "shield";

  // 2. Known standard bot IDs
  const botId = (bot.id ?? "").toLowerCase();
  if (botId === "tuli") return "cursor";
  if (botId === "atlas") return "capsule";
  if (botId === "markets") return "star";
  if (botId === "listing-coach") return "squircle";
  if (botId === "spend-scout") return "shield";
  if (botId === "risk-inspector") return "hexagon";
  if (botId === "approval-agent" || botId === "approval-gate") return "diamond";
  if (botId === "scheduler-bot") return "drop";

  // 3. Domain role keywords
  const text = `${bot.name ?? ""} ${bot.title ?? ""}`.toLowerCase();
  if (text.includes("spend") || text.includes("scout") || text.includes("treasury") || text.includes("guard")) return "shield";
  if (text.includes("coach") || text.includes("listing") || text.includes("terms") || text.includes("quality")) return "squircle";
  if (text.includes("market") || text.includes("discovery") || text.includes("radar") || text.includes("intel")) return "star";
  if (text.includes("risk") || text.includes("compliance") || text.includes("security") || text.includes("fraud")) return "hexagon";
  if (text.includes("approval") || text.includes("jury") || text.includes("arbitration") || text.includes("governance")) return "diamond";
  if (text.includes("settlement") || text.includes("escrow") || text.includes("vault") || text.includes("payout")) return "capsule";
  if (text.includes("schedule") || text.includes("routine") || text.includes("cron") || text.includes("automation")) return "drop";
  if (text.includes("coordinator") || text.includes("lead") || text.includes("chief") || text.includes("tuli")) return "cursor";

  // 4. Stable deterministic hash fallback based on bot ID or name
  const seed = bot.id || bot.name || "default";
  const index = stableHash(seed) % MASCOT_BODY_IDS.length;
  return MASCOT_BODY_IDS[index] ?? "cursor";
}

export function BotAvatar({ bot, size = 44, label, ...mascotProps }: BotAvatarProps) {
  const effectiveBody = defaultMascotBodyForBot(bot);
  const profile = botAvatarProfile(bot);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [profile.avatarUrl]);

  const outcome = resolveBotAvatarOutcome({
    avatarCrop: profile.avatarCrop,
    hasUrl: Boolean(profile.avatarUrl),
    imageFailed,
  });

  if (outcome !== "flatImage") {
    return (
      <MausAvatar
        bodyId={effectiveBody}
        {...mascotProps}
        color={bot.color}
        size={size}
        label={label ?? bot.name}
      />
    );
  }

  const radius =
    profile.avatarCrop === "circle"
      ? "50%"
      : profile.avatarCrop === "rounded"
        ? "22%"
        : "0";
  return (
    <img
      src={profile.avatarUrl}
      alt={label ?? (bot.name ? `${bot.name} avatar` : "Bot avatar")}
      width={size}
      height={size}
      draggable={false}
      onError={() => setImageFailed(true)}
      className="block shrink-0 bg-raised object-cover"
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}

export function InitialsAvatar({
  initials,
  size = 32,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-raised text-ink-secondary font-medium"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
