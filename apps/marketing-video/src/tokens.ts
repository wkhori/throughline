/**
 * Design tokens mirrored from packages/shared-ui/src/styles/tokens.css.
 * Kept in a plain .ts file so Remotion's bundler does not need a CSS pipeline.
 */
export const tokens = {
  shellBg: 'oklch(0.98 0.005 250)',
  heroBg: 'oklch(0.98 0.01 230)',
  panelBg: 'oklch(1 0 0)',
  text: 'oklch(0.18 0.01 250)',
  heroHeading: 'oklch(0.2 0.02 230)',
  muted: 'oklch(0.55 0.015 250)',
  panelBorder: 'oklch(0.92 0.005 250)',
  accent: 'oklch(0.72 0.18 150)',
  accentSoft: 'oklch(0.94 0.04 150)',
  badgeBg: 'oklch(0.95 0.01 230)',
  badgeFg: 'oklch(0.32 0.04 230)',
  doneBg: 'oklch(0.93 0.06 150)',
  doneFg: 'oklch(0.35 0.13 150)',
  partialBg: 'oklch(0.94 0.06 60)',
  partialFg: 'oklch(0.4 0.13 60)',
  notDoneBg: 'oklch(0.93 0.07 25)',
  notDoneFg: 'oklch(0.35 0.15 25)',
  black: 'oklch(0.14 0.005 250)',
} as const;

export const fontFamily =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
