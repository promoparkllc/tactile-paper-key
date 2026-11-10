// Press ruler — a time ruler under the key, graduated like videojs.org's data bars (1 px lines at a 4 px pitch):
// 600 px = 300 ms, a taller line every 50 ms, two 2 px marks at 70 ms and 200 ms. It draws left → right over 400 ms;
// from the press frame a 2 px playhead runs in real time and each mark lights (accent) as the key's travel passes it.
// Labels stay ink and go SemiBold when lit: accent text on a light frame measures 2.9:1, below the 4.5:1 floor.

import type { Ctx } from '../Film';
import { COLOR, STAGE, TYPE, px, textColor } from '../layout';
import { MS, linear, opacity, ramp } from '../motion';
import { rulerTiming } from '../timing';
import { monoStyle } from './Type';

export const PressRuler: React.FC<Ctx> = ({ t, frame, film }) => {
  const { s4, draw, press, exit } = rulerTiming(film);
  if (frame < s4.start || frame > s4.end || t < draw) return null;
  const color = textColor(s4.id);
  const R = STAGE.ruler;
  const pxPerMs = R.width / MS.rulerSpan;
  const drawn = ramp(t, draw, MS.rulerDraw, 'outQuint') * R.width;
  const head = linear(t, press, MS.rulerSpan) * R.width;
  const headOn = t >= press;
  const ticks: React.ReactNode[] = [];
  for (let x = 0; x <= R.width; x += R.tickPitch) {
    if (x > drawn) break;
    const ms = x / pxPerMs;
    const major = Math.abs(ms % 50) < 1e-6;
    const h = major ? R.majorH : R.minorH;
    ticks.push(<rect key={x} x={R.x + x} y={R.y - h} width={1} height={h} fill={color} opacity={major ? 0.7 : 0.45} />);
  }
  const labels: Array<[number, string, boolean]> = [[0, '0', false], ...R.marksMs.map((m) => [m, `${m} ms`, true] as [number, string, boolean])];
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: opacity(t, draw, exit, film.fps) }} shapeRendering="crispEdges">
      <rect x={R.x} y={R.y} width={px(drawn)} height={1} fill={color} opacity={0.7} />
      {ticks}
      {R.marksMs.map((m) => {
        const x = R.x + px(m * pxPerMs);
        if (x - R.x > drawn) return null;
        const lit = headOn && head >= m * pxPerMs;
        return <rect key={m} x={x - 1} y={R.y - R.markH} width={2} height={R.markH} fill={lit ? COLOR.accent : color} />;
      })}
      {headOn ? <rect x={R.x + px(head) - 1} y={R.y - R.markH - 8} width={2} height={R.markH + 8} fill={COLOR.accent} /> : null}
      {labels.map(([m, text, mark]) => {
        const x = R.x + px(m * pxPerMs);
        if (x - R.x > drawn) return null;
        const lit = mark && headOn && head >= m * pxPerMs;
        return (
          <text key={text} x={x} y={R.y + R.labelGap + TYPE.rulerLabel} textAnchor={m === 0 ? 'start' : 'middle'} style={{ ...monoStyle(TYPE.rulerLabel, color, lit ? 600 : 500), fill: color }}>
            {text}
          </text>
        );
      })}
    </svg>
  );
};
