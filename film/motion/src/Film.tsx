// Film.tsx — the layer. Every child is a pure function of (t, film, anchors) and returns null outside its window; the
// background is transparent because this layer is composited over the Blender render (scripts/stills.mjs, later the
// final composite). No CSS transitions, no state, no randomness.

import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { FilmData } from './data/load';
import { Fonts } from './Fonts';
import { Band } from './components/Band';
import { Callouts } from './components/Callouts';
import { EndCard } from './components/EndCard';
import { FaderTimecodes } from './components/FaderTimecodes';
import { FanChips } from './components/FanChips';
import { Flatten } from './components/Flatten';
import { Hook } from './components/Hook';
import { Hud } from './components/Hud';
import { PressRuler } from './components/PressRuler';
import { TabChip } from './components/TabChip';

export type FilmProps = Record<string, unknown> & {
  data: FilmData | null;
};

export const Film: React.FC<FilmProps> = ({ data }) => {
  const frame = useCurrentFrame();
  if (!data) return null;
  const { film, anchorsS2, extras } = data;
  const t = frame / film.fps;
  const ctx = { t, frame, film, anchorsS2, extras };
  return (
    <AbsoluteFill style={{ background: 'transparent', fontKerning: 'normal', WebkitFontSmoothing: 'antialiased' }}>
      <Fonts />
      <Hook {...ctx} />
      <Callouts {...ctx} />
      <FanChips {...ctx} />
      <PressRuler {...ctx} />
      <Flatten {...ctx} />
      <FaderTimecodes {...ctx} />
      <TabChip {...ctx} />
      <EndCard {...ctx} />
      <Band {...ctx} />
      <Hud {...ctx} />
    </AbsoluteFill>
  );
};

export type Ctx = {
  t: number;
  frame: number;
  film: FilmData['film'];
  anchorsS2: FilmData['anchorsS2'];
  extras: FilmData['extras'];
};
