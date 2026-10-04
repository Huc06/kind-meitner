// Agent logos: flat blob faces, one per mascot body. Every agent without an
// uploaded photo already resolves to a stable body (by role, catalog id or a
// hash of its id), so mapping body → blob gives each agent a stable logo and
// keeps the body picker meaningful. The two "partially-obscured" crops from
// the source pack are reference images only and are not shipped.
import type { MascotBodyId } from "../../shared/mascot-bodies";
import faceWave from "@/assets/agent-blobs/face-wave.png";
import presetBean from "@/assets/agent-blobs/preset-bean.png";
import presetBlob from "@/assets/agent-blobs/preset-blob.png";
import presetDrop from "@/assets/agent-blobs/preset-drop.png";
import presetEgg from "@/assets/agent-blobs/preset-egg.png";
import presetGem from "@/assets/agent-blobs/preset-gem.png";
import presetRound from "@/assets/agent-blobs/preset-round.png";
import presetShard from "@/assets/agent-blobs/preset-shard.png";
import presetSun from "@/assets/agent-blobs/preset-sun.png";
import presetTile from "@/assets/agent-blobs/preset-tile.png";

/** Closest blob for each body shape; `cursor` is the shipped default mascot. */
export const AGENT_BLOB_BY_BODY: Record<MascotBodyId, string> = {
  cursor: faceWave,
  blob: presetBlob,
  circle: presetRound,
  squircle: presetTile,
  capsule: presetBean,
  drop: presetDrop,
  shield: presetShard,
  hexagon: presetGem,
  diamond: presetEgg,
  star: presetSun,
};

/** A persisted or streamed body id may be anything; unknown ones wear the default. */
export function agentLogoBody(bodyId: string | undefined): MascotBodyId {
  return bodyId && Object.hasOwn(AGENT_BLOB_BY_BODY, bodyId) ? (bodyId as MascotBodyId) : "cursor";
}
