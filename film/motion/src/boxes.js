// boxes.js — where the text of each M1 still sits, for scripts/contrast.mjs. Boxes are generous: the script finds
// the real glyph pixels inside them through the overlay's alpha, so a box only has to contain its text and nothing
// else that is text. Positions mirror the components (layout.js + timing.js); widths use ADVANCE estimates.

import { anchorsAt } from './data/anchorsAt.js';
import { formatClock, formatTimecode, sceneAt } from './data/normalize.js';
import { ADVANCE, CODE_TEXT, END_SMALL, END_TITLE, FLATTEN_WORDS, FONT, H, HOOK_WORDS, HUD_NAMES, STAGE, TYPE, W, hudTop, textColor } from './layout.js';
import { MS } from './motion.js';
import { CALLOUT_ORDER, calloutTiming, capRun, flattenTiming, rulerTiming } from './timing.js';

const width = (text, size, font) => Math.ceil(text.length * size * ADVANCE[font]) + 8;

const hud = (film, frame) => {
  const scene = sceneAt(film, frame);
  const label = `${String(scene.n).padStart(2, '0')} / ${HUD_NAMES[scene.id] ?? scene.name}`;
  const w = width(label, TYPE.hudLabel, FONT.display) + STAGE.hud.gap + width(formatTimecode(frame, film.fps), TYPE.hudTime, FONT.mono);
  return { name: 'hud', x: STAGE.hud.x - 4, y: hudTop(scene.id) - 6, w, h: TYPE.hudTime + 12, color: textColor(scene.id, frame) };
};

