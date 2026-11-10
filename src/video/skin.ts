import '../styles/video/tactile.css';
import './skin.css';
import '@videojs/html/i18n';
import '@videojs/html/ui/container';
import '@videojs/html/ui/poster';
import '@videojs/html/ui/error-dialog';
import '@videojs/html/ui/dialog-backdrop';
import '@videojs/html/ui/dialog-popup';
import '@videojs/html/ui/dialog-title';
import '@videojs/html/ui/dialog-description';
import '@videojs/html/ui/dialog-close';
import '@videojs/html/ui/controls';
import '@videojs/html/ui/controls-group';
import '@videojs/html/ui/controls-content';
import '@videojs/html/ui/buffering-indicator';
import '@videojs/html/ui/play-button';
import '@videojs/html/ui/mute-button';
import '@videojs/html/ui/captions-button';
import '@videojs/html/ui/fullscreen-button';
import '@videojs/html/ui/time-slider';
import '@videojs/html/ui/volume-slider';
import '@videojs/html/ui/slider-track';
import '@videojs/html/ui/slider-buffer';
import '@videojs/html/ui/slider-fill';
import '@videojs/html/ui/slider-thumb';
import '@videojs/html/ui/slider-thumbnail';
import '@videojs/html/ui/slider-value';
import '@videojs/html/ui/time-group';
import '@videojs/html/ui/time';
import '@videojs/html/ui/time-separator';
import '@videojs/html/ui/menu';
import '@videojs/html/ui/menu-content';
import '@videojs/html/ui/menu-item';
import '@videojs/html/ui/menu-separator';
import '@videojs/html/ui/menu-radio-item';
import '@videojs/html/ui/menu-item-indicator';
import '@videojs/html/ui/playback-rate-radio-group';
import '@videojs/html/ui/captions-radio-group';
import '@videojs/html/ui/quality-radio-group';
import '@videojs/html/ui/hotkey';
import '@videojs/html/ui/gesture';
import '@videojs/html/ui/status-announcer';
import '@videojs/html/ui/tooltip';
import '@videojs/html/ui/tooltip-group';
import '@videojs/html/ui/tooltip-label';
import '@videojs/html/ui/tooltip-shortcut';
import {
  I18nController,
  i18nContext,
  type PlaybackRateRadioGroupElement,
  PlayerController,
  playerContext,
  selectPlayback,
  selectPlaybackRate,
  UIElement,
  type PropertyValues,
} from '@videojs/html';
import { rateText } from '@videojs/html/i18n/text/playback';
import { registerIcons } from '@videojs/html/icons';

/*
 * Tactile icon family. Drawn on an 18×18 grid, from design/Final.dc.html. Strokes are 1.4 (glyphs), 1.5 (fullscreen),
 * or 1.6 (play/pause, chevron, check); the play triangle is the only filled glyph. Icons not on the board (volume-off,
 * fullscreen-exit, restart, check) are drawn to the same grid and weight.
 */
const svg = (attrs: string, body: string) =>
  `<svg viewBox="0 0 18 18" ${attrs} aria-hidden="true" focusable="false">${body}</svg>`;

const stroke = (width: number, body: string, extra = 'stroke-linejoin="round"') =>
  svg(`fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" ${extra}`, body);

/** Play and pause share one glyph: two quads whose `d` morphs between the triangle halves and the two bars. */
export const PLAY_PAUSE_PATHS = {
  playLeft: 'M5.5 3.6 L9.75 6.3 L9.75 11.7 L5.5 14.4 Z',
  playRight: 'M9.75 6.3 L14 9 L14 9 L9.75 11.7 Z',
  pauseLeft: 'M5.7 3.4 L7.3 3.4 L7.3 14.6 L5.7 14.6 Z',
  pauseRight: 'M10.7 3.4 L12.3 3.4 L12.3 14.6 L10.7 14.6 Z',
} as const;

