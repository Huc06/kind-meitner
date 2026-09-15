import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LandingPreloader } from "./LandingPreloader";
import "./landing.css";

const HERO_WORDS = ["your", "ai", "team,", "under", "your", "control."];

const PRINCIPLES = [
  {
    index: "01",
    title: "Private by default",
    description: "Run your workspace on the desktop you own. Your projects, conversations, and decisions stay close to you.",
  },
  {
    index: "02",
    title: "One workspace, many agents",
    description: "Bring models, skills, routines, and people into a shared place that keeps context connected.",
  },
  {
    index: "03",
    title: "Human control at every step",
    description: "See work in progress, set boundaries, and approve the actions that matter before they happen.",
  },
] as const;

const WORKFLOW_STEPS = [
  ["01", "Give your team a goal", "Describe the outcome once and keep the context in one workspace."],
  ["02", "Coordinate the work", "Assign agents, review their progress, and keep everyone aligned."],
  ["03", "Decide what ships", "Keep the final call with the person who owns the work."],
] as const;

function ThemeIcon({ isDark }: { isDark: boolean }) {
  if (isDark) {
    return (
      <svg className="theme-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.7 6.7 0 0 0 10.8 10.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m17.9 4.2.35.95.95.35-.95.35-.35.95-.35-.95-.95-.35.95-.35.35-.95Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg className="theme-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2.75v2.1M12 19.15v2.1M2.75 12h2.1M19.15 12h2.1M5.46 5.46l1.48 1.48M17.06 17.06l1.48 1.48M18.54 5.46l-1.48 1.48M6.94 17.06l-1.48 1.48" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LandingPage() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.landingTheme = isDark ? "dark" : "light";
    return () => {
      delete document.documentElement.dataset.landingTheme;
    };
  }, [isDark]);

  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="Kind Meitner home">
          kind meitner
        </a>
        <div className="nav-actions">
          <a href="#workflow">How it works</a>
          <a href="#desktop">Desktop app</a>
          <button
            type="button"
            className="theme-toggle"
            aria-label={isDark ? "Use light theme" : "Use dark theme"}
            aria-pressed={isDark}
            onClick={() => setIsDark((value) => !value)}
          >
            <ThemeIcon isDark={isDark} />
          </button>
        </div>
      </nav>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <p className="eyebrow">A private operating system for AI work</p>
        <h1 id="hero-title" className="tile-heading">
          {HERO_WORDS.map((word, index) => (
            <span key={`${word}-${index}`} style={{ "--tile-index": index } as React.CSSProperties}>
              {word}
            </span>
          ))}
        </h1>
        <p className="hero-copy">
          Kind Meitner helps you turn intent into coordinated work: shape a goal, guide your AI team, and keep the decisions that matter in your hands.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#desktop">Explore the desktop app</a>
          <a className="text-link" href="#workflow">See the workflow <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-introduction">
          <p className="eyebrow">Why Kind Meitner</p>
          <p className="introduction-statement">
            We make the desktop <span className="introduction-highlight">the home for your AI team</span>: a private place where context, tools, and people meet before work moves forward.
          </p>
          <div className="introduction-aside">
            <p className="introduction-detail">
              Instead of scattering prompts across tabs and services, Kind Meitner gives each task a visible path — from intent, to agent activity, to your final decision.
            </p>
            <div className="introduction-spectrum" aria-hidden="true"><i /><i /><i /><i /></div>
          </div>
        </div>
      </section>

      <section className="workspace-preview" id="desktop" aria-labelledby="workspace-heading">
        <div className="preview-caption">
          <p className="eyebrow">Your command center</p>
          <h2 id="workspace-heading">Work stays visible.</h2>
          <p>From the first prompt to the final approval, the whole team shares one clear workspace.</p>
        </div>
        <div className="desktop-window" aria-label="Illustration of a Kind Meitner workspace">
          <div className="window-header">
            <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
            <span>kind meitner / product launch</span>
            <span className="window-state">local · ready</span>
          </div>
          <div className="window-body">
            <aside className="workspace-rail" aria-hidden="true">
              <b>KM</b><span /><span /><span /><span />
            </aside>
            <div className="workspace-content">
              <div className="workspace-context">
                <p>Active goal</p>
                <strong>Ship a focused launch plan</strong>
                <span>3 agents · 2 approvals · local workspace</span>
              </div>
              <div className="activity-list">
                <div><span className="status-dot complete" /><p><strong>Research agent</strong><small>Mapped the audience and competitor set</small></p><time>done</time></div>
                <div><span className="status-dot active" /><p><strong>Strategy agent</strong><small>Drafting the launch narrative</small></p><time>working</time></div>
                <div><span className="status-dot waiting" /><p><strong>You</strong><small>Review positioning before it moves forward</small></p><time>review</time></div>
              </div>
              <div className="composer-preview">Tell your team what matters next <kbd>⌘ ↵</kbd></div>
            </div>
          </div>
        </div>
      </section>

      <section className="principles" aria-label="Kind Meitner principles">
        {PRINCIPLES.map((principle) => (
          <article key={principle.index}>
            <span>{principle.index}</span>
            <h2>{principle.title}</h2>
            <p>{principle.description}</p>
          </article>
        ))}
      </section>

      <section className="workflow" id="workflow" aria-labelledby="workflow-heading">
        <div className="workflow-intro">
          <p className="eyebrow">A calmer way to work with AI</p>
          <h2 id="workflow-heading">From an idea to a decision, without losing the thread.</h2>
        </div>
        <ol>
          {WORKFLOW_STEPS.map(([index, title, description]) => (
            <li key={index}>
              <span>{index}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="closing" aria-labelledby="closing-heading">
        <p className="eyebrow">Built for people who lead the work</p>
        <h2 id="closing-heading">Make AI useful. Keep the work yours.</h2>
        <a className="button button-primary" href="#top">Meet Kind Meitner</a>
      </section>

      <footer className="landing-footer">
        <a className="wordmark" href="#top">kind meitner</a>
        <p>AI work, under your control.</p>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <>
    <LandingPreloader />
    <LandingPage />
  </>,
);
