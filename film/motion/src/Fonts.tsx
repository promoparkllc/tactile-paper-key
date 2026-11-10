// Fonts.tsx — the three families from public/fonts, loaded through the FontFace API under delayRender, so no frame
// renders before the glyphs exist. Network stays off: the files are local copies (Google Fonts statics + Geist Mono).

import { useEffect } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';
import { FONT } from './layout';

const FACES: Array<[string, string, number]> = [
  [FONT.display, 'fonts/Michroma-Regular.ttf', 400],
  [FONT.sans, 'fonts/InstrumentSans-Regular.ttf', 400],
  [FONT.sans, 'fonts/InstrumentSans-Medium.ttf', 500],
  [FONT.sans, 'fonts/InstrumentSans-SemiBold.ttf', 600],
  [FONT.mono, 'fonts/GeistMono-Medium.ttf', 500],
  [FONT.mono, 'fonts/GeistMono-SemiBold.ttf', 600],
];

let loading: Promise<void> | null = null;
const loadAll = (): Promise<void> => {
  if (!loading) {
    loading = Promise.all(
      FACES.map(([family, file, weight]) => {
        const face = new FontFace(family, `url(${staticFile(file)})`, { weight: String(weight) });
        return face.load().then((f) => {
          document.fonts.add(f);
        });
      }),
    ).then(() => undefined);
  }
  return loading;
};

export const Fonts: React.FC = () => {
  useEffect(() => {
    const handle = delayRender('fonts');
    loadAll().then(
      () => continueRender(handle),
      (err) => {
        throw err;
      },
    );
  }, []);
  return null;
};
