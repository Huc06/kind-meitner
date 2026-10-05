#!/usr/bin/env node
// A local A2A route proxy (the zroute shape) for development: forwards A2A
// traffic to one upstream agent and reports that upstream's identity in the
// proxy card and every result (`metadata.upstream`). It never answers itself.
//
//   node scripts/dev/a2a-route-proxy.mjs --port 8820 --upstream http://127.0.0.1:8810/
import { createServer } from "node:http";

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
};
const port = Number(arg("--port", "8820"));
const upstream = new URL(arg("--upstream", "http://127.0.0.1:8810/"));

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

async function upstreamCard() {
  const res = await fetch(new URL("/.well-known/agent-card.json", upstream));
  if (!res.ok) throw new Error(`upstream card ${res.status}`);
  return res.json();
}

createServer(async (req, res) => {
  try {
    const card = await upstreamCard();
    const identity = { agentId: card.metadata?.agentId ?? card.name, name: card.name, provider: card.provider?.organization };
    if (req.method === "GET" && (req.url === "/.well-known/agent-card.json" || req.url === "/.well-known/agent.json")) {
      return send(res, 200, {
        ...card,
        name: `zroute → ${card.name}`,
        url: `http://127.0.0.1:${port}/`,
        provider: { organization: "zroute proxy (local)" },
        metadata: { agentId: "zroute-local", upstream: identity },
      });
    }
    if (req.method !== "POST") return send(res, 404, { error: "not found" });
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const rpc = JSON.parse(raw);
    console.log(`[zroute] route=${rpc.params?.metadata?.routeId ?? "-"} → ${identity.name}`);
    const forwarded = await fetch(upstream, { method: "POST", headers: { "content-type": "application/json" }, body: raw });
    const body = await forwarded.json();
    if (body.result) body.result.metadata = { ...body.result.metadata, upstream: identity };
    send(res, forwarded.status, body);
  } catch (error) {
    send(res, 502, { error: String(error.message ?? error) });
  }
}).listen(port, "127.0.0.1", () => console.log(`zroute-style proxy on http://127.0.0.1:${port}/ → ${upstream}`));
