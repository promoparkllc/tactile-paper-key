// The showcase page v3: the players (the real skin, four of them) load after the page's load event, so the first
// screen paints with the poster before the skin's script runs; the section nav runs at once.
import './showcase.css';
// Sections 06 and 07 (Copy keys, token links, their reveal) and the players load after the page's load event.
const start = () => {
  void import('./specs-install');
  void import('./states');
  void import('./players').then((m) => m.bootPlayers());
};
if (document.readyState === 'complete') void start();
else window.addEventListener('load', () => (window.requestIdleCallback ? window.requestIdleCallback(() => void start(), { timeout: 1500 }) : setTimeout(() => void start(), 0)), { once: true });

// ---------------------------------------------------------------- Nav: the current section ----------------------
const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('.nav a')];
const sections = navLinks.map((a) => document.querySelector<HTMLElement>(a.getAttribute('href')!)).filter((s): s is HTMLElement => !!s);
const current = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const a of navLinks) {
        const is = a.getAttribute('href') === `#${entry.target.id}`;
        if (is) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      }
    }
  },
  { rootMargin: '-40% 0px -55% 0px' }
);
for (const s of sections) current.observe(s);
