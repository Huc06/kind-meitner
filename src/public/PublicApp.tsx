// What a signed-out visitor gets: the animated intro story, the landing page,
// the live demo intro, and diagnostics checker.
// None of them needs the workspace store or private session;
// everything else (the workspace, settings, chat) goes through sign-in at /pair.
import { useEffect, useState } from "react";
import { LandingPage, type LandingTarget } from "@/components/LandingPage";
import { DemoView } from "@/components/demo/DemoView";
import { DemoIntroView } from "@/components/onboarding/DemoIntroView";

export type PublicView = "intro" | "landing" | "demo" | "diagnostics";

const PUBLIC_INTRO_SEEN_KEY = "kind-meitner:public-intro-seen";

function viewFromUrl(): PublicView {
  try {
    const params = new URLSearchParams(location.search);
    const viewParam = params.get("view");
    if (viewParam === "diagnostics") return "diagnostics";
    if (viewParam === "demo") return "demo";
    if (viewParam === "intro") return "intro";
    if (viewParam === "landing") return "landing";
    // Fresh public visitor at /: if intro not seen yet, show intro
    const seen = localStorage.getItem(PUBLIC_INTRO_SEEN_KEY);
    if (!seen) return "intro";
    return "landing";
  } catch {
    return "landing";
  }
}

export function PublicApp() {
  const [view, setView] = useState<PublicView>(viewFromUrl);

  useEffect(() => {
    const onPop = () => setView(viewFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const show = (next: PublicView) => {
    let url = "/";
    if (next === "demo") url = "/?view=demo";
    else if (next === "diagnostics") url = "/?view=diagnostics";
    else if (next === "intro") url = "/?view=intro";
    else if (next === "landing") url = "/";
    history.pushState(null, "", url);
    setView(next);
    window.scrollTo(0, 0);
  };

  const goToSignIn = (returnTo = "/") => {
    const target = new URL("/pair", location.origin);
    if (returnTo) target.searchParams.set("return_to", returnTo);
    location.assign(target.toString());
  };

  const onNavigate = (target: LandingTarget) => {
    if (target === "demo") return show("demo");
    goToSignIn("/");
  };

  const markIntroSeen = () => {
    try {
      localStorage.setItem(PUBLIC_INTRO_SEEN_KEY, "1");
    } catch {}
  };

  if (view === "diagnostics") {
    return (
      <div className="flex h-full flex-col">
        <DemoView onExit={() => show("landing")} onOpenChat={() => goToSignIn("/?view=diagnostics")} />
      </div>
    );
  }

  if (view === "demo" || view === "intro") {
    return (
      <div className="flex h-full flex-col">
        <DemoIntroView
          mode={view === "demo" ? "demo" : "public"}
          onStart={() => {
            markIntroSeen();
            goToSignIn(view === "demo" ? "/?view=demo" : "/");
          }}
          onSkip={() => {
            markIntroSeen();
            show("landing");
          }}
          onExit={() => show("landing")}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <LandingPage onNavigate={onNavigate} />
    </div>
  );
}
