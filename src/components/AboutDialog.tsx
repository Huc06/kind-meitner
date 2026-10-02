// "About kind-meitner" — the version you are running and where to go next.
// Small on purpose: the interesting settings live in the settings panel, and
import { useEffect, useRef } from "react";
import { DialogBackdrop, DialogPanel } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import {
  APP_NAME,
  APP_REPOSITORY,
  DOCS_URL,
  LICENSE_URL,
  RELEASES_URL,
  appVersion,
  openExternalLink,
  platformLabel,
} from "@/lib/app-links";
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const platform = platformLabel(window.ogb?.platform);

  return (
    <DialogBackdrop onDismiss={onClose}>
      <DialogPanel
        aria-labelledby="about-dialog-title"
        className="w-full max-w-[380px] p-6 text-center"
      >
        <img src="/app-icon.svg" alt="" width={56} height={56} className="mx-auto size-14" />
        <h2 id="about-dialog-title" className="label-mono mt-3 text-[14px] text-ink">
          <span className="text-ink-secondary">[ </span>
          {APP_NAME}
          <span className="text-ink-secondary"> ]</span>
        </h2>
        <p className="mt-1 font-mono text-[11px] text-ink-secondary">
          Version {appVersion()}
          {platform ? ` · ${platform}` : ""}
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
          An open-source desktop home for your agents. Apache 2.0 licensed.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 font-mono text-[11px]">
          <AboutLink href={APP_REPOSITORY} label="GitHub" />
          <AboutLink href={DOCS_URL} label="Docs" />
          <AboutLink href={RELEASES_URL} label="Releases" />
          <AboutLink href={LICENSE_URL} label="License" />
        </div>
        <Button
          ref={closeRef}
          type="button"
          variant="secondary"
          size="sm"
          onClick={onClose}
          className="mt-5 w-full"
        >
          Close
        </Button>
      </DialogPanel>
    </DialogBackdrop>
  );
}

function AboutLink({ href, label }: { href: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => void openExternalLink(href)}
      className="text-ink underline hover:text-ink-secondary"
    >
      {label}
    </button>
  );
}
