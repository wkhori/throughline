import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { tokens, fontFamily } from '../tokens';

interface CommitRow {
  text: string;
  outcome: string;
}

const COMMITS: CommitRow[] = [
  { text: 'Draft pricing v2 RFC and circulate to leadership', outcome: 'Outcome 3.2' },
  { text: 'Onboard two design partners to the new tier', outcome: 'Outcome 3.2' },
  { text: 'Cut p95 reconcile time below 600ms', outcome: 'Outcome 1.4' },
];

/**
 * Scene 3 (8-13s, 150 frames): IC drafting commits panel + AI caption.
 */
export const SceneIcDrafting: React.FC = () => {
  const frame = useCurrentFrame();

  const panelOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const rowAnim = (idx: number): { opacity: number; tx: number } => {
    const start = 24 + idx * 6; // 200ms ≈ 6 frames
    const opacity = interpolate(frame, [start, start + 16], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const tx = interpolate(frame, [start, start + 16], [12, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return { opacity, tx };
  };

  const captionOpacity = interpolate(frame, [70, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.shellBg,
        fontFamily,
        padding: 48,
        gap: 32,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 36,
          alignItems: 'flex-start',
          opacity: panelOpacity,
        }}
      >
        <div
          style={{
            flex: '0 0 720px',
            backgroundColor: tokens.panelBg,
            border: `1px solid ${tokens.panelBorder}`,
            borderRadius: 12,
            padding: 28,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
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
                padding: '6px 10px',
                borderRadius: 999,
                backgroundColor: tokens.badgeBg,
                color: tokens.badgeFg,
              }}
            >
              DRAFT
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {COMMITS.map((c, i) => {
              const { opacity, tx } = rowAnim(i);
              return (
                <div
                  key={i}
                  style={{
                    opacity,
                    transform: `translateY(${tx}px)`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    border: `1px solid ${tokens.panelBorder}`,
                    borderRadius: 8,
                    backgroundColor: 'oklch(0.995 0 0)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      color: tokens.text,
                      fontWeight: 400,
                      maxWidth: 480,
                    }}
                  >
                    {c.text}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: 999,
                      backgroundColor: tokens.accentSoft,
                      color: tokens.accent,
                    }}
                  >
                    {c.outcome}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            opacity: captionOpacity,
            paddingTop: 24,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: tokens.muted,
              marginBottom: 12,
            }}
          >
            COPILOT
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: tokens.heroHeading,
              lineHeight: 1.35,
            }}
          >
            T1 suggests the outcome.
            <br />
            T2 flags drift.
            <br />
            T7 lints quality.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
