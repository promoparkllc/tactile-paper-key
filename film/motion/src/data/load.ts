// load.ts — fetches the synced data from public/data (scripts/sync-data.mjs copies it there from film/). Runs inside
// Remotion's calculateMetadata, so the composition's duration and fps are the export's, never a constant.

import { staticFile } from 'remotion';
import type { AnchorSet, Extras, WipeEdgeSet } from './anchors';
import { normalizeFilm, type Film } from './scenes';

async function json<T>(path: string, optional = false): Promise<T | null> {
  const res = await fetch(staticFile(path));
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`${path} not found — run \`npm run sync\` (copies film/scenes.json + anchors into public/data)`);
  }
  return (await res.json()) as T;
}

export interface FilmData {
  film: Film;
  anchorsS2: AnchorSet;
  extras: Extras;
}

export async function loadFilmData(): Promise<FilmData> {
  const [source, scenes, anchorsS2, anchorsS3, anchorsS6, wipeEdge] = await Promise.all([
    json<{ scenes: string; fixture: boolean }>('data/_source.json', true),
    json<Record<string, unknown>>('data/scenes.json'),
    json<AnchorSet>('data/anchors_s2.json'),
    json<AnchorSet>('data/anchors_s3.json', true),
    json<AnchorSet>('data/anchors_s6.json', true),
    json<WipeEdgeSet>('data/wipe_edge.json', true),
  ]);
  const film = normalizeFilm(scenes!, source?.scenes ?? 'public/data/scenes.json');
  const pxPerMm = (scenes as Record<string, unknown>)?.px_per_mm_s5 as number | undefined;
  return {
    film,
    anchorsS2: anchorsS2!,
    extras: { anchorsS3, anchorsS6, wipeEdge, pxPerMmS5: pxPerMm ?? null },
  };
}
