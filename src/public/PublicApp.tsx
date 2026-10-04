// What a signed-out visitor gets: the landing page and the live Demo view.
// Neither needs the workspace store or a session; everything else (the
// workspace, settings, chat) goes through sign-in at /pair.
import { useEffect, useState } from "react";
import { LandingPage, type LandingTarget } from "@/components/LandingPage";
import { DemoView } from "@/components/demo/DemoView";

type PublicView = "landing" | "demo";

const viewFromUrl = (): PublicView => (new URLSearchParams(location.search).get("view") === "demo" ? "demo" : "landing");

const goToSignIn = () => location.assign("/pair");

export function PublicApp() {
  const [view, setView] = useState<PublicView>(viewFromUrl);

  useEffect(() => {
    const onPop = () => setView(viewFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const show = (next: PublicView) => {
    history.pushState(null, "", next === "demo" ? "/?view=demo" : "/");
    setView(next);
    window.scrollTo(0, 0);
  };

  const onNavigate = (target: LandingTarget) => (target === "demo" ? show("demo") : goToSignIn());

  return (
    <div className="flex h-full flex-col">
      {view === "demo" ? <DemoView onExit={() => show("landing")} onOpenChat={goToSignIn} /> : <LandingPage onNavigate={onNavigate} />}
    </div>
  );
}
