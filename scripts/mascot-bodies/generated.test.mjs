import { describe, expect, it } from "vitest";

import { BODY_DEFS } from "./builders.ts";
import { maskFromPolylines } from "./raster.ts";
import { applyFit, boundsOf, fitTransform, flatten } from "./geometry.ts";
import { fieldFromMask } from "./sdf.ts";
import { buildClouds, report } from "./solve.ts";
import { MASCOT_BODIES, MASCOT_BODY_IDS } from "../../shared/mascot-bodies.ts";

// The companion "generated catalogs" guard — which re-ran the generator and
// diffed its output against the checked-in Swift and Kotlin catalogs — lived
// here upstream. This repository ships the server and desktop app only; it has
// no ios/ or android/ module for the generator to emit into, so that guard read
// paths that do not exist and could never pass. The silhouette check below
// covers the generator logic that this repository does build.

describe("every baked anchor", () => {
  /** The four extreme pointer aims the generator solves against. */
  const AIMS = [
    { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
  ];

  it("clears the silhouette across every expression and every gaze", () => {
    for (const id of MASCOT_BODY_IDS) {
      const def = BODY_DEFS.find(s => s.id === id);
      const polylines = flatten(def.d);
      const fit = fitTransform(boundsOf(polylines));
      const sdf = fieldFromMask(maskFromPolylines(applyFit(polylines, fit), 256), 256);

      for (const aim of AIMS) {
        const result = report(buildClouds(0, undefined, aim), sdf, MASCOT_BODIES[id].anchor);
        expect(result.clipping, `${id} clips looking (${aim.x}, ${aim.y})`).toEqual([]);
      }
    }
  }, 120_000);
});
