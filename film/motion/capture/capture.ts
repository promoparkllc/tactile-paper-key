// The capture page: the real Tactile skin (src/video/skin) on a Video.js v10 HTML player, playing the film itself
// from a plain <video>. Served by Vite with the repo's config (alias `@/` → src), driven by scripts/capture.mjs.
// Query: ?src=<video url>&captions=<vtt url>&storyboard=<thumbnails vtt url>&width=<css px, default 1200>
import '@videojs/html/i18n';
import '@videojs/html/video/player';
import '@/video/skin';
import '@/skin.css';
import skinTemplate from '@/video/skin.html?raw';

const params = new URLSearchParams(location.search);
const src = params.get('src') ?? '/film.mp4';
const captions = params.get('captions');
const storyboard = params.get('storyboard'); // what mux-video adds by itself: the track the seek preview reads
const width = Number(params.get('width') ?? 1200); // the Contra mobile scene captures the 390 px player
document.documentElement.style.setProperty('--w', `${width}px`);
document.documentElement.style.setProperty('--h', `${Math.round((width * 9) / 16)}px`);

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';
const i18n = document.createElement('media-i18n');
const player = document.createElement('video-player');
player.innerHTML = skinTemplate.replace(
  MEDIA_PLACEHOLDER,
  `<video src="${src}" playsinline muted preload="auto">` +
    (captions ? `<track kind="captions" label="English" srclang="en" src="${captions}" default>` : '') +
    (storyboard ? `<track kind="metadata" label="thumbnails" src="${storyboard}" default>` : '') +
    `</video>`
);
i18n.append(player);
document.getElementById('stage')!.append(i18n);

declare global {
  interface Window {
    __capture: { player: HTMLElement; video: HTMLVideoElement; container: HTMLElement };
  }
}
window.__capture = {
  player,
  video: player.querySelector('video')!,
  container: player.querySelector('media-container')!,
};
