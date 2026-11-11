// players.ts — the page's four real players (hero, anatomy, configurator, access). Loaded by main.ts after the page's
// load event, so the first paint and the poster do not wait for the skin's script.
import '@videojs/html/video/player';
import '@videojs/html/media/mux-video';
import '@/video/skin';
import skinTemplate from '@/video/skin.html?raw';

export function bootPlayers(): void {
  /** Poster before playback: frame 43 of the film's 3D render, the rim-lit key with no title over it (1920 px WebP in `public/`). */
  const POSTER_SRC = './poster.webp';

  /** The film "From object to interface" (27.5 s, 1080p) on Mux, HLS through `mux-video`. Playback ID is public. */
  const PLAYBACK_ID = 'qSuGOUoDG02f3O024g1A9FRbyM00BNxdKL400pA5e1C4JI8';

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
    // four players share one template: every id (and the commandfor / trigger that points at it) gets this player's
    // suffix before the player connects, so `commandfor` opens this player's menu, each tooltip finds its own key and
    // no id repeats on the page
    const suffix = `-p${++mounted}`;
    for (const el of player.querySelectorAll<HTMLElement>('[id^="tactile-"]')) el.id = `${el.id}${suffix}`;
    for (const el of player.querySelectorAll<HTMLElement>('[commandfor^="tactile-"]')) el.setAttribute('commandfor', `${el.getAttribute('commandfor')}${suffix}`);
    // the tooltips name their key with `trigger`: without the suffix they found no key and never opened
    for (const el of player.querySelectorAll<HTMLElement>('[trigger^="tactile-"]')) el.setAttribute('trigger', `${el.getAttribute('trigger')}${suffix}`);
    frame.append(i18n);
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
    wireAnatomy(m);
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
    // phones (page ≤ 600 px): the numbers sit under the player, their lines up to the controls, nothing over the image
    const below = anatomyPanel.closest<HTMLElement>('.sc')!.clientWidth <= 600;
    anatomyPanel.toggleAttribute('data-below', below);
    const frameBottom = anatomyFrame.getBoundingClientRect().bottom - panel.top;
    const missing: string[] = [];
    for (const el of callouts) {
      const part = el.dataset.part!;
      const target = anatomy.container.querySelector<HTMLElement>(PARTS[part]!);
      const r = target?.getBoundingClientRect();
      const visible = !!r && r.width > 0 && r.height > 0 && !!dockRect && dockRect.width > 0;
      el.toggleAttribute('data-placed', visible);
      // the legend lists what this dock has: narrower docks hand some parts elsewhere (see MOVED)
      const card = cards.find((c) => c.dataset.part === part)?.closest('li');
      if (card && dockRect?.width) card.hidden = !visible;
      if (!visible && dockRect?.width) missing.push(part);
      if (!visible || !r || !dockRect) continue;
      el.style.left = `${r.left + r.width / 2 - panel.left}px`;
      if (below) {
        const top = frameBottom + NUM_GAP;
        el.style.top = `${top}px`;
        el.style.setProperty('--lead', `${Math.max(8, top - (r.bottom - panel.top) - 4)}px`);
      } else {
        const top = dockRect.top - panel.top - 46;
        el.style.top = `${top}px`;
        el.style.setProperty('--lead', `${Math.max(8, dockRect.top - panel.top - top - 26 - 4)}px`);
      }
    }
    const note = missing.map((p) => MOVED[p]).filter(Boolean);
    partsNote.hidden = !note.length;
    if (note.length) partsNote.textContent = `At this width: ${note.join('; ')}.`;
    placeHint(anatomy, panel, dockRect);
  }

  /** Where a part goes when the dock is too narrow for it (the skin's container queries: 880, 760 and 560 px). */
  const MOVED: Record<string, string> = {
    display: 'the times sit above the seek fader',
    volume: 'volume is left to the device, Mute stays',
    cc: 'Captions is a row in the settings menu',
    settings: 'Settings is the key in the top corner',
  };
  const partsNote = document.getElementById('parts-note')!;
  /** Phones: gap from the frame's bottom edge to the numbers, and from the numbers to TRY IT's arrow. */
  const NUM_GAP = 14;
  const HINT_GAP = 10;
  void document.fonts.ready.then(placeCallouts);

  // ---------------------------------------------------------------- 02 Anatomy: hint, links, "show me" cards -------
  /** What the page points at per part, in the dock (a fader's cap, which takes focus, rather than the whole fader). */
  const TARGETS: Record<string, string[]> = {
    play: ['.tactile-dock-play'],
    display: ['.tactile-dock .tactile-pill'],
    seek: ['.tactile-seek .tactile-fader-cap'],
    mute: ['.tactile-dock .tactile-key-mute'],
    volume: ['.tactile-volume-wrap .tactile-fader-cap'],
    cc: ['.tactile-dock .tactile-key-cc'],
    settings: ['.tactile-dock .tactile-key-settings'],
    fullscreen: ['.tactile-dock .tactile-key-fullscreen'],
  };
  const HINT_KEY = 'tactile-anatomy-hint';
  const hint = anatomyPanel.querySelector<HTMLElement>('.anatomy-hint')!;
  const cards = [...document.querySelectorAll<HTMLButtonElement>('#anatomy .part-btn')];
  const isVisible = (el: Element | null): el is HTMLElement => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const target = (m: Mounted, part: string): HTMLElement | null => {
    for (const s of TARGETS[part] ?? []) {
      const el = m.container.querySelector<HTMLElement>(s);
      if (isVisible(el)) return el;
    }
    return null;
  };
  /** The part a node inside the player belongs to (hover or focus on a control lights its number and card). */
  const partOf = (node: Node | null): string | null => {
    const el = node instanceof Element ? node : null;
    if (!el) return null;
    for (const [part, selectors] of Object.entries(TARGETS)) {
      if (selectors.some((s) => el.closest(s))) return part;
    }
    return null;
  };

  let hintGone = false;
  try {
    hintGone = sessionStorage.getItem(HINT_KEY) === 'done';
  } catch {
    /* storage blocked: the hint shows until the first interaction on this page */
  }
  if (hintGone) hint.setAttribute('data-gone', '');

  function dismissHint(): void {
    if (hintGone) return;
    hintGone = true;
    hint.setAttribute('data-gone', '');
    try {
      sessionStorage.setItem(HINT_KEY, 'done');
    } catch {
      /* the hint stays gone on this page only */
    }
  }

  /** TRY IT sits over the seek cap; when number 3 is right above the cap, over the number, so the two read as a chain. */
  /** Placed with a transform: the hint follows the dock as it settles without counting as a layout shift. */
  function moveHint(x: number, y: number): void {
    hint.style.transform = `translate(${x}px, ${y}px)`;
  }

  function placeHint(m: Mounted, panel: DOMRect, dockRect: DOMRect | undefined): void {
    const cap = m.container.querySelector<HTMLElement>('.tactile-seek .tactile-fader-cap');
    if (hintGone || !dockRect || !isVisible(cap)) {
      hint.removeAttribute('data-placed');
      return;
    }
    const below = anatomyPanel.hasAttribute('data-below');
    hint.toggleAttribute('data-below', below);
    if (below) {
      // phones: under the numbers, centred under the seek fader, arrow up
      const fader = m.container.querySelector<HTMLElement>('.tactile-seek')!.getBoundingClientRect();
      const frameBottom = anatomyFrame.getBoundingClientRect().bottom - panel.top;
      moveHint(fader.left + fader.width / 2 - panel.left, frameBottom + NUM_GAP + 26 + HINT_GAP + 5); // the arrow's 5 px above the pill
      hint.setAttribute('data-placed', '');
      return;
    }
    const r = cap.getBoundingClientRect();
    const x = r.left + r.width / 2 - panel.left;
    const num = callouts.find((c) => c.dataset.part === 'seek');
    const numX = num?.hasAttribute('data-placed') ? parseFloat(num.style.left) : NaN;
    const half = hint.offsetWidth / 2 + 13 + 6;
    const overNumber = Math.abs(numX - x) < half;
    const bottom = overNumber ? parseFloat(num!.style.top) - 6 : dockRect.top - panel.top - 6;
    moveHint(x, bottom - 5); // the arrow's 5 px under the pill
    hint.setAttribute('data-placed', '');
  }

  /** Light number N and card N; with `ring`, draw the skin's focus ring on control N (focus does not move). */
  let ringed: HTMLElement | null = null;
  function highlight(part: string | null, ring = false): void {
    for (const c of callouts) c.classList.toggle('is-on', c.dataset.part === part);
    for (const c of cards) c.classList.toggle('is-on', c.dataset.part === part);
    ringed?.removeAttribute('data-anatomy-ring');
    ringed = null;
    if (ring && part && anatomyFrame.querySelector('video-player')) {
      ringed = target(getAnatomy(), part);
      ringed?.setAttribute('data-anatomy-ring', '');
    }
  }

  for (const c of callouts) {
    c.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && highlight(c.dataset.part!, true));
    c.addEventListener('pointerleave', () => highlight(null));
  }
  for (const card of cards) {
    card.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && highlight(card.dataset.part!, true));
    card.addEventListener('pointerleave', () => highlight(null));
    card.addEventListener('click', () => showPart(card.dataset.part!));
  }

  /** "Show me": bring the player into view if it is not, focus control N (its tooltip names it), light number N 1.5 s. */
  let litTimer = 0;
  function showPart(part: string): void {
    dismissHint();
    const m = getAnatomy();
    highlight(null);
    const go = () => {
      const el = target(m, part);
      const box = (el ?? m.container).getBoundingClientRect();
      // in view means below the sticky header, which would otherwise hide the dock
      const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
      if (box.top < headerBottom || box.bottom > window.innerHeight) {
        anatomyFrame.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }
      if (el && el.tabIndex >= 0) {
        // focusVisible where supported; the page ring covers browsers that keep it hidden after a pointer click
        el.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
        if (!el.matches(':focus-visible')) {
          el.setAttribute('data-anatomy-ring', '');
          el.addEventListener('blur', () => el.removeAttribute('data-anatomy-ring'), { once: true });
        }
      } else if (el) {
        // the display is not a control: its ring stays while the number is lit
        el.setAttribute('data-anatomy-ring', '');
        setTimeout(() => el.removeAttribute('data-anatomy-ring'), 1500);
      }
      const num = callouts.find((c) => c.dataset.part === part);
      for (const c of callouts) c.classList.remove('is-lit');
      clearTimeout(litTimer);
      num?.classList.add('is-lit');
      litTimer = window.setTimeout(() => num?.classList.remove('is-lit'), 1500);
    };
    // a player mounted just now lays out its dock on the next frame
    if (m.container.querySelector('.tactile-dock')?.getBoundingClientRect().width) go();
    else requestAnimationFrame(() => requestAnimationFrame(go));
  }

  function wireAnatomy(m: Mounted): void {
    // the first real interaction hides TRY IT and stops the nudge
    const interact = () => {
      dismissHint();
      for (const a of running) a.cancel();
    };
    m.container.addEventListener('pointerdown', interact);
    m.container.addEventListener('touchstart', interact, { passive: true });
    m.container.addEventListener('keydown', interact);
    // hover or focus on a control lights its number and card
    m.container.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'touch') highlight(partOf(e.target as Node));
    });
    m.container.addEventListener('pointerleave', () => highlight(null));
    m.container.addEventListener('focusin', (e) => highlight(partOf(e.target as Node)));
    m.container.addEventListener('focusout', (e) => {
      if (!m.container.contains(e.relatedTarget as Node)) highlight(null);
    });
  }

  /**
   * First time the panel is in view: the seek cap nudges out 14 px and eases back (600 ms), then the Play key dips 1 px
   * (70 ms down, 200 ms up). Transform only: the media time does not change and nothing plays. Not under reduced motion.
   */
  const running: Animation[] = [];
  const nudgeObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      nudgeObserver.disconnect();
      if (reducedMotion.matches || hintGone) return;
      const m = getAnatomy();
      const start = () => {
        const cap = target(m, 'seek');
        const play = target(m, 'play');
        if (!cap || hintGone) return;
        const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
        const nudge = cap.animate(
          [
            { transform: 'translateX(0)', easing: 'cubic-bezier(0.4, 0, 1, 1)' },
            { transform: 'translateX(14px)', offset: 140 / 740, easing: EASE },
            { transform: 'translateX(0)' },
          ],
          { duration: 740 }
        );
        running.push(nudge);
        nudge.onfinish = () => {
          if (!play || hintGone) return;
          const press = play.animate(
            [
              { transform: 'translateY(0)', easing: 'ease-out' },
              { transform: 'translateY(1px)', offset: 70 / 270, easing: 'ease-in-out' },
              { transform: 'translateY(0)' },
            ],
            { duration: 270, delay: 120 }
          );
          running.push(press);
        };
      };
      // wait for the clip's frame at 3 s (the cap sits where it will stay), then a beat so the eye lands first
      const ready = () => setTimeout(start, 400);
      if (m.media.readyState >= 1 && !m.media.seeking && m.media.currentTime > 0) ready();
      else m.media.addEventListener('seeked', ready, { once: true });
    },
    { threshold: 0.6 }
  );
  nudgeObserver.observe(anatomyFrame);

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
