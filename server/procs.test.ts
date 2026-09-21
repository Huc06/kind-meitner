import { describe, expect, it } from "vitest";
import { tmpdir } from "node:os";

import { brokerSocketPath } from "./procs.ts";

describe("brokerSocketPath", () => {
  it("keeps POSIX broker sockets below macOS's Unix-domain path limit", () => {
    const deepDataDir = `${tmpdir()}/${"fixture-data-".repeat(16)}`;
    const path = brokerSocketPath(deepDataDir, "t-perm-abcdef12");

    if (process.platform === "win32") {
      expect(path).toMatch(/^\\\\\.\\pipe\\kind-meitner-perm-/);
      return;
    }

    expect(path.startsWith(tmpdir())).toBe(true);
    expect(path.length).toBeLessThan(104);
    expect(path).not.toContain(deepDataDir);
  });
});
