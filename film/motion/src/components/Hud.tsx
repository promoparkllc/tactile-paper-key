// HUD — bottom-left, 64 px margin (above the dock in S8), on every frame: "0N / NAME" in Michroma 16 px and the mono timecode mm:ss:ff (16 px).
// Colour follows the scene's tone (cream on dark frames, ink on light ones); the contrast script measures it.

import type { Ctx } from '../Film';
import { formatTimecode, sceneAt } from '../data/scenes';
import { H, HUD_NAMES, STAGE, TYPE, hudBottom, px, textColor } from '../layout';
import { displayStyle, monoStyle } from './Type';

export const Hud: React.FC<Ctx> = ({ frame, film }) => {
  const scene = sceneAt(film, frame);
  if (!scene) return null;
  const color = textColor(scene.id);
  const name = HUD_NAMES[scene.id as keyof typeof HUD_NAMES] ?? scene.name.toUpperCase();
  return (
    <div style={{ position: 'absolute', left: px(STAGE.hud.x), top: px(H - hudBottom(scene.id) - TYPE.hudTime), display: 'flex', alignItems: 'baseline', gap: STAGE.hud.gap }}>
      <span style={{ ...displayStyle(TYPE.hudLabel, color), letterSpacing: '0.02em' }}>
        {String(scene.n).padStart(2, '0')} / {name}
      </span>
      <span style={monoStyle(TYPE.hudTime, color)}>{formatTimecode(frame, film.fps)}</span>
    </div>
  );
};
