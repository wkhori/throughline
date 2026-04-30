interface SlackIconProps {
  size?: number;
  className?: string;
}

/**
 * Slack glyph rendered inline as four colored hash-bars. Public Slack mark colors,
 * sized like a lucide icon so it composes naturally inside buttons.
 */
export function SlackIcon({ size = 14, className }: SlackIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#E01E5A"
        d="M5.042 15.165a2.528 2.528 0 1 1-5.056 0 2.528 2.528 0 0 1 2.528-2.528h2.528v2.528zm1.27 0a2.528 2.528 0 1 1 5.056 0v6.323a2.528 2.528 0 1 1-5.056 0v-6.323z"
      />
      <path
        fill="#36C5F0"
        d="M8.84 5.042a2.528 2.528 0 1 1 0-5.056 2.528 2.528 0 0 1 2.528 2.528v2.528H8.84zm0 1.27a2.528 2.528 0 1 1 0 5.056H2.518a2.528 2.528 0 1 1 0-5.056H8.84z"
      />
      <path
        fill="#2EB67D"
        d="M18.956 8.84a2.528 2.528 0 1 1 5.056 0 2.528 2.528 0 0 1-2.528 2.528H18.956V8.84zm-1.27 0a2.528 2.528 0 1 1-5.056 0V2.518a2.528 2.528 0 1 1 5.056 0V8.84z"
      />
      <path
        fill="#ECB22E"
        d="M15.158 18.956a2.528 2.528 0 1 1 0 5.056 2.528 2.528 0 0 1-2.528-2.528v-2.528h2.528zm0-1.27a2.528 2.528 0 1 1 0-5.056h6.323a2.528 2.528 0 1 1 0 5.056h-6.323z"
      />
    </svg>
  );
}
