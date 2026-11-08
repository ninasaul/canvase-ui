import Image from "next/image";
import type { CSSProperties } from "react";

export interface CardItem {
  id: string | number;
  url: string;
  title: string;
}

export interface DiagonalMarqueeCarouselProps {
  cards?: CardItem[];
  /** Rotation of the whole media wall, in degrees. */
  angle?: number;
  /** Seconds for one full loop; larger is slower. Rows drift around this value. */
  baseSpeed?: number;
  alternateDirections?: boolean;
  /** Number of rows in the wall. Five rows cover a 16:9 viewport at -20deg. */
  rows?: number;
  /** Background usage: skips hover-pause and interaction affordances. */
  decorative?: boolean;
  className?: string;
  cardClassName?: string;
  fadeClassName?: string;
}

/**
 * Generated material studies shipped in `public/media-wall`, one per card so no
 * tile repeats on screen — see `scripts/generate-media-wall.mjs`. Pass `cards`
 * to use your own media instead.
 */
const MEDIA_WALL_TILES = 50;

const DEFAULT_CARDS: CardItem[] = Array.from(
  { length: MEDIA_WALL_TILES },
  (_, index) => {
    const name = String(index + 1).padStart(2, "0");
    return {
      id: name,
      url: `/media-wall/tile-${name}.webp`,
      title: `Material study ${name}`,
    };
  },
);

/* Speeds vary from row to row so the wall never reads as a single sliding sheet.
   Multipliers keep the ratios of the original design (100% / 85% / 115% / ...). */
const ROW_SPEED_STEPS = [1, 0.875, 1.125, 0.95, 1.2, 0.9, 1.08, 0.82];

const CARD_BASE_CLASS =
  "group relative h-[300px] w-[400px] shrink-0 overflow-hidden rounded-xl bg-zinc-200 shadow-[0_24px_60px_-30px_rgba(9,9,11,0.55)] ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10";

const CARD_GAP_CLASS = "shrink-0 pr-8";

function Card({ card, className = "" }: { card: CardItem; className?: string }) {
  return (
    <div className={`${CARD_BASE_CLASS} ${className}`.trim()}>
      {/* Already pre-sized WebP, and the wall repeats the same files dozens of
          times — skip the optimizer so it never queues a render per card. The
          whole wall sits above the fold, so lazy loading would only delay the
          first paint (and trip Next's LCP warning). */}
      <Image
        src={card.url}
        alt={card.title}
        width={800}
        height={600}
        loading="eager"
        decoding="async"
        unoptimized
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/15" />
    </div>
  );
}

function MarqueeRow({
  cards,
  speed,
  direction,
  cardClassName,
  decorative,
}: {
  cards: CardItem[];
  speed: number;
  direction: 1 | -1;
  cardClassName?: string;
  decorative: boolean;
}) {
  const animationClass =
    direction === -1 ? "ui-marquee-left" : "ui-marquee-right";

  /* Two identical halves; the keyframes translate by exactly -50%, so the loop
     has no seam. The row's own slice must stay wider than the viewport after
     rotation — the carousel hands each row enough cards for that. */
  const halves = [0, 1];

  return (
    <div className="flex w-full overflow-hidden">
      <div
        className={`flex w-max shrink-0 ${animationClass} ${
          decorative ? "" : "cursor-pointer hover:[animation-play-state:paused]"
        }`}
        style={{ "--speed": `${speed}s` } as CSSProperties}
      >
        {halves.map((half) => (
          <div
            key={half}
            aria-hidden={half === 1 ? true : undefined}
            className="flex shrink-0"
          >
            {cards.map((card, index) => (
              <div key={`${half}-${card.id}-${index}`} className={CARD_GAP_CLASS}>
                <Card card={card} className={cardClassName} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A rotated wall of cards drifting in alternating directions.
 *
 * Pass `decorative` to use it as a hero backdrop: it then hides itself from
 * assistive tech, ignores the pointer, and leaves pausing to the
 * `prefers-reduced-motion` rule in `globals.css`.
 */
export function DiagonalMarqueeCarousel({
  cards = DEFAULT_CARDS,
  angle = -25,
  baseSpeed = 120,
  alternateDirections = true,
  rows = 5,
  decorative = false,
  className = "",
  cardClassName = "",
  fadeClassName = "from-background dark:from-background",
}: DiagonalMarqueeCarouselProps) {
  const rowCount = Math.max(1, rows);
  /* Deal the cards out row by row so neighbouring rows never show the same
     image. Ten cards per row is the minimum that keeps a row wider than the
     viewport after rotation; with fewer source cards they get reused. */
  const cardsPerRow = Math.max(10, Math.ceil(cards.length / rowCount));

  const rowConfigs = Array.from({ length: rowCount }, (_, index) => ({
    id: index,
    speed: Math.max(
      20,
      Math.round(
        baseSpeed * ROW_SPEED_STEPS[index % ROW_SPEED_STEPS.length],
      ),
    ),
    direction: (index % 2 === 1 && alternateDirections ? 1 : -1) as 1 | -1,
    cards: Array.from(
      { length: cardsPerRow },
      (_, slot) => cards[(index * cardsPerRow + slot) % cards.length],
    ),
  }));

  return (
    <div
      aria-hidden={decorative || undefined}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${
        decorative ? "pointer-events-none select-none" : ""
      } ${className}`.trim()}
    >
      <div
        className="absolute z-0 flex w-[140vw] flex-col gap-8"
        style={{ transform: `rotate(${angle}deg)` }}
      >
        {rowConfigs.map((row) => {
          const rowCards =
            row.direction === -1 ? row.cards : [...row.cards].reverse();
          return (
            <MarqueeRow
              key={row.id}
              cards={rowCards}
              speed={row.speed}
              direction={row.direction}
              cardClassName={cardClassName}
              decorative={decorative}
            />
          );
        })}
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-1/4 bg-gradient-to-b to-transparent ${fadeClassName}`.trim()}
      />
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/4 bg-gradient-to-t to-transparent ${fadeClassName}`.trim()}
      />
    </div>
  );
}
