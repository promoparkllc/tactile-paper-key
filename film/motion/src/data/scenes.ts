// scenes.ts — types for the contract with the 3D session; the logic lives in normalize.js (plain JS, shared with the
// node scripts). Everything about *when* comes from film/scenes.json, exported from the Blender retiming on the
// 120 BPM grid. Frames are 0-based after normalisation (Blender frame 1 = Remotion frame 0).

import * as N from './normalize.js';

export interface Scene {
  id: string; // S1…S8, END
  n: number; // 1…9 for the HUD
  name: string;
  start: number; // 0-based, inclusive
  end: number; // 0-based, inclusive
}

export interface Events {
  explode: [number, number, number, number]; // apart start, apart end (hold starts), together start, together end
  fan: [number, number];
  boneUp: [number, number];
  press: number;
  latch: [number, number]; // the press latches (the accent rim; `led` in older exports)
  keysFlat: Record<string, number>; // each flatten ENDS on its frame
  flatLen: number;
  wipe: [number, number];
  capSlide: [number, number];
  faderFlat: [number, number];
  displayOn: [number, number];
  displayFlat: [number, number];
  dockFlat: [number, number];
  morph: number;
  tabHops?: number[]; // live capture: frames where the focus ring hops (optional)
}

export interface Seek {
  from: number;
  fill: number;
  end: number;
  timeDur: string; // what the display shows as duration, e.g. "0:26"
}

export interface Film {
  fps: number;
  bpm: number;
  fpb: number;
  frames: number; // total frames of the film (end card included)
  hardCut: number; // 0-based frame where the live capture starts
  filmSeconds: number;
  scenes: Scene[];
  events: Events;
  seek: Seek;
  source: string;
  raw: Record<string, unknown>;
}

export const normalizeFilm = N.normalizeFilm as (raw: Record<string, unknown>, source?: string) => Film;
export const sceneById = N.sceneById as (film: Film, id: string) => Scene;
export const sceneAt = N.sceneAt as (film: Film, frame: number) => Scene | undefined;
export const beatFrame = N.beatFrame as (film: Film, k: number) => number;
export const formatClock = N.formatClock as (seconds: number) => string;
export const formatTimecode = N.formatTimecode as (frame: number, fps: number) => string;
