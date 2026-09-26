> **DRAFT — not for publication until approved.** Issue #378. The numbers and their releases come from `comparison.md`.

# Tailwind classes that arrive after the build

Tailwind compiles the classes it can see at build time. Some classes aren't there yet. An AI model writes
them at runtime, a CMS editor types them into content, or an embedded widget renders them inside a shadow
root on someone else's page. Those classes render unstyled.

**BaroCSS** (published **0.10.1**: `@barocss/kit`, `@barocss/browser`, `@barocss/server`) generates
Tailwind-compatible CSS for those classes at runtime, alongside your existing build.

## What we measured

- Shadow DOM widgets under strict CSP on a hostile host: parity 1.000, 0 host damage, and 0 cross-origin
  loads from 22 adversarial class shapes (#364, published 0.10.0).
- AI-written CMS blocks on a strict-CSP page and in shadow-root mode: 1.0 (#347, #355, dev after 0.9.0).
- Real model-written json-render specs in a Tailwind-built app: 0.859 of elements match, against 0.163
  build-only, with the shell untouched (#231; unchanged in #305, dev after 0.8.0).
- SSR: the client runtime alone leaves ~270–340 ms unstyled. `@barocss/server` gets a full match at first
  paint (#266).
- An agent reading only the docs adopted it in an Astro CMS starter. The strong model reached 0.983 at first
  paint; the weak model was unreliable (#289, published 0.7.0).

## When not to use it

- **You know the class set in advance:** pre-generate at build time. Parity 1.0 with no runtime (#218).
- **A no-build page under a default CSP:** `@tailwindcss/browser`, the official runtime, already covers it
  (#198).
- BaroCSS is a reimplementation: 100% on its parity corpora (#241, #304), 100% on 567 held-out classes (dev after 0.10.1; 94.5% when #243 first measured it).

## Caveats

Headless browsers, 3–5 runs per arm, frozen model outputs. Few numbers were measured on 0.10.1 itself.
Firefox and WebKit reruns match Chromium (#374). All the evidence so far is our own, and we want your real
cases. Details: [comparison](./comparison.md).
