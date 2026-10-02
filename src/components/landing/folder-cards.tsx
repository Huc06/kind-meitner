import { Frame } from "@/components/ui/frame";
import { tileFor, TILE_FILL } from "@/components/ui/tile";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";

export interface FolderCardItem {
  id: string;
  number: string;
  title: string;
  description: string;
  href: string;
  folderColor?: string;
  borderColor?: string;
  textColor?: string;
  subTextColor?: string;
  crt?: string;
  crtBackground?: string;
}

export const LANDING_PAGES: FolderCardItem[] = [
  {
    id: "invite",
    number: "01",
    title: "Invite an OKX agent",
    description: "Open Channel 1 and invite Markets, Listing Coach, or Spend Scout.",
    href: "/docs/getting-started/first-bot",
  },
  {
    id: "catalog",
    number: "02",
    title: "Catalog agents",
    description: "Local Free · read-only catalog. Not the live Portal.",
    href: "/docs/okx/agents",
  },
  {
    id: "rooms",
    number: "03",
    title: "Rooms",
    description: "Invite only works in a non-DM room.",
    href: "/docs/okx/rooms",
  },
];

/**
 * Restyled console dossier cards.
 * Uses Nymspace Frame with zero radii, tokens, and tile marks.
 * Dropped motion/react spring animations in favor of cybernetic console tokens.
 */
export function FolderCards({ cards }: { cards: FolderCardItem[] }) {
  return (
    <section className="w-full py-4" aria-label="Invite path">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const tone = tileFor(card.id);
          return (
            <Frame
              key={card.id}
              title={card.title}
              index={card.number}
              surface="app"
              className="bg-card p-5 flex flex-col justify-between hover:bg-raised transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 shrink-0", TILE_FILL[tone])} aria-hidden="true" />
                    <span className="label-mono text-ink-secondary">{card.id}</span>
                  </div>
                  <Tag tone={tone} variant="outline" size="sm">
                    DOSSIER
                  </Tag>
                </div>
                <h3 className="mt-3 font-sans text-base font-medium text-ink">{card.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{card.description}</p>
                <div className="mt-3 border border-hairline bg-inset px-2.5 py-1.5 font-mono text-[11px] text-ink-secondary flex items-center justify-between">
                  <span className="truncate">{card.href}</span>
                  <span className="shrink-0 text-ink">READ</span>
                </div>
              </div>
              <div className="mt-4 pt-3 frame-rule-above">
                <a
                  href={card.href}
                  className="flex items-center justify-between label-mono text-ink-secondary hover:text-ink"
                >
                  <span>Open documentation</span>
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </Frame>
          );
        })}
      </div>
    </section>
  );
}

export default FolderCards;
