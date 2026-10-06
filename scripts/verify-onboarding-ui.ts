// Assert the first-run workflow against a handle from `control-kind-meitner ui launch`.
// The handle gate refuses live-app URLs and stopped fixtures. All profile,
// bot and onboarding writes below stay inside that launch's disposable home.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { runControlKindMeitner } from "./control-kind-meitner.ts";
import { TOUR_STEPS } from "../src/lib/guided-tour.ts";

const en: Record<string, string> = JSON.parse(
  readFileSync(new URL("../src/locales/en.json", import.meta.url), "utf8")
);
const t = (key: string, params?: Record<string, string | number>): string => {
  const template = en[key];
  if (!template) throw new Error(`Missing locale key: ${key}`);
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
};

const handle = process.argv[2];
if (!handle) throw new Error("Usage: node --experimental-strip-types scripts/verify-onboarding-ui.ts /path/to/fixture/ui.json");
const ui = (verb: string, ...args: string[]) => runControlKindMeitner(["ui", verb, "--ui", handle, ...args]) as Promise<Record<string, any>>;
const evaluate = async (js: string) => (await ui("eval", "--js", js)).result;
const click = async (name: string) => {
  // Let the 320ms spotlight transition land before sending a real pointer
  // click; the browser CLI does not wait for moving controls to stabilize.
  await delay(400);
  return ui("click", "--name", name);
};
const type = async (name: string, text: string) => {
  await delay(200);
  return ui("type", "--name", name, "--text", text);
};
const snapshot = async () => (await ui("snapshot")).snapshot as string;
const config = () => evaluate("fetch('/api/config').then(r => r.ok ? r.json() : null).catch(() => null)");
const poll = async (read: () => Promise<unknown>, expected: unknown, label: string) => {
  const end = Date.now() + 15_000;
  let result;
  do {
    try {
      result = await read();
      if (JSON.stringify(result) === JSON.stringify(expected)) return;
    } catch {}
    await delay(100);
  } while (Date.now() < end);
  assert.deepEqual(result, expected, label);
};
const textVisible = (text: string) => poll(async () => (await snapshot()).toLowerCase().includes(text.toLowerCase()), true, text);
const evidence = resolve(".kind-meitner-scratch/verify-evidence/onboarding");
mkdirSync(evidence, { recursive: true });
const screenshot = (name: string) => ui("screenshot", "--out", resolve(evidence, `${name}.png`));
const openSettings = async () => {
  await click(t("sidebar.menu.settings"));
  await textVisible(t("settings.welcome.replay"));
};
const holdConfigWrite = () => evaluate(`(() => {
  const original = window.fetch.bind(window);
  window.heldWrites = 0;
  window.fetch = (input, init) => {
    if (String(input) === '/api/config' && init?.method === 'PUT') {
      window.heldWrites++;
      window.fetch = original;
      return new Promise(resolve => { window.releaseWrite = () => resolve(original(input, init)); });
    }
    return original(input, init);
  };
  return true;
})()`);

// The standard fixture suppresses onboarding. This opt-in entry skips that
// suppression; only this fixture browser's localStorage is cleared.
await evaluate("localStorage.clear(); setTimeout(() => { location.search = '?onboarding=1'; }, 0); true");
await poll(async () => evaluate("location.search").catch(() => null), "?onboarding=1", "onboarding url");
await textVisible(t("onboarding.name"));
await evaluate("document.documentElement.dataset.reducedMotion = 'true'; true");
await screenshot("welcome");
await type(t("onboarding.name"), "Onboarding fixture");
await type(t("phone.signIn.email"), "onboarding@example.test");
await evaluate(`(() => {
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (String(input) === '/api/config' && init?.method === 'PUT') {
      window.fetch = original;
      return Promise.resolve(new Response(JSON.stringify({error:'Fixture profile rejected'}), {status:503}));
    }
    return original(input, init);
  };
  return true;
})()`);
await click(t("onboarding.continue"));
await textVisible(t("onboarding.profile.error"));
assert.equal(await evaluate("document.querySelector('input[type=email]').value"), "onboarding@example.test");
await click(t("onboarding.continue"));
await textVisible(t("onboarding.reel.title"));
assert.equal((await config()).profile.email, "onboarding@example.test");
console.log("PASS profile failure preserves input; retry persists before advancing");

