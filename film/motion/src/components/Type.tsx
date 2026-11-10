// Type.tsx — display words (Michroma, uppercase, one letter per frame, outline → fill) and mono labels. Text that
// holds sits on whole pixels: every position passes through px(). Letters that have not landed keep their box
// (visibility hidden), so nothing reflows while a word builds.

import type { CSSProperties } from 'react';
import { COLOR, FONT, px } from '../layout';
import { OUTLINE_STROKE_PX } from '../motion';

export const displayStyle = (size: number, color: string): CSSProperties => ({
  fontFamily: `${FONT.display}, sans-serif`,
  fontWeight: 400,
  fontSize: size,
  lineHeight: 0.98,
  letterSpacing: '-0.03em',
  textTransform: 'uppercase',
  color,
  whiteSpace: 'nowrap',
});

export const monoStyle = (size: number, color: string, weight: 500 | 600 = 500): CSSProperties => ({
  fontFamily: `${FONT.mono}, monospace`,
  fontWeight: weight,
  fontSize: size,
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
  color,
  whiteSpace: 'pre',
});

export const sansStyle = (size: number, color: string, weight: 400 | 500 | 600 = 400): CSSProperties => ({
  fontFamily: `${FONT.sans}, sans-serif`,
  fontWeight: weight,
  fontSize: size,
  lineHeight: 1.3,
  color,
  whiteSpace: 'nowrap',
});

interface WordProps {
  text: string;
  shown: number; // letters landed
  size: number;
  color: string;
  outline?: boolean; // draw as 1.5 px stroke
  fill?: number; // 0..1 fill over the outline (opacity of the filled copy; never springs)
  style?: CSSProperties;
}

/** A display word. Outline words carry the stroke; `fill` lays the solid word over it. */
export const DisplayWord: React.FC<WordProps> = ({ text, shown, size, color, outline = false, fill = 1, style }) => {
  const letters = (visibleColor: string, stroke: boolean) =>
    Array.from(text).map((ch, i) => (
      <span
        key={i}
        style={{
          visibility: i < shown ? 'visible' : 'hidden',
          color: stroke ? 'transparent' : visibleColor,
          WebkitTextStroke: stroke ? `${OUTLINE_STROKE_PX}px ${visibleColor}` : undefined,
        }}
      >
        {ch === ' ' ? ' ' : ch}
      </span>
    ));
  return (
    <span style={{ position: 'relative', display: 'inline-block', ...displayStyle(size, color), ...style }}>
      {outline ? (
        <>
          <span style={{ display: 'inline-block' }}>{letters(color, true)}</span>
          <span style={{ position: 'absolute', left: 0, top: 0, opacity: fill }}>{letters(color, false)}</span>
        </>
      ) : (
        letters(color, false)
      )}
    </span>
  );
};

interface AtProps {
  x: number;
  y: number;
  children: React.ReactNode;
  style?: CSSProperties;
  anchor?: 'left' | 'right' | 'center';
}

/** Absolute placement on whole pixels. */
export const At: React.FC<AtProps> = ({ x, y, children, style, anchor = 'left' }) => (
  <div
    style={{
      position: 'absolute',
      left: anchor === 'right' ? undefined : px(x),
      right: anchor === 'right' ? px(1920 - x) : undefined,
      top: px(y),
      transform: anchor === 'center' ? 'translateX(-50%)' : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);

/** A keycap drawn like the skin: face, 1.25 px ring, 2 px shade that collapses with the press depth (0..1). */
export const KeyCap: React.FC<{ size: number; depth: number; accent?: boolean; children?: React.ReactNode }> = ({
  size,
  depth,
  accent = false,
  children,
}) => {
  const face = accent ? COLOR.accent : COLOR.keyFace;
  const shade = accent ? '#8F3210' : COLOR.keyShade;
  const down = Math.round(2 * depth);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: face,
        boxSizing: 'border-box',
        border: `1.25px solid ${COLOR.ring}`,
        boxShadow: `0 ${2 - down}px 0 ${shade}`,
        transform: `translateY(${down}px)`,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {children}
    </div>
  );
};
