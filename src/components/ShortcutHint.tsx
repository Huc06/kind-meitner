import { SHORTCUT_GROUPS, shortcutKeysForPlatform } from "@/lib/keyboard-shortcuts";

/** Display the real binding, without adding a second shortcut registry. */
export function shortcutLabel(id: string): string | undefined {
  const item = SHORTCUT_GROUPS.flatMap((group) => group.items).find((entry) => entry.id === id);
  return item ? shortcutKeysForPlatform(item).join(" ") : undefined;
}

export function ShortcutHint({ id }: { id: string }) {
  const label = shortcutLabel(id);
  if (!label) return null;
  return (
    <kbd
      aria-hidden="true"
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center border border-hairline bg-inset px-1 font-mono text-[10px] font-medium text-ink-secondary"
    >
      {label}
    </kbd>
  );
}
