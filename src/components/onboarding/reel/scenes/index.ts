// The reel's scenes, all drawn in code: no recordings to ship, and every
// skin and locale gets the same picture. REEL is the order they play in;
// each scene reports its own mascot cues and its own end.
import type { ComponentType } from "react";
import { AgentChat } from "./AgentChat";
import { Channels } from "./Channels";
import { ReadinessScene } from "./ReadinessScene";
import { TrustScene } from "./TrustScene";
import type { SceneProps } from "./types";

export type { SceneProps };

const SCENES: Record<string, ComponentType<SceneProps>> = {
  room: Channels,
  agents: AgentChat,
  readiness: ReadinessScene,
  trust: TrustScene,
};

/** Scene ids in playing order: short OKX workflow. */
export const REEL = ["room", "agents", "readiness", "trust"] as const;
export function sceneFor(id: string): ComponentType<SceneProps> | null {
  return SCENES[id] ?? null;
}
