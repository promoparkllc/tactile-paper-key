// The Contra video stage: two real Tactile players (src/video/skin) on the snow clip, and the hooks render.mjs drives
// frame by frame (layer opacity, film frame, glaze, pointer ring, media time, the animation clock).
import '@videojs/html/video/player';
import '@/video/skin';
import '@/skin.css';
import skinTemplate from '@/video/skin.html?raw';

const thumbs = new URLSearchParams(location.search).get('thumbs');
let mounted = 0;

function mount(host) {
  const media =
    '<video src="/footage/snow.mp4" playsinline preload="auto" muted crossorigin>' +
    '<track kind="captions" label="English" srclang="en" src="/footage/snow.en.vtt">' +
    (thumbs ? `<track kind="metadata" label="thumbnails" src="${thumbs}" default>` : '') +
    '</video>';
  const i18n = document.createElement('media-i18n');
  const player = document.createElement('video-player');
  player.innerHTML = skinTemplate.replace('<!-- Add a compatible media component here. -->', media);
  i18n.append(player);
  // two players share one template: unique ids (and the attributes that point at them) before they connect
  const suffix = `-s${++mounted}`;
  for (const el of player.querySelectorAll('[id^="tactile-"]')) el.id += suffix;
  for (const attr of ['commandfor', 'trigger']) {
    for (const el of player.querySelectorAll(`[${attr}^="tactile-"]`)) el.setAttribute(attr, el.getAttribute(attr) + suffix);
  }
  host.append(i18n);
  player.querySelector('media-controls').setAttribute('visibility', 'always');
  const m = player.querySelector('video');
  // `paused` reads from a flag, so a player can show its playing state on a frame the stage sets
  m.__playing = false;
  Object.defineProperty(m, 'paused', { get: () => !m.__playing, configurable: true });
  return { player, container: player.querySelector('media-container'), media: m };
}

const poster = mount(document.getElementById('poster'));
const action = mount(document.getElementById('action'));

// the action player: a click on Play starts it for real; the stage then holds the media and moves time itself
action.media.addEventListener('play', () => {
  if (action.media.__playing) return;
  action.media.__playing = true;
  // the real pause's own event comes after this handler: announce playing once it has gone by
  action.media.addEventListener('pause', () => {
    action.media.dispatchEvent(new Event('playing'));
    action.media.dispatchEvent(new Event('timeupdate'));
  }, { once: true });
  HTMLMediaElement.prototype.pause.call(action.media);
});

const seek = (m, t) =>
  new Promise((resolve) => {
    if (Math.abs(m.currentTime - t) < 0.001) return resolve();
    m.addEventListener('seeked', () => resolve(), { once: true });
    m.currentTime = t;
  });

const layer = (id) => document.getElementById(id);
const film = document.getElementById('film');
const pointer = document.getElementById('pointer');

window.__stage = {
  ready: async () => {
    for (const p of [poster, action]) if (p.media.readyState < 2) await new Promise((r) => p.media.addEventListener('loadeddata', r, { once: true }));
    // sound on at half volume, as on the cover: the speaker glyph shows its waves (the video itself has no audio)
    for (const p of [poster, action]) { p.media.muted = false; p.media.volume = 0.5; }
    await document.fonts.ready;
  },
  /** The poster player: held in its playing state at 44 % of the clip. */
  holdPoster: async () => {
    poster.media.__playing = true;
    await seek(poster.media, poster.media.duration * 0.44);
    poster.media.dispatchEvent(new Event('playing'));
    poster.media.dispatchEvent(new Event('timeupdate'));
  },
  actionAt: async (t) => {
    await seek(action.media, t);
    action.media.dispatchEvent(new Event('timeupdate'));
  },
  actionTime: () => action.media.currentTime,
  actionPlaying: () => action.media.__playing,
  opacity: (id, v) => { layer(id).style.opacity = String(v); },
  film: (src) =>
    new Promise((resolve) => {
      if (!src) { film.removeAttribute('src'); return resolve(); }
      if (film.getAttribute('src') === src) return resolve();
      film.onload = () => film.decode().then(resolve, resolve);
      film.src = src;
    }),
  glaze: (g) => {
    if (g === 'bone') action.container.removeAttribute('data-glaze');
    else action.container.setAttribute('data-glaze', g);
  },
  pointer: (x, y, { shown = true, down = false } = {}) => {
    pointer.style.left = `${x}px`;
    pointer.style.top = `${y}px`;
    pointer.style.opacity = shown ? '1' : '0';
    pointer.toggleAttribute('data-down', down);
  },
  /** Centre of an element of the action player, in page px. */
  at: (selector, fx = 0.5, fy = 0.5) => {
    const r = action.container.querySelector(selector).getBoundingClientRect();
    return { x: r.left + r.width * fx, y: r.top + r.height * fy };
  },
  /**
   * The animation clock: every CSS transition and animation is paused and moved on by exactly one frame per call, so
   * the skin's motion lands on the same frames whatever the time a screenshot takes.
   */
  step: (ms) => {
    for (const a of document.getAnimations()) {
      if (!a.__stepped) {
        a.__stepped = true;
        a.pause();
        a.__t = Number(a.currentTime ?? 0);
      }
      a.__t += ms;
      const end = a.effect?.getComputedTiming().endTime ?? Infinity;
      if (a.__t >= Number(end)) a.finish();
      else a.currentTime = a.__t;
    }
  },
};
