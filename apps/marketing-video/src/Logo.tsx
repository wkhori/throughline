import React from 'react';
import { tokens, fontFamily } from './tokens';

interface LogoProps {
  size?: number;
  color?: string;
  wordmarkColor?: string;
}

/**
 * Throughline mark — line + chevron + endpoint dot. Mirrors
 * packages/shared-ui/src/components/Logo/Logo.tsx so the brand reads as one
 * shape across header, favicon, and this video.
 */
export const Logo: React.FC<LogoProps> = ({
  size = 48,
  color = tokens.text,
  wordmarkColor,
}) => {
  const wmColor = wordmarkColor ?? color;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size * 0.32,
        fontFamily,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M6 24 L20 24"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <path
          d="M20 12 L34 24 L20 36"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx={40} cy={24} r={3} fill={tokens.accent} />
      </svg>
      <span
        style={{
          fontSize: size * 0.6,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          color: wmColor,
          lineHeight: 1,
        }}
      >
        throughline
      </span>
    </div>
  );
};
