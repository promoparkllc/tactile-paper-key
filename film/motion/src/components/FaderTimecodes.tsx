// Fader timecodes — the film's own current time rides above the fader cap (anchors_s6 `cap`, the cap's top centre)
// while the cap slides and holds, counting the real film time; the duration sits at the groove's right end
// (`groove_end`). Mono 24 px, ink. The current time shows only while the cap is on frame for a run of frames (the
// three frames before the camera leaves the cap at the slide's start are skipped) and fades over 8 frames at the
// ends of that run; both labels never move except with the cap itself.

import type { Ctx } from '../Film';
import { anchorsAt } from '../data/anchors';
import { formatClock } from '../data/scenes';
import { STAGE, TYPE, W, px, textColor } from '../layout';
import { opacity } from '../motion';
import { capRun, faderTiming } from '../timing';
import { monoStyle } from './Type';

export const FaderTimecodes: React.FC<Ctx> = ({ t, frame, film, extras }) => {
  const { s6, enter, exit } = faderTiming(film);
  if (frame < s6.start || frame > s6.end) return null;
  const color = textColor(s6.id);
  const live = anchorsAt(extras.anchorsS6, frame);
  const base = { ...monoStyle(TYPE.timecode, color), position: 'absolute' as const, whiteSpace: 'nowrap' as const };
  const F = STAGE.fader;

  // duration at the groove's right end (hidden while that end is off frame)
  const end = live?.groove_end;
  const right = end && end.visible && end.x > F.edgeMargin && end.x < W - F.edgeMargin ? end : null;

  // current time above the cap
  const run = capRun(film, extras.anchorsS6);
  const cap = live?.cap;
  const inRun = run && frame >= run.first && frame <= run.last && cap && cap.visible;
  return (
    <>
      {t >= enter && right ? (
        <span style={{ ...base, left: px(right.x + F.endGap), top: px(right.y - TYPE.timecode / 2), opacity: opacity(t, enter, exit, film.fps) }}>
          {film.seek.timeDur}
        </span>
      ) : null}
      {inRun ? (
        <span
          style={{
            ...base,
            left: px(Math.min(Math.max(cap.x, F.edgeMargin), W - F.edgeMargin)),
            top: px(cap.y - F.capRise - TYPE.timecode),
            transform: 'translateX(-50%)',
            opacity: opacity(t, run.first / film.fps, Math.min(exit, (run.last - 8) / film.fps), film.fps),
          }}
        >
          {formatClock(t)}
        </span>
      ) : null}
    </>
  );
};
