import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Logo } from '../Logo';
import { tokens, fontFamily } from '../tokens';

/**
 * Scene 6 (22-25s, 90 frames): Soft off-white outro with logo and url.
 */
export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 18, 75, 90], [0, 1, 1, 0.92], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const urlOpacity = interpolate(frame, [12, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.heroBg,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 18,
        fontFamily,
        opacity,
      }}
    >
      <Logo size={64} />
      <div
        style={{
          opacity: urlOpacity,
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          color: tokens.muted,
        }}
      >
        throughline.app
      </div>
    </AbsoluteFill>
  );
};
