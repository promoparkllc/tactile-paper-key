// End card — "TACTILE" filled, "PAPER KEY" outlined (both one letter per frame), the small row in Instrument Sans,
// then three 64 px keys (dock proportions) on their own row under the small row press on beats 1, 2, 3 with the skin's curve. Ink on the bone field the composite lays
// under this scene. No CTA, no URL beyond the small row.

import type { Ctx } from '../Film';
import { END_SMALL, END_TITLE, STAGE, TYPE, px, textColor } from '../layout';
import { MS, lettersShown, pressDepth, ramp } from '../motion';
import { endTiming } from '../timing';
import { DisplayWord, KeyCap, sansStyle } from './Type';

export const EndCard: React.FC<Ctx> = ({ t, frame, film }) => {
  const { end, w1, w2, small, keys } = endTiming(film);
  if (frame < end.start || frame > end.end || t < w1) return null;
  const color = textColor(end.id);
  const E = STAGE.end;
  const lineH = TYPE.endTitle * 0.98;
  const top = px(E.titleBaseline - 2 * lineH + TYPE.endTitle * 0.08);
  const smallP = ramp(t, small, MS.smallRow, 'outQuint');
  return (
    <>
      <div style={{ position: 'absolute', left: px(E.x), top, display: 'flex', flexDirection: 'column' }}>
        <DisplayWord text={END_TITLE[0]} shown={lettersShown(t, w1, END_TITLE[0], film.fps)} size={TYPE.endTitle} color={color} />
        <DisplayWord text={END_TITLE[1]} shown={lettersShown(t, w2, END_TITLE[1], film.fps)} size={TYPE.endTitle} color={color} outline fill={0} />
      </div>
      {t >= small ? (
        <div style={{ position: 'absolute', left: px(E.x), top: px(E.titleBaseline + E.smallRowGap), clipPath: `inset(0 ${Math.round((1 - smallP) * 100)}% 0 0)` }}>
          <span style={sansStyle(TYPE.endSmall, color, 500)}>{END_SMALL}</span>
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: px(E.x), top: px(E.keys.top), display: 'flex', gap: E.keys.gap }}>
        {keys.map((tk, i) => (
          <KeyCap key={i} size={E.keys.size} depth={pressDepth(t, tk)} accent={i === 0} />
        ))}
      </div>
    </>
  );
};
