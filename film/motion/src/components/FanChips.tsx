// Fan chips — under each glaze cap a chip with its hex (filled with the glaze, text cream or ink by measured
// contrast), revealed top → bottom over 300 ms, 120 ms apart in the order the fan opens; the bone chip lands when the
// bone cap has risen. Above the fan the mono line "--media-accent-color" types one glyph per frame.

import type { Ctx } from '../Film';
import { anchorsAt } from '../data/anchors';
import { sceneById } from '../data/scenes';
import { COLOR, FALLBACK_FAN, FAN_LINE, STAGE, TYPE, W, px, textColor } from '../layout';
import { MS, STAGGER_FRAMES, contrast, opacity, ramp, typedPrefix } from '../motion';
import { fanTiming } from '../timing';
import { At, monoStyle } from './Type';

export const FanChips: React.FC<Ctx> = ({ t, frame, film, extras }) => {
  const s3 = sceneById(film, 'S3');
  if (frame < s3.start || frame > s3.end) return null;
  const { line, chips, bone, exit } = fanTiming(film);
  const color = textColor(s3.id);
  const fade = opacity(t, line, exit, film.fps);
  const live = anchorsAt(extras.anchorsS3, frame);
  const pos = (name: string): [number, number] | null => {
    if (live) {
      const a = live[`${name}_center`] ?? live[name];
      return a && a.visible ? [a.x, a.y] : null;
    }
    const fb = FALLBACK_FAN.pos[name as keyof typeof FALLBACK_FAN.pos];
    return fb ? [fb[0], fb[1]] : null;
  };
  const stagger = STAGGER_FRAMES.chip / film.fps;
  const order = FALLBACK_FAN.order;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fade }}>
      <At x={W / 2} y={STAGE.fanLine.y} anchor="center">
        <span style={monoStyle(TYPE.fanLine, color)}>{typedPrefix(t, line, FAN_LINE, film.fps)}</span>
      </At>
      {order.map((name, i) => {
        const p0 = pos(name);
        if (!p0) return null;
        const ti = name === 'bone' ? bone : chips + i * stagger;
        if (t < ti) return null;
        const p = ramp(t, ti, MS.chipReveal, 'outQuint');
        const hex = COLOR.glazes[name as keyof typeof COLOR.glazes];
        const textOn = contrast(hex, COLOR.cream) >= 4.5 ? COLOR.cream : COLOR.ink;
        const text = hex.toUpperCase();
        const w = px(text.length * TYPE.chip * 0.6 + 2 * STAGE.chips.padX);
        return (
          <div
            key={name}
            style={{
              position: 'absolute',
              left: px(p0[0] - w / 2),
              top: px(p0[1] + STAGE.chips.dy),
              width: w,
              height: STAGE.chips.height,
              borderRadius: STAGE.chips.radius,
              background: hex,
              border: `1.25px solid ${color}`,
              boxSizing: 'border-box',
              display: 'grid',
              placeItems: 'center',
              clipPath: `inset(0 0 ${Math.round((1 - p) * 100)}% 0)`,
            }}
          >
            <span style={monoStyle(TYPE.chip, textOn)}>{text}</span>
          </div>
        );
      })}
    </div>
  );
};
