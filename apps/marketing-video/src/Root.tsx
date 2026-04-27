import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { HeroVideo } from './HeroVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="hero-video"
        component={HeroVideo}
        durationInFrames={750}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};

registerRoot(RemotionRoot);
