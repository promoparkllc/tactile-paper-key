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
