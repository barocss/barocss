> **DRAFT — not for publication until approved.** Issue #378. The numbers and their releases come from `comparison.md`.

# Tailwind classes that arrive after the build

Tailwind compiles the classes it can see at build time. Some classes aren't there yet. An AI model writes
them at runtime, a CMS editor types them into content, or an embedded widget renders them inside a shadow
root on someone else's page. Those classes render unstyled.

**BaroCSS** (published **0.10.1**: `@barocss/kit`, `@barocss/browser`, `@barocss/server`) generates
Tailwind-compatible CSS for those classes at runtime, alongside your existing build.

## What we measured

- Shadow DOM widgets under strict CSP on a hostile host: 0 host damage and 0 cross-origin loads from 22
  adversarial class shapes (#364, published 0.10.0). A gap found during launch prep (@property-backed
  utilities didn't render inside shadow roots) is fixed in 0.10.2 (0/905 in 3 engines, #384).
- AI-written CMS blocks on a strict-CSP page: 1.0 (#347, dev after 0.9.0).
- Real model-written json-render specs in a Tailwind-built app: 0.904 of elements match, against 0.163
  build-only; the shell is untouched before mount and 0.997 after (#231 rerun in #383, published 0.10.1).
- SSR: `@barocss/server` gets a full match at first paint; the client runtime alone leaves ~350–410 ms
  unstyled (#266 rerun in #383, published 0.10.1).
- An agent reading only the docs adopted it in an Astro CMS starter. The strong model reached 0.983 at first
  paint; the weak model was unreliable (#289, published 0.7.0).

## When not to use it

- **You know the class set in advance:** pre-generate at build time. Parity 1.0 with no runtime (#218).
- **A no-build page under a default CSP:** `@tailwindcss/browser`, the official runtime, already covers it.
  BaroCSS now matches it there (100% vs 100%), but twb paints the final state sooner (#198 rerun in #383,
  published 0.10.1).
- BaroCSS is a reimplementation: 100% on its parity corpora (#241, #304), 100% on 567 held-out classes (dev after 0.10.1; 94.5% when #243 first measured it).

## Caveats

Headless browsers, 3–5 runs per arm, frozen model outputs. #198, #231 and #266 were rerun on published 0.10.1 (#383); the rest are older releases.
Firefox and WebKit reruns match Chromium (#374). All the evidence so far is our own, and we want your real
cases. Details: [comparison](./comparison.md).
