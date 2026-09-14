import { describe, expect, it } from "vitest";

import { launchdPlist, serviceCommand, servicePlan, systemdUnit, unstableInstallWarning, type ServiceSpec } from "./service-unit.ts";

const spec: ServiceSpec = {
  node: "/usr/bin/node",
  script: "/usr/lib/node_modules/kind-meitner/cli.js",
  serveArgs: ["--port", "8799", "--data-dir", "/home/maus/.kind-meitner", "--domain", "maus.example.com", "--no-pair"],
  dataDir: "/home/maus/.kind-meitner",
  user: "maus",
  home: "/home/maus",
  bindsLowPorts: true,
  label: "agentada",
};

describe("service units", () => {
  it("runs the same serve command, with strip-types only for a checkout", () => {
    expect(serviceCommand(spec)).toEqual(["/usr/bin/node", "/usr/lib/node_modules/kind-meitner/cli.js", "serve", ...spec.serveArgs]);
    expect(serviceCommand({ ...spec, script: "/srv/kind-meitner/server/kind-meitner.ts" })[1]).toBe("--experimental-strip-types");
  });

  it("renders a systemd unit that restarts, runs as the user, and grants low ports only for --domain", () => {
    const unit = systemdUnit(spec);
    expect(unit).toContain("Description=kind-meitner (agentada)");
    expect(unit).toContain("User=maus");
    expect(unit).toContain("Environment=KIND_MEITNER_DATA_DIR=/home/maus/.kind-meitner");
    expect(unit).toContain("ExecStart=/usr/bin/node /usr/lib/node_modules/kind-meitner/cli.js serve --port 8799 --data-dir /home/maus/.kind-meitner --domain maus.example.com --no-pair");
    expect(unit).toContain("Restart=always");
    expect(unit).toContain("AmbientCapabilities=CAP_NET_BIND_SERVICE");
    expect(unit).toContain("WantedBy=multi-user.target");
    const local = systemdUnit({ ...spec, bindsLowPorts: false, serveArgs: ["--port", "8799", "--data-dir", "/home/maus/.kind-meitner"] });
    expect(local).not.toContain("CAP_NET_BIND_SERVICE");
    // a path with a space is quoted for systemd
    expect(systemdUnit({ ...spec, dataDir: "/home/maus/My Data", serveArgs: ["--data-dir", "/home/maus/My Data"] })).toContain('ExecStart=/usr/bin/node /usr/lib/node_modules/kind-meitner/cli.js serve --data-dir "/home/maus/My Data"');
  });

  it("renders a launchd agent that keeps the server alive and logs under the data dir", () => {
    const plist = launchdPlist({ ...spec, home: "/Users/maus", dataDir: "/Users/maus/.kind-meitner" });
    expect(plist).toContain("<string>com.kind-meitner.serve</string>");
    expect(plist).toContain("<string>/usr/bin/node</string>");
    expect(plist).toContain("<string>serve</string>");
    expect(plist).toContain("<string>maus.example.com</string>");
    expect(plist).toContain("<key>KeepAlive</key>");
    expect(plist).toContain("/Users/maus/.kind-meitner/logs/service.log");
    expect(launchdPlist({ ...spec, serveArgs: ["--label", "a & b <c>"] })).toContain("<string>a &amp; b &lt;c&gt;</string>");
  });

  it("refuses to point a service at an npx cache, and knows where each platform's file goes", () => {
    expect(unstableInstallWarning("/home/maus/.npm/_npx/abc123/node_modules/kind-meitner/cli.js")).toMatch(/npm install -g kind-meitner/);
    expect(unstableInstallWarning("/usr/lib/node_modules/kind-meitner/cli.js")).toBeNull();
    const linux = servicePlan("linux", "/home/maus/.kind-meitner");
    expect(linux?.installed).toBe("/etc/systemd/system/kind-meitner.service");
    expect(linux?.activate.join("\n")).toContain("systemctl enable --now kind-meitner");
    const mac = servicePlan("darwin", "/Users/maus/.kind-meitner", "/Users/maus");
    expect(mac?.installed).toBe("/Users/maus/Library/LaunchAgents/com.kind-meitner.serve.plist");
    expect(mac?.activate.join("\n")).toContain("launchctl bootstrap gui/$(id -u)");
    expect(servicePlan("win32", "C:\\x")).toBeNull();
  });
});
