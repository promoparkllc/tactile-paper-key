// Tab chip — over the live capture a "TAB" key (kbd style: 1.25 px ring, radius 8, mono) presses with the skin's own
// curve (70 ms down, 200 ms back) every time the focus ring hops. Hop frames from scenes.json events.tab_hops; until
// the capture is scripted, one hop per beat from half a beat after the hard cut.

import type { Ctx } from '../Film';
import { sceneById } from '../data/scenes';
import { STAGE, TAB_LABEL, TYPE, px, textColor } from '../layout';
import { pressDepth } from '../motion';
import { tabHops } from '../timing';
import { monoStyle } from './Type';

export const TabChip: React.FC<Ctx> = ({ t, frame, film }) => {
  const s8 = sceneById(film, 'S8');
  if (frame < film.hardCut || frame > s8.end) return null;
  const color = textColor(s8.id, frame); // cream on the dark field, ink once the clip has faded in
  const depth = Math.max(0, ...tabHops(film).map((f: number) => pressDepth(t, f / film.fps)));
  const down = Math.round(2 * depth);
  const T = STAGE.tab;
  return (
    <div
      style={{
        position: 'absolute',
        right: px(T.right),
        top: px(T.top),
        height: T.height,
        padding: `0 ${T.padX}px`,
        borderRadius: T.radius,
        border: `1.25px solid ${color}`,
        boxShadow: `0 ${2 - down}px 0 ${color}`,
        transform: `translateY(${down}px)`,
        display: 'grid',
        placeItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <span style={monoStyle(TYPE.tab, color)}>{TAB_LABEL}</span>
    </div>
  );
};
