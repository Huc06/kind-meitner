import type { MascotBodyId } from "../../shared/mascot-bodies";
import { MAUS_COLORS, type MausColor, type MausState } from "./mascot";

type BotAvatarType =
  | "clover"
  | "flower"
  | "triangle"
  | "square"
  | "blob"
  | "ghost"
  | "circle"
  | "drop"
  | "star"
  | "droid"
  | "mech"
  | "alien"
  | "hexagon"
  | "cat"
  | "cloud"
  | "pill"
  | "pebble"
  | "puddle";

type BotAvatarState = "default" | "working" | "sleeping";

const BODY_TO_TYPE: Record<MascotBodyId, BotAvatarType> = {
  cursor: "ghost",
  blob: "blob",
  circle: "circle",
  squircle: "pebble",
  capsule: "pill",
  drop: "drop",
  shield: "droid",
  hexagon: "hexagon",
  diamond: "triangle",
  star: "star",
};

/** Cursor is the shipped default, so a missing id wears the ghost. */
export function mascotBodyToType(bodyId: MascotBodyId | null | undefined): BotAvatarType {
  if (bodyId == null) return "ghost";
  return BODY_TO_TYPE[bodyId] ?? "ghost";
}

/** Collapse the app's state vocabulary onto the three library states. */
export function mausStateToBotState(state: MausState | null | undefined): BotAvatarState {
  if (state === "idle" || state === "sleeping") return "sleeping";
  if (state === "working" || state === "thinking" || state === "loading") return "working";
  return "default";
}

export function mausColorToHex(color: MausColor): string {
  return MAUS_COLORS[color];
}
