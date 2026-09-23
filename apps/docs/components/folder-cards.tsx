"use client";

import { useState } from "react";
import { motion, type Transition } from "motion/react";
import CRTWarp from "./CRTWarp";
export interface FolderCardItem {
  id: string;
  number: string;
  title: string;
  description: string;
  href: string;
  folderColor: string;
  borderColor: string;
  textColor: string;
  subTextColor: string;
  crt: string;
  crtBackground: string;
}

export const LANDING_PAGES: FolderCardItem[] = [
  {
    id: "invite",
    number: "01",
    title: "Invite an OKX agent",
    description: "Open Channel 1 and invite Markets, Listing Coach, or Spend Scout.",
    href: "/docs/getting-started/first-bot",
    folderColor: "#E8DFFB",
    borderColor: "#D4C4F5",
    textColor: "#3B2F63",
    subTextColor: "rgba(59, 47, 99, 0.65)",
    crt: "#c755f7",
    crtBackground: "#14081f",
  },
  {
    id: "catalog",
    number: "02",
    title: "Catalog agents",
    description: "Local Free · read-only catalog. Not the live Portal.",
    href: "/docs/okx/agents",
    folderColor: "#FFE8D6",
    borderColor: "#FFD4B8",
    textColor: "#5C3D2E",
    subTextColor: "rgba(92, 61, 46, 0.65)",
    crt: "#ffb067",
    crtBackground: "#1a0d06",
  },
  {
    id: "rooms",
    number: "03",
    title: "Rooms",
    description: "Invite only works in a non-DM room.",
    href: "/docs/okx/rooms",
    folderColor: "#D8F5E4",
    borderColor: "#B8EBCE",
    textColor: "#1F4D38",
    subTextColor: "rgba(31, 77, 56, 0.65)",
    crt: "#3dba7a",
    crtBackground: "#04140c",
  },
];

const gpuSpringTransition: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 28,
  mass: 0.75,
  restDelta: 0.0005,
  restSpeed: 0.0005,
};

function FolderPeek({ card, paused }: { card: FolderCardItem; paused: boolean }) {
  return (
    <div className="relative isolate h-[400px] w-[300px] shrink-0">
      <motion.a
        href={card.href}
        className="group relative block h-[400px] w-[300px] cursor-pointer select-none overflow-hidden rounded-[32px] shadow-lg transform-gpu [backface-visibility:hidden] [contain:paint]"
        style={{ border: `10px solid ${card.borderColor}`, boxSizing: "border-box" }}
        initial="initial"
        whileHover="hover"
        animate="initial"
      >
        <div className="absolute inset-0 z-0">
          <CRTWarp
            color={card.crt}
            backgroundColor={card.crtBackground}
            speed={0.5}
            curvature={0.25}
            scanlineStrength={0.25}
            scanlineFrequency={200}
            waveAmplitude={0.3}
            waveFrequency={2.5}
            bloom={1.5}
            bloomRadius={1}
            noise={0.1}
            vignette={0}
            brightness={1.25}
            pixelation={1}
            rgbShift={0.015}
            mouseReact
            mouseStrength={0.5}
            dpr={1}
            fps={30}
            paused={paused}
          />
        </div>

        <motion.div
          className="pointer-events-none absolute inset-x-0 top-[80px] z-20 h-[380px] transform-gpu will-change-[transform]"
          variants={{ initial: { y: 0 }, hover: { y: 100 } }}
          transition={gpuSpringTransition}
        >
          <svg viewBox="0 0 280 380" fill="none" preserveAspectRatio="none" className="absolute inset-0 h-full w-full drop-shadow-[0_-10px_20px_rgba(0,0,0,0.15)]">
            <path
              d="M 0,20 C 0,9 9,0 20,0 L 122,0 C 133,0 140,5.5 143.5,15 C 147,24.5 154,30 164,30 L 262,30 C 272,30 280,38 280,48 L 280,380 L 0,380 Z"
              fill={card.folderColor}
            />
          </svg>
          <div className="absolute left-6 top-4 font-mono text-[3.5rem] font-bold tabular-nums leading-none tracking-tighter" style={{ color: card.textColor }}>
            {card.number}
          </div>
        </motion.div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 p-5 pb-[22px]" style={{ color: card.textColor }}>
          <h3 className="font-sans text-base font-semibold leading-7 tracking-tight">{card.title}</h3>
          <p className="font-sans text-sm font-normal leading-relaxed" style={{ color: card.subTextColor }}>
            {card.description}
          </p>
        </div>
      </motion.a>
    </div>
  );
}

export function FolderCards({ cards }: { cards: FolderCardItem[] }) {
  const [liveId, setLiveId] = useState<string | null>(null);
  return (
    <section className="flex w-full items-center justify-center px-6 py-8" aria-label="Invite path">
      <div className="flex flex-wrap items-center justify-center gap-8">
        {cards.map((card) => (
          <div key={card.id} onPointerEnter={() => setLiveId(card.id)} onPointerLeave={() => setLiveId(null)}>
            <FolderPeek card={card} paused={liveId !== card.id} />
          </div>
        ))}
      </div>
    </section>
  );
}
