# Lighthouse

Page tested: https://tactile-paper-key.vercel.app/ (production), Lighthouse 13.6.0, 2026-11-10 14:00 UTC, one run
per form factor with Lighthouse's default throttling.

| Form factor | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop | 100 | 100 | 100 | 100 | 0.5 s | 0 | 20 ms |
| Mobile | 99 | 100 | 100 | 100 | 1.2 s | 0 | 140 ms |

An earlier run the same day (13:14 UTC), before the page's secondary players were deferred until after load, scored
98 on desktop and 67 on mobile for performance, with the other three categories at 100.

The raw HTML and JSON reports stay in the working repository; they are not part of the public one.
