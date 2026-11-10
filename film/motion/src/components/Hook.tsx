// Hook — "EVERY / CONTROL", left, baseline ≈ 540. Words land one letter per frame, word 2 starts 90 ms after word 1;
// CONTROL arrives as a 1.5 px outline and fills over 300 ms after a 300 ms beat. The title leaves under the band:
// the part of it the band has covered is clipped away (no fade, no slide).

import type { Ctx } from '../Film';
import { HOOK_WORDS, STAGE, TYPE, px, textColor } from '../layout';
import { MS, lettersShown, ramp } from '../motion';
import { sceneById } from '../data/scenes';
import { bandLeadingEdge, hookTiming } from '../timing';
import { DisplayWord } from './Type';

export const Hook: React.FC<Ctx> = ({ t, film }) => {
  const s2 = sceneById(film, 'S2');
  const { s1, w1, w2, fillStart } = hookTiming(film);
  if (t < w1 || t > (s2.start + 1) / film.fps + MS.band / 1000) return null;
  const color = textColor(s1.id);
  const lead = bandLeadingEdge(t, film, STAGE.band.width);
  const clipLeft = Math.max(0, lead - STAGE.hook.x);
  const lineH = TYPE.hook * 0.98;
  const top = px(STAGE.hook.baseline - 2 * lineH + TYPE.hook * 0.08);
  return (
    <div
      style={{
        position: 'absolute',
        left: px(STAGE.hook.x),
        top,
        display: 'flex',
        flexDirection: 'column',
        clipPath: clipLeft > 0 ? `inset(0 0 0 ${px(clipLeft)}px)` : undefined,
      }}
    >
      <DisplayWord text={HOOK_WORDS[0]} shown={lettersShown(t, w1, HOOK_WORDS[0], film.fps)} size={TYPE.hook} color={color} />
      <DisplayWord
        text={HOOK_WORDS[1]}
        shown={lettersShown(t, w2, HOOK_WORDS[1], film.fps)}
        size={TYPE.hook}
        color={color}
        outline
        fill={ramp(t, fillStart, MS.fill, 'outCubic')}
      />
    </div>
  );
};
