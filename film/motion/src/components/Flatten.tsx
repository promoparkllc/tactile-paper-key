// Flatten — "OBJECT → INTERFACE" right-aligned on the flat side and revealed by the wipe (INTERFACE as an outline,
// filled when the wipe completes), the 2 px accent band on the wipe front, the 8 px grid revealed on the flat side,
// and the CSS block (below the dock) typing one glyph per frame with a 2 blink/s cursor. Everything Remotion draws in
// this shot sits on the interface side: the 3D side keeps the window bars, where ink measures 2.5–4.1:1. The wipe front comes from wipe_edge.json when the 3D side
// exports it; otherwise FALLBACK_WIPE follows the Blender key (quart in-out over the wipe frames) with SF5's slant.

import type { Ctx } from '../Film';
import { wipeEdgeAt } from '../data/anchors';
import { CODE_TEXT, COLOR, FLATTEN_WORDS, H, STAGE, TYPE, W, px, textColor } from '../layout';
import { MS, blinkOn, lettersShown, opacity, ramp, typedPrefix } from '../motion';
import { flattenTiming, wipeFallback } from '../timing';
import { DisplayWord, monoStyle } from './Type';

export const Flatten: React.FC<Ctx> = (ctx) => {
  const { t, frame, film, extras } = ctx;
  const { s5, object, arrow, iface, fill, code, exit } = flattenTiming(film);
  if (frame < s5.start || frame > s5.end || t < object) return null;
  const color = textColor(s5.id);
  const fade = opacity(t, object, exit, film.fps);
  const edge = wipeEdgeAt(extras.wipeEdge, frame) ?? wipeFallback(film, t);
  const flatSide = `${edge.xTop},0 ${W + 4},0 ${W + 4},${H} ${edge.xBottom},${H}`;
  const pitch = extras.pxPerMmS5 ? 8 * extras.pxPerMmS5 : STAGE.grid.pitchPx;
  const arrowP = ramp(t, arrow, MS.leader, 'outQuint');
  const typed = typedPrefix(t, code, CODE_TEXT, film.fps, MS.codeCharsPerFrame);
  const lines = typed.split('\n');
  const lineH = TYPE.code * TYPE.codeLineHeight;
  const cursorOn = t >= code && blinkOn(t, code);
  const F = STAGE.flattenTitle;
  const wordW = (text: string) => text.length * TYPE.flattenTitle * 0.92;
  const arrowLen = F.arrowLen;
  const titleX = px(F.right - (wordW(FLATTEN_WORDS[0]) + F.gap + arrowLen + F.gap + wordW(FLATTEN_WORDS[1])));
  const arrowX = px(titleX + wordW(FLATTEN_WORDS[0]) + F.gap);
  const ifaceX = arrowX + arrowLen + F.gap;
  const flatClip = `polygon(${edge.xTop}px 0, ${W}px 0, ${W}px ${H}px, ${edge.xBottom}px ${H}px)`;
  const titleY = px(F.y);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <pattern id="grid8" width={pitch} height={pitch} patternUnits="userSpaceOnUse">
            <path d={`M ${pitch} 0 L 0 0 0 ${pitch}`} fill="none" stroke={COLOR.ink} strokeWidth={1} opacity={STAGE.grid.inkAlpha} />
          </pattern>
          <clipPath id="flatSide">
            <polygon points={flatSide} />
          </clipPath>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill="url(#grid8)" clipPath="url(#flatSide)" />
        {edge.xTop > -2 && edge.xTop < W + 2 ? <line x1={edge.xTop} y1={0} x2={edge.xBottom} y2={H} stroke={COLOR.accent} strokeWidth={2} /> : null}
        {t >= arrow ? (
          <g stroke={color} strokeWidth={3} fill="none" strokeLinecap="square" clipPath="url(#flatSide)">
            <line x1={arrowX} y1={titleY + TYPE.flattenTitle * 0.5} x2={arrowX + arrowLen * arrowP} y2={titleY + TYPE.flattenTitle * 0.5} />
            {arrowP > 0.99 ? <path d={`M ${arrowX + arrowLen - 18} ${titleY + TYPE.flattenTitle * 0.5 - 18} l 18 18 l -18 18`} /> : null}
          </g>
        ) : null}
      </svg>
      <div style={{ position: 'absolute', inset: 0, clipPath: flatClip }}>
        <div style={{ position: 'absolute', left: titleX, top: titleY }}>
          <DisplayWord text={FLATTEN_WORDS[0]} shown={lettersShown(t, object, FLATTEN_WORDS[0], film.fps)} size={TYPE.flattenTitle} color={color} />
        </div>
        <div style={{ position: 'absolute', left: ifaceX, top: titleY }}>
          <DisplayWord
            text={FLATTEN_WORDS[1]}
            shown={lettersShown(t, iface, FLATTEN_WORDS[1], film.fps)}
            size={TYPE.flattenTitle}
            color={color}
            outline
            fill={ramp(t, fill, MS.fill, 'outCubic')}
          />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, clipPath: flatClip }}>
        <div style={{ position: 'absolute', left: px(STAGE.code.x), top: px(STAGE.code.y), ...monoStyle(TYPE.code, color), lineHeight: TYPE.codeLineHeight }}>
          {lines.map((line: string, i: number) => (
            <div key={i} style={{ height: lineH, display: 'flex', alignItems: 'center' }}>
              <span>{line}</span>
              {i === lines.length - 1 && cursorOn && typed.length < CODE_TEXT.length ? (
                <span style={{ display: 'inline-block', width: 2, height: TYPE.code * 1.15, background: color, marginLeft: 2 }} />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
