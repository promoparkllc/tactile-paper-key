// The lab page: the real skin on one player, configured by the query string (see lab.html).
import '@videojs/html/video/player';
import '@videojs/html/media/mux-video';
import '@/video/skin';
import '@/skin.css';
import skinTemplate from '@/video/skin.html?raw';

const q = new URLSearchParams(location.search);
const width = Number(q.get('width') ?? 1280);
document.documentElement.style.setProperty('--w', `${width}px`);

const src = q.get('src');
const mux = q.get('mux');
const captions = q.get('captions');
const track = captions ? `<track kind="captions" label="English" srclang="en" src="${captions}">` : '';
const media = mux
  ? `<mux-video src="https://stream.mux.com/${mux}.m3u8" playsinline crossorigin>${track}</mux-video>`
  : `<video src="${src ?? '/footage/snow.mp4'}" playsinline preload="auto" crossorigin>${track}</video>`;

const i18n = document.createElement('media-i18n');
const player = document.createElement('video-player');
if (q.get('poster')) player.setAttribute('poster', q.get('poster')!);
player.innerHTML = skinTemplate.replace('<!-- Add a compatible media component here. -->', media);
i18n.append(player);
document.getElementById('stage')!.append(i18n);

const container = player.querySelector<HTMLElement>('media-container')!;
if (q.get('glaze')) container.setAttribute('data-glaze', q.get('glaze')!);
if (q.get('accent')) container.style.setProperty('--media-accent-color', q.get('accent')!);
if (q.get('pinned')) player.querySelector('media-controls')?.setAttribute('visibility', 'always');

declare global {
  interface Window {
    __lab: { player: HTMLElement; container: HTMLElement; media: HTMLMediaElement };
  }
}
window.__lab = { player, container, media: (player.querySelector('mux-video') ?? player.querySelector('video')) as unknown as HTMLMediaElement };
