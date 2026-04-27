import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { tokens, fontFamily } from '../tokens';

const INSIGHTS = [
  'Outcome 3.2 absorbed 47% of effort this week',
  'Sarah Mendez — commit carried forward 4 weeks',
  'Enterprise pipeline starved (0% effort)',
];

/**
 * Scene 5 (17-22s, 150 frames): Manager weekly digest panel + caption.
 */
export const SceneManagerDigest: React.FC = () => {
  const frame = useCurrentFrame();

  const headerOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const lineAnim = (idx: number): { opacity: number; tx: number } => {
    const start = 22 + idx * 11; // ~350ms
    const opacity = interpolate(frame, [start, start + 16], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const tx = interpolate(frame, [start, start + 16], [-24, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return { opacity, tx };
  };

  const captionOpacity = interpolate(frame, [88, 108], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
          backgroundColor: tokens.panelBg,
          border: `1px solid ${tokens.panelBorder}`,
          borderRadius: 12,
          padding: 32,
          opacity: headerOpacity,
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
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: tokens.text,
            }}
          >
            Weekly Digest
          </div>
          <div
            style={{
              fontSize: 13,
              color: tokens.muted,
              fontWeight: 500,
            }}
          >
            10 reports · Apr 27
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {INSIGHTS.map((line, i) => {
            const { opacity, tx } = lineAnim(i);
            return (
              <div
                key={i}
                style={{
                  opacity,
                  transform: `translateX(${tx}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  border: `1px solid ${tokens.panelBorder}`,
                  borderRadius: 8,
                  backgroundColor: 'oklch(0.995 0 0)',
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: tokens.accent,
                  }}
                />
                <div style={{ fontSize: 15, color: tokens.text, fontWeight: 500 }}>{line}</div>
              </div>
            );
          })}
        </div>
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
        Insights 15Five structurally cannot produce.
      </div>
    </AbsoluteFill>
  );
};
