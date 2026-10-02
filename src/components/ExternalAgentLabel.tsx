import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { decideExternalPayment, externalSourceLabel, formatTestnetAmount } from "@/lib/external-agents";
import { t } from "@/lib/i18n";
import type { Message } from "@/state/store";

const FLAG_KEYS = {
  "hidden-characters": "external.flag.hiddenCharacters",
  "unsafe-link": "external.flag.unsafeLink",
  "instructions-to-agents": "external.flag.instructions",
  "redacted-secret": "external.flag.redacted",
  truncated: "external.flag.truncated",
} as const;

/** Transport and provenance for a message from an external agent: which
 * connection answered, how (direct or through zroute → upstream), and what
 * the content filter found. Never claims official OKX status. */
export function ExternalAgentLabel({ external }: { external: NonNullable<Message["external"]> }) {
  const flags = (external.contentFlags ?? []).filter((flag): flag is keyof typeof FLAG_KEYS => flag in FLAG_KEYS);
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] text-ink-secondary" data-external-source={external.transport}>
        <span>{externalSourceLabel(external)}</span>
        {external.status === "streaming" && <span>· {t("external.streaming")}</span>}
        {external.status === "cancelled" && <span>· {t("external.cancelledShort")}</span>}
        {external.latencyMs !== undefined && <span>· {t("external.latency", { ms: external.latencyMs })}</span>}
        <Tag tone="neutral" variant="outline" size="sm">{t("external.untrusted")}</Tag>
      </span>
      {flags.length > 0 && (
        <span role="note" className="inline-flex items-start gap-1 font-mono text-[10.5px] text-warning" data-content-flags={flags.join(" ")}>
          <AlertTriangle size={11} className="mt-px shrink-0" aria-hidden="true" />
          {flags.map((flag) => t(FLAG_KEYS[flag])).join(" · ")}
        </span>
      )}
    </span>
  );
}

/** An x402 testnet payment an external agent asked for. Nothing is signed
 * until the person approves; the card states what settled and what did not. */
export function ExternalPaymentCard({ message }: { message: Message }) {
  const payment = message.externalPayment!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expired = payment.state === "pending" && payment.expiresAt < Date.now();
  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await decideExternalPayment(payment.id, approve);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("external.error.generic"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label={t("external.pay.title")} className="w-full max-w-[min(32rem,100%)] border border-warning/50 bg-card p-3.5" data-payment-state={payment.state}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-ink">{message.external?.displayName ?? t("external.pay.agent")}</span>
        <span className="font-mono text-[11px] text-ink-secondary">{t("external.pay.title")}</span>
        <Tag tone="warning" variant="soft" size="sm">{t("external.pay.testnetOnly")}</Tag>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 font-mono text-[11px]">
        <dt className="text-ink-secondary">{t("external.pay.amount")}</dt>
        <dd className="text-ink">{formatTestnetAmount(payment.amount)} <span className="text-ink-secondary">({payment.amount} {t("external.pay.units")})</span></dd>
        <dt className="text-ink-secondary">{t("external.pay.network")}</dt>
        <dd className="text-ink">X Layer testnet · {payment.network}</dd>
        <dt className="text-ink-secondary">{t("external.pay.asset")}</dt>
        <dd className="truncate text-ink" title={payment.asset}>{payment.asset}</dd>
        <dt className="text-ink-secondary">{t("external.pay.payTo")}</dt>
        <dd className="truncate text-ink" title={payment.payTo}>{payment.payTo}</dd>
        {payment.description && (
          <>
            <dt className="text-ink-secondary">{t("external.pay.for")}</dt>
            <dd className="text-ink">{payment.description}</dd>
          </>
        )}
        {payment.transaction && (
          <>
            <dt className="text-ink-secondary">{t("external.pay.transaction")}</dt>
            <dd className="truncate text-ink" title={payment.transaction}>{payment.transaction}</dd>
          </>
        )}
      </dl>
      <p role="status" aria-live="polite" className="mt-2 font-mono text-[11px] text-ink-secondary">
        {expired ? t("external.pay.state.expired") : t(`external.pay.state.${payment.state}`)}
      </p>
      {payment.state === "pending" && !expired && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void decide(true)}>{t("external.pay.approve")}</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void decide(false)}>{t("external.pay.decline")}</Button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 font-mono text-[11px] text-danger">{error}</p>}
    </section>
  );
}
