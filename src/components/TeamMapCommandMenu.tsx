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
        "inline-flex min-w-5 origin-center items-center justify-center rounded-[5px] border border-white/[0.12] bg-[#1E2228] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold select-none transition-transform duration-100 ease-out",
        pressed
          ? "scale-x-95 scale-y-85 bg-accent/20 border-accent/40 text-accent shadow-none"
          : "text-white/60 shadow-[0_1px_0_0_rgba(255,255,255,0.08)]",
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

  const modDownRef = React.useRef(false);
  const armedRef = React.useRef(false);
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

  // Global hotkey: ⌘K or Ctrl+K
  React.useEffect(() => {
    const usesMod = (e: KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey);
    const isMod = (k: string) => k === "control" || k === "meta";

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (isMod(k)) modDownRef.current = true;
      if (k === key && usesMod(e)) {
        e.preventDefault();
        setCombo(true);
        armedRef.current = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const released = armedRef.current && (isMod(k) || k === key);
      if (isMod(k)) modDownRef.current = false;
      if (released) {
        armedRef.current = false;
        setCombo(false);
        setOpen(!isOpen);
      }
    };

    const reset = () => {
      armedRef.current = false;
      modDownRef.current = false;
      setCombo(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", reset);
    };
  }, [isMac, key, isOpen, setOpen]);

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
            "group flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#16191E]/80 backdrop-blur-md px-3 py-1.5 text-xs text-white/60 transition hover:border-white/[0.18] hover:bg-[#1C2026] hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            className,
          )}
        >
          <Search className="size-3.5 shrink-0 text-white/40 group-hover:text-accent transition-colors" aria-hidden="true" />
          <span className="truncate">{triggerPlaceholder}</span>
          <span className="flex items-center gap-1 ml-1.5">
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
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-20 backdrop-blur-md animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#14171C]/95 shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 duration-150"
              onKeyDown={onListKeyDown}
            >
              {/* Search Bar Input */}
              <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
                <Search className="size-4 shrink-0 text-white/40" aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setRawActive(0);
                  }}
                  placeholder={placeholder}
                  aria-label={placeholder}
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
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
                  <p className="px-3 py-8 text-center text-sm text-white/40">
                    {emptyMessage}
                  </p>
                ) : (
                  groups.map((group) => (
                    <div key={group.label || "_"} className="mb-2 last:mb-0">
                      {group.label && (
                        <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
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
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition cursor-pointer",
                              active
                                ? "bg-white/[0.08] text-white"
                                : "text-white/70 hover:bg-white/[0.04] hover:text-white",
                            )}
                          >
                            {item.icon && (
                              <span className="grid size-5 shrink-0 place-items-center opacity-80">
                                {item.icon}
                              </span>
                            )}
                            <span className="flex-1 truncate">
                              <span className="block truncate font-medium text-white/90">{item.label}</span>
                              {item.description && (
                                <span className="block truncate text-[11.5px] text-white/45">
                                  {item.description}
                                </span>
                              )}
                            </span>
                            {item.shortcut && (
                              <Kbd className="ml-auto text-[10px]">{item.shortcut}</Kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer navigation keys */}
              <div className="flex items-center gap-4 border-t border-white/[0.08] bg-[#0E1013]/60 px-4 py-2.5 text-[11px] text-white/40">
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