registerIcons('tactile', {
  play: svg('fill="currentColor"', '<path d="M5.5 3.6 14 9l-8.5 5.4z"/>'),
  pause: stroke(1.6, '<path d="M6.5 4v10M11.5 4v10"/>', ''),
  playpause: svg(
    'fill="currentColor"',
    `<path class="tactile-pp tactile-pp-left" d="${PLAY_PAUSE_PATHS.playLeft}"/>` +
      `<path class="tactile-pp tactile-pp-right" d="${PLAY_PAUSE_PATHS.playRight}"/>`
  ),
  // Replay: Lucide's rotate-ccw geometry scaled 24 → 18 (counter-clockwise arc, head at the start).
  restart: stroke(
    1.5,
    '<path d="M2.25 9a6.75 6.75 0 1 0 6.75-6.75A7.31 7.31 0 0 0 3.945 4.305L2.25 6"/><path d="M2.25 2.25V6h3.75"/>'
  ),
  'volume-high': stroke(
    1.4,
    '<path d="M2.5 6.7h2.8l3.9-3.2v11l-3.9-3.2H2.5z"/><path d="M12 6.3a3.8 3.8 0 0 1 0 5.4M14 4.3a6.6 6.6 0 0 1 0 9.4"/>'
  ),
  'volume-low': stroke(1.4, '<path d="M2.5 6.7h2.8l3.9-3.2v11l-3.9-3.2H2.5z"/><path d="M12 6.3a3.8 3.8 0 0 1 0 5.4"/>'),
  'volume-off': stroke(1.4, '<path d="M2.5 6.7h2.8l3.9-3.2v11l-3.9-3.2H2.5z"/><path d="M12 7l4 4M16 7l-4 4"/>'),
  'fullscreen-enter': stroke(1.5, '<path d="M2.5 6.5v-4h4M11.5 2.5h4v4M15.5 11.5v4h-4M6.5 15.5h-4v-4"/>'),
  // Exit mirrors enter: same 13px optical box, arms turned inward.
  'fullscreen-exit': stroke(1.5, '<path d="M7 2.5V7H2.5M11 2.5V7h4.5M15.5 11H11v4.5M2.5 11H7v4.5"/>'),
  // The frame with its text set as a subtitle: two lines against the bottom edge, a long one over a short one.
  captions: stroke(1.4, '<rect x="2" y="4" width="14" height="10" rx="2.5"/><path d="M5 9h8M6.5 11.5h5"/>', ''),
  settings: stroke(
    1.4,
    '<path d="M2.5 5h13M2.5 9h13M2.5 13h13"/>' +
      '<rect class="tactile-knob" x="5" y="3.2" width="2.8" height="3.6" rx="1"/>' +
      '<rect class="tactile-knob" x="10.5" y="7.2" width="2.8" height="3.6" rx="1"/>' +
      '<rect class="tactile-knob" x="6.5" y="11.2" width="2.8" height="3.6" rx="1"/>',
    ''
  ),
  chevron: stroke(1.6, '<path d="M7 4l5 5-5 5"/>'),
  check: stroke(1.6, '<path d="M4 9.5l3.2 3.2L14 6"/>'),
});

/** `1` → `1.0×`, `1.5` → `1.5×`, `0.75` → `0.75×`. One decimal unless the rate needs two. */
function formatRate(rate: number): string {
  const text = Number.isInteger(rate * 10) ? rate.toFixed(1) : rate.toFixed(2);
  return `${text}×`;
}

/**
 * The status display: a black pill that reads "PLAY 1.0×" or "PAUSED" from the player store, next to the time group.
 * It reflects `data-paused`, `data-ended`, and `data-started`, so the skin can swap the label and show the pill only
 * when it matters, and writes the playback rate into its `[data-part="rate"]` child.
 */
class TactileStatusElement extends UIElement {
  static readonly tagName = 'tactile-status';

  readonly #playback = new PlayerController(this, playerContext, selectPlayback);
  readonly #rate = new PlayerController(this, playerContext, selectPlaybackRate);
  readonly #i18n = new I18nController(this, i18nContext);

  override connectedCallback(): void {
    super.connectedCallback();

    // The Speed menu shows rates the same way the pill does: `1.0×`, not `1×`.
    const container = this.closest('media-container');
    // When the markup is set on a <video-player> that is already in the page, this element connects before the
    // groups further down have upgraded; a property set then would be shadowed, so upgrade each group first.
    container?.querySelectorAll<PlaybackRateRadioGroupElement>('media-playback-rate-radio-group').forEach((group) => {
      customElements.upgrade(group);
      group.formatRate = formatRate;
    });
    container?.querySelectorAll<HTMLElement>('media-menu.tactile-menu').forEach(watchMenuScroll);
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed);

    const playback = this.#playback.value;

