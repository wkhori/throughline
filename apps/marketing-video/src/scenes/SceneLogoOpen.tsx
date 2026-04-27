import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Logo } from '../Logo';
import { tokens, fontFamily } from '../tokens';

/**
 * Scene 1 (0-3s, 90 frames): Logo cold open on black. Snap-eased fade + subtle scale.
 */
export const SceneLogoOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [72, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const scale = spring({
    frame,
    fps,
    config: { damping: 200, mass: 1, stiffness: 80 },
    from: 0.95,
    to: 1.0,
  });

  const subtitleOpacity = interpolate(frame, [18, 36, 72, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.black,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div style={{ opacity, transform: `scale(${scale})` }}>
        <Logo size={80} color="oklch(0.98 0.005 250)" wordmarkColor="oklch(0.98 0.005 250)" />
      </div>
      <div
        style={{
          opacity: subtitleOpacity,
          color: 'oklch(0.7 0.015 250)',
          fontFamily,
          fontSize: 22,
          letterSpacing: '-0.005em',
          fontWeight: 400,
        }}
      >
        Strategic alignment, by design.
      </div>
    </AbsoluteFill>
  );
};
