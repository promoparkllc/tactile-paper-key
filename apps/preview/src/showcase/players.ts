// players.ts — the page's four real players (hero, anatomy, configurator, access). Loaded by main.ts after the page's
// load event, so the first paint and the poster do not wait for the skin's script.
import '@videojs/html/video/player';
import '@videojs/html/media/mux-video';
import '@/video/skin';
import skinTemplate from '@/video/skin.html?raw';

export function bootPlayers(): void {
  /** Poster before playback: frame 45 of the film, the dark hook with no UI (1920 px WebP in `public/`). */
  const POSTER_SRC = './poster.webp';

  /** The film "From object to interface" (26 s, 1080p) on Mux, HLS through `mux-video`. Playback ID is public. */
  const PLAYBACK_ID = '6FsjtrlJovCj1y1jJ9LxJKvglUwzLd6aS9MOtVXGsig';

  /** `--media-accent-color` presets. `ink` is the matching `--media-accent-text-color`. */
  const SWATCHES = [
    { hex: '#D9531E', ink: '#160C07', label: 'Burnt orange' },
    { hex: '#FFA31A', ink: '#1E1D1D', label: 'Amber' },
    { hex: '#3F6FD8', ink: '#FFFFFF', label: 'Blue' },
    { hex: '#2A9D6A', ink: '#08170F', label: 'Green' },
  ] as const;

  /** Demo footage (public/footage, 720p H.264, 6 s, one caption cue each) and its poster frame (public/img). */
  const FOOTAGE: Record<string, { src: string; poster: string; captions: string; alt: string }> = {
    snow: { src: './footage/snow.mp4', poster: './img/footage-snow.webp', captions: './footage/snow.en.vtt', alt: 'Very bright snowy ridge' },
    night: { src: './footage/night.mp4', poster: './img/footage-night.webp', captions: './footage/night.en.vtt', alt: 'Dark rainy street at night' },
    market: { src: './footage/market.mp4', poster: './img/footage-market.webp', captions: './footage/market.en.vtt', alt: 'Busy colourful flower market' },
    studio: { src: './footage/studio.mp4', poster: './img/footage-studio.webp', captions: './footage/studio.en.vtt', alt: 'Warm podcast studio' },
  };

  const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';

  interface Mounted {
    player: HTMLElement;
    container: HTMLElement;
    media: HTMLMediaElement;
    controls: HTMLElement;
  }

  interface MountOptions {
    media: string; // the media element's markup
    poster?: string;
    pinned?: boolean;
  }

  let mounted = 0;

  function mountPlayer(frame: HTMLElement, options: MountOptions): Mounted {
    const i18n = document.createElement('media-i18n');
    const player = document.createElement('video-player');
    if (options.poster) player.setAttribute('poster', options.poster);
    player.innerHTML = skinTemplate.replace(MEDIA_PLACEHOLDER, options.media);
    i18n.append(player);
    frame.append(i18n);
    // four players share one template: every id (and the commandfor that points at it) gets this player's suffix,
    // so `commandfor` opens this player's menu and no id repeats on the page
    const suffix = `-p${++mounted}`;
    for (const el of player.querySelectorAll<HTMLElement>('[id^="tactile-"]')) el.id = `${el.id}${suffix}`;
    for (const el of player.querySelectorAll<HTMLElement>('[commandfor^="tactile-"]')) el.setAttribute('commandfor', `${el.getAttribute('commandfor')}${suffix}`);
    const container = player.querySelector<HTMLElement>('media-container')!;
    const controls = player.querySelector<HTMLElement>('media-controls')!;
    if (options.pinned) controls.setAttribute('visibility', 'always');
    const media = (player.querySelector('mux-video') ?? player.querySelector('video')) as unknown as HTMLMediaElement;
    return { player, container, media, controls };
  }

  const videoMarkup = (clip: (typeof FOOTAGE)[string], { muted = true, captionsOn = false } = {}) =>
    `<video src="${clip.src}" playsinline preload="metadata" ${muted ? 'muted' : ''} crossorigin>` +
    `<track kind="captions" label="English" srclang="en" src="${clip.captions}" ${captionsOn ? 'default' : ''}>` +
    `</video>`;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /** Show a player's dock for a while after a page action (the controls hide 2 s after the last pointer activity). */
  function showControlsFor(container: HTMLElement, ms = 4000): void {
    const rect = container.getBoundingClientRect();
    const poke = () =>
      container.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    poke();
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started >= ms) clearInterval(timer);
      else poke();
    }, 1500);
  }

  function revealFrame(frame: HTMLElement): void {
    const r = frame.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) frame.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  /** Start a player that is still READY (no dock before the first play), so a change becomes visible. */
  function startIfReady({ container, media }: Mounted): void {
    const started = container.querySelector('media-play-button')?.hasAttribute('data-started') ?? true;
    if (!started) void media.play().catch(() => undefined);
  }

  /**
   * The three players below the fold mount when their frame comes within 600 px of the viewport (or when a control that
   * drives them is used), so the first screen pays for one player only. The frame keeps its poster until then.
   */
  function lazyPlayer(frame: HTMLElement, mount: () => Mounted): () => Mounted {
    let mountedPlayer: Mounted | null = null;
    const get = () => {
      if (!mountedPlayer) {
        mountedPlayer = mount();
        observer.disconnect();
      }
      return mountedPlayer;
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) get();
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(frame);
    return get;
  }

  // ---------------------------------------------------------------- Hero: the film --------------------------------
  const hero = mountPlayer(document.getElementById('hero-frame')!, {
    poster: POSTER_SRC,
    media: `<mux-video src="https://stream.mux.com/${PLAYBACK_ID}.m3u8" playsinline crossorigin>` + `<track kind="captions" label="English" srclang="en" src="./captions.en.vtt">` + `</mux-video>`,
  });
  void hero;

  // ---------------------------------------------------------------- 02 Anatomy: the pinned dock, numbered ----------
  const anatomyFrame = document.getElementById('anatomy-frame')!;
  const getAnatomy = lazyPlayer(anatomyFrame, () => {
    const m = mountPlayer(anatomyFrame, { poster: FOOTAGE.studio.poster, media: videoMarkup(FOOTAGE.studio), pinned: true });
    // a frame from inside the clip, so the dock sits on footage rather than on the first (dark) frame
    m.media.addEventListener('loadedmetadata', () => {
      m.media.currentTime = 3;
    }, { once: true });
    requestAnimationFrame(placeCallouts);
    setTimeout(placeCallouts, 600);
    new ResizeObserver(placeCallouts).observe(anatomyFrame);
    return m;
  });

  const PARTS: Record<string, string> = {
    play: '.tactile-dock-play',
    display: '.tactile-dock .tactile-pill',
    seek: '.tactile-seek',
    mute: '.tactile-key-mute',
    volume: '.tactile-volume-wrap',
    cc: '.tactile-key-cc',
    settings: '.tactile-key-settings',
    fullscreen: '.tactile-key-fullscreen',
  };
  const callouts = [...document.querySelectorAll<HTMLElement>('#anatomy-callouts .callnum')];
  const anatomyPanel = anatomyFrame.parentElement!;

  function placeCallouts(): void {
    const panel = anatomyPanel.getBoundingClientRect();
    const anatomy = anatomyFrame.querySelector('video-player') ? getAnatomy() : null;
    if (!anatomy) return;
    const dock = anatomy.container.querySelector<HTMLElement>('.tactile-dock');
    const dockRect = dock?.getBoundingClientRect();
    for (const el of callouts) {
      const target = anatomy.container.querySelector<HTMLElement>(PARTS[el.dataset.part!]!);
      const r = target?.getBoundingClientRect();
      const visible = !!r && r.width > 0 && r.height > 0 && !!dockRect && dockRect.width > 0;
      el.toggleAttribute('data-placed', visible);
      if (!visible || !r || !dockRect) continue;
      const top = dockRect.top - panel.top - 46;
      el.style.left = `${r.left + r.width / 2 - panel.left}px`;
      el.style.top = `${top}px`;
      el.style.setProperty('--lead', `${Math.max(8, dockRect.top - panel.top - top - 26 - 4)}px`);
    }
  }
  void document.fonts.ready.then(placeCallouts);

  // ---------------------------------------------------------------- 03 Configurator -------------------------------
  const configFrame = document.getElementById('config-frame')!;
  const getConfig = lazyPlayer(configFrame, () => {
    const m = mountPlayer(configFrame, { poster: FOOTAGE.studio.poster, media: videoMarkup(FOOTAGE.studio) });
    m.media.loop = true;
    m.container.style.setProperty('--media-accent-color', accentNow.hex);
    m.container.style.setProperty('--media-accent-text-color', accentNow.ink);
    if (glazeNow !== 'bone') m.container.setAttribute('data-glaze', glazeNow);
    return m;
  });
  let glazeNow = 'bone';
  let accentNow: { hex: string; ink: string } = SWATCHES[0];

  function pressOnly(group: HTMLElement, chosen: HTMLElement): void {
    for (const b of group.querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-pressed', String(b === chosen));
  }

  const glazeGroup = document.getElementById('glazes')!;
  glazeGroup.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-glaze]');
    if (!button) return;
    const glaze = button.dataset.glaze!;
    glazeNow = glaze;
    const config = getConfig();
    if (glaze === 'bone') config.container.removeAttribute('data-glaze');
    else config.container.setAttribute('data-glaze', glaze);
    pressOnly(glazeGroup, button);
    startIfReady(config);
    revealFrame(configFrame);
    showControlsFor(config.container);
  });

  const swatchGroup = document.getElementById('swatches')!;
  function applyAccent(hex: string, ink: string, fromUser = false): void {
    accentNow = { hex, ink };
    for (const b of swatchGroup.querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-pressed', String(b.dataset.hex === hex));
    if (fromUser) {
      const config = getConfig();
      config.container.style.setProperty('--media-accent-color', hex);
      config.container.style.setProperty('--media-accent-text-color', ink);
      startIfReady(config);
      revealFrame(configFrame);
      showControlsFor(config.container);
    }
  }
  for (const swatch of SWATCHES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sw';
    button.dataset.hex = swatch.hex;
    button.style.background = swatch.hex;
    button.setAttribute('aria-label', `${swatch.label} ${swatch.hex}`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => applyAccent(swatch.hex, swatch.ink, true));
    swatchGroup.append(button);
  }
  applyAccent(SWATCHES[0].hex, SWATCHES[0].ink);

  const deviceGroup = document.getElementById('devices')!;
  deviceGroup.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-device]');
    if (!button) return;
    const phone = button.dataset.device === 'phone';
    configFrame.style.setProperty('--config-width', phone ? '390px' : '100%');
    pressOnly(deviceGroup, button);
    const config = getConfig();
    startIfReady(config);
    revealFrame(configFrame);
    showControlsFor(config.container);
  });

  // ---------------------------------------------------------------- 05 Access: the footage switch ---------------
  const accessFrame = document.getElementById('access-frame')!;
  const getAccess = lazyPlayer(accessFrame, () => {
    const m = mountPlayer(accessFrame, { poster: FOOTAGE.snow.poster, media: videoMarkup(FOOTAGE.snow, { captionsOn: true }) });
    m.media.loop = true;
    return m;
  });

  const footageGroup = document.getElementById('footage')!;
  footageGroup.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-footage]');
    if (!button) return;
    const clip = FOOTAGE[button.dataset.footage!]!;
    const access = getAccess();
    const wasPlaying = !access.media.paused;
    const video = access.media as HTMLVideoElement;
    // swap the source and its caption track; keep the captions showing
    const track = video.querySelector('track');
    if (track) track.src = clip.captions;
    video.poster = clip.poster;
    video.src = clip.src;
    video.load();
    for (const t of video.textTracks) t.mode = 'showing';
    access.player.setAttribute('poster', clip.poster);
    pressOnly(footageGroup, button);
    void video.play().catch(() => undefined);
    if (!wasPlaying) void video.play().catch(() => undefined);
    revealFrame(accessFrame);
    showControlsFor(access.container);
  });
}
