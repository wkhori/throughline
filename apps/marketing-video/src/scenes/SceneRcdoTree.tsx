import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { tokens, fontFamily } from '../tokens';

interface NodeBoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  caption: string;
  opacity: number;
  highlight?: boolean;
}

const NodeBox: React.FC<NodeBoxProps> = ({ x, y, w, h, label, caption, opacity, highlight }) => (
  <g opacity={opacity}>
    {highlight ? (
      <rect
        x={x - 4}
        y={y - 4}
        width={w + 8}
        height={h + 8}
        rx={10}
        fill="none"
        stroke={tokens.accent}
        strokeWidth={2}
        strokeOpacity={0.8}
      />
    ) : null}
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={6}
      fill={tokens.panelBg}
      stroke={tokens.panelBorder}
      strokeWidth={1}
    />
    <text
      x={x + w / 2}
      y={y + 18}
      fontFamily={fontFamily}
      fontSize={10}
      fontWeight={600}
      letterSpacing="0.06em"
      fill={tokens.muted}
      textAnchor="middle"
    >
      {label}
    </text>
    <text
      x={x + w / 2}
      y={y + 38}
      fontFamily={fontFamily}
      fontSize={13}
      fontWeight={500}
      fill={tokens.text}
      textAnchor="middle"
    >
      {caption}
    </text>
  </g>
);

/**
 * Scene 2 (3-8s, 150 frames, frame 0..149 local): RCDO tree builds tier by tier.
 * Final state highlights one Supporting Outcome and connects a "Commit" card to it.
 */
