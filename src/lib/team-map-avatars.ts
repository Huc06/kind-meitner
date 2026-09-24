/**
 * Distinct glossy bot-avatars designs for Team Map marketplace demo agents.
 */

export type TeamMapAvatarType =
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

export interface TeamMapAvatarSpec {
  type: TeamMapAvatarType;
  face: "eyes" | "mouth";
  /** optional hex override; omit to use library palette */
  color?: string;
  seed: number; // 0–1 so roster doesn't blink in unison
  shading?: "plastic" | "crisp" | "smooth" | "flat";
}

/** Demo agent id → avatar design */
export const DEMO_AGENT_AVATARS: Record<string, TeamMapAvatarSpec> = {
  coordinator: { type: "star", face: "mouth", seed: 0.08, shading: "plastic" },
  discovery: { type: "cloud", face: "eyes", seed: 0.22, shading: "plastic" },
  risk: { type: "hexagon", face: "eyes", seed: 0.37, shading: "crisp" },
  negotiation: { type: "flower", face: "mouth", seed: 0.51, shading: "plastic" },
  escrow: { type: "mech", face: "eyes", seed: 0.66, shading: "crisp" },
  reviewer: { type: "clover", face: "mouth", seed: 0.81, shading: "plastic" },
};

/** Stable 0–1 seed from an id string (unknown agents stay visually fixed). */
export function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Map to (0, 1) exclusive of exact 0/1 edge cases that can look identical.
  return ((h >>> 0) % 997) / 997;
}

export function presenceToBotAvatarState(
  presence: string,
): "default" | "working" | "sleeping" {
  if (presence === "working" || presence === "reviewing") return "working";
  if (presence === "completed" || presence === "offline") return "sleeping";
  return "default";
}

export function resolveDemoAgentAvatar(agentId: string): TeamMapAvatarSpec {
  const known = DEMO_AGENT_AVATARS[agentId];
  if (known) return known;
  return { type: "blob", face: "eyes", seed: hashSeed(agentId) };
}
