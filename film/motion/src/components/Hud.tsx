// HUD — the scene label "0N / NAME" (Michroma 16 px) top-left at the 64 px margin on every frame, level with the Tab
// chip. No timecode: the player shows the time, and on the page its dock covers the bottom 140 px of the frame.
// Colour from HUD_TONE_RUNS (cream on dark frames, ink on light ones, switching on the measured frame).

import type { Ctx } from '../Film';
import { sceneAt } from '../data/scenes';
import { HUD_NAMES, STAGE, TYPE, hudColor, px } from '../layout';
import { displayStyle } from './Type';

export const Hud: React.FC<Ctx> = ({ frame, film }) => {
  const scene = sceneAt(film, frame);
  if (!scene) return null;
  const color = hudColor(frame);
  const name = HUD_NAMES[scene.id as keyof typeof HUD_NAMES] ?? scene.name.toUpperCase();
  return (
    <div style={{ position: 'absolute', left: px(STAGE.hud.x), top: px(STAGE.hud.top), ...displayStyle(TYPE.hudLabel, color), letterSpacing: '0.02em' }}>
      {String(scene.n).padStart(2, '0')} / {name}
    </div>
  );
};
