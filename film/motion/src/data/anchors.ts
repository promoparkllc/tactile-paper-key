// anchors.ts — screen-space anchors exported by the 3D side (film/anchors_s2.json and the optional anchors_s3 /
// anchors_s6 / wipe_edge exports share the shape). Keys are Blender frames (1-based); positions are px in `size`.

export interface Anchor {
  x: number;
  y: number;
  visible: boolean;
}

export interface AnchorSet {
  size: [number, number];
  fps: number;
  labels?: Record<string, string>;
  frames: Record<string, Record<string, Anchor>>;
}

export interface WipeEdgeSet {
  size?: [number, number];
  frames: Record<string, { x_top: number; x_bottom: number }>;
}

export interface Extras {
  anchorsS3?: AnchorSet | null; // keys: <glaze>_center / <glaze>_top (graphite, stone, bone, orange, yellow)
  anchorsS6?: AnchorSet | null; // keys: groove_start, groove_end, cap
  wipeEdge?: WipeEdgeSet | null; // per frame: x_top, x_bottom of the wipe front in px
  pxPerMmS5?: number | null; // screen px per mm in the flatten shot (8 mm grid → px)
}

import { anchorsAt as anchorsAtJs } from './anchorsAt.js';

/** Anchors for a 0-based frame; tolerates a ±2 frame gap in the export. null when the export does not cover it. */
export const anchorsAt = anchorsAtJs as (set: AnchorSet | null | undefined, frame0: number) => Record<string, Anchor> | null;

export const anchorRange = (set: AnchorSet | null | undefined): [number, number] | null => {
  if (!set) return null;
  const ks = Object.keys(set.frames).map(Number);
  return ks.length ? [Math.min(...ks) - 1, Math.max(...ks) - 1] : null;
};

export function wipeEdgeAt(set: WipeEdgeSet | null | undefined, frame0: number): { xTop: number; xBottom: number } | null {
  if (!set) return null;
  const hit = set.frames[String(frame0 + 1)];
  return hit ? { xTop: hit.x_top, xBottom: hit.x_bottom } : null;
}