// Reduced motion must hold every scene. Scene navigation is driven by the real Next button.
await textVisible(t("onboarding.reel.ask.title"));
await click(t("onboarding.reel.next"));
await textVisible(t("onboarding.reel.work.title"));
await screenshot("reel");
await delay(5500);
await textVisible(t("onboarding.reel.work.title"));
await click(t("onboarding.reel.next"));
await textVisible(t("onboarding.reel.result.title"));
await click(t("onboarding.reel.next"));
await textVisible(t("onboarding.reel.repeat.title"));
await click(t("onboarding.continue"));
await textVisible(t("common.checkAgain"));
await screenshot("engines");
const inventoryBefore = await evaluate("[...document.querySelectorAll('.welcome-card [aria-expanded]')].map(e => e.textContent)");
await evaluate(`(() => {
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (String(input) === '/api/instances') {
      window.fetch = original;
      return Promise.resolve(new Response(JSON.stringify({error:'Fixture inventory unavailable'}), {status:503}));
    }
    return original(input, init);
  };
  return true;
})()`);
await click(t("common.checkAgain"));
await textVisible(t("onboarding.engines.error"));
assert.deepEqual(await evaluate("[...document.querySelectorAll('.welcome-card [aria-expanded]')].map(e => e.textContent)"), inventoryBefore);
await click(t("common.checkAgain"));
await poll(async () => (await snapshot()).toLowerCase().includes(t("onboarding.engines.error").toLowerCase()), false, "inventory retry");
await click(t("onboarding.continue"));
await textVisible(t("onboarding.phone.title"));
await click(t("phone.intro.notNow"));
await textVisible(t("onboarding.bot.finish"));
await screenshot("meet-bot");
await click(t("onboarding.bot.finish"));
await textVisible(t("onboarding.tour.room.title"));
console.log("PASS reel, engine failure/retry, phone skip and welcome completion");

// Complete every live-interface step and verify its server record. A missing
// optional browser tab may skip itself, but every required anchor must work.
for (const step of TOUR_STEPS) {
  if ((await config()).onboarding.hintsSeen.includes(step.id)) continue;
  await poll(() => evaluate("Boolean(document.querySelector('[data-tour-card] button'))"), true, step.id);
  await screenshot(step.id);
  const isLast = step.id === TOUR_STEPS[TOUR_STEPS.length - 1]!.id;
  await click(isLast ? t("onboarding.tour.finish") : t("onboarding.tour.next"));
  await poll(async () => (await config()).onboarding.hintsSeen.includes(step.id), true, `saved ${step.id}`);
}
await poll(() => evaluate("document.querySelectorAll('[data-tour-card]').length"), 0, "tour closed");
await evaluate("setTimeout(() => location.reload(), 0); true");
await textVisible(t("composer.placeholder.room"));
assert.equal(await evaluate("document.querySelectorAll('.welcome-card, [data-tour-card]').length"), 0);
console.log("PASS full guided tour, saved progress, reload stays dismissed");

await openSettings();
await click(t("settings.welcome.appTour"));
await textVisible(t("onboarding.tour.room.title"));
await holdConfigWrite();
await click(t("onboarding.tour.next"));
await poll(() => evaluate("window.heldWrites"), 1, "Next pending");
await click(t("onboarding.tour.skip"));
await poll(() => evaluate("document.querySelectorAll('[data-tour-card]').length"), 0, "Skip closes immediately");
await evaluate("window.releaseWrite(); true");
await poll(async () => (await config()).onboarding.hintsSeen.filter((id: string) => id.startsWith("tour.")).length, TOUR_STEPS.length, "Skip survives in-flight Next");
console.log("PASS Settings replay and Skip queued behind slow Next");

await openSettings();
await click(t("settings.welcome.replay"));
await textVisible(t("onboarding.name"));
await holdConfigWrite();
await click(t("onboarding.skipTour"));
await poll(() => evaluate("document.querySelectorAll('.welcome-card').length"), 0, "slow completion cannot trap welcome");
await evaluate("window.releaseWrite(); true");
console.log("PASS welcome replay can close while persistence is pending");
await poll(async () => Boolean((await config()).onboarding.completedAt), true, "welcome save completed");

// An upgraded install can have only the legacy browser gate. Replay still
// works without a new welcome completion, and failures keep Settings open.
await evaluate("fetch('/api/config', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({onboarding:{completedAt:'', version:0}})}).then(r=>r.ok)");
await evaluate("setTimeout(() => location.reload(), 0); true");
await textVisible(t("composer.placeholder.room"));
await openSettings();
await evaluate(`(() => {
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (String(input) === '/api/config' && init?.method === 'PUT') {
      window.fetch = original;
      return Promise.resolve(new Response('{}', {status:503}));
    }
    return original(input, init);
  };
  return true;
})()`);
await click(t("settings.welcome.appTour"));
await textVisible(t("onboarding.tour.error"));
await click(t("settings.welcome.appTour"));
await textVisible(t("onboarding.tour.room.title"));
await click(t("onboarding.tour.skip"));
await poll(async () => (await config()).onboarding.hintsSeen.filter((id: string) => id.startsWith("tour.")).length, TOUR_STEPS.length, "legacy replay saved");
console.log("PASS legacy-install replay and failed replay retry");
await screenshot("complete");
console.log(JSON.stringify({ ok: true, evidence, config: (await config()).onboarding }));
