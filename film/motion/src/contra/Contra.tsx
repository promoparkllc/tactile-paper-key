// Contra.tsx — the Contra presentation video (45 s, 120 BPM). Two formats share this component with their own
// LAYOUTS entry. Every scene: the demo clip inside the player box (the real skin's capture goes on top of it once
// public/contra/capture/<scene>/ exists; until then a marked placeholder), a Michroma title (one word per frame, the
// accent word outlined then filled), a Geist Mono line, and the scene's own overlay (kbd chips, swatches, end card).
// Hard cuts on downbeats; the film's double band passes once, on the hook → first scene cut. The hook: the film's own
// S1 frames under the title (cream, measured ≥ 4.5:1 per format), then the S5 wipe with no text.

import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Fonts } from '../Fonts';
import { MS, lettersShown, pressDepth, ramp, typedPrefix } from '../motion';
import { px } from '../layout';
import { DisplayWord, KeyCap, monoStyle } from '../components/Type';
import { CAPTURE_DIR, FPB, FPS, LAYOUTS, PAGE, SCENES, sceneAt } from './config';

type Layout = (typeof LAYOUTS)['16:9'] | (typeof LAYOUTS)['4:5'];
type Scene = (typeof SCENES)[number];
export type Manifest = { scenes: Record<string, { frames: number; width: number; height: number; touch?: boolean; sourceRect?: { width: number; height: number }; pointer?: Array<[number, number] | null> }> } | null;
export type ContraProps = Record<string, unknown> & { aspect: '16:9' | '4:5'; manifest: Manifest; hasMusic: boolean };

const TITLE_LEAD = MS.titleLead / 1000; // 300 ms after the cut
const MONO_LEAD = 0.6;

/** Title: words one row (16:9) or stacked (4:5); letters land one per frame; the accent word outlines then fills. */
const Title: React.FC<{ scene: Scene; t: number; L: Layout; color: string; words?: string[]; accent?: string | null; x?: number; baseline?: number; size?: number; lineGap?: number }> = ({
  scene, t, L, color, words = scene.title ?? [], accent = scene.accent, x = L.title.x, baseline = L.title.baseline, size = L.title.size, lineGap = L.title.lineGap,
}) => {
  if (!words.length) return null;
  const t0 = scene.start + TITLE_LEAD;
  const stacked = lineGap > 0;
  // every word lands letter by letter, words 90 ms apart across the rows; the accent word is outlined, then fills
  let cursor = t0;
  const rows = words.map((row) =>
    row.split(' ').map((w) => {
      const start = cursor;
      const landed = start + (w.length - 1) / FPS;
      cursor = landed + MS.wordStagger / 1000;
      return { w, start, landed, isAccent: !!accent && w === accent };
    })
  );
  const top = px(baseline - size * 0.92);
  const wordGap = px(size * 0.36);
  return (
    <div style={{ position: 'absolute', left: px(x), top, display: 'flex', flexDirection: stacked ? 'column' : 'row', gap: stacked ? px(lineGap - size) : wordGap, alignItems: 'flex-start' }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: 'flex', gap: wordGap }}>
          {row.map(({ w, start, landed, isAccent }, i) => (
            <DisplayWord key={i} text={w} shown={lettersShown(t, start, w, FPS)} size={size} color={color} outline={isAccent} fill={isAccent ? ramp(t, landed + MS.wordBeat / 1000, MS.fill, 'outCubic') : 1} />
          ))}
        </div>
      ))}
    </div>
  );
};

const Mono: React.FC<{ text: string | null; t: number; t0: number; x: number; baseline: number; size: number; color: string; right?: boolean }> = ({ text, t, t0, x, baseline, size, color, right }) => {
  if (!text || t < t0) return null;
  return (
    <div style={{ position: 'absolute', left: right ? undefined : px(x), right: right ? px(x) : undefined, top: px(baseline - size), ...monoStyle(size, color) }}>
      {typedPrefix(t, t0, text, FPS)}
    </div>
  );
};

/** The pointer the capture script logged (CSS px of the captured player), drawn as an arrow: ink with a light edge. */
const Cursor: React.FC<{ at: [number, number]; scale: number }> = ({ at, scale }) => (
  <svg width={px(22 * scale)} height={px(22 * scale)} viewBox="0 0 22 22" style={{ position: 'absolute', left: px(at[0] * scale), top: px(at[1] * scale), overflow: 'visible' }}>
    <path d="M1 1 L1 17.5 L5.6 13.4 L8.7 20.4 L11.6 19.1 L8.6 12.3 L14.6 12.1 Z" fill={PAGE.ink} stroke={PAGE.keyFace} strokeWidth={1.4} strokeLinejoin="round" />
  </svg>
);

