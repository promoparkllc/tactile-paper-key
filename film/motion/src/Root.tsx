// Root.tsx — compositions: "Film" (the explainer's layer; duration and fps from the synced scenes.json) and the two
// Contra presentation formats ("Contra16x9", "Contra4x5"; 45 s on the same 120 BPM grid, captures from a manifest).

import { Composition, staticFile } from 'remotion';
import { Film, type FilmProps } from './Film';
import { Contra, type ContraProps, type Manifest } from './contra/Contra';
import { FPS as CONTRA_FPS, FRAMES as CONTRA_FRAMES, LAYOUTS, MANIFEST } from './contra/config';
import { loadFilmData } from './data/load';
import { H, W } from './layout';

const contraMetadata = async ({ props }: { props: ContraProps }) => {
  let manifest: Manifest = null;
  try {
    const r = await fetch(staticFile(MANIFEST));
    if (r.ok) manifest = (await r.json()) as Manifest;
  } catch {
    manifest = null;
  }
  let hasMusic = false;
  try {
    const r = await fetch(staticFile('contra/music.wav'), { method: 'HEAD' });
    hasMusic = r.ok;
  } catch {
    hasMusic = false;
  }
  return { props: { ...props, manifest, hasMusic } };
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="Film"
      component={Film}
      width={W}
      height={H}
      fps={30}
      durationInFrames={780}
      defaultProps={{ data: null } as FilmProps}
      calculateMetadata={async ({ props }) => {
        const data = await loadFilmData();
        return {
          durationInFrames: data.film.frames,
          fps: data.film.fps,
          props: { ...props, data },
        };
      }}
    />
    <Composition id="Contra16x9" component={Contra} width={LAYOUTS['16:9'].width} height={LAYOUTS['16:9'].height} fps={CONTRA_FPS} durationInFrames={CONTRA_FRAMES} defaultProps={{ aspect: '16:9', manifest: null, hasMusic: false } as ContraProps} calculateMetadata={contraMetadata} />
    <Composition id="Contra4x5" component={Contra} width={LAYOUTS['4:5'].width} height={LAYOUTS['4:5'].height} fps={CONTRA_FPS} durationInFrames={CONTRA_FRAMES} defaultProps={{ aspect: '4:5', manifest: null, hasMusic: false } as ContraProps} calculateMetadata={contraMetadata} />
  </>
);
