import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Dev Day judge evidence documentation", () => {
  it("links reproducible fixture evidence and explicitly preserves live-proof gates", () => {
    const judge = read("docs/okx-dev-day-judge.md");
    const evidence = read("docs/evidence/dev-day/README.md");
    const fixture = JSON.parse(read("docs/evidence/dev-day/fixture-free-mcp.json"));

    expect(judge).toContain("fixture-free-mcp.json");
    expect(judge).toContain("fixture-test-output.txt");
    expect(judge).toContain("explicitly pending and must not be inferred from local test results");
    expect(judge).toContain("external Codex/OpenClaw/other-agent transcript");
    expect(judge).toContain("Build-window delta");
    expect(judge).toContain("scan_free_mcp_readiness");
    expect(judge).toContain("get_asp_trust_card");
    expect(evidence).toContain("collect-dev-day-fixture-evidence.ts");
    expect(evidence).toContain("makes no outbound request");
    expect(evidence).toContain("Pending: human/deploy gates");
    expect(fixture.environment).toMatchObject({
      kind: "isolated local fixture",
      externalNetworkAccess: false,
      fixtureDataDisposedAfterCollection: true,
    });
    expect(fixture.assertions.toolsList.names).toEqual(expect.arrayContaining([
      "scan_free_mcp_readiness",
      "get_asp_trust_card",
    ]));
    expect(fixture.assertions.vercelPitfall.verdict).toBe("FAIL");
  });
});
