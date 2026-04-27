import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { SceneLogoOpen } from './scenes/SceneLogoOpen';
import { SceneRcdoTree } from './scenes/SceneRcdoTree';
import { SceneIcDrafting } from './scenes/SceneIcDrafting';
import { SceneLockReconcile } from './scenes/SceneLockReconcile';
import { SceneManagerDigest } from './scenes/SceneManagerDigest';
import { SceneOutro } from './scenes/SceneOutro';

/**
 * Throughline marketing hero — 25s @ 30fps = 750 frames, 1280x720.
 * Six scenes wired through Sequence boundaries; each scene is fully self-contained.
 */
export const HeroVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'oklch(0.98 0.005 250)' }}>
      <Sequence from={0} durationInFrames={90}>
        <SceneLogoOpen />
      </Sequence>
      <Sequence from={90} durationInFrames={150}>
        <SceneRcdoTree />
      </Sequence>
      <Sequence from={240} durationInFrames={150}>
        <SceneIcDrafting />
      </Sequence>
      <Sequence from={390} durationInFrames={120}>
        <SceneLockReconcile />
      </Sequence>
      <Sequence from={510} durationInFrames={150}>
        <SceneManagerDigest />
      </Sequence>
      <Sequence from={660} durationInFrames={90}>
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  );
};
