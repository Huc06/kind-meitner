import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MausAvatar } from "@/components/Avatar";
import {
  MAUS_COLOR_NAMES,
  MAUS_COLORS,
  MAUS_MOTIONS,
  PICKABLE_STATES,
  STATE_GROUPS,
  type MausColor,
  type MausMotion,
  type MausState,
} from "@/lib/mascot";
import "./styles.css";
import "./mascot-preview.css";

interface ScenarioLabels extends Partial<Record<MausState, string>> {}

const SCENARIOS: ScenarioLabels = {
  idle: "General / admin",
  happy: "Support / guide",
  curious: "Awaiting input",
  drowsy: "Overnight / async",
  working: "Code / build",
  thinking: "Research / strategy",
  listening: "Dictation / voice",
  sleeping: "Paused / stopped",
  suspicious: "Review / audit",
  proud: "Task completed",
};

const MOTION_SCENARIOS = {
  arrive: "New bot created",
  switch: "Active bot changed",
  customize: "Appearance updated",
  alert: "Needs attention",
  thinking: "Waiting for input",
  working: "Task in progress",
  launch: "Computer starting",
  success: "Step completed",
  celebrate: "Turn finished",
  blink: "New reply",
  surprise: "Unread update",
  failure: "Action failed",
} satisfies Record<Exclude<MausMotion, "none">, string>;

const MOTION_COLORS: MausColor[] = [
  "green", "blue", "purple", "red", "cyan", "orange",
  "teal", "green", "pink", "yellow", "coral", "red",
];

function Tuner({
  state,
  setState,
  color,
  setColor,
}: {
  state: MausState;
  setState: (s: MausState) => void;
  color: MausColor;
  setColor: (c: MausColor) => void;
}) {
  return (
    <section className="tuner">
      <div className="tuner-stage">
        <MausAvatar
          color={color}
          state={state}
          size={300}
          label={`${state} maus`}
          interactive
        />
        <div className="tuner-readout">
          <strong>{state}</strong>
          <span>{color}</span>
        </div>
      </div>

      <div className="tuner-controls">
        <div className="tuner-block">
          <h3>Colour</h3>
          <div className="chips">
            {MAUS_COLOR_NAMES.map((c) => (
              <button
                key={c}
                type="button"
                className={c === color ? "on" : ""}
                onClick={() => setColor(c)}
              >
                <span className="swatch" style={{ background: MAUS_COLORS[c] }} />
                {c}
              </button>
            ))}
          </div>

          {Object.entries(STATE_GROUPS).map(([group, names]) => (
            <div key={group}>
              <h3>{group}</h3>
              <div className="chips">
                {names.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={state === name ? "on" : ""}
                    onClick={() => setState(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MotionCard({
  motion,
  index,
  replayAll,
  color,
}: {
  motion: Exclude<MausMotion, "none">;
  index: number;
  replayAll: number;
  color: MausColor;
}) {
  const [replayOne, setReplayOne] = useState(0);

  return (
    <article className="motion-card">
      <div className="motion-stage">
        <MausAvatar
          color={color ?? MOTION_COLORS[index]}
          state="idle"
          size={172}
          motion={motion}
          motionKey={replayAll * 100 + replayOne}
          label={`${motion} motion`}
        />
      </div>
      <footer className="motion-meta">
        <div>
          <span className="motion-number">{String(index + 1).padStart(2, "0")}</span>
          <h2>{motion}</h2>
          <p>{MOTION_SCENARIOS[motion]}</p>
        </div>
        <button type="button" onClick={() => setReplayOne((value) => value + 1)}>
          Replay
        </button>
      </footer>
    </article>
  );
}

function Preview() {
  const [replayAll, setReplayAll] = useState(0);
  const [state, setState] = useState<MausState>("idle");
  const [color, setColor] = useState<MausColor>("green");

  useEffect(() => {
    const interval = window.setInterval(() => setReplayAll((value) => value + 1), 4600);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <main className="preview-shell">
      <header className="preview-header">
        <div>
          <p className="eyebrow">bot-avatars · 18 bodies · 3 states</p>
          <h1>Maus motion library</h1>
          <p className="intro">
            The app&rsquo;s bot color and state, drawn by the bot-avatars canvas.
            A motion beat borrows a library state, then hands it back.
          </p>
        </div>
        <button className="replay-all" type="button" onClick={() => setReplayAll((v) => v + 1)}>
          <span aria-hidden="true">↻</span>
          Replay all motions
        </button>
      </header>

      <Tuner
        state={state}
        setState={setState}
        color={color}
        setColor={setColor}
      />

      <section className="motion-grid" aria-label="Mascot motion library">
        {MAUS_MOTIONS.map((motion, index) => (
          <MotionCard
            key={motion}
            motion={motion}
            index={index}
            replayAll={replayAll}
            color={MOTION_COLORS[index]}
          />
        ))}
      </section>

      <section className="expression-library" aria-labelledby="expression-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Identity system</p>
            <h2 id="expression-heading">Colors and states</h2>
          </div>
          <p>Move your pointer over any Maus to test the responsive eyes.</p>
        </div>

        <div className="matrix-wrap">
          <div className="matrix">
            <div className="corner-label">Color ↓ / state →</div>
            {PICKABLE_STATES.map((s) => (
              <div className="column-label" key={s}>
                <strong>{s}</strong>
                <span>{SCENARIOS[s]}</span>
              </div>
            ))}

            {MAUS_COLOR_NAMES.map((c) => (
              <div className="matrix-row" key={c}>
                <div className="row-label">
                  <span className="swatch" style={{ background: MAUS_COLORS[c] }} />
                  <strong>{c}</strong>
                  <code>{MAUS_COLORS[c]}</code>
                </div>
                {PICKABLE_STATES.map((s) => (
                  <div className="mascot-cell" key={`${c}-${s}`}>
                    <MausAvatar color={c} state={s} size={86} label={`${c} ${s} maus`} interactive />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
