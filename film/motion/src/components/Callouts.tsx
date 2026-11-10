// Callouts — exploded view. For every anchor in anchors_s2.json a 1 px leader draws from the piece toward the label
// (stroke-dashoffset, 250 ms, ease-out-quint), then the mono label types two glyphs per frame. Callouts start 60 ms
// apart and all leave together (200 ms, ease-in-expo) 8 frames before the parts rejoin; one whose anchor would leave
// the frame earlier goes 6 frames before that.
// Only anchors on frame get a callout. They enter 5 frames before the hold (f101): on f91–100 the cap and display
// pieces still cross each other in the final framing.

import type { Ctx } from '../Film';
import { anchorsAt } from '../data/anchors';
import { sceneById } from '../data/scenes';
import { STAGE, TYPE, px, textColor } from '../layout';
import { MS, ramp, typedPrefix } from '../motion';
import { CALLOUT_ORDER, calloutExit, calloutTiming } from '../timing';
import { monoStyle } from './Type';

export const Callouts: React.FC<Ctx> = ({ t, frame, film, anchorsS2 }) => {
  const s2 = sceneById(film, 'S2');
  const { start, exit, stagger } = calloutTiming(film, anchorsS2.labels);
  if (t < start || t > exit + MS.exit / 1000) return null;
  const set = anchorsAt(anchorsS2, frame);
  if (!set) return null;
  const color = textColor(s2.id);
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }} shapeRendering="geometricPrecision">
      {CALLOUT_ORDER.map((key: string, i: number) => {
        const a = set[key];
        const label = anchorsS2.labels?.[key] ?? '';
        if (!a || !a.visible || !label) return null;
        const ti = start + i * stagger;
        if (t < ti) return null;
        const exitKey = calloutExit(film, anchorsS2, key, frame, exit);
        const out = 1 - ramp(t, exitKey, MS.exit, 'inExpo');
        if (out <= 0) return null;
        const [dx, dy] = STAGE.callout.offsets[key as keyof typeof STAGE.callout.offsets] ?? [60, -100];
        const ax = px(a.x) + 0.5;
        const ay = px(a.y) + 0.5;
        const lx = ax + dx;
        const ly = ay + dy;
        const len = Math.hypot(dx, dy);
        const p = ramp(t, ti, MS.leader, 'outQuint');
        const typed = typedPrefix(t, ti + MS.leader / 1000, label, film.fps, MS.calloutCharsPerFrame);
        const anchorEnd = dx < 0 ? 'end' : 'start';
        return (
          <g key={key} opacity={out}>
            <circle cx={ax} cy={ay} r={STAGE.callout.dot} fill="none" stroke={color} strokeWidth={1.25} />
            <line x1={ax} y1={ay} x2={lx} y2={ly} stroke={color} strokeWidth={1} strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
            <text
              x={px(lx) + (dx < 0 ? -8 : 8)}
              y={px(ly) + (dy < 0 ? -6 : TYPE.callout + 2)}
              textAnchor={anchorEnd}
              style={{ ...monoStyle(TYPE.callout, color), fill: color }}
            >
              {typed}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
