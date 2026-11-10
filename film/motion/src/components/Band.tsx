// Band — the double band (#FFA31A over #FF6A00, the live page's motif) crosses the frame once, left → right, over
// 500 ms with ease-in-out-quart, centred on the hook → exploded cut. Its only appearance in the film.

import type { Ctx } from '../Film';
import { sceneById } from '../data/scenes';
import { COLOR, H, STAGE, px } from '../layout';
import { MS } from '../motion';
import { bandLeadingEdge, bandStart } from '../timing';

export const Band: React.FC<Ctx> = ({ t, film }) => {
  const t0 = bandStart(film);
  if (t < t0 || t > t0 + MS.band / 1000) return null;
  const lead = bandLeadingEdge(t, film, STAGE.band.width);
  const left = px(lead - STAGE.band.width);
  return (
    <div style={{ position: 'absolute', left, top: 0, width: STAGE.band.width, height: H }}>
      <div style={{ height: H / 2, background: COLOR.amber }} />
      <div style={{ height: H / 2, background: COLOR.amberDeep }} />
    </div>
  );
};
