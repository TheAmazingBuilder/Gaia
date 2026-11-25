"use client";

import * as React from "react";

/**
 * Gaïa brand — the user's chosen Möbius renders (25 Nov 2026).
 *
 * The ribbon is the 3D render he chose, NOT a redraw. The images live in
 * public/brand/ as binary .webp — they cannot ride a snapshot push, so
 * they are dropped into the clone by hand (see README, "Branding").
 *   - mobius-app-icon.webp — the square 3D ribbon (home-screen icon)
 *   - mobius-lockup-v2.webp — the horizontal lockup (3:1), hero use
 *   - mobius-mono-v2.webp — the white 3D ribbon, single-colour contexts
 *   - mobius-favicon-v2.webp — reference asset; the live favicon is the
 *     SVG redraw in src/app/icon.svg, because Next.js metadata icons do
 *     not accept .webp
 *
 * The .webp renders have a dark background baked in, so they are used in
 * dark mode only. In light mode — or if an image fails to load (the files
 * are not in public/brand/ yet) — the flat SVG mark + JSX wordmark below
 * take over: same lemniscate geometry, same aurora gradient, theme-aware.
 *
 * Small sizes use the mark + wordmark as components: the lockup image at
 * 24 px tall would make the signature ï dots unreadable. The full lockup
 * image is reserved for hero sizes (login screen).
 */

// ── Flat SVG fallback (lemniscate, viewBox 0 0 120 64) ──────────────────────
// Half 1 (under-strand) is split around the centre crossing: the gap is the
// twist. Half 2 (over-strand) is drawn on top, continuous.

const MARK_HALF_1A =
  "M 110.0 32.0 L 109.9 30.5 L 109.7 29.1 L 109.4 27.7 L 109.0 26.3 L 108.4 25.0 L 107.8 23.7 L 107.0 22.5 L 106.2 21.3 L 105.2 20.3 L 104.2 19.3 L 103.1 18.4 L 102.0 17.6 L 100.8 16.9 L 99.6 16.3 L 98.4 15.7 L 97.1 15.3 L 95.8 14.9 L 94.6 14.7 L 93.3 14.5 L 92.0 14.4 L 90.7 14.3 L 89.5 14.3 L 88.2 14.4 L 87.0 14.6 L 85.8 14.8 L 84.6 15.1 L 83.5 15.4 L 82.3 15.7 L 81.2 16.1 L 80.2 16.5 L 79.1 17.0 L 78.1 17.5 L 77.1 18.0 L 76.1 18.5 L 75.1 19.1 L 74.2 19.7 L 73.3 20.3 L 72.4 20.9 L 71.5 21.6 L 70.6 22.2 L 69.8 22.9 L 69.0 23.6 L 68.2 24.2 L 67.4 24.9 L 66.6 25.6 L 65.8 26.3 L 65.0 27.1 L 64.3 27.8";

const MARK_HALF_1B =
  "M 55.7 36.2 L 55.0 36.9 L 54.2 37.7 L 53.4 38.4 L 52.6 39.1 L 51.8 39.8 L 51.0 40.4 L 50.2 41.1 L 49.4 41.8 L 48.5 42.4 L 47.6 43.1 L 46.7 43.7 L 45.8 44.3 L 44.9 44.9 L 43.9 45.5 L 42.9 46.0 L 41.9 46.5 L 40.9 47.0 L 39.8 47.5 L 38.8 47.9 L 37.7 48.3 L 36.5 48.6 L 35.4 48.9 L 34.2 49.2 L 33.0 49.4 L 31.8 49.6 L 30.5 49.7 L 29.3 49.7 L 28.0 49.6 L 26.7 49.5 L 25.4 49.3 L 24.2 49.1 L 22.9 48.7 L 21.6 48.3 L 20.4 47.7 L 19.2 47.1 L 18.0 46.4 L 16.9 45.6 L 15.8 44.7 L 14.8 43.7 L 13.8 42.7 L 13.0 41.5 L 12.2 40.3 L 11.6 39.0 L 11.0 37.7 L 10.6 36.3 L 10.3 34.9 L 10.1 33.5 L 10.0 32.0";

