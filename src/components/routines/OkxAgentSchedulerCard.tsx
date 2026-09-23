import { useState } from "react";
import { Clock, Loader2, Play, Plus, Search } from "lucide-react";
import { api, useStore } from "@/state/store";
import { cn } from "@/lib/cn";
import { OKX_PRODUCTION_FREE_MCP_URL } from "@/lib/okx-action-cards";

export interface ResolvedAgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ResolvedAgent {
  agentId: string;
  name: string;
  description: string;
  endpointUrl: string;
  provider: string;
  avatar: string;
  status: "available" | "offline";
  tools: ResolvedAgentTool[];
}

const PRESET_AGENTS = [
  {
    id: "okx-market-scout-v1",
    name: "Markets (ASP #13837)",
    role: "Readiness & Trust Gatekeeper",
    badge: "Official ASP",
    desc: "Runs free, read-only listing readiness scans and pre-spend trust cards.",
  },
  {
    id: "okx-listing-coach",
    name: "Listing Coach",
    role: "Builder Readiness Advocate",
    badge: "Builder Tool",
    desc: "Scans candidate endpoints against OKX listing review criteria.",
  },
  {
    id: "okx-spend-scout",
    name: "Spend Scout",
    role: "Buyer Pre-Spend Guardian",
    badge: "Security",
    desc: "Evaluates listing reachability and safety before funds are spent.",
  },
];

const SCHEDULE_INTERVALS = [
  { label: "Every 15 mins", value: 15 },
  { label: "Every 30 mins", value: 30 },
  { label: "Every 1 hour", value: 60 },
  { label: "Every 6 hours", value: 360 },
  { label: "Daily (24h)", value: 1440 },
];

const DEFAULT_TOOLS = [
  { name: "scan_free_mcp_readiness", label: "scan_free_mcp_readiness (Listing Gate)" },
  { name: "get_asp_trust_card", label: "get_asp_trust_card (Pre-Spend Trust)" },
  { name: "query_market_benchmarks", label: "query_market_benchmarks (Intelligence)" },
];

