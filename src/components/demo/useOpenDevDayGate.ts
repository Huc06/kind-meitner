import { useCallback } from "react";
import { api, useStore } from "@/state/store";
import { isDevDayGate } from "@/lib/dev-day-gate";

/** Signed-in only: seeds (or finds) the #dev-day-gate room and opens it. */
export function useOpenDevDayGate(): () => Promise<void> {
  const { state, dispatch } = useStore();
  return useCallback(async () => {
    try {
      const { room } = await api("/api/okx/dev-day-gate", { method: "POST", body: "{}" });
      if (room) {
        dispatch({ type: "groupPatched", group: room });
        dispatch({ type: "select", id: room.id });
      }
    } catch {
      const existing = state.groups.find(isDevDayGate);
      if (existing) dispatch({ type: "select", id: existing.id });
    } finally {
      dispatch({ type: "showChat" });
    }
  }, [state.groups, dispatch]);
}
