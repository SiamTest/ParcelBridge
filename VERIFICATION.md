# Verification · Ankur Website 1.0.2

Verified on 5 October 2026.

Version 1.0.2 restores the SoundDesigner expansion styles for both join buttons. At 320, 360, 390, 768 and 1440px, browser checks confirm intermediate animated height, width expansion, 100/150ms staged options, chevron-to-X rotation, no clipped menu items, Escape with focus return, outside-click closing, link selection and reduced motion. No browser page errors were reported. See `preview/mobile-hero-expanded.png` and `preview/mobile-footer-expanded.png`. Svelte checks, lint, tests and the production build passed for 1.0.2.

Version 1.0.1 restores the original scroll animation on the hero navigation bar. Browser checks confirm an intermediate animated width, a narrower pill after scrolling, expansion on return to the top, all controls fitting at 320–1440px, working mobile menus, reduced motion and no page errors. See `preview/mobile-header-scrolled.png` and `preview/desktop-header-scrolled.png`.

The complete creative-tool interaction checks below were performed for 1.0.0; those components are unchanged in 1.0.1. Code checks, tests and the production build were rerun for 1.0.1.

- Svelte diagnostics: zero errors, zero warnings.
- Prettier and ESLint: passed.
- Node tests: 2 passed (scroll observer lifecycle and public content validity).
- Production static build: passed.
- Wrangler deployment dry run: passed; live deployment requires the owner's Cloudflare credentials.
- Browser: 320, 360, 390, 768, 1024 and 1440px widths; no horizontal overflow.
- Expanding join menu, mobile navigation and Escape-to-close: passed.
- Poetry draft persistence after reload and UTF-8 text download: passed.
- User-initiated musical notes and animated feedback: passed.
- Canvas drawing, clearing, keyboard stamps and PNG download: passed.
- Native FAQ expansion, Bengali font loading and scroll reveals: passed.
- Reduced-motion preference and readable no-JavaScript content: passed.
- No browser page errors or console errors while exercising those flows with the configured Content Security Policy.

`preview/desktop.png`, `preview/desktop-hero.png` and `preview/mobile.png` show the finished website. Responsive viewport checks were performed in Chromium, not on a physical phone.

Official contact details, a precise premises address, confirmed events and a final public URL still need to be supplied by the organization. These fields are editable in `src/lib/site.ts`.
