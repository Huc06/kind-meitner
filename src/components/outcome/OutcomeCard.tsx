import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Play,
  Share2,
  Wind,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";
import { Tag } from "@/components/ui/tag";
import { api } from "@/state/store";
import type { OutdoorWindowItem } from "../../../shared/connected-services";
export interface OutcomeExecutionResult {
  ok: boolean;
  durationMs?: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    structuredContent?: {
      location?: { resolved_name?: string };
      windows?: OutdoorWindowItem[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  error?: string;
}

export interface OutcomeCardProps {
  initialState?: "proposal" | "clarification" | "running" | "deliverable" | "cancelled" | "no_match";
  serviceId: "outdoorwindow" | "plate" | string;
  agentId: string;
  serviceName: string;
  toolName: string;
  price: string;
  matchReason?: string;
  inputs: Record<string, unknown>;
  missingInputs?: Array<{ name: string; label: string; placeholder: string }>;
  deliverable?: OutcomeExecutionResult;
  targetThreadId?: string;
  onFollowUpCard?: (text: string) => void;
  onScheduleCreated?: (scheduleId: string) => void;
}

export function OutcomeCard(props: OutcomeCardProps) {
  const [state, setState] = useState(props.initialState ?? "proposal");
  const [inputs, setInputs] = useState<Record<string, unknown>>({ ...props.inputs });
  const [missingInputs, setMissingInputs] = useState(props.missingInputs ?? []);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [deliverable, setDeliverable] = useState<OutcomeExecutionResult | undefined>(props.deliverable);
  const [plateDeliverable, setPlateDeliverable] = useState<OutcomeExecutionResult | undefined>();
  const [plateRunning, setPlateRunning] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduledStatus, setScheduledStatus] = useState<{
    id: string;
    runCount: number;
    maxRuns: number;
    diffText: string;
    status: string;
  } | null>(null);

  // Missing inputs clarification flow
  if (state === "clarification" || missingInputs.length > 0) {
    const missing = missingInputs[0];
    const handleSubmitMissing = (e: React.FormEvent) => {
      e.preventDefault();
      const val = (inputs[missing.name] as string | undefined)?.trim();
      if (!val) return;
      setMissingInputs((prev) => prev.slice(1));
      if (missingInputs.length <= 1) {
        setState("proposal");
      }
    };

    return (
      <Frame title="INPUT REQUIRED" surface="card" className="max-w-[480px] p-4 text-ink">
        <div className="flex items-center gap-2 text-[12px] font-mono text-ink-secondary">
          <span>Kind Meitner Coordinator</span>
          <span>·</span>
          <span>{props.serviceName} (#{props.agentId})</span>
        </div>
        <p className="mt-1 text-[13px] text-ink">
          To plan your outdoor window, please specify your location:
        </p>
        <form onSubmit={handleSubmitMissing} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            className="flex-1 border border-hairline bg-inset px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-ink"
            placeholder={missing.placeholder}
            value={(inputs[missing.name] as string) ?? ""}
            onChange={(e) => setInputs((prev) => ({ ...prev, [missing.name]: e.target.value }))}
            autoFocus
          />
          <Button variant="primary" size="sm" type="submit">
            Continue
          </Button>
        </form>
      </Frame>
    );
  }

  // No match state
  if (state === "no_match") {
    return (
      <Frame title="NO MATCHING SERVICE" surface="card" className="max-w-[500px] p-4 text-ink">
        <div className="flex items-center gap-2 text-[12px] font-mono text-ink-secondary">
          <span>Kind Meitner Coordinator</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
          {props.matchReason ?? "No connected service fits this task."}
        </p>
        <div className="mt-3 border-t border-hairline pt-3 font-mono text-[11px] text-ink-secondary">
          Connected capabilities: <strong>OutdoorWindow (#6706)</strong> for air quality/weather windows, and <strong>Plate (#6708)</strong> for social cards.
        </div>
      </Frame>
    );
  }

  // Cancelled state
  if (state === "cancelled") {
    return (
      <Frame title="ACTION CANCELLED" surface="card" className="max-w-[480px] p-3 text-ink opacity-70">
        <div className="flex items-center gap-2 text-[12px] font-mono text-ink-secondary">
          <XCircle size={14} />
          <span>Execution cancelled by user. Nothing was sent or run.</span>
        </div>
      </Frame>
    );
  }

  // Execute pinned tool
  const handleRun = async () => {
    setRunning(true);
    setState("running");
    try {
      const res: OutcomeExecutionResult = await api("/api/okx/outcome/execute", {
        method: "POST",
        body: JSON.stringify({
          serviceId: props.serviceId,
          toolName: props.toolName,
          arguments: inputs,
          targetThreadId: props.targetThreadId,
        }),
      });
      setDeliverable(res);
      setState("deliverable");
    } catch (err) {
      setDeliverable({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      setState("deliverable");
    } finally {
      setRunning(false);
    }
  };

  // Follow-up Plate Card generation
  const handleMakeCard = async (textToRender: string) => {
    setPlateRunning(true);
    try {
      const res: OutcomeExecutionResult = await api("/api/okx/outcome/execute", {
        method: "POST",
        body: JSON.stringify({
          serviceId: "plate",
          toolName: "render_card",
          arguments: { text: textToRender },
          targetThreadId: props.targetThreadId,
        }),
      });
      setPlateDeliverable(res);
      props.onFollowUpCard?.(textToRender);
    } catch (err) {
      setPlateDeliverable({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPlateRunning(false);
    }
  };

  // Schedule demo run (1-minute demo cap 3)
  const handleScheduleDemo = async () => {
    setScheduling(true);
    try {
      const res: {
        schedule?: { id: string; runCount: number; maxRuns: number; status: string };
        firstRun?: { diffText: string };
      } = await api("/api/okx/outcome/schedule", {
        method: "POST",
        body: JSON.stringify({
          place: inputs.place,
          activity: inputs.activity,
          duration_minutes: inputs.duration_minutes,
          intervalMinutes: 1,
          maxRuns: 3,
          threadId: props.targetThreadId,
        }),
      });
      if (res?.schedule) {
        setScheduledStatus({
          id: res.schedule.id,
          runCount: res.schedule.runCount,
          maxRuns: res.schedule.maxRuns,
          diffText: res.firstRun?.diffText ?? "Run 1 started",
          status: res.schedule.status,
        });
        props.onScheduleCreated?.(res.schedule.id);
      }
    } catch {
      // Ignored
    } finally {
      setScheduling(false);
    }
  };

  const handlePauseSchedule = async () => {
    if (!scheduledStatus?.id) return;
    try {
      const res: { schedule?: { status: string } } = await api(`/api/okx/outcome/schedules/${scheduledStatus.id}/pause`, { method: "POST" });
      if (res?.schedule) {
        setScheduledStatus((prev) => prev ? { ...prev, status: res.schedule!.status } : null);
      }
    } catch {}
  };

  const handleResumeSchedule = async () => {
    if (!scheduledStatus?.id) return;
    try {
      const res: { schedule?: { status: string } } = await api(`/api/okx/outcome/schedules/${scheduledStatus.id}/resume`, { method: "POST" });
      if (res?.schedule) {
        setScheduledStatus((prev) => prev ? { ...prev, status: res.schedule!.status } : null);
      }
    } catch {}
  };

  const handleCancelSchedule = async () => {
    if (!scheduledStatus?.id) return;
    try {
      const res: { schedule?: { status: string } } = await api(`/api/okx/outcome/schedules/${scheduledStatus.id}/cancel`, { method: "POST" });
      if (res?.schedule) {
        setScheduledStatus((prev) => prev ? { ...prev, status: res.schedule!.status } : null);
      }
    } catch {}
  };

  // 1. Deliverable view
  if (state === "deliverable" && deliverable) {
    const summaryText =
      deliverable.result?.content?.[0]?.text ??
      (deliverable.ok ? "Deliverable generated" : `Error: ${deliverable.error}`);
    const windows = deliverable.result?.structuredContent?.windows ?? [];

    // Extract plate png if available
    let platePngUrl: string | undefined;
    if (plateDeliverable?.result?.content) {
      for (const item of plateDeliverable.result.content) {
        const match = item.text?.match(/https:\/\/[^\s"]+\.png/);
        if (match?.[0]) platePngUrl = match[0];
      }
    }

    return (
      <div className="flex flex-col gap-3 max-w-[620px] w-full">
        {/* Main Deliverable Card */}
        <Frame
          title={`${props.serviceName.toUpperCase()} · DELIVERABLE`}
          surface="card"
          className="border border-hairline p-4 text-ink bg-card shadow-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-hairline pb-2.5 text-[12px] font-mono text-ink-secondary">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink">{props.serviceName}</span>
              <span>·</span>
              <span>okx.ai #{props.agentId}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {deliverable.ok ? (
                <Tag tone="success">
                  <CheckCircle2 size={11} className="mr-1" />
                  Completed (200 OK) · {deliverable.durationMs ?? 0}ms
                </Tag>
              ) : (
                <Tag tone="danger">
                  <XCircle size={11} className="mr-1" />
                  Failed
                </Tag>
              )}
            </div>
          </div>

          {/* Error display */}
          {!deliverable.ok && (
            <div className="mt-3 p-3 bg-danger/10 border border-danger/30 text-danger text-[13px] font-mono rounded">
              {props.serviceName} returned: {deliverable.error}
            </div>
          )}

          {/* Readable summary */}
          {deliverable.ok && (
            <div className="mt-3">
              <p className="text-[13.5px] leading-relaxed text-ink font-sans whitespace-pre-wrap">
                {summaryText}
              </p>

              {/* Windows table */}
              {windows.length > 0 && (
                <div className="mt-4 border border-hairline rounded overflow-hidden">
                  <div className="bg-inset px-3 py-1.5 font-mono text-[11px] font-medium text-ink-secondary flex justify-between">
                    <span>Ranked Time Windows (Next 48h)</span>
                    <span>Suitability Score (0-100)</span>
                  </div>
                  <div className="divide-y divide-hairline">
                    {windows.slice(0, 4).map((w, idx) => {
                      const startTime = w.start ? new Date(w.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                      const endTime = w.end ? new Date(w.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                      const dayName = w.start ? new Date(w.start).toLocaleDateString([], { weekday: "short" }) : "";
                      const score = w.score ?? 0;
                      const scoreTone = score >= 80 ? "success" : score >= 60 ? "warning" : "danger";

                      return (
                        <div key={idx} className="p-2.5 flex items-center justify-between text-[12.5px]">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-ink-secondary text-[11px] w-4">#{idx + 1}</span>
                            <div className="flex flex-col">
                              <span className="font-medium text-ink">
                                {dayName} {startTime} – {endTime}
                              </span>
                              <span className="text-[11px] text-ink-secondary flex items-center gap-1">
                                <Wind size={11} /> Limiter: {w.limiting_factor}
                              </span>
                            </div>
                          </div>
                          <div>
                            <Tag tone={scoreTone}>{score} / 100</Tag>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Follow-up actions: Make card & Schedule */}
              <div className="mt-4 pt-3 border-t border-hairline flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={plateRunning || Boolean(plateDeliverable)}
                    onClick={() => void handleMakeCard(summaryText)}
                  >
                    {plateRunning ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Share2 size={13} className="mr-1.5" />}
                    {plateDeliverable ? "Card rendered below" : "Make a shareable card (Plate · #6708)"}
                  </Button>
                </div>

                {!scheduledStatus && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={scheduling}
                    onClick={() => void handleScheduleDemo()}
                    className="text-[11.5px] font-mono text-ink-secondary"
                  >
                    {scheduling ? <Loader2 size={12} className="animate-spin mr-1" /> : <Clock size={12} className="mr-1" />}
                    Schedule 1-min demo (max 3 runs)
                  </Button>
                )}
              </div>
            </div>
          )}
        </Frame>

        {/* Scheduled Runs Card */}
        {scheduledStatus && (
          <Frame title="SCHEDULED DEMO MONITOR" surface="card" className="border border-hairline p-3 text-ink bg-card">
            <div className="flex items-center justify-between text-[12px] font-mono">
              <div className="flex items-center gap-2">
                <Tag tone={scheduledStatus.status === "active" ? "accent" : scheduledStatus.status === "completed" ? "success" : "neutral"}>
                  {scheduledStatus.status.toUpperCase()}
                </Tag>
                <span className="text-ink">
                  Run {scheduledStatus.runCount} of {scheduledStatus.maxRuns} (1-minute interval)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {scheduledStatus.status === "active" && (
                  <Button variant="secondary" size="xs" onClick={() => void handlePauseSchedule()}>
                    Pause
                  </Button>
                )}
                {scheduledStatus.status === "paused" && (
                  <Button variant="secondary" size="xs" onClick={() => void handleResumeSchedule()}>
                    Resume
                  </Button>
                )}
                {scheduledStatus.status !== "cancelled" && scheduledStatus.status !== "completed" && (
                  <Button variant="ghost" size="xs" onClick={() => void handleCancelSchedule()}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-2 text-[12px] font-mono text-ink-secondary">
              Latest update: <span className="text-ink">{scheduledStatus.diffText}</span>
            </div>
          </Frame>
        )}

        {/* Plate Card Deliverable */}
        {plateDeliverable && (
          <Frame
            title="PLATE · SOCIAL CARD DELIVERABLE"
            surface="card"
            className="border border-hairline p-4 text-ink bg-card shadow-sm animate-pop-in"
          >
            <div className="flex items-center justify-between border-b border-hairline pb-2 text-[12px] font-mono text-ink-secondary">
              <div className="flex items-center gap-2">
                <ImageIcon size={13} />
                <span className="font-semibold text-ink">Plate (okx.ai #6708)</span>
              </div>
              <Tag tone="success">
                Rendered ({plateDeliverable.durationMs ?? 0}ms)
              </Tag>
            </div>

            {platePngUrl ? (
              <div className="mt-3 flex flex-col items-center">
                <img
                  src={platePngUrl}
                  alt="Outdoor window social card"
                  className="rounded border border-hairline max-w-full shadow"
                />
                <div className="mt-2 flex items-center justify-between w-full font-mono text-[11px] text-ink-secondary">
                  <span>Deterministic vector typesetting</span>
                  <a
                    href={platePngUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-ink hover:underline"
                  >
                    <ExternalLink size={11} /> Open full-size PNG
                  </a>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[12px] font-mono text-ink-secondary">
                {plateDeliverable.result?.content?.[0]?.text ?? "Social card rendered successfully."}
              </p>
            )}
          </Frame>
        )}
      </div>
    );
  }

  // 2. Proposal / Action card view
  return (
    <Frame
      title="PROPOSED ACTION"
      surface="card"
      className="max-w-[540px] w-full border border-hairline p-4 text-ink bg-card shadow-sm"
    >
      {/* Top attribution */}
      <div className="flex items-center justify-between border-b border-hairline pb-2.5 text-[12px] font-mono text-ink-secondary">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">Kind Meitner Coordinator</span>
          <span>·</span>
          <span>Deterministic</span>
        </div>
        <Tag tone="accent">Proposed</Tag>
      </div>

      {/* Match explanation */}
      {props.matchReason && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-secondary font-mono">
          {props.matchReason}
        </p>
      )}

      {/* Action details */}
      <div className="mt-3 border border-hairline bg-inset p-3 rounded font-mono text-[12px] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-ink-secondary">Service:</span>
          <span className="font-semibold text-ink">{props.serviceName} (okx.ai #{props.agentId})</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-secondary">Tool:</span>
          <span className="text-ink">{props.toolName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-secondary">Cost:</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            Listed price: free (0 USDT) per okx.ai listing
          </span>
        </div>

        {/* Inputs */}
        <div className="border-t border-hairline/60 pt-2 flex flex-col gap-1.5">
          <span className="text-ink-secondary">Inputs:</span>
          {editing ? (
            <div className="flex flex-col gap-2 mt-1">
              {props.serviceId === "outdoorwindow" && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-ink-secondary">Location:</span>
                    <input
                      type="text"
                      className="flex-1 border border-hairline bg-card px-2 py-1 text-[12px] text-ink"
                      value={(inputs.place as string) ?? ""}
                      onChange={(e) => setInputs((prev) => ({ ...prev, place: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-ink-secondary">Activity:</span>
                    <select
                      className="flex-1 border border-hairline bg-card px-2 py-1 text-[12px] text-ink"
                      value={(inputs.activity as string) ?? "run"}
                      onChange={(e) => setInputs((prev) => ({ ...prev, activity: e.target.value }))}
                    >
                      <option value="run">run</option>
                      <option value="walk">walk</option>
                      <option value="cycle">cycle</option>
                      <option value="kids_playground">kids_playground</option>
                      <option value="outdoor_dining">outdoor_dining</option>
                      <option value="commute">commute</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-ink-secondary">Duration:</span>
                    <input
                      type="number"
                      className="w-24 border border-hairline bg-card px-2 py-1 text-[12px] text-ink"
                      value={(inputs.duration_minutes as number) ?? 45}
                      onChange={(e) => setInputs((prev) => ({ ...prev, duration_minutes: parseInt(e.target.value, 10) || 45 }))}
                    />
                    <span className="text-ink-secondary">minutes</span>
                  </div>
                </>
              )}
              {props.serviceId === "plate" && (
                <div className="flex items-center gap-2">
                  <span className="w-20 text-ink-secondary">Text:</span>
                  <input
                    type="text"
                    className="flex-1 border border-hairline bg-card px-2 py-1 text-[12px] text-ink"
                    value={(inputs.text as string) ?? ""}
                    onChange={(e) => setInputs((prev) => ({ ...prev, text: e.target.value }))}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card p-2 border border-hairline font-mono text-[11.5px] text-ink">
              {JSON.stringify(inputs, null, 2)}
            </div>
          )}
        </div>
      </div>

      {/* Contract & Buttons */}
      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-ink-secondary">
        <span>Nothing executes before Run.</span>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-hairline">
        <Button
          variant="ghost"
          size="sm"
          disabled={running}
          onClick={() => setState("cancelled")}
        >
          Cancel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={running}
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Done Editing" : "Edit Inputs"}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={running}
          onClick={() => void handleRun()}
        >
          {running ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Play size={13} className="mr-1.5" />}
          {running ? "Executing…" : "Run"}
        </Button>
      </div>
    </Frame>
  );
}
