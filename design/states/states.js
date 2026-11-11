// The player for the state captures: the real Tactile skin (src/video/skin) on one demo clip, with its caption track
// (off unless capture.mjs turns it on) and, for the seek preview, a storyboard track made by capture.mjs.
import '@videojs/html/video/player';
import '@/video/skin';
import '@/skin.css';
import skinTemplate from '@/video/skin.html?raw';

const params = new URLSearchParams(location.search);
const clip = params.get('clip') ?? 'snow';
const thumbs = params.get('thumbs');

const media =
  `<video src="/footage/${clip}.mp4" playsinline preload="auto" crossorigin>` +
  `<track kind="captions" label="English" srclang="en" src="/footage/${clip}.en.vtt">` +
  (thumbs ? `<track kind="metadata" label="thumbnails" src="${thumbs}" default>` : '') +
  '</video>';

const i18n = document.createElement('media-i18n');
const player = document.createElement('video-player');
if (params.get('poster')) player.setAttribute('poster', `/img/footage-${clip}.webp`);
player.innerHTML = skinTemplate.replace('<!-- Add a compatible media component here. -->', media);
i18n.append(player);
const stage = document.getElementById('stage');
// ?fit=cover fills a frame whose shape differs from the clip's (the 4:3 step card)
if (params.get('fit')) stage.style.setProperty('--media-object-fit', params.get('fit'));
stage.append(i18n);

window.__s = { player, container: player.querySelector('media-container'), media: player.querySelector('video') };

// ?drive=1: the capture drives the media. play() / pause() and the `paused` / `ended` reads answer from flags, so the
// skin reacts to its own keys (a click on Play morphs the glyph) while the video only moves when the capture seeks it.
if (params.get('drive')) {
  const m = window.__s.media;
  m.__playing = false;
  m.__ended = false;
  Object.defineProperty(m, 'paused', { get: () => !m.__playing, configurable: true });
  Object.defineProperty(m, 'ended', { get: () => m.__ended, configurable: true });
  m.play = function () {
    this.__playing = true;
    this.__ended = false;
    this.dispatchEvent(new Event('play'));
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  };
  m.pause = function () {
    if (!this.__playing) return;
    this.__playing = false;
    this.dispatchEvent(new Event('pause'));
  };
  window.__s.seek = (t) =>
    new Promise((resolve) => {
      if (Math.abs(m.currentTime - t) < 0.001) return resolve();
      m.addEventListener('seeked', () => { m.dispatchEvent(new Event('timeupdate')); resolve(); }, { once: true });
      m.currentTime = t;
    });
  window.__s.end = () => {
    m.__playing = false;
    m.__ended = true;
    m.dispatchEvent(new Event('pause'));
    m.dispatchEvent(new Event('ended'));
  };
}

/**
 * The animation clock for clips: every CSS transition and animation is paused and moved on by exactly `ms` per call, so
 * the skin's motion lands on the same frames whatever the time a screenshot takes.
 */
window.__step = (ms) => {
  for (const a of document.getAnimations()) {
    if (!a.__stepped) {
      a.__stepped = true;
      a.pause();
      a.__t = Number(a.currentTime ?? 0);
    }
    a.__t += ms;
    const end = Number(a.effect?.getComputedTiming().endTime ?? Infinity);
    if (a.__t >= end) a.finish();
    else a.currentTime = a.__t;
  }
};
