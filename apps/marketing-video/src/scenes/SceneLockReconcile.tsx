import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { tokens, fontFamily } from '../tokens';

const STATES = [
  {
    label: 'DRAFT',
    bg: tokens.badgeBg,
    fg: tokens.badgeFg,
  },
  {
    label: 'LOCKED',
    bg: 'oklch(0.94 0.04 230)',
    fg: 'oklch(0.4 0.13 230)',
  },
  {
    label: 'RECONCILED',
    bg: tokens.doneBg,
    fg: tokens.doneFg,
  },
];

const RESULTS = [
  { label: 'DONE', bg: tokens.doneBg, fg: tokens.doneFg },
  { label: 'PARTIAL', bg: tokens.partialBg, fg: tokens.partialFg },
  { label: 'NOT_DONE', bg: tokens.notDoneBg, fg: tokens.notDoneFg },
];

/**
 * Scene 4 (13-17s, 120 frames): Lifecycle slides DRAFT -> LOCKED -> RECONCILED.
 * Below, three commit rows show DONE / PARTIAL / NOT_DONE chips.
 */
export const SceneLockReconcile: React.FC = () => {
  const frame = useCurrentFrame();

  // Pick the active badge stage. ~30 frames per stage.
  const stage = frame < 25 ? 0 : frame < 60 ? 1 : 2;
  const current = STATES[stage]!;

  const badgeOpacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const resultAnim = (idx: number): { opacity: number; tx: number } => {
    const start = 70 + idx * 10;
    const opacity = interpolate(frame, [start, start + 14], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const tx = interpolate(frame, [start, start + 14], [-10, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return { opacity, tx };
  };

  const captionOpacity = interpolate(frame, [95, 115], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const commitTexts = [
    'Draft pricing v2 RFC and circulate',
    'Onboard two design partners',
    'Cut p95 reconcile below 600ms',
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.shellBg,
        fontFamily,
        padding: 48,
        flexDirection: 'column',
        gap: 28,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          opacity: badgeOpacity,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: tokens.text,
          }}
        >
          Week of Apr 27
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            padding: '6px 12px',
            borderRadius: 999,
            backgroundColor: current.bg,
            color: current.fg,
            transition: 'background-color 250ms cubic-bezier(0.2,0.8,0.2,1)',
          }}
        >
          {current.label}
        </div>
      </div>

      <div
        style={{
          backgroundColor: tokens.panelBg,
          border: `1px solid ${tokens.panelBorder}`,
          borderRadius: 12,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {commitTexts.map((text, i) => {
          const { opacity, tx } = resultAnim(i);
          const r = RESULTS[i]!;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                border: `1px solid ${tokens.panelBorder}`,
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 14, color: tokens.text }}>{text}</div>
              <div
                style={{
                  opacity,
                  transform: `translateX(${tx}px)`,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  padding: '4px 10px',
                  borderRadius: 999,
                  backgroundColor: r.bg,
                  color: r.fg,
                }}
              >
                {r.label}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          opacity: captionOpacity,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          color: tokens.muted,
        }}
      >
        Reconciliation closes the loop.
      </div>
    </AbsoluteFill>
  );
};