export function OkxAgentSchedulerCard({ onOpenRoom }: { onOpenRoom?: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const [selectedPreset, setSelectedPreset] = useState("okx-market-scout-v1");
  const [customInput, setCustomInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolvedAgent, setResolvedAgent] = useState<ResolvedAgent | null>(null);
  const [selectedTool, setSelectedTool] = useState("scan_free_mcp_readiness");
  const [targetEndpointUrl, setTargetEndpointUrl] = useState(OKX_PRODUCTION_FREE_MCP_URL);
  const [targetAgentId, setTargetAgentId] = useState("13837");
  const [intervalMins, setIntervalMins] = useState(30);
  const [runningNow, setRunningNow] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [lastExecutionResult, setLastExecutionResult] = useState<{ ok: boolean; message: string } | null>(null);

  const devDayGateRoom = state.groups.find((group) =>
    group.section === "Dev Day" && group.name.trim().replace(/^#/, "").toLowerCase() === "dev-day-gate",
  ) ?? state.groups.find((group) => group.name === "#dev-day-gate");
  const targetThreadId = devDayGateRoom?.threadId;
  const leadBot = state.bots.find((bot) => !bot.hidden && bot.name === "Markets")
    ?? state.bots.find((bot) => !bot.hidden);

  const toolArgs = (): Record<string, unknown> => {
    if (selectedTool === "scan_free_mcp_readiness") {
      return {
        endpointUrl: targetEndpointUrl.trim(),
        ...(targetAgentId.trim() ? { agentId: targetAgentId.trim() } : {}),
      };
    }
    if (selectedTool === "get_asp_trust_card") {
      return {
        agentId: targetAgentId.trim() || "13837",
        ...(targetEndpointUrl.trim() ? { endpointUrl: targetEndpointUrl.trim() } : {}),
      };
    }
    return {};
  };

  const resolveAgent = async (agentIdOrUrl: string) => {
    if (!agentIdOrUrl.trim()) return;
    setResolving(true);
    setLastExecutionResult(null);
    try {
      const res = await api("/api/okx/resolve-agent", {
        method: "POST",
        body: JSON.stringify({ agentIdOrUrl: agentIdOrUrl.trim() }),
      }) as ResolvedAgent;
      setResolvedAgent(res);
      if (res.status === "offline") {
        setLastExecutionResult({ ok: false, message: `Agent ${res.agentId} is offline or has no MCP endpoint.` });
        return;
      }
      if (res.tools[0]?.name) setSelectedTool(res.tools[0].name);
    } catch (err) {
      setLastExecutionResult({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to resolve agent",
      });
    } finally {
      setResolving(false);
    }
  };

  const handleSelectPreset = (id: string) => {
    setSelectedPreset(id);
    setCustomInput("");
    void resolveAgent(id);
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    setLastExecutionResult(null);
    try {
      const res = await api("/api/okx/execute-agent-tool", {
        method: "POST",
        body: JSON.stringify({
          endpointUrl: resolvedAgent?.endpointUrl || "/api/okx/free-mcp",
          toolName: selectedTool,
          arguments: toolArgs(),
          targetThreadId,
        }),
      });
      setLastExecutionResult({
        ok: Boolean(res.ok),
        message: res.ok
          ? "Executed. Result card posted to #dev-day-gate."
          : (res.error ?? "Execution failed"),
      });
    } catch (err) {
      setLastExecutionResult({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to execute tool",
      });
    } finally {
      setRunningNow(false);
    }
  };

  const handleScheduleRoutine = async () => {
    if (!leadBot) {
      setLastExecutionResult({ ok: false, message: "Create a bot before scheduling an OKX routine." });
      return;
    }
    setScheduling(true);
    setLastExecutionResult(null);
    try {
      const created = await api("/api/routines", {
        method: "POST",
        body: JSON.stringify({
          name: `OKX: ${selectedTool} (${intervalMins}m)`,
          prompt: `okx-tool:${JSON.stringify({
            toolName: selectedTool,
            endpointUrl: resolvedAgent?.endpointUrl || "/api/okx/free-mcp",
            arguments: toolArgs(),
          })}`,
          target: "okx-task",
          botId: leadBot.id,
          runOn: "maus",
          schedule: {
            type: "interval",
            everyMinutes: intervalMins,
            anchorAt: Date.now(),
          },
          durationMinutes: 5,
          enabled: true,
        }),
      });
      if (created.routine) dispatch({ type: "routinePatched", routine: created.routine });
      setLastExecutionResult({
        ok: true,
        message: `Routine created. Runs every ${intervalMins} minutes into #dev-day-gate.`,
      });
    } catch (err) {
      setLastExecutionResult({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to create routine",
      });
    } finally {
      setScheduling(false);
    }
  };

  const toolOptions = resolvedAgent?.tools.length
    ? resolvedAgent.tools.map((tool) => ({ name: tool.name, label: tool.name }))
    : DEFAULT_TOOLS;

  return (
    <div className="rounded-2xl border border-accent-border/40 bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold text-ink">OKX.ai Agent Hub & Scheduler</span>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-accent">
              A2MCP Tools
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-secondary">
            Resolve an agent, pick a tool, then run now or schedule into #dev-day-gate.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label className="text-[12px] font-medium uppercase tracking-wide text-ink-secondary">
          Select OKX Agent
        </label>
        <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {PRESET_AGENTS.map((preset) => {
            const isSelected = selectedPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={cn(
                  "flex flex-col rounded-xl border p-3 text-left transition-all",
                  isSelected
                    ? "border-accent bg-accent/10 shadow-sm"
                    : "border-hairline/50 bg-panel/30 hover:border-hairline hover:bg-raised/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-ink">{preset.name}</span>
                  <span className="rounded bg-control px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary">
                    {preset.badge}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-accent">{preset.role}</div>
                <div className="mt-1 line-clamp-2 text-[11.5px] text-ink-secondary">{preset.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3.5 flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(event) => setCustomInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void resolveAgent(customInput)}
          placeholder="Or enter Agent ID or MCP URL (13837, okx.ai/agents/11167, or https://…)"
          className="w-full rounded-xl border border-hairline/50 bg-inset px-3.5 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void resolveAgent(customInput)}
          disabled={resolving || !customInput.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-control px-3.5 py-2 text-[13px] font-medium text-ink hover:bg-raised disabled:opacity-50"
        >
          {resolving ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Fetch Tools
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-hairline/40 bg-inset/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-ink">Action & Parameters</span>
          <span className="truncate text-[11.5px] text-ink-secondary">
            Endpoint: <span className="font-mono text-accent">{resolvedAgent?.endpointUrl || "/api/okx/free-mcp"}</span>
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11.5px] font-medium text-ink-secondary">Agent Tool</label>
            <select
              value={selectedTool}
              onChange={(event) => setSelectedTool(event.target.value)}
              className="mt-1 w-full rounded-lg border border-hairline/40 bg-control px-3 py-1.5 text-[13px] text-ink focus:border-accent focus:outline-none"
            >
              {toolOptions.map((tool) => (
                <option key={tool.name} value={tool.name}>{tool.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11.5px] font-medium text-ink-secondary">Target Agent ID</label>
            <div className="mt-1 flex gap-1.5">
              <input
                type="text"
                value={targetAgentId}
                onChange={(event) => setTargetAgentId(event.target.value)}
                placeholder="13837"
                className="w-full rounded-lg border border-hairline/40 bg-control px-3 py-1.5 font-mono text-[12.5px] text-ink focus:border-accent focus:outline-none"
              />
              <button type="button" onClick={() => setTargetAgentId("13837")} className="shrink-0 rounded bg-card px-2 py-1 text-[11px] text-ink-secondary hover:text-ink">
                #13837
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-[11.5px] font-medium text-ink-secondary">Candidate endpoint URL</label>
          <div className="mt-1 flex gap-1.5">
            <input
              type="url"
              value={targetEndpointUrl}
              onChange={(event) => setTargetEndpointUrl(event.target.value)}
              placeholder={OKX_PRODUCTION_FREE_MCP_URL}
              className="w-full rounded-lg border border-hairline/40 bg-control px-3 py-1.5 font-mono text-[12.5px] text-ink focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setTargetEndpointUrl(OKX_PRODUCTION_FREE_MCP_URL)}
              className="shrink-0 rounded bg-card px-2 py-1 text-[11px] text-ink-secondary hover:text-ink"
            >
              Railway
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline/40 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Clock size={15} className="text-ink-secondary" />
          <span className="text-[12.5px] font-medium text-ink">Frequency:</span>
          {SCHEDULE_INTERVALS.map((interval) => (
            <button
              key={interval.value}
              type="button"
              onClick={() => setIntervalMins(interval.value)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors",
                intervalMins === interval.value
                  ? "bg-accent text-white"
                  : "bg-control text-ink-secondary hover:text-ink",
              )}
            >
              {interval.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRunNow()}
            disabled={runningNow}
            className="flex items-center gap-1.5 rounded-xl bg-control px-4 py-2 text-[13px] font-semibold text-ink hover:bg-raised disabled:opacity-50"
          >
            {runningNow ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run Now
          </button>
          <button
            type="button"
            onClick={() => void handleScheduleRoutine()}
            disabled={scheduling}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {scheduling ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Schedule Routine
          </button>
        </div>
      </div>

      {lastExecutionResult && (
        <div
          role="status"
          className={cn(
            "mt-3 flex items-center justify-between rounded-xl px-3.5 py-2.5 text-[12.5px]",
            lastExecutionResult.ok
              ? "border border-success/30 bg-success/10 text-success"
              : "border border-danger/30 bg-danger/10 text-danger",
          )}
        >
          <span>{lastExecutionResult.message}</span>
          {lastExecutionResult.ok && (
            <button
              type="button"
              onClick={() => {
                if (devDayGateRoom && onOpenRoom) onOpenRoom(devDayGateRoom.id);
                else dispatch({ type: "showChat" });
              }}
              className="ml-3 font-semibold underline hover:opacity-80"
            >
              View in Room →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
