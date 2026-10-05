// Dev showcase for EventTimelineCard. Served by Vite in dev at
// /event-timeline-preview.html; not part of the packaged app.
// ?cards=2 renders a second card to check that SVG IDs never collide.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EventTimelineCard } from "@/components/event-timeline/EventTimelineCard";
import { EventTimelineShowcase } from "@/components/event-timeline/EventTimelineShowcase";
import { OKX_DEV_DAY_EVENTS } from "@/components/event-timeline/schedule";
import "./styles.css";

const second = new URLSearchParams(location.search).get("cards") === "2";

function Preview() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-black px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-[760px] flex-col gap-10">
        <EventTimelineShowcase
          events={OKX_DEV_DAY_EVENTS}
          date="2026-10-07"
          timeZone="Asia/Singapore"
          defaultSelectedId="finalist-demos"
        />
        {second && (
          <EventTimelineCard events={OKX_DEV_DAY_EVENTS} date="2026-10-07" timeZone="Asia/Singapore" defaultSelectedId="panel-1" />
        )}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
