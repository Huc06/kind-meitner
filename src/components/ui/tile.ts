import type { TileTone } from "./tag";

/** The categorical tile palette, in landing word-tile order. */
export const TILE_TONES: readonly TileTone[] = ["green", "cyan", "violet", "orange", "magenta", "yellow", "red", "pink"];

/** Solid fill + lettering classes for a tile tone. */
export const TILE_FILL: Record<TileTone, string> = {
  red: "bg-tile-red text-tile-ink",
  pink: "bg-tile-pink text-tile-ink",
  green: "bg-tile-green text-tile-ink",
  violet: "bg-tile-violet text-white",
  yellow: "bg-tile-yellow text-tile-ink",
  cyan: "bg-tile-cyan text-tile-ink",
  orange: "bg-tile-orange text-tile-ink",
  magenta: "bg-tile-magenta text-tile-ink",
};

/** Text/border classes for a tile tone, for marks on a neutral ground. */
export const TILE_TEXT: Record<TileTone, string> = {
  red: "text-tile-red",
  pink: "text-tile-pink",
  green: "text-tile-green",
  violet: "text-tile-violet",
  yellow: "text-tile-yellow",
  cyan: "text-tile-cyan",
  orange: "text-tile-orange",
  magenta: "text-tile-magenta",
};

/** A stable tile for an identity (bot id, team name): the same key always
 * lands on the same colour, across renders and reloads. FNV-1a, because it is
 * short and spreads adjacent ids well. */
export function tileFor(key: string): TileTone {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return TILE_TONES[(hash >>> 0) % TILE_TONES.length];
}
