// The cover's player: the real Tactile skin (src/video/skin), bone glaze, snow footage, controls pinned, captions off
// (the track is there, so the Captions key shows, unlatched), sound on at half volume. render.mjs holds it in the playing state at 44 %.
import '@videojs/html/video/player';
import '@/video/skin';
import '@/skin.css';
import skinTemplate from '@/video/skin.html?raw';

const asked = new URLSearchParams(location.search).get('format');
const format = asked === 'og' || asked === 'contra' ? asked : 'cover';
document.getElementById('frame').dataset.format = format;

const media =
  '<video src="/footage/snow.mp4" playsinline preload="auto" crossorigin>' +
  '<track kind="captions" label="English" srclang="en" src="/footage/snow.en.vtt">' +
  '</video>';

const i18n = document.createElement('media-i18n');
const player = document.createElement('video-player');
player.innerHTML = skinTemplate.replace('<!-- Add a compatible media component here. -->', media);
i18n.append(player);
document.getElementById('player').append(i18n);
player.querySelector('media-controls')?.setAttribute('visibility', 'always');

window.__cover = { format, player, media: player.querySelector('video') };