const MARK_HALF_2 =
  "M 10.0 32.0 L 10.3 28.8 L 11.3 25.6 L 12.8 22.8 L 14.7 20.3 L 17.1 18.2 L 19.7 16.6 L 22.5 15.4 L 25.4 14.7 L 28.2 14.4 L 31.1 14.4 L 33.8 14.7 L 36.4 15.3 L 38.9 16.2 L 41.3 17.2 L 43.6 18.3 L 45.7 19.6 L 47.7 21.0 L 49.7 22.5 L 51.5 24.0 L 53.3 25.5 L 55.0 27.1 L 56.7 28.7 L 58.4 30.4 L 60.0 32.0 L 61.6 33.6 L 63.3 35.3 L 65.0 36.9 L 66.7 38.5 L 68.5 40.0 L 70.3 41.5 L 72.3 43.0 L 74.3 44.4 L 76.4 45.7 L 78.7 46.8 L 81.1 47.8 L 83.6 48.7 L 86.2 49.3 L 88.9 49.6 L 91.8 49.6 L 94.6 49.3 L 97.5 48.6 L 100.3 47.4 L 102.9 45.8 L 105.3 43.7 L 107.2 41.2 L 108.7 38.4 L 109.7 35.2 L 110.0 32.0";

const AURORA_STOPS = [
  { offset: "0", color: "#FF6B5B" },
  { offset: "0.5", color: "#8B5CF6" },
  { offset: "1", color: "#22D3EE" },
] as const;

/** Flat SVG Möbius — light-mode and missing-asset fallback. */
function MarkSvg({
  className,
  variant = "aurora",
}: {
  className?: string;
  variant?: "aurora" | "mono";
}) {
  const gradientId = React.useId().replace(/:/g, "");
  const stroke =
    variant === "mono" ? "currentColor" : `url(#${gradientId})`;
  return (
    <svg
      viewBox="0 0 120 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {variant === "aurora" ? (
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1="10"
            y1="0"
            x2="110"
            y2="0"
          >
            {AURORA_STOPS.map((stop) => (
              <stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.color}
              />
            ))}
          </linearGradient>
        </defs>
      ) : null}
      <g fill="none" stroke={stroke} strokeWidth={10} strokeLinecap="round">
        <path d={MARK_HALF_1A} />
        <path d={MARK_HALF_1B} />
        <path d={MARK_HALF_2} />
      </g>
    </svg>
  );
}

/**
 * The Möbius mark: the chosen 3D render in dark mode (the square app icon
 * for "aurora", the white ribbon for "mono"), the flat SVG in light mode
 * or when the image is not in public/brand/ yet.
 */
export function GaiaMark({
  className,
  variant = "aurora",
}: {
  className?: string;
  /** "aurora" — 3D ribbon. "mono" — white 3D ribbon, single-colour use. */
  variant?: "aurora" | "mono";
}) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return <MarkSvg className={className} variant={variant} />;
  const src =
    variant === "mono"
      ? "/brand/mobius-mono-v2.webp"
      : "/brand/mobius-app-icon.webp";
  return (
    <>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={() => setFailed(true)}
        className={`hidden rounded-md dark:block ${className ?? ""}`}
      />
      <span className="dark:hidden">
        <MarkSvg className={className} variant={variant} />
      </span>
    </>
  );
}

/**
 * "Gaïa" in geometric sans (Geist), the signature being the two dots of
 * the ï — one coral, one cyan. The dots are sized and positioned in em so
 * they follow the surrounding font size. Screen readers get "Gaïa" via
 * the aria-label; the visual spans are hidden from them.
 */
export function GaiaWordmark({ className }: { className?: string }) {
  return (
    <span aria-label="Gaïa" className={className}>
      <span aria-hidden="true">
        Ga
        <span className="relative inline-block leading-none">
          ı
          <span className="absolute bottom-[0.72em] left-[-0.04em] size-[0.16em] rounded-full bg-brand-coral" />
          <span className="absolute bottom-[0.72em] left-[0.18em] size-[0.16em] rounded-full bg-brand-cyan" />
        </span>
        a
      </span>
    </span>
  );
}

/** Horizontal lockup: Möbius mark + wordmark (small sizes). */
export function GaiaBrand({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <GaiaMark className={markClassName ?? "h-5 w-auto"} />
      <GaiaWordmark
        className={wordmarkClassName ?? "text-base font-bold tracking-tight"}
      />
    </span>
  );
}

/**
 * The full horizontal lockup image (mark + wordmark, 3:1) — hero sizes
 * only, e.g. the login screen. Falls back to GaiaBrand (mark + wordmark
 * components) in light mode or when the image is not in public/brand/ yet.
 */
export function GaiaLockup({ className }: { className?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <GaiaBrand
        markClassName="h-8 w-auto"
        wordmarkClassName="text-3xl font-bold tracking-tight"
      />
    );
  }
  return (
    <>
      <img
        src="/brand/mobius-lockup-v2.webp"
        alt="Gaïa"
        draggable={false}
        onError={() => setFailed(true)}
        className={`hidden dark:block ${className ?? ""}`}
      />
      <span className="dark:hidden">
        <GaiaBrand
          markClassName="h-8 w-auto"
          wordmarkClassName="text-3xl font-bold tracking-tight"
        />
      </span>
    </>
  );
}