export const SceneRcdoTree: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Stagger ~250ms = 7.5 frames at 30fps; we use 8.
  const stagger = (delay: number): number =>
    interpolate(frame, [delay, delay + 18], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  const rcOpacity = stagger(20);
  const doOpacity = stagger(35);
  const oOpacity = stagger(50);
  const soOpacity = stagger(65);
  const commitOpacity = stagger(95);
  const arrowDraw = interpolate(frame, [105, 130], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Layout
  const rcBox = { x: 540, y: 110, w: 200, h: 56 };
  const doBoxes = [
    { x: 220, y: 220, w: 180, h: 56 },
    { x: 540, y: 220, w: 180, h: 56 },
    { x: 860, y: 220, w: 180, h: 56 },
  ];
  const oBoxes = [
    { x: 480, y: 330, w: 150, h: 50 },
    { x: 650, y: 330, w: 150, h: 50 },
  ];
  const soBoxes = [
    { x: 380, y: 430, w: 130, h: 46 },
    { x: 530, y: 430, w: 130, h: 46 },
    { x: 680, y: 430, w: 130, h: 46 },
    { x: 830, y: 430, w: 130, h: 46 },
  ];
  const commitBox = { x: 940, y: 540, w: 220, h: 56 };
  const highlightedSoIdx = 2;

  const lineDraw = (delay: number, dur = 12): number =>
    interpolate(frame, [delay, delay + dur], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.heroBg,
        fontFamily,
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          textAlign: 'center',
          paddingTop: 50,
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          color: tokens.heroHeading,
        }}
      >
        Every commit linked to strategy.
      </div>
      <svg
        width={1280}
        height={720}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* RC -> DO lines */}
        {doBoxes.map((d, i) => {
          const x1 = rcBox.x + rcBox.w / 2;
          const y1 = rcBox.y + rcBox.h;
          const x2 = d.x + d.w / 2;
          const y2 = d.y;
          const t = lineDraw(28 + i * 2);
          return (
            <line
              key={`rcdo-${i}`}
              x1={x1}
              y1={y1}
              x2={x1 + (x2 - x1) * t}
              y2={y1 + (y2 - y1) * t}
              stroke={tokens.panelBorder}
              strokeWidth={1.5}
            />
          );
        })}
        {/* DO -> O lines (only middle DO branches) */}
        {oBoxes.map((o, i) => {
          const d = doBoxes[1];
          if (!d) return null;
          const x1 = d.x + d.w / 2;
          const y1 = d.y + d.h;
          const x2 = o.x + o.w / 2;
          const y2 = o.y;
          const t = lineDraw(43 + i * 2);
          return (
            <line
              key={`do-o-${i}`}
              x1={x1}
              y1={y1}
              x2={x1 + (x2 - x1) * t}
              y2={y1 + (y2 - y1) * t}
              stroke={tokens.panelBorder}
              strokeWidth={1.5}
            />
          );
        })}
        {/* O -> SO lines */}
        {soBoxes.map((s, i) => {
          const o = oBoxes[i < 2 ? 0 : 1];
          if (!o) return null;
          const x1 = o.x + o.w / 2;
          const y1 = o.y + o.h;
          const x2 = s.x + s.w / 2;
          const y2 = s.y;
          const t = lineDraw(58 + i * 2);
          return (
            <line
              key={`o-so-${i}`}
              x1={x1}
              y1={y1}
              x2={x1 + (x2 - x1) * t}
              y2={y1 + (y2 - y1) * t}
              stroke={tokens.panelBorder}
              strokeWidth={1.5}
            />
          );
        })}
        {/* Boxes */}
        <NodeBox
          {...rcBox}
          label="RALLY CRY"
          caption="Become the alignment OS"
          opacity={rcOpacity}
        />
        <NodeBox {...doBoxes[0]!} label="DO 1" caption="Win mid-market" opacity={doOpacity} />
        <NodeBox
          {...doBoxes[1]!}
          label="DO 2"
          caption="Ship enterprise tier"
          opacity={doOpacity}
        />
        <NodeBox
          {...doBoxes[2]!}
          label="DO 3"
          caption="Operational excellence"
          opacity={doOpacity}
        />
        <NodeBox {...oBoxes[0]!} label="OUTCOME" caption="3.1" opacity={oOpacity} />
        <NodeBox {...oBoxes[1]!} label="OUTCOME" caption="3.2" opacity={oOpacity} />
        {soBoxes.map((s, i) => (
          <NodeBox
            key={`so-${i}`}
            {...s}
            label="SO"
            caption={`3.${i < 2 ? '1' : '2'}.${(i % 2) + 1}`}
            opacity={soOpacity}
            highlight={i === highlightedSoIdx}
          />
        ))}
        {/* Commit card */}
        <g opacity={commitOpacity}>
          <rect
            x={commitBox.x}
            y={commitBox.y}
            width={commitBox.w}
            height={commitBox.h}
            rx={8}
            fill={tokens.panelBg}
            stroke={tokens.accent}
            strokeWidth={1.5}
          />
          <text
            x={commitBox.x + 14}
            y={commitBox.y + 22}
            fontFamily={fontFamily}
            fontSize={11}
            fontWeight={600}
            letterSpacing="0.06em"
            fill={tokens.accent}
          >
            COMMIT
          </text>
          <text
            x={commitBox.x + 14}
            y={commitBox.y + 42}
            fontFamily={fontFamily}
            fontSize={13}
            fontWeight={500}
            fill={tokens.text}
          >
            Ship pricing v2 RFC
          </text>
        </g>
        {/* Arrow from SO[2] to commit */}
        {(() => {
          const so = soBoxes[highlightedSoIdx]!;
          const x1 = so.x + so.w;
          const y1 = so.y + so.h / 2;
          const x2 = commitBox.x;
          const y2 = commitBox.y + commitBox.h / 2;
          const xMid = (x1 + x2) / 2;
          const t = arrowDraw;
          const px = x1 + (x2 - x1) * t;
          const py = y1 + (y2 - y1) * t;
          return (
            <g>
              <path
                d={`M ${x1} ${y1} Q ${xMid} ${y1} ${px} ${py}`}
                stroke={tokens.accent}
                strokeWidth={1.5}
                fill="none"
                strokeOpacity={0.7}
              />
              {t > 0.95 ? (
                <polygon
                  points={`${x2},${y2} ${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4}`}
                  fill={tokens.accent}
                  opacity={0.7}
                />
              ) : null}
            </g>
          );
        })()}
      </svg>
    </AbsoluteFill>
  );
};
