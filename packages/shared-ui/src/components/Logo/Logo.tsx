import type { CSSProperties } from 'react';

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * Throughline logo — three nested arcs converging into a single right-pointing
 * arrow head, expressing "many streams of work flowing through a single line of
 * strategic intent." The wordmark uses the system font at the optical weight
 * of the mark; tracking is tightened slightly so the lockup reads like one
 * shape from across the room.
 */
export function Logo({ size = 24, showWordmark = true, className, style }: LogoProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M3 6c4 4 8 4 12 0"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M3 12c5 5 10 5 14 0"
          stroke="currentColor"
          strokeOpacity="0.65"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M3 18c6 6 12 6 16 0"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M16 12l5 0M16 12l-3-3M16 12l-3 3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark ? (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: Math.round(size * 0.66),
            letterSpacing: '-0.015em',
            color: 'currentColor',
          }}
        >
          Throughline
        </span>
      ) : null}
    </span>
  );
}
