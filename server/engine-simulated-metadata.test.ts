import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { makeFakeDriver } from "./testing/fake-driver.ts";
import { ProviderRegistry } from "./harness/registry.ts";

const FAKE_CLI = join(fileURLToPath(new URL(".", import.meta.url)), "testing", "fake-claude-cli.ts");

describe("Simulated engine metadata contract", () => {
  it("detects explicit simulated / testEngine flags on instance records", async () => {
    const fake = makeFakeDriver();
    const registry = new ProviderRegistry([fake.driver]);

    await registry.load({
      testInstance: {
        driver: "fake",
        displayName: "Simulated Agent",
        simulated: true,
        testEngine: true,
      },
      liveInstance: {
        driver: "fake",
        displayName: "Live Agent",
      },
    });

    expect(registry.isSimulated("testInstance")).toBe(true);
    expect(registry.isSimulated("liveInstance")).toBe(false);

    const described = await registry.describe();
    const testDesc = described.find((d) => d.instanceId === "testInstance");
    const liveDesc = described.find((d) => d.instanceId === "liveInstance");

    expect(testDesc).toBeDefined();
    expect(testDesc?.simulated).toBe(true);
    expect(testDesc?.testEngine).toBe(true);
    expect(testDesc?.snapshot.simulated).toBe(true);
    expect(testDesc?.snapshot.testEngine).toBe(true);

    expect(liveDesc).toBeDefined();
    expect(liveDesc?.simulated).toBe(false);
    expect(liveDesc?.testEngine).toBe(false);
    expect(liveDesc?.snapshot.simulated).toBeUndefined();
  });

  it("identifies the fake claude CLI as simulated via the fixture contract", async () => {
    const fake = makeFakeDriver();
    const registry = new ProviderRegistry([fake.driver]);

    await registry.load({
      fakeClaude: {
        driver: "fake",
        displayName: "Fixture Claude",
        config: { cli: FAKE_CLI },
      },
    });

    expect(registry.isSimulated("fakeClaude")).toBe(true);

    const described = await registry.describe();
    const fakeDesc = described.find((d) => d.instanceId === "fakeClaude");
    expect(fakeDesc).toBeDefined();
    expect(fakeDesc?.simulated).toBe(true);
    expect(fakeDesc?.testEngine).toBe(true);
    expect(fakeDesc?.snapshot.simulated).toBe(true);
  });

  it("fake-claude-cli answers test-engine probe with simulated metadata", () => {
    const output = execFileSync(process.execPath, [FAKE_CLI, "--simulated"], { encoding: "utf8" });
    const parsed = JSON.parse(output) as { simulated: boolean; testEngine: boolean };
    expect(parsed.simulated).toBe(true);
    expect(parsed.testEngine).toBe(true);
  });
});
