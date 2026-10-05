import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { launchVerificationServer, runControlKindMeitner } from "../scripts/control-kind-meitner.ts";
import { waitForExit } from "./testing/cleanup.ts";

interface ControlResult {
  bot?: { id: string; activeTaskId: string };
  status?: string;
  messages?: Array<{
    role: string;
    kind: string;
    text?: string;
    tool?: { name: string; ok: boolean };
  }>;
}

interface InstancesResponse {
  instances?: Array<{
    instanceId: string;
    snapshot?: { state: string };
  }>;
}

describe("Laptop Claude relay end-to-end fixture", () => {
  it("streams replies via the runner, then fails turns with not-connected error when stopped", async () => {
    const fixture = await launchVerificationServer();
    let runnerProcess: ChildProcess | null = null;

    try {
      // 1. Create a token via the admin API
      const tokenRes = await fetch(`${fixture.info.url}/api/engine-relay/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "E2E Runner" }),
      });
      const { token } = (await tokenRes.json()) as { token: string };
      expect(token).toBeDefined();

      // 2. Start the runner locally using fake-claude-cli.ts
      const runnerScript = join(process.cwd(), "scripts", "engine-relay-runner.mjs");
      const fakeClaude = join(process.cwd(), "server", "testing", "fake-claude-cli.ts");

      runnerProcess = spawn(
        process.execPath,
        [
          runnerScript,
          "--server", fixture.info.url,
          "--token", token,
          "--claude", fakeClaude,
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            FAKE_CLAUDE_MODE: "happy",
            FAKE_CLAUDE_REPLIES: JSON.stringify(["Hello from laptop claude runner!"]),
          },
        },
      );

      runnerProcess.stderr?.setEncoding("utf8");
      runnerProcess.stderr?.on("data", (chunk) => {
        if (!chunk.includes("fake-claude")) {
          process.stderr.write(`[runner stderr] ${chunk}`);
        }
      });

      // 3. Wait until the runner connects and Laptop Claude becomes "available"
      await expect.poll(async () => {
        const res = await fetch(`${fixture.info.url}/api/instances`);
        const data = (await res.json()) as InstancesResponse;
        const laptop = data.instances?.find((i) => i.instanceId === "laptopClaude");
        return laptop?.snapshot?.state;
      }, { timeout: 15_000, interval: 300 }).toBe("available");

      // 4. Create a bot using control-kind-meitner
      const created = (await runControlKindMeitner([
        "new-bot",
        "--name", "Relay Test Bot",
        "--url", fixture.info.url,
      ])) as ControlResult;
      expect(created.bot?.id).toBeDefined();
      const botId = created.bot!.id;

      // 5. Select the Laptop Claude engine for the bot
      await runControlKindMeitner([
        "set-model",
        "--bot", botId,
        "--instance", "laptopClaude",
        "--model", "claude-sonnet-5",
        "--url", fixture.info.url,
      ]);

      // 6. Send a message to the bot
      await runControlKindMeitner([
        "send",
        "--bot", botId,
        "--text", "Hello from E2E test",
        "--url", fixture.info.url,
      ]);

      // 7. Wait for the turn to complete
      const waitResult = (await runControlKindMeitner([
        "wait",
        "--bot", botId,
        "--timeout", "15",
        "--url", fixture.info.url,
      ])) as ControlResult;
      expect(waitResult.status).toBe("settled");

      // 8. Observe the reply streamed back
      const msgResult = (await runControlKindMeitner([
        "messages",
        "--bot", botId,
        "--limit", "10",
        "--url", fixture.info.url,
      ])) as ControlResult;

      const botMessage = [...(msgResult.messages ?? [])].reverse().find((m) => m.role === "bot" && m.kind === "text");
      expect(botMessage).toBeDefined();
      expect(botMessage?.text).toContain("Hello from laptop claude runner!");

      // 9. Stop the runner
      runnerProcess.kill("SIGTERM");
      await waitForExit(runnerProcess);
      runnerProcess = null;

      // Wait until snapshot reflects that the runner is disconnected (>30s without poll)
      await expect.poll(async () => {
        const res = await fetch(`${fixture.info.url}/api/instances`);
        const data = (await res.json()) as InstancesResponse;
        const laptop = data.instances?.find((i) => i.instanceId === "laptopClaude");
        return laptop?.snapshot?.state;
      }, { timeout: 35_000, interval: 1000 }).toBe("unavailable");

      // 10. Confirm next turn fails with the not-connected error
      await runControlKindMeitner([
        "send",
        "--bot", botId,
        "--text", "Message after runner stopped",
        "--url", fixture.info.url,
      ]);

      const waitResult2 = (await runControlKindMeitner([
        "wait",
        "--bot", botId,
        "--timeout", "25",
        "--url", fixture.info.url,
      ])) as ControlResult;
      expect(waitResult2.status).toBe("failed");

      const msgResult2 = (await runControlKindMeitner([
        "messages",
        "--bot", botId,
        "--limit", "10",
        "--url", fixture.info.url,
      ])) as ControlResult;

      const errorActivity = msgResult2.messages?.find(
        (m) => m.role === "bot" && m.kind === "activity" && m.tool?.ok === false,
      );
      expect(errorActivity).toBeDefined();
      expect(errorActivity?.tool?.name).toMatch(/Laptop (Claude is not connected|runner disconnected)/);
    } finally {
      if (runnerProcess) {
        runnerProcess.kill("SIGKILL");
      }
      await fixture.close();
    }
  }, 75_000);
});
