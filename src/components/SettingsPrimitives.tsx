import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";

export function Switch({
  checked,
  className,
  ...props
}: Omit<ComponentProps<"button">, "children" | "role" | "aria-checked"> & { checked: boolean }) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative h-5 w-9 shrink-0 border border-hairline transition-colors enabled:hover:border-ink-secondary/60 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
        checked ? "border-accent bg-accent" : "bg-inset",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] h-3.5 w-3.5 transition-[left] motion-reduce:transition-none",
          checked ? "left-[18px] bg-[var(--color-app)]" : "left-[2px] bg-ink-secondary",
        )}
      />
    </button>
  );
}

export function Card({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Frame
      title={title}
      surface="panel"
      solid
      className={cn("bg-card p-4", className)}
    >
      {subtitle && (
        <div className={cn("text-[12px] leading-relaxed text-ink-secondary", title && "mb-3")}>
          {subtitle}
        </div>
      )}
      {children}
    </Frame>
  );
}

/** Simple preferences share an aligned row; forms with several fields keep a Card. */
export function SettingRow({
  title,
  subtitle,
  children,
  message,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  message?: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={titleId} className="setting-row frame-rule-below py-3.5 last:after:hidden">
      <div className="grid min-w-0 grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
        <div className="min-w-0">
          <div id={titleId} className="text-[13px] font-medium text-ink">{title}</div>
          {subtitle && <div className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{subtitle}</div>}
        </div>
        <div className="min-w-0 sm:max-w-[280px]">{children}</div>
      </div>
      {message && <div className="mt-2 text-[12px]">{message}</div>}
    </div>
  );
}

/** A command the user is meant to run, with one-click copy. */
export function CommandLine({ command, copyLabel = "Copy command" }: { command: string; copyLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard permission can be denied; leave the button unchanged */
    }
  };

  return (
    <div className="flex items-center gap-2 border border-hairline bg-inset px-3 py-1.5 font-mono text-[12px]">
      <span aria-hidden="true" className="select-none text-ink-secondary">$</span>
      <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap text-ink">
        {command}
      </code>
      <Button
        variant="ghost"
        size="xs"
        icon
        onClick={() => void copy()}
        aria-label={copyLabel}
      >
        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      </Button>
    </div>
  );
}
