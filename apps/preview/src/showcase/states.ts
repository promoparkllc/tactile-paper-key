// 04 States: each card's still is the poster of a short clip of that state (design/states/capture.mjs, 640 × 360,
// WebM VP9 with an MP4 fallback). With a pointer, the clip plays from its start on hover or focus and goes back to the
// poster when they leave; on a phone, the card crossing the middle band of the screen plays and the others rest. A
// clip's sources are attached only when first needed (preload="none"), and under reduced motion nothing plays.
const cards = [...document.querySelectorAll<HTMLElement>('#states-grid .stile')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const hover = matchMedia('(hover: hover)');

const clipOf = (card: HTMLElement) => card.querySelector<HTMLVideoElement>('.stile-clip');

function attach(video: HTMLVideoElement): void {
  if (video.dataset.attached) return;
  video.dataset.attached = '1';
  const base = video.dataset.clip!;
  video.innerHTML = `<source src="${base}.webm" type="video/webm"><source src="${base}.mp4" type="video/mp4">`;
  // the clip shows only once it is really playing, so the poster never blinks to an empty frame
  video.addEventListener('playing', () => video.setAttribute('data-on', ''));
  video.load();
}

function start(card: HTMLElement): void {
  const video = clipOf(card);
  if (!video || reduced.matches) return;
  attach(video);
  video.currentTime = 0;
  void video.play().catch(() => undefined);
}

function stop(card: HTMLElement): void {
  const video = clipOf(card);
  if (!video || !video.dataset.attached) return;
  video.pause();
  video.removeAttribute('data-on');
  video.currentTime = 0;
}

if (hover.matches) {
  for (const card of cards) {
    card.addEventListener('pointerenter', () => start(card));
    card.addEventListener('pointerleave', () => { if (!card.matches(':focus-within')) stop(card); });
    card.addEventListener('focusin', () => start(card));
    card.addEventListener('focusout', () => { if (!card.matches(':hover')) stop(card); });
  }
} else {
  // sources for the cards within about a screen of the viewport
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting || reduced.matches) continue;
        const video = clipOf(e.target as HTMLElement);
        if (video) attach(video);
        near.unobserve(e.target);
      }
    },
    { rootMargin: '100% 0px' }
  );
  // one clip at a time: the card in the band through the middle of the screen
  let playing: HTMLElement | null = null;
  const band = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const card = e.target as HTMLElement;
        if (e.isIntersecting && card !== playing) {
          if (playing) stop(playing);
          playing = card;
          start(card);
        } else if (!e.isIntersecting && card === playing) {
          stop(card);
          playing = null;
        }
      }
    },
    { rootMargin: '-45% 0px -45% 0px' }
  );
  for (const card of cards) {
    near.observe(card);
    band.observe(card);
  }
}

export {};