export function boxesFor(still, frame, film, anchorsS2, anchorsS6 = null) {
  const t = frame / film.fps;
  const out = [hud(film, frame)];
  if (still === 'hook') {
    const lineH = TYPE.hook * 0.98;
    const top = STAGE.hook.baseline - 2 * lineH + TYPE.hook * 0.08;
    const color = textColor('S1');
    out.push({ name: 'EVERY', x: STAGE.hook.x - 4, y: top - 4, w: width(HOOK_WORDS[0], TYPE.hook, FONT.display), h: lineH + 8, color });
    out.push({ name: 'CONTROL (outline)', x: STAGE.hook.x - 4, y: top + lineH - 4, w: width(HOOK_WORDS[1], TYPE.hook, FONT.display), h: lineH + 8, color });
  }
  if (still === 'exploded') {
    const set = anchorsAt(anchorsS2, frame);
    const color = textColor('S2');
    if (set) {
      for (const key of CALLOUT_ORDER) {
        const a = set[key];
        const label = anchorsS2.labels?.[key];
        if (!a || !a.visible || !label) continue;
        const [dx, dy] = STAGE.callout.offsets[key];
        const lx = Math.round(a.x) + dx;
        const ly = Math.round(a.y) + dy;
        const w = width(label, TYPE.callout, FONT.mono);
        const x = dx < 0 ? lx - 8 - w : lx + 8 - 4;
        const y = dy < 0 ? ly - 6 - TYPE.callout - 4 : ly + 2 - 4;
        out.push({ name: `callout ${key}`, x, y, w: w + 8, h: TYPE.callout + 10, color });
      }
    }
  }
  if (still === 'press') {
    const R = STAGE.ruler;
    const pxPerMs = R.width / MS.rulerSpan;
    const { press } = rulerTiming(film);
    const color = textColor('S4');
    const y = R.y + R.labelGap;
    out.push({ name: 'ruler 0', x: R.x - 4, y, w: width('0', TYPE.rulerLabel, FONT.mono), h: TYPE.rulerLabel + 8, color });
    for (const m of R.marksMs) {
      const lit = t >= press + MS.rulerSpan / 1000 || t - press >= m / 1000;
      const label = `${m} ms`;
      const w = width(label, TYPE.rulerLabel, FONT.mono);
      out.push({ name: `ruler ${label}${lit ? ' (lit)' : ''}`, x: R.x + Math.round(m * pxPerMs) - w / 2, y, w, h: TYPE.rulerLabel + 8, color });
    }
  }
  if (still === 'flatten') {
    const color = textColor('S5');
    const size = TYPE.flattenTitle;
    const F = STAGE.flattenTitle;
    const wordW = (text) => text.length * size * 0.92;
    const objW = width(FLATTEN_WORDS[0], size, FONT.display);
    const titleX = Math.round(F.right - (wordW(FLATTEN_WORDS[0]) + F.gap + F.arrowLen + F.gap + wordW(FLATTEN_WORDS[1])));
    const arrowX = Math.round(titleX + wordW(FLATTEN_WORDS[0]) + F.gap);
    const ifaceX = arrowX + F.arrowLen + F.gap;
    out.push({ name: 'OBJECT', x: titleX - 4, y: F.y - 4, w: objW, h: size + 8, color });
    out.push({ name: 'INTERFACE (outline)', x: ifaceX - 4, y: F.y - 4, w: width(FLATTEN_WORDS[1], size, FONT.display), h: size + 8, color });
    const { code } = flattenTiming(film);
    const lines = CODE_TEXT.split('\n');
    const lineH = TYPE.code * TYPE.codeLineHeight;
    const typedFrames = Math.floor((t - code) * film.fps) + 1;
    let budget = typedFrames;
    lines.forEach((line, i) => {
      const glyphs = line.replace(/\s/g, '').length;
      if (budget <= 0) return;
      budget -= glyphs;
      out.push({ name: `code line ${i + 1}`, x: STAGE.code.x - 4, y: STAGE.code.y + i * lineH - 2, w: width(line, TYPE.code, FONT.mono) + 8, h: lineH + 4, color });
    });
  }
  if (still === 'fader') {
    const color = textColor('S6');
    const F = STAGE.fader;
    const live = anchorsAt(anchorsS6, frame);
    const run = capRun(film, anchorsS6);
    const cap = live?.cap;
    if (run && cap && cap.visible && frame >= run.first && frame <= run.last) {
      const w = width(formatClock(t), TYPE.timecode, FONT.mono);
      const x = Math.min(Math.max(cap.x, F.edgeMargin), W - F.edgeMargin) - w / 2;
      out.push({ name: 'current time (cap)', x: x - 4, y: cap.y - F.capRise - TYPE.timecode - 6, w: w + 8, h: TYPE.timecode + 12, color });
    }
    const end = live?.groove_end;
    if (end && end.visible && end.x > F.edgeMargin && end.x < W - F.edgeMargin) {
      out.push({ name: 'duration (groove end)', x: end.x + F.endGap - 4, y: end.y - TYPE.timecode / 2 - 6, w: width(film.seek.timeDur, TYPE.timecode, FONT.mono) + 8, h: TYPE.timecode + 12, color });
    }
  }
  if (still === 'end') {
    const color = textColor('END');
    const E = STAGE.end;
    const lineH = TYPE.endTitle * 0.98;
    const top = E.titleBaseline - 2 * lineH + TYPE.endTitle * 0.08;
    out.push({ name: 'TACTILE', x: E.x - 4, y: top - 4, w: width(END_TITLE[0], TYPE.endTitle, FONT.display), h: lineH + 8, color });
    out.push({ name: 'PAPER KEY (outline)', x: E.x - 4, y: top + lineH - 4, w: width(END_TITLE[1], TYPE.endTitle, FONT.display), h: lineH + 8, color });
    out.push({ name: 'small row', x: E.x - 4, y: E.titleBaseline + E.smallRowGap - 4, w: width(END_SMALL, TYPE.endSmall, FONT.sans), h: TYPE.endSmall * 1.3 + 8, color });
  }
  return out.map((b) => ({ ...b, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }));
}

export { formatClock };
