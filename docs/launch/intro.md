> **DRAFT — not for publication until approved.** Issue #378. The numbers come from `comparison.md` and its Issues.

# Tailwind classes that arrive after the build

Tailwind compiles the classes it can see at build time. Some classes aren't there yet. An AI model writes
them at runtime, a CMS editor types them into content, or an embedded widget renders them inside a shadow
root on someone else's page. Those classes render unstyled.

**BaroCSS** (published **0.10.1**: `@barocss/kit`, `@barocss/browser`, `@barocss/server`) generates
Tailwind-compatible CSS for those classes at runtime, alongside your existing build.

## What we measured

- Real model-written json-render specs in a Tailwind-built app: 0.859 of elements match the reference with
  BaroCSS, against 0.163 with the build alone, and the app shell is untouched (#231).
- AI-written CMS blocks: 0.938 parity with 0 shell damage (#253). `@tailwindcss/browser` reached 1.000
  here but changed elements of the shell.
- SSR: the client runtime alone leaves ~270–340 ms unstyled. `@barocss/server` gets a full match at first
  paint (#266).
- Shadow DOM widgets under strict CSP: parity 1.000, 0 host damage, and 0 cross-origin loads from 22
  adversarial class shapes (#327, #347, #364).
- An agent reading only the docs adopted it in an Astro CMS starter. The strong model reached 0.983 at first
  paint; the weak model was unreliable (#289).

## When not to use it

- **You know the class set in advance** (a fixed component catalog): pre-generate at build time instead. It
  is better: parity 1.0 with no runtime (#218).
- **A no-build prototype page:** `@tailwindcss/browser` has higher parity there (100% vs 92.3–98.1%, #198).

## Caveats

Headless browsers, 3–5 runs per arm, frozen model outputs. Firefox and WebKit reruns match Chromium (#374).
All the evidence so far is our own, and we want your real cases. Details: [comparison](./comparison.md).