    if (playback) {
      this.toggleAttribute('data-paused', playback.paused);
      this.toggleAttribute('data-ended', playback.ended);
      this.toggleAttribute('data-started', playback.started);

      // The centre key leaves the screen while playing. If the keyboard had the focus on it (Space or Enter on the
      // key, or K), the dock's play key takes it, so the next Tab continues from the same control. A click or tap
      // does not move focus: a focused dock key would open its tooltip under a pointer that never went there.
      const playing = playback.started && !playback.paused && !playback.ended;
      const active = document.activeElement;

      if (playing && active instanceof HTMLElement && active.classList.contains('tactile-center-play')) {
        const skin = this.closest<HTMLElement>('.media-skin');

        if (skin?.contains(active)) {
          if (skin.getAttribute('data-input') === 'keyboard') {
            // Next frame: the dock is out of the Tab order until its own play key has seen the new state.
            requestAnimationFrame(() => {
              if (document.activeElement !== active) return;
              skin.querySelector<HTMLElement>('.tactile-dock-play')?.focus({ focusVisible: true } as FocusOptions);
            });
          } else {
            active.blur();
          }
        }
      }
    }

    const rate = this.#rate.value;
    const rateElement = this.querySelector<HTMLElement>('[data-part="rate"]');

    if (!rateElement) return;

    if (rate && rate.playbackRateAvailability === 'available') {
      const text = formatRate(rate.playbackRate);

      rateElement.hidden = false;
      rateElement.textContent = text;
      rateElement.setAttribute('aria-label', this.#i18n.value(rateText, { rate: text }));
      this.setAttribute('data-rate', String(rate.playbackRate));
    } else {
      rateElement.hidden = true;
      rateElement.textContent = '';
      rateElement.removeAttribute('aria-label');
      this.removeAttribute('data-rate');
    }
  }
}

if (!customElements.get(TactileStatusElement.tagName)) {
  customElements.define(TactileStatusElement.tagName, TactileStatusElement);
}

/*
 * Menu scrolling. A menu page is clipped by default; it becomes scrollable only through `data-scrollable`, which is
 * set here once the panel has stopped moving and the page measures taller than its box. Any state change on the panel
 * or a page (opening, closing, a page sliding in) removes the attribute at once, in the same task as the change and
 * so before the next paint, which is what keeps a scrollbar from flashing while the panel resizes around its content.
 */
const watchedMenus = new WeakSet<Element>();

function watchMenuScroll(menu: HTMLElement): void {
  if (watchedMenus.has(menu)) return;
  watchedMenus.add(menu);

  const pages = () => [...menu.querySelectorAll<HTMLElement>('media-menu-content')];
  const moving = (el: Element) => el.hasAttribute('data-starting-style') || el.hasAttribute('data-ending-style');
  let frame = 0;

  const lock = () => {
    for (const page of pages()) page.removeAttribute('data-scrollable');
  };

  const measure = () => {
    const parts = new Set<Element>([menu, ...pages()]);
    const animating = menu
      .getAnimations({ subtree: true })
      .some((a) => a.playState === 'running' && parts.has((a.effect as KeyframeEffect | null)?.target as Element));

    // Still moving: the transition's end event measures again.
    if (!menu.hasAttribute('data-open') || moving(menu) || animating || pages().some(moving)) return;

    for (const page of pages()) {
      const current = !page.hasAttribute('data-child-open') && page.getClientRects().length > 0;
      page.toggleAttribute('data-scrollable', current && page.scrollHeight > page.clientHeight + 1);
    }
  };

  const settle = () => {
    cancelAnimationFrame(frame);
    // Two frames: the first lets a transition that this change starts register before it is looked for.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(measure);
    });
  };

  new MutationObserver((records) => {
    if (records.every((record) => record.attributeName === 'data-scrollable')) return;
    lock();
    settle();
  }).observe(menu, { attributes: true });

  // Pages are few and fixed in the template; rows are not observed, so hovering a row never unlocks or locks a page.
  const pageObserver = new MutationObserver((records) => {
    if (records.every((record) => record.attributeName === 'data-scrollable')) return;
    lock();
    settle();
  });
  for (const page of pages()) pageObserver.observe(page, { attributes: true });

  const onEnd = (event: Event) => {
    const target = event.target as Element;
    if (target === menu || target.localName === 'media-menu-content') settle();
  };
  menu.addEventListener('transitionend', onEnd);
  menu.addEventListener('transitioncancel', onEnd);
  menu.addEventListener('animationend', onEnd);

  // The player resizing (fullscreen, rotation) changes how much room the panel has.
  new ResizeObserver(() => {
    lock();
    settle();
  }).observe(menu);
}

