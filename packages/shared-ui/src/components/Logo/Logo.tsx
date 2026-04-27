import type { CSSProperties } from 'react';

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Override the endpoint dot color. Defaults to the Throughline accent green. */
  dotColor?: string;
};

const DEFAULT_DOT = 'oklch(0.72 0.18 150)';

/**
 * Throughline mark — a horizontal line that sweeps into a right-pointing chevron
 * and lands on a single accent endpoint. The line is the throughline; the dot is
 * where the work resolves. Canonical across header, favicon, and the marketing
 * video so the brand reads as one shape from across the room.
 */
export function Logo({
  size = 24,
  showWordmark = true,
  className,
  style,
  dotColor = DEFAULT_DOT,
}: LogoProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.32), ...style }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M6 24 L20 24"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <path
          d="M20 12 L34 24 L20 36"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx={40} cy={24} r={3} fill={dotColor} />
      </svg>
      {showWordmark ? (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
            fontSize: Math.round(size * 0.6),
            letterSpacing: '-0.015em',
            color: 'currentColor',
            lineHeight: 1,
          }}
        >
          Throughline
        </span>
      ) : null}
    </span>
  );
}
