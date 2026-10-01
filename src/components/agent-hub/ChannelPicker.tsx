import { useEffect } from "react";
import { useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function formatChannelName(name: string): string {
  const stripped = name.trim().replace(/^#+/, "");
  return `#${stripped}`;
}

export interface ChannelPickerProps {
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ChannelPicker({
  selectedRoomId,
  onSelectRoom,
  disabled = false,
  className,
}: ChannelPickerProps) {
  const { state, dispatch } = useStore();
  const nonDmGroups = (state.groups ?? []).filter((g) => !g.dm);

  // Default to current room if it's a non-DM group, else first available group
  useEffect(() => {
    if (nonDmGroups.length === 0) return;
    if (selectedRoomId && nonDmGroups.some((g) => g.id === selectedRoomId)) {
      return;
    }
    const currentIsNonDm = nonDmGroups.find((g) => g.id === state.selectedId);
    if (currentIsNonDm) {
      onSelectRoom(currentIsNonDm.id);
    } else {
      onSelectRoom(nonDmGroups[0].id);
    }
  }, [nonDmGroups, selectedRoomId, state.selectedId, onSelectRoom]);

  if (nonDmGroups.length === 0) {
    const handleCreateChannel = () => {
      const firstBot = (state.bots ?? []).find((b) => !b.hidden);
      dispatch({
        type: "createGroup",
        memberIds: firstBot ? [firstBot.id] : [],
      });
    };

    return (
      <div className="flex flex-col gap-2 rounded-none border border-hairline bg-inset p-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[12px] text-ink-secondary">
          {t("okxHub.noGroupChannels")}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          disabled={disabled}
          onClick={handleCreateChannel}
          className="shrink-0"
        >
          <Plus size={12} className="mr-1 inline" />
          {t("okxHub.createChannel")}
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <Select
        value={selectedRoomId ?? ""}
        onChange={(e) => onSelectRoom(e.target.value)}
        disabled={disabled}
        aria-label={t("okxHub.addToChannel")}
        className="w-full font-mono text-[12px]"
      >
        {nonDmGroups.map((group) => (
          <option key={group.id} value={group.id}>
            {formatChannelName(group.name)}
          </option>
        ))}
      </Select>
    </div>
  );
}
