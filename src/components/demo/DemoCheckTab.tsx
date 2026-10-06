import { useEffect, useRef, useState } from "react";
import {
  OKX_DEMO_IDENTITY,
  OKX_DEMO_CONTROLLED_FAILURE_URL,
  type OkxDemoCheckRequest,
  type OkxDemoCheckResult,
} from "../../../shared/okx-demo-identity";
import { OKX_DEMO_RECORDED } from "../../../shared/okx-demo-recorded";
import { api, ApiError } from "@/state/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DemoResultCard } from "./DemoResultCard";
import { AlertTriangle, RefreshCw, XCircle } from "lucide-react";

export function DemoCheckTab({
  onCheckSuccess,
}: {
  onCheckSuccess: (result: OkxDemoCheckResult & { ok: true }, verdict: string) => void;
}) {
  // Endpoint form state
  const [endpointUrl, setEndpointUrl] = useState("");
  const [endpointError, setEndpointError] = useState<string | null>(null);

  // Agent form state
  const [agentId, setAgentId] = useState<string>(OKX_DEMO_IDENTITY.agentId);
  const [agentEndpointUrl, setAgentEndpointUrl] = useState("");
  const [agentError, setAgentError] = useState<string | null>(null);

  // Execution state
  const [activeForm, setActiveForm] = useState<"endpoint" | "agent" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cancelledMessage, setCancelledMessage] = useState<string | null>(null);

  // Active check result or error
  const [checkResult, setCheckResult] = useState<OkxDemoCheckResult | null>(null);
  const [lastRequest, setLastRequest] = useState<OkxDemoCheckRequest | null>(null);
  const [showRecorded, setShowRecorded] = useState(false);

  // Refs for abort, sequence token, and focus management
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const endpointRunButtonRef = useRef<HTMLButtonElement>(null);
  const agentRunButtonRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  // A result or in-flight status appears below the forms; bring it into view
  // so it is not missed on short viewports.
  useEffect(() => {
    if (isLoading || checkResult) statusRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [isLoading, checkResult]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const startTimer = () => {
    setElapsedSeconds(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
    const start = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 200);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelCheck = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopTimer();
    setIsLoading(false);
    setCancelledMessage(t("demo.cancelled"));
    // The trigger is disabled until this state change renders; focus after it.
    const trigger = activeForm === "endpoint" ? endpointRunButtonRef : agentRunButtonRef;
    requestAnimationFrame(() => trigger.current?.focus());
  };

  const executeCheck = async (req: OkxDemoCheckRequest, formType: "endpoint" | "agent") => {
    const currentSeq = ++requestSequenceRef.current;
    setActiveForm(formType);
    setIsLoading(true);
    setCancelledMessage(null);
    setCheckResult(null);
    setShowRecorded(false);
    setLastRequest(req);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    startTimer();

    try {
      const data = (await api("/api/okx/demo/check", {
        method: "POST",
        body: JSON.stringify(req),
        signal: controller.signal,
      })) as OkxDemoCheckResult;

      if (currentSeq !== requestSequenceRef.current) return;

      stopTimer();
      setIsLoading(false);
      abortControllerRef.current = null;
      setCheckResult(data);

      if (data.ok) {
        const envData = (data.envelope?.data ?? {}) as Record<string, unknown>;
        const verdict = String(envData.listingStatus ?? envData.verdict ?? envData.decision ?? "");
        onCheckSuccess(data, verdict);
      }
    } catch (err: unknown) {
      if (currentSeq !== requestSequenceRef.current) return;
      stopTimer();
      setIsLoading(false);
      abortControllerRef.current = null;
      if (err instanceof Error && err.name === "AbortError") {
        setCancelledMessage(t("demo.cancelled"));
        return;
      }

      // Treat unexpected network exceptions as ok: false with tool_error/unreachable
      const safeMessage = err instanceof ApiError ? err.message : t("demo.error.network");
      setCheckResult({
        ok: false,
        source: "live",
        status: "unreachable",
        safeMessage,
        requestId: `req-client-err-${Date.now()}`,
        startedAt: new Date().toISOString(),
        latencyMs: 0,
      });
    }
  };

  const handleRunEndpoint = () => {
    const url = endpointUrl.trim();
    if (!url) {
      setEndpointError(t("demo.endpointForm.errorEmpty"));
      return;
    }
    if (url.length > 500) {
      setEndpointError(t("demo.endpointForm.errorTooLong"));
      return;
    }
    setEndpointError(null);
    void executeCheck({ kind: "endpoint", endpointUrl: url }, "endpoint");
  };

  const handleAgentIdChange = (value: string) => {
    setAgentId(value);
    if (agentError) setAgentError(null);
    setCheckResult(null);
    setLastRequest(null);
    setCancelledMessage(null);
    setShowRecorded(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    requestSequenceRef.current++;
  };

  const handleAgentEndpointUrlChange = (value: string) => {
    setAgentEndpointUrl(value);
    setCheckResult(null);
    setLastRequest(null);
    setCancelledMessage(null);
    setShowRecorded(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    requestSequenceRef.current++;
  };

  const handleRunAgent = () => {
    const raw = agentId.trim();
    if (!raw) {
      setAgentError(t("demo.agentForm.errorEmpty"));
      return;
    }
    const urlMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?okx\.ai\/agents\/(\d+)/i);
    const cleaned = urlMatch ? urlMatch[1]! : raw.replace(/^#/, "");
    if (!/^\d+$/.test(cleaned)) {
      setAgentError(t("demo.agentForm.errorInvalid", { defaultValue: "Enter a numeric OKX agent ID (e.g. 13867) or okx.ai/agents/<id> URL." }));
      return;
    }
    setAgentError(null);
    const ep = agentEndpointUrl.trim() || undefined;
    void executeCheck({ kind: "agent", agentId: cleaned, endpointUrl: ep }, "agent");
  };

  const retryLastCheck = () => {
    if (!lastRequest || !activeForm) return;
    void executeCheck(lastRequest, activeForm);
  };

  // Determine matching recorded case
  const getMatchingRecordedCase = (): OkxDemoCheckResult & { ok: true } => {
    if (activeForm === "agent") {
      return OKX_DEMO_RECORDED.cases.agent as OkxDemoCheckResult & { ok: true };
    }
    if (endpointUrl.trim() === OKX_DEMO_CONTROLLED_FAILURE_URL) {
      return OKX_DEMO_RECORDED.cases.failure as OkxDemoCheckResult & { ok: true };
    }
    return OKX_DEMO_RECORDED.cases.endpoint as OkxDemoCheckResult & { ok: true };
  };

  return (
    <div className="space-y-6">
      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Endpoint Check Form */}
        <div className="flex flex-col justify-between rounded border border-hairline bg-surface p-4 sm:p-5">
          <div className="space-y-3">
            <h2 className="font-mono text-sm font-semibold tracking-tight text-ink">
              {t("demo.endpointForm.title")}
            </h2>
            <div>
              <label
                htmlFor="demo-endpoint-input"
                className="block font-mono text-[11px] font-medium text-ink-secondary mb-1"
              >
                {t("demo.endpointForm.label")}
              </label>
              <input
                id="demo-endpoint-input"
                type="text"
                value={endpointUrl}
                onChange={(e) => {
                  setEndpointUrl(e.target.value);
                  if (endpointError) setEndpointError(null);
                }}
                placeholder={OKX_DEMO_IDENTITY.endpointUrl}
                disabled={isLoading}
                className="w-full rounded border border-hairline bg-inset px-2.5 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-secondary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
              />
              {endpointError && (
                <p className="mt-1 font-mono text-[11px] text-danger" role="alert">
                  {endpointError}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={isLoading}
                onClick={() => {
                  setEndpointUrl(OKX_DEMO_IDENTITY.endpointUrl);
                  setEndpointError(null);
                }}
                className="font-mono text-[11px]"
              >
                {t("demo.endpointForm.useOurs")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={isLoading}
                onClick={() => {
                  setEndpointUrl(OKX_DEMO_CONTROLLED_FAILURE_URL);
                  setEndpointError(null);
                }}
                className="font-mono text-[11px]"
              >
                {t("demo.endpointForm.useControlledFailure")}
              </Button>
            </div>

            <p className="font-mono text-[11px] leading-relaxed text-ink-secondary">
              {t("demo.endpointForm.failureHelper")}
            </p>
          </div>

          <div className="pt-4 mt-2 border-t border-hairline">
            <Button
              ref={endpointRunButtonRef}
              variant="primary"
              size="sm"
              disabled={isLoading}
              onClick={handleRunEndpoint}
              className="w-full font-mono text-[12px]"
            >
              {isLoading && activeForm === "endpoint"
                ? t("demo.checking", { seconds: elapsedSeconds })
                : t("demo.endpointForm.run")}
            </Button>
          </div>
        </div>

        {/* Agent Check Form */}
        <div className="flex flex-col justify-between rounded border border-hairline bg-surface p-4 sm:p-5">
          <div className="space-y-3">
            <h2 className="font-mono text-sm font-semibold tracking-tight text-ink">
              {t("demo.agentForm.title")}
            </h2>
            <div>
              <label
                htmlFor="demo-agent-id-input"
                className="block font-mono text-[11px] font-medium text-ink-secondary mb-1"
              >
                {t("demo.agentForm.idLabel")}
              </label>
              <input
                id="demo-agent-id-input"
                type="text"
                value={agentId}
                onChange={(e) => handleAgentIdChange(e.target.value)}
                placeholder="13851"
                className="w-full rounded border border-hairline bg-inset px-2.5 py-1.5 font-mono text-[12px] text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
              />
              {agentError && (
                <p className="mt-1 font-mono text-[11px] text-danger" role="alert">
                  {agentError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="demo-agent-endpoint-input"
                className="block font-mono text-[11px] font-medium text-ink-secondary mb-1"
              >
                {t("demo.agentForm.endpointLabel")}
              </label>
              <input
                id="demo-agent-endpoint-input"
                type="text"
                value={agentEndpointUrl}
                onChange={(e) => handleAgentEndpointUrlChange(e.target.value)}
                placeholder="https://example.com/mcp"
                disabled={isLoading}
                className="w-full rounded border border-hairline bg-inset px-2.5 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-secondary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus"
              />
            </div>

            <p className="font-mono text-[11px] leading-relaxed text-ink-secondary">
              {t("demo.agentForm.helper")}
            </p>
          </div>

          <div className="pt-4 mt-2 border-t border-hairline">
            <Button
              ref={agentRunButtonRef}
              variant="primary"
              size="sm"
              disabled={isLoading}
              onClick={handleRunAgent}
              className="w-full font-mono text-[12px]"
            >
              {isLoading && activeForm === "agent"
                ? t("demo.checking", { seconds: elapsedSeconds })
                : t("demo.agentForm.run")}
            </Button>
          </div>
        </div>
      </div>

      {/* Execution Status / In-flight Controls */}
      <div ref={statusRef} aria-live="polite" className="min-w-0 scroll-mt-4">
        {isLoading && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-hairline bg-surface p-3 font-mono text-[12px]">
            <div className="flex items-center gap-2 text-ink">
              <span className="size-2 animate-ping rounded-full bg-accent" />
              <span>{t("demo.checking", { seconds: elapsedSeconds })}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={cancelCheck} className="font-mono text-[11px]">
              {t("demo.cancel")}
            </Button>
          </div>
        )}

        {cancelledMessage && !isLoading && (
          <div className="flex items-center gap-2 rounded border border-hairline bg-inset p-3 font-mono text-[12px] text-ink-secondary">
            <XCircle size={15} aria-hidden="true" className="shrink-0 text-ink-secondary" />
            <span>{cancelledMessage}</span>
          </div>
        )}

        {/* Failure state */}
        {checkResult && !checkResult.ok && !isLoading && (
          <div className="space-y-3 rounded border border-danger/40 bg-surface p-4 sm:p-5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
              <div className="min-w-0 flex-1 font-mono text-[12px]">
                <div className="font-semibold text-danger">
                  {checkResult.status === "timeout"
                    ? t("demo.error.timeout")
                    : checkResult.status === "unreachable"
                      ? t("demo.error.unreachable")
                      : checkResult.status === "rate_limited"
                        ? t("demo.error.rate_limited")
                        : checkResult.status === "bad_response"
                          ? t("demo.error.bad_response")
                          : checkResult.status === "tool_error"
                            ? t("demo.error.tool_error")
                            : t("demo.error.invalid_input")}
                </div>
                <div className="mt-1 text-ink break-words">{checkResult.safeMessage}</div>
                <div className="mt-1 text-[11px] text-ink-secondary">
                  {t("demo.error.meta", { status: checkResult.status, latency: checkResult.latencyMs })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3 font-mono text-[12px]">
              <Button variant="secondary" size="sm" onClick={retryLastCheck}>
                <RefreshCw size={12} aria-hidden="true" />
                <span>{t("demo.retry")}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRecorded((prev) => !prev)}
              >
                <span>
                  {showRecorded
                    ? t("demo.hideRecordedEvidence")
                    : t("demo.showRecordedEvidence")}
                </span>
              </Button>
            </div>

            {showRecorded && (
              <div className="mt-3 border-t border-hairline pt-3">
                <DemoResultCard
                  result={getMatchingRecordedCase()}
                  isRecorded={true}
                  capturedAt={OKX_DEMO_RECORDED.capturedAt}
                />
              </div>
            )}
          </div>
        )}

        {/* Success live state */}
        {checkResult && checkResult.ok && !isLoading && (
          <div className="space-y-3">
            <DemoResultCard
              result={checkResult}
              isRecorded={false}
              onRerun={lastRequest && activeForm ? () => void executeCheck(lastRequest, activeForm) : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
