// Shared by bot settings and the bot's side panel. Both routes use the same
// editor and central logs, so a routine never has a competing detail page.
import { CalendarClock, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { useStore, type Bot } from "@/state/store";
import type { Routine, RoutineRun, RoutineRunOn } from "@/lib/routines";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { RoutineEditor } from "../RoutinesPage";
import { RoutineList } from "../routines/RoutineList";
export function RoutinesSection({ bot, routines, runs, defaultRunOn }: { bot: Bot; routines: Routine[]; runs: RoutineRun[]; defaultRunOn?: RoutineRunOn }) {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  return <div className="flex flex-col gap-4">
    <div className="border border-hairline bg-card p-4">
      <div className="flex items-center gap-2">
        <CalendarClock size={15} className="text-ink-secondary" />
        <h2 className="min-w-0 flex-1 text-[14px] font-medium text-ink">{t("computer.tab.routines")}</h2>
        <span className="font-mono text-[11px] text-ink-secondary">{routines.length}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={() => setEditing("new")} className="flex-1">
          <Plus size={13} />{t("computer.routines.create")}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => dispatch({ type: "showRoutines", section: "logs", botId: bot.id })}>
          <FileText size={13} />{t("routines.logs")}
        </Button>
      </div>
    </div>
    <RoutineList routines={routines} runs={runs} loading={state.routinesLoadState === "loading" && routines.length === 0} error={state.routinesLoadState === "error"} onOpen={setEditing} onLogs={(routine) => dispatch({ type: "showRoutines", section: "logs", botId: bot.id, routineId: routine.id })} />
    <button type="button" onClick={() => dispatch({ type: "showRoutines", section: "schedule", view: "list", botId: bot.id })} className="self-start font-mono text-[11px] uppercase tracking-wide text-ink hover:underline">{t("computer.routines.openTitle")} →</button>
    {editing && <RoutineEditor key={bot.id} routine={editing === "new" ? undefined : editing} bots={[bot]} lockedBotId={bot.id} defaultRunOn={defaultRunOn} onClose={() => setEditing(null)} />}
  </div>;
}