/** The player box: the clip, then the capture (when the manifest lists the scene) or the marked placeholder. */
const PlayerBox: React.FC<{ scene: Scene; frame: number; t: number; box: { x: number; y: number; width: number; height: number }; manifest: Manifest; label: string }> = ({ scene, frame, t, box, manifest, label }) => {
  const local = frame - scene.start * FPS;
  const cap = manifest?.scenes?.[scene.id];
  const scale = box.width / 1200; // CSS px of the captured player → box px
  const dockH = 68 * scale;
  const inset = 20 * scale;
  return (
    <div style={{ position: 'absolute', left: px(box.x), top: px(box.y), width: px(box.width), height: px(box.height), overflow: 'hidden', background: '#111' }}>
      {'clip' in scene && scene.clip ? (
        <Sequence from={scene.start * FPS} durationInFrames={(scene.end - scene.start) * FPS} layout="none">
          <OffthreadVideo src={staticFile(`contra/footage/${scene.clip}`)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Sequence>
      ) : null}
      {cap && local < cap.frames ? (
        <>
          <Img src={staticFile(`${CAPTURE_DIR}/${scene.id}/${String(local).padStart(4, '0')}.png`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          {!cap.touch && cap.pointer?.[local] ? <Cursor at={cap.pointer[local]!} scale={box.width / (cap.sourceRect?.width ?? 1200)} /> : null}
        </>
      ) : (
        <>
          {/* placeholder: the dock's silhouette where the real one will be, and the mark */}
          <div style={{ position: 'absolute', left: px(inset), right: px(inset), bottom: px(inset), height: px(dockH), borderRadius: px(dockH / 2), background: PAGE.placeholder, opacity: 0.85, border: `1.25px dashed ${PAGE.ring}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: px(10 * scale), padding: `0 ${px(12 * scale)}px` }}>
            <div style={{ width: px(64 * scale), height: px(44 * scale), borderRadius: px(22 * scale), background: PAGE.accent, opacity: 0.9 }} />
            <div style={{ width: px(150 * scale), height: px(40 * scale), borderRadius: px(20 * scale), background: '#151413', opacity: 0.9 }} />
            <div style={{ flex: 1, height: px(2 * scale), background: PAGE.ring, opacity: 0.5 }} />
            {[0, 1, 2, 3].map((k) => (
              <div key={k} style={{ width: px(44 * scale), height: px(44 * scale), borderRadius: '50%', border: `1.25px solid ${PAGE.ring}`, boxSizing: 'border-box', opacity: 0.8 }} />
            ))}
          </div>
          <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, border: `2px dashed ${PAGE.accent}`, boxSizing: 'border-box', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: px(inset), top: px(inset), padding: `${px(8 * scale)}px ${px(12 * scale)}px`, background: PAGE.accent, color: '#fff', ...monoStyle(Math.round(18 * scale), '#fff', 600) }}>
            {label}
          </div>
        </>
      )}
    </div>
  );
};

/** Width the title row takes (Michroma runs about 0.95 em a glyph), so the inline mono line starts after it. */
const titleWidth = (scene: Scene, L: Layout) => (scene.title ?? []).join(' ').length * L.title.size * 0.95;

/** kbd chips (keyboard scene): each appears at its moment and presses with the skin's curve; stacked or in a row. */
const KbdChips: React.FC<{ scene: Scene; t: number; L: Layout; color: string }> = ({ scene, t, L, color }) => {
  const chips = ('kbd' in scene ? scene.kbd : []) ?? [];
  const K = L.kbd;
  const vertical = !K.row;
  return (
    <div style={{ position: 'absolute', right: px(L.width - K.right), top: px(K.y), display: 'flex', flexDirection: vertical ? 'column' : 'row-reverse', gap: K.gap }}>
      {chips.map((c, i) => {
        const at = scene.start + c.at;
        if (t < at) return null;
        const depth = pressDepth(t, at);
        const down = Math.round(2 * depth);
        return (
          <div key={i} style={{ minWidth: K.size, height: K.size, padding: `0 ${px(K.size * 0.3)}px`, borderRadius: 8, border: `1.25px solid ${color}`, boxShadow: `0 ${2 - down}px 0 ${color}`, transform: `translateY(${down}px)`, display: 'grid', placeItems: 'center', boxSizing: 'border-box', ...monoStyle(Math.round(K.size * 0.4), color, 600) }}>
            {c.label}
          </div>
        );
      })}
    </div>
  );
};

/** Swatches (accent scene): four glazes; the live one carries the ring and grows 8 % with the skin's press curve. */
const Swatches: React.FC<{ scene: Scene; t: number; L: Layout }> = ({ scene, t, L }) => {
  const sw = ('swatches' in scene ? scene.swatches : []) ?? [];
  const S = L.swatches;
  const vertical = !S.row;
  const liveIndex = sw.reduce((acc, s, i) => (t >= scene.start + s.at ? i : acc), 0);
  return (
    <div style={{ position: 'absolute', right: px(L.width - S.right), top: px(S.y), display: 'flex', flexDirection: vertical ? 'column' : 'row-reverse', gap: S.gap }}>
      {sw.map((s, i) => {
        const live = i === liveIndex;
        const pop = live ? 1 - pressDepth(t, scene.start + s.at) * 0.5 : 0;
        return <div key={i} style={{ width: S.size, height: S.size, borderRadius: '50%', background: s.hex, border: `1.25px solid ${PAGE.ring}`, boxSizing: 'border-box', outline: live ? `2px solid ${PAGE.ring}` : 'none', outlineOffset: 3, transform: `scale(${1 + 0.08 * pop})` }} />;
      })}
    </div>
  );
};

/** The film's double band, once, centred on a cut: 192 px, two columns, 500 ms ease-in-out-quart, left → right. */
const Band: React.FC<{ t: number; at: number; L: Layout }> = ({ t, at, L }) => {
  const t0 = at - MS.band / 2000;
  if (t < t0 || t > t0 + MS.band / 1000) return null;
  const width = Math.round(L.width * 0.1);
  const lead = (L.width + width) * ramp(t, t0, MS.band, 'inOutQuart');
  return (
    <>
      <div style={{ position: 'absolute', left: px(lead - width), top: 0, width: px(width / 2), height: L.height, background: '#FFA31A' }} />
      <div style={{ position: 'absolute', left: px(lead - width / 2), top: 0, width: px(width / 2), height: L.height, background: '#FF6A00' }} />
    </>
  );
};

/** End card beside the mobile capture: title filled + outlined, the small row, three keys on beats (42 / 42.5 / 43 s). */
const EndCard: React.FC<{ scene: Scene; t: number; L: Layout; color: string }> = ({ scene, t, L, color }) => {
  const E = L.end;
  const keys = [0, 1, 2].map((k) => 42 + k * (FPB / FPS));
  return (
    <>
      <Title scene={scene} t={t} L={L} color={color} words={scene.title ?? []} accent={scene.accent} x={E.textX} baseline={E.titleBaseline} size={E.titleSize} lineGap={E.lineGap} />
      <Mono text={scene.mono} t={t} t0={scene.start + 1.2} x={E.textX} baseline={E.smallBaseline} size={L.mono.size} color={color} />
      {t >= scene.start + 1.2 ? (
        <div style={{ position: 'absolute', left: px(E.textX), top: px(E.keys.y), display: 'flex', gap: E.keys.gap }}>
          {keys.map((tk, i) => (
            <KeyCap key={i} size={E.keys.size} depth={pressDepth(t, tk)} accent={i === 0} />
          ))}
        </div>
      ) : null}
    </>
  );
};

export const Contra: React.FC<ContraProps> = ({ aspect, manifest, hasMusic }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const L = LAYOUTS[aspect];
  const scene = sceneAt(frame);
  const ink = PAGE.ink;
  const n = SCENES.indexOf(scene) + 1;
  const label = `CAPTURE · ${String(n).padStart(2, '0')} ${scene.name.toUpperCase()} · ${scene.capture?.viewport === 'mobile' ? '390 px @3' : '1200 × 675 @1.6'} · pending`;
  return (
    <AbsoluteFill style={{ background: PAGE.bone, width: L.width, height: L.height }}>
      <Fonts />
      {hasMusic ? <Audio src={staticFile('contra/music.wav')} /> : null}

      {scene.id === 'hook' ? (
        <>
          {(scene.background ?? []).map((seg, i) => (
            <Sequence key={i} from={seg.at * FPS} durationInFrames={seg.seconds * FPS} layout="none">
              <OffthreadVideo src={staticFile('contra/film3d.mp4')} startFrom={seg.fromFrame} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </Sequence>
          ))}
          {t < (scene.titleUntil ?? 4) ? (
            <Title scene={{ ...scene, start: 0 }} t={t} L={L} color={L.hook.color} words={scene.title ?? []} accent={scene.accent} x={L.hook.x} baseline={L.hook.baseline} size={L.hook.size} lineGap={Math.round(L.hook.size * 0.98)} />
          ) : null}
        </>
      ) : scene.id === 'end' ? (
        <>
          <PlayerBox scene={scene} frame={frame} t={t} box={L.end.phone} manifest={manifest} label={label} />
          <EndCard scene={scene} t={t} L={L} color={ink} />
        </>
      ) : (
        <>
          <PlayerBox scene={scene} frame={frame} t={t} box={L.player} manifest={manifest} label={label} />
          <Title scene={scene} t={t} L={L} color={ink} />
          <Mono text={scene.mono} t={t} t0={scene.start + MONO_LEAD} x={L.monoInline ? L.mono.x + titleWidth(scene, L) + 48 : L.mono.x} baseline={L.mono.baseline} size={L.mono.size} color={ink} />
          {scene.id === 'keyboard' ? <KbdChips scene={scene} t={t} L={L} color={ink} /> : null}
          {scene.id === 'accent' ? <Swatches scene={scene} t={t} L={L} /> : null}
        </>
      )}
      <Band t={t} at={4} L={L} />
    </AbsoluteFill>
  );
};
