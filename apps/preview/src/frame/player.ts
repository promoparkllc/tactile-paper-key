import '@videojs/html/video/player';
import '@videojs/html/media/mux-video';
import '@/video/skin';
import skinTemplate from '@/video/skin.html?raw';

// What the preview plays. Change these to try the skin with your own media; any Mux or HLS URL works.
// The Tactile film "From object to interface" (27.5 s, 1080p) on Mux, HLS through `mux-video`.
const PLAYBACK_ID = 'qSuGOUoDG02f3O024g1A9FRbyM00BNxdKL400pA5e1C4JI8';
const SRC = `https://stream.mux.com/${PLAYBACK_ID}.m3u8`;
/** Frame 43 of the film's 3D render (the rim-lit key, no title over it), served from `apps/preview/public`. */
const POSTER = './poster.webp';
/** The film's captions, one cue per shot; off until the viewer turns them on. */
const CAPTIONS = './captions.en.vtt';

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';

export function createPlayer(): HTMLElement {
  const player = document.createElement('video-player');
  player.setAttribute('poster', POSTER);

  player.innerHTML = skinTemplate.replace(
    MEDIA_PLACEHOLDER,
    `<mux-video src="${SRC}" playsinline crossorigin>` +
      `<track kind="captions" label="English" srclang="en" src="${CAPTIONS}">` +
      `</mux-video>`
  );

  return player;
}
