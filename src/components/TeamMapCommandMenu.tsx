import * as React from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type CommandMenuItem = {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  keywords?: string[];
  group?: string;
  onSelect?: () => void;
};

export type CommandMenuProps = {
  items: CommandMenuItem[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (item: CommandMenuItem) => void;
  hotkey?: string;
  placeholder?: string;
  triggerPlaceholder?: string;
  emptyMessage?: string;
  showTrigger?: boolean;
  className?: string;
};

function Kbd({
  children,
  pressed,
  className,
}: {
  children: React.ReactNode;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <kbd
      data-slot="command-menu-kbd"
      className={cn(
        "inline-flex h-5 min-w-5 origin-center items-center justify-center border border-hairline bg-inset px-1 font-mono text-[10.5px] font-medium select-none transition-transform duration-100 ease-out",
        pressed
          ? "scale-x-95 scale-y-85 bg-accent text-accent-ink"
          : "text-ink-secondary",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function TeamMapCommandMenu({
  items,
  open,
  defaultOpen = false,
  onOpenChange,
  onSelect,
  hotkey = "k",
  placeholder = "Search agents, switch use cases, or inspect blockers…",
  triggerPlaceholder = "Search or type ⌘K…",
  emptyMessage = "No matching agents or actions found.",
  showTrigger = true,
  className,
}: CommandMenuProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isOpen = isControlled ? open : internalOpen;

  const [isMac, setIsMac] = React.useState(false);
  const [combo, setCombo] = React.useState(false);
  const [keys, setKeys] = React.useState({
    up: false,
    down: false,
    enter: false,
    esc: false,
  });
  const [query, setQuery] = React.useState("");
  const [rawActive, setRawActive] = React.useState(0);

  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const key = hotkey.toLowerCase();

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (next) {
        setQuery("");
        setRawActive(0);
      }
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  React.useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" &&
        /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent),
    );
  }, []);

  // Global hotkey: ⌘K or Ctrl+K - immediate trigger on keydown
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) {
        e.preventDefault();
        e.stopPropagation();
        setCombo(true);
        setOpen(!isOpen);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === key || e.key === "Meta" || e.key === "Control") {
        setCombo(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [key, isOpen, setOpen]);

  // Squeeze keys inside open menu
  React.useEffect(() => {
    if (!isOpen) return;
    const map: Record<string, keyof typeof keys> = {
      arrowup: "up",
      arrowdown: "down",
      enter: "enter",
      escape: "esc",
    };
    const onDown = (e: KeyboardEvent) => {
      const name = map[e.key.toLowerCase()];
      if (name) setKeys((s) => ({ ...s, [name]: true }));
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const name = map[e.key.toLowerCase()];
      if (name) setKeys((s) => ({ ...s, [name]: false }));
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      setKeys({ up: false, down: false, enter: false, esc: false });
    };
  }, [isOpen, setOpen]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [item.label, item.description, item.group, ...(item.keywords ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const activeIndex = Math.min(rawActive, Math.max(0, filtered.length - 1));

  React.useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleSelect = (item: CommandMenuItem) => {
    item.onSelect?.();
    onSelect?.(item);
    setOpen(false);
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setRawActive((activeIndex + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setRawActive((activeIndex - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) handleSelect(item);
    }
  };

  const groups = React.useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, { item: CommandMenuItem; index: number }[]>();
    filtered.forEach((item, index) => {
      const g = item.group ?? "";
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g)!.push({ item, index });
    });
    return order.map((g) => ({ label: g, rows: map.get(g)! }));
  }, [filtered]);

  const modLabel = isMac ? "⌘" : "Ctrl";

  // Auto focus input when opened
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  return (
    <>
      {showTrigger && (
        <button
          type="button"
          data-slot="command-menu-trigger"
          aria-label="Open command palette"
          onClick={() => setOpen(true)}
          className={cn(
            "group flex h-8 items-center justify-between gap-3 border border-hairline bg-inset px-3 text-[12px] font-medium text-ink-secondary transition hover:border-ink hover:text-ink focus-visible:outline-none cursor-pointer",
            className,
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Search size={13} className="shrink-0 text-ink-secondary group-hover:text-ink transition-colors" aria-hidden="true" />
            <span className="truncate font-normal tracking-tight text-ink-secondary group-hover:text-ink">{triggerPlaceholder}</span>
          </div>
          <span className="flex items-center gap-1 shrink-0">
            <Kbd pressed={combo}>{modLabel}</Kbd>
            <Kbd pressed={combo} className="uppercase">
              {key}
            </Kbd>
          </span>
        </button>
      )}

      {isOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-20 animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="relative flex w-full max-w-xl flex-col border border-hairline bg-panel shadow-2xl animate-in zoom-in-95 duration-150"
              onKeyDown={onListKeyDown}
            >
              {/* Search Bar Input */}
              <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
                <Search className="size-4 shrink-0 text-ink-secondary" aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setRawActive(0);
                  }}
                  placeholder={placeholder}
                  aria-label={placeholder}
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-secondary/50"
                />
                <span className="hidden items-center gap-1 sm:flex">
                  <Kbd pressed={combo}>{modLabel}</Kbd>
                  <Kbd pressed={combo} className="uppercase">
                    {key}
                  </Kbd>
                </span>
              </div>

              {/* Items List */}
              <div
                ref={listRef}
                className="max-h-[min(60vh,380px)] overflow-y-auto overscroll-contain p-2"
              >
                {filtered.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-ink-secondary">
                    {emptyMessage}
                  </p>
                ) : (
                  groups.map((group) => (
                    <div key={group.label || "_"} className="mb-2 last:mb-0">
                      {group.label && (
                        <div className="label-mono px-3 pt-2 pb-1 text-[10.5px] text-ink-secondary">
                          {group.label}
                        </div>
                      )}
                      {group.rows.map(({ item, index }) => {
                        const active = index === activeIndex;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-index={index}
                            data-active={active || undefined}
                            onMouseMove={() => setRawActive(index)}
                            onClick={() => handleSelect(item)}
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition cursor-pointer",
                              active
                                ? "bg-raised text-ink"
                                : "text-ink-secondary hover:bg-raised-hover hover:text-ink",
                            )}
                          >
                            {item.icon && (
                              <span className="grid size-5 shrink-0 place-items-center opacity-80">
                                {item.icon}
                              </span>
                            )}
                            <span className="flex-1 truncate">
                              <span className="block truncate font-medium text-ink">{item.label}</span>
                              {item.description && (
                                <span className="block truncate text-[11.5px] text-ink-secondary">
                                  {item.description}
                                </span>
                              )}
                            </span>
                            {item.shortcut && (
                              <Kbd className="ml-auto text-[10.5px]">{item.shortcut}</Kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer navigation keys */}
              <div className="frame-rule-above flex items-center gap-4 bg-app px-4 py-2.5 text-[11px] font-mono text-ink-secondary">
                <span className="flex items-center gap-1">
                  <Kbd pressed={keys.up}>↑</Kbd>
                  <Kbd pressed={keys.down}>↓</Kbd>
                  <span>navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <Kbd pressed={keys.enter}>↵</Kbd>
                  <span>select</span>
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <Kbd pressed={keys.esc}>esc</Kbd>
                  <span>close</span>
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
