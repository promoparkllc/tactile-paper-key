// Sections 06 Specs and 07 Install (design/InstallSpecs.dc.html): the Copy keys, the part ↔ token links, the phone
// "+ N more" toggle, and the one-time reveal when a section enters the viewport. No player code: it runs at once.

export {};

const COPY_ICON =
  '<svg class="i-copy" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5.5" y="5.5" width="8" height="8" rx="1.8"/><path d="M10.5 3.5v-.3A1.7 1.7 0 0 0 8.8 1.5H4.2a1.7 1.7 0 0 0-1.7 1.7v4.6a1.7 1.7 0 0 0 1.7 1.7h.3"/></svg>';
const CHECK_ICON =
  '<svg class="i-check" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3.5 8.5l3 3 6-7"/></svg>';

/** How long a Copy key stays latched and its pill stays up. */
const DONE_MS = 1500;

const liveRegion = document.getElementById('copy-status');
const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

/** The polite live region: cleared first, so the same word is announced again on the next copy. */
function announce(text: string): void {
  if (!liveRegion) return;
  liveRegion.textContent = '';
  requestAnimationFrame(() => {
    liveRegion.textContent = text;
  });
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function select(node: Node): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

// ---------------------------------------------------------------- 07: Copy keys ---------------------------------
/** What a step copies: its command only (no "$", no step number). Statements shown side by side copy as lines. */
function stepText(step: Element): string {
  const text = step.querySelector('.cmd-text');
  if (!text) return '';
  const statements = [...text.querySelectorAll('.stmt')];
  return (statements.length ? statements.map((s) => s.textContent ?? '').join('\n') : (text.textContent ?? '')).trim();
}

const timers = new WeakMap<Element, number>();

function flash(el: Element, classes: string[], ms = DONE_MS): void {
  el.classList.add(...classes);
  window.clearTimeout(timers.get(el));
  timers.set(el, window.setTimeout(() => el.classList.remove(...classes), ms));
}

for (const key of document.querySelectorAll<HTMLButtonElement>('.inst-step .ck')) {
  const step = key.closest('.inst-step')!;
  const toast = key.querySelector<HTMLElement>('.toast')!;
  key.insertAdjacentHTML('afterbegin', COPY_ICON + CHECK_ICON);
  key.hidden = false;

  key.addEventListener('click', async () => {
    if (await writeClipboard(stepText(step))) {
      toast.textContent = 'COPIED';
      flash(key, ['is-done', 'is-toast']);
      announce('Copied');
      return;
    }

    // No clipboard access: select the command and say which keys copy it.
    const shortcut = isMac ? '⌘C' : 'CTRL+C';
    select(step.querySelector('.cmd-text')!);
    toast.textContent = `PRESS ${shortcut}`;
    flash(key, ['is-toast'], 3000);
    announce(`Selected. Press ${isMac ? 'Command C' : 'Control C'} to copy.`);
  });
}

// ---------------------------------------------------------------- 06: part ↔ token ------------------------------
const drawing = document.querySelector<HTMLElement>('.spec-draw');
const tokens = document.querySelector<HTMLElement>('.spec-tokens');

if (drawing && tokens) {
  const parts = [...drawing.querySelectorAll<HTMLButtonElement>('.part')];
  const rows = [...tokens.querySelectorAll<HTMLButtonElement>('.tok')];
  const dock = drawing.querySelector<HTMLElement>('.spec-dock');
  const list = (value: string | undefined) => (value ?? '').split(' ').filter(Boolean);
  /** The parts a row lights, and the parts that light the row (a part lights only the tokens it is drawn from). */
  const partsOf = (row: HTMLElement) => list(row.dataset.parts);
  const lightsFor = (row: HTMLElement) => list(row.dataset.for);
  /** A part pinned by a tap or click stays lit until another is picked. */
  let pinned: string | null = null;

  /** Light a set of parts and the rows that read them, or one row and its parts. */
  function light(partNames: string[], row: HTMLElement | null): void {
    for (const p of parts) {
      const on = partNames.includes(p.dataset.part!);
      p.classList.toggle('is-on', on);
      if (p.dataset.part === 'dock') dock?.classList.toggle('is-on', on);
    }
    for (const r of rows) r.classList.toggle('is-on', row ? r === row : lightsFor(r).some((n) => partNames.includes(n)));
  }
  const rest = () => light(pinned ? [pinned] : [], null);

  for (const part of parts) {
    const name = part.dataset.part!;
    const on = () => light([name], null);
    part.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && on());
    part.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && rest());
    part.addEventListener('focus', on);
    part.addEventListener('blur', rest);
    part.addEventListener('click', () => {
      pinned = pinned === name ? null : name;
      for (const p of parts) p.setAttribute('aria-pressed', String(p.dataset.part === pinned));
      light(pinned ? [pinned] : part.matches(':hover, :focus-visible') ? [name] : [], null);
    });
  }

  for (const row of rows) {
    row.querySelector('.mini')!.innerHTML = COPY_ICON.replace(/width="14" height="14"/, 'width="11" height="11"') + CHECK_ICON.replace(/width="14" height="14"/, 'width="11" height="11"');
    const on = () => light(partsOf(row), row);
    row.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && on());
    row.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && rest());
    row.addEventListener('focus', on);
    row.addEventListener('blur', rest);
    row.addEventListener('click', async () => {
      on();
      const text = row.dataset.copy ?? '';
      if (await writeClipboard(text)) {
        flash(row, ['is-done']);
        announce('Copied');
      } else {
        select(row.querySelector('.tok-n')!);
        announce(`Could not copy. ${text}`);
      }
    });
  }

  // Phone: the four main rows, then "+ N more" opens the rest in place.
  const more = tokens.querySelector<HTMLButtonElement>('.tok-more');
  if (more) {
    const hidden = rows.filter((r) => !r.hasAttribute('data-primary')).length;
    const closed = `+ ${hidden} more · tap a row to copy`;
    more.textContent = closed;
    more.hidden = false;
    tokens.setAttribute('data-collapsed', '');
    more.addEventListener('click', () => {
      const open = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', String(open));
      tokens.toggleAttribute('data-collapsed', !open);
      tokens.toggleAttribute('data-expanded', open);
      more.textContent = open ? 'Show fewer' : closed;
      // the rows just opened come before the button: move focus to the first of them
      if (open) rows.find((r) => !r.hasAttribute('data-primary'))?.focus();
    });
  }
}

// ---------------------------------------------------------------- Reveal, once ----------------------------------
const sections = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
const index = (root: ParentNode, selector: string, from = 0) => root.querySelectorAll<HTMLElement>(selector).forEach((el, i) => el.style.setProperty('--i', String(from + i)));

for (const section of sections) {
  index(section, '.inst-step');
  index(section, '.spec-parts .part'); // a part's dimension line, ticks and label inherit its index
  index(section, '.spec-dock', 5);
  index(section, '.spec-caption', 8);
  index(section, '.spec-tokens > *');
}

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const section = entry.target as HTMLElement;
        section.dataset.reveal = 'in';
        observer.unobserve(section);
        // Once it has played, the animations come off: a row shown later (the phone list opening) must not replay.
        window.setTimeout(() => (section.dataset.reveal = 'done'), 1800);
      }
    },
    { threshold: 0.25 }
  );
  for (const section of sections) {
    // Already on screen when this module arrives (a link to #install): it stays as it is, nothing hides and comes back.
    const box = section.getBoundingClientRect();
    if (box.top < innerHeight && box.bottom > 0) continue;
    section.dataset.reveal = 'wait';
    observer.observe(section);
  }
}
