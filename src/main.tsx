import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { readSessionState, takePairingCodeFromLocation, takeInvitedEmailFromLocation } from "./lib/session";
import { bootstrapBrand } from "./lib/brand";
import { applySkin, readSkin } from "./lib/skins";
import { PairPage } from "./pair/PairPage";
import { PublicApp } from "./public/PublicApp";
import "./styles.css";

// Before the first paint, not inside a component: stamping the skin during
// render would show one frame of the default palette first. The brand (window
// title, accent) is fetched the same way so a white-labelled deployment never
// flashes the default name; it waits at most a moment and falls back silently.
applySkin(readSkin());

/** A pairing link lands on /pair. A remote browser without a session sees
 * the public shell (landing page and live demo) on "/", and sign-in on any
 * other path; on the owner's own machine the server trusts loopback and this
 * check is a single fast request. */
async function chooseRoot(): Promise<React.ReactNode> {
  if (location.pathname === "/pair") return <PairPage initialCode={takePairingCodeFromLocation()} initialEmail={takeInvitedEmailFromLocation()} />;
  const session = await readSessionState();
  if (session.kind === "unauthenticated") {
    return location.pathname === "/" ? <PublicApp /> : <PairPage initialCode={null} reason={session.error} />;
  }
  return <App />;
}

void Promise.all([bootstrapBrand(), chooseRoot()]).then(([, root]) => {
  createRoot(document.getElementById("root")!).render(<StrictMode>{root}</StrictMode>);
});