/** Distance the seek preview keeps from the player's edges, in px. */
const PREVIEW_EDGE = 8;

/**
 * The seek preview: the storyboard frame and the pointer time above the timeline. CSS centres it on
 * `--media-slider-pointer`; this element measures how far it may travel before it would leave the player and writes
 * that as `--tactile-preview-min` / `--tactile-preview-max` (offsets from the slider's left edge), so the preview
 * clamps at the player's edges, not at the ends of the slider.
 */
class TactileSeekPreviewElement extends HTMLElement {
  static readonly tagName = 'tactile-seek-preview';

  #observer: ResizeObserver | null = null;
  #abort: AbortController | null = null;

  connectedCallback(): void {
    const slider = this.closest<HTMLElement>('media-time-slider');
    const container = this.closest<HTMLElement>('media-container');
    if (!slider || !container) return;

    const sync = () => {
      const bounds = container.getBoundingClientRect();
      const track = slider.getBoundingClientRect();
      const width = this.offsetWidth;
      if (!bounds.width || !track.width || !width) return;

      // Rects are in viewport px; the offsets are used inside the controls layer, which may be zoomed.
      const zoom = (this as { currentCSSZoom?: number }).currentCSSZoom || 1;
      const min = (bounds.left - track.left) / zoom + PREVIEW_EDGE;
      const max = Math.max(min, (bounds.right - track.left) / zoom - PREVIEW_EDGE - width);
      this.style.setProperty('--tactile-preview-min', `${min.toFixed(1)}px`);
      this.style.setProperty('--tactile-preview-max', `${max.toFixed(1)}px`);
    };

    this.#observer = new ResizeObserver(sync);
    this.#observer.observe(container);
    this.#observer.observe(slider);

    // The slider can move without resizing (a neighbour changes width), so measure again when it is used.
    this.#abort = new AbortController();
    slider.addEventListener('pointerenter', sync, { signal: this.#abort.signal });
    slider.addEventListener('pointerdown', sync, { signal: this.#abort.signal });
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#abort?.abort();
    this.#abort = null;
  }
}

if (!customElements.get(TactileSeekPreviewElement.tagName)) {
  customElements.define(TactileSeekPreviewElement.tagName, TactileSeekPreviewElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'tactile-status': TactileStatusElement;
    'tactile-seek-preview': TactileSeekPreviewElement;
  }
}

/*
 * "Try again" on the error screen. The dialog's close part dismisses the error; this reloads the source the media
 * element already has, returns to where playback was, and plays again if it had started.
 */
type ReloadableMedia = HTMLElement & Pick<HTMLMediaElement, 'load' | 'play' | 'currentTime' | 'addEventListener'>;

function findMedia(container: Element): ReloadableMedia | undefined {
  return [...container.children].find(
    (child): child is ReloadableMedia => 'currentTime' in child && typeof (child as ReloadableMedia).load === 'function'
  );
}

function retry(event: Event): void {
  const key = (event.target as Element | null)?.closest?.('[data-tactile-retry]');
  const container = key?.closest('.media-skin[data-theme="tactile"]');
  const media = container && findMedia(container);
  if (!container || !media) return;

  const started = container.querySelector('.tactile-dock-play')?.hasAttribute('data-started') ?? false;
  const time = media.currentTime;

  media.load();

  if (!started) return;

  media.addEventListener(
    'loadedmetadata',
    () => {
      if (time > 0) media.currentTime = time;
      void media.play().catch(() => undefined);
    },
    { once: true }
  );
}

/*
 * Input modality. Menus move focus into their first row when they open, and Chromium then matches `:focus-visible`
 * even after a mouse click. The container records the last input kind so the skin can show the ring only for
 * keyboard-driven focus (`[data-input="keyboard"] .tactile-row:focus-visible`).
 */
function markInput(event: Event, kind: 'pointer' | 'keyboard'): void {
  const target = event.target as Element | null;
  const skin = target?.closest?.('.media-skin[data-theme="tactile"]');
  if (skin && skin.getAttribute('data-input') !== kind) skin.setAttribute('data-input', kind);
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', retry);
  document.addEventListener('pointerdown', (event) => markInput(event, 'pointer'), true);
  document.addEventListener(
    'keydown',
    (event) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey) markInput(event, 'keyboard');
    },
    true
  );
}
