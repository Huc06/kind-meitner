// Per-conversation first-welcome dismissals. Same best-effort localStorage
// style as drafts: a full quota or locked-down origin must never crash the
// empty state, and each bot/thread key is isolated from the others.

const KEY = "kind-meitner-welcome-dismissed";

type Values = Record<string, unknown>;
type Store = Pick<Storage, "getItem" | "setItem"> | undefined;

// Fallback when Storage is missing or rejects reads/writes. When Storage
// works it is authoritative so a cleared store (tests, quota recovery) is
// not shadowed by a stale in-memory true.
const fallback = new Map<string, boolean>();
const fallbackByStore = new WeakMap<object, Map<string, boolean>>();

function memoryFor(store: Store): Map<string, boolean> {
  if (!store) return fallback;
  const existing = fallbackByStore.get(store as object);
  if (existing) return existing;
  const created = new Map<string, boolean>();
  fallbackByStore.set(store as object, created);
  return created;
}

function read(store: Store): Values | null {
  try {
    const raw = store?.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Values) : {};
  } catch {
    return null;
  }
}

function getStore(): Store {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Composer-aligned key so dismissals follow the same bot/thread identity. */
export function welcomeConversationKey(botId: string, threadId: string): string {
  return `bot:${botId}:${threadId}`;
}

export function isWelcomeDismissed(id: string, store: Store = getStore()): boolean {
  const values = read(store);
  if (values) {
    const dismissed = values[id] === true;
    memoryFor(store).set(id, dismissed);
    return dismissed;
  }
  return memoryFor(store).get(id) === true;
}

export function dismissWelcome(id: string, store: Store = getStore()): void {
  memoryFor(store).set(id, true);
  const values = read(store) ?? {};
  values[id] = true;
  try {
    store?.setItem(KEY, JSON.stringify(values));
  } catch {
    /* quota / private mode — dismissal lasts for this session only */
  }
}

/** Test helper: forget a conversation's dismissal without touching others. */
export function clearWelcomeDismissal(id: string, store: Store = getStore()): void {
  memoryFor(store).set(id, false);
  const values = read(store) ?? {};
  delete values[id];
  try {
    store?.setItem(KEY, JSON.stringify(values));
  } catch {
    /* best-effort */
  }
}

export function shouldShowFirstConversationWelcome(options: {
  messageCount: number;
  busy: boolean;
  dismissed: boolean;
}): boolean {
  return options.messageCount === 0 && !options.busy && !options.dismissed;
}
