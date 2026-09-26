> **DRAFT — not for publication until approved.** Issue #378. The numbers and their releases come from `comparison.md`.

# Tailwind classes that arrive after the build

Tailwind compiles the classes it can see at build time. Some classes aren't there yet. An AI model writes
them at runtime, a CMS editor types them into content, or an embedded widget renders them inside a shadow
root on someone else's page. Those classes render unstyled.

**BaroCSS** (published **0.10.3**: `@barocss/kit`, `@barocss/browser`, `@barocss/server`) generates
Tailwind-compatible CSS for those classes at runtime, alongside your existing build.

## What we measured

- Shadow DOM widgets under strict CSP on a hostile host: 0 host damage and 0 cross-origin loads from 22
  adversarial class shapes (#364, published 0.10.0). A gap found during launch prep (@property-backed
  utilities didn't render inside shadow roots) is fixed in 0.10.2 (0/905 in 3 engines, #384).
- AI-written CMS blocks on a strict-CSP page: 1.0 (#347, dev after 0.9.0).
- Real model-written json-render specs in a Tailwind-built app: 0.904 of elements match, against 0.163
  build-only; the shell is untouched before mount and 0.997 after (#231 rerun in #383, published 0.10.1). The 0.997 is not
  a regression: #394 measured the same 0.9972 on the #231 commit, 0.8.0 and 0.10.1 (deterministic, N=1).
- SSR: `@barocss/server` gets a full match at first paint; the client runtime alone leaves a median 408 ms
  (opus spec) / 360 ms (haiku spec) unstyled on 0.10.1, against 390 / 327 ms for 0.8.0 in the same #394
  session (N=3 per release, 4x CPU throttle, `scripts/regress-394/result.json`).
- An agent reading only the docs adopted it in an Astro CMS starter. The strong model reached 0.983 at first
  paint (#289, published 0.7.0). The weak model (haiku) was unreliable in #289; after the #306 doc fixes a
  recheck adopted it 2/2: first paint 0.983 / 0.958, hydrated 1.0 / 0.975, 0 shell damage
  (`scripts/cms-starter-probe/results-306-recheck.json`, published 0.7.0).

## When not to use it

- **You know the class set in advance:** pre-generate at build time. Parity 1.0 with no runtime (#218).
- **A no-build page under a default CSP:** `@tailwindcss/browser`, the official runtime, already covers it.
  BaroCSS now matches it there (100% vs 100%), but twb reached the final state sooner in the same run (24 vs 43 ms,
  #198 rerun in #383, published 0.10.1, single session, both runtimes side by side).
- BaroCSS is a reimplementation: 100% on its parity corpora (#241, #304), 100% on 567 held-out classes (dev after 0.10.1; 94.5% when #243 first measured it).

## Security posture

- A fuzz campaign over untrusted class input (#319, `scripts/fuzz/campaign.mjs`, widened in #339) found
  issues that were fixed in 0.8.1 / 0.8.2 (security and availability) and in 0.10.3 (class input could
  produce a rule applying outside its element). See `packages/barocss/CHANGELOG.md`.
- CI runs a multi-seed fuzz ratchet: a fixed seed list plus a logged rotating seed (#392,
  `packages/barocss/tests/fuzz/fuzz.test.ts`).
- The [security guide](../../apps/barocss-docs/docs/guide/security.md) (#345) covers untrusted classes,
  strict CSP and limiting external `url()` loads.

## Known issues

- When two utilities on one element set the same property, BaroCSS can pick a different winner than a
  Tailwind build; fix in progress (#401).

## Caveats

Headless browsers, 3–5 runs per arm, frozen model outputs. #198, #231 and #266 were rerun on published 0.10.1 (#383); the rest are older releases.
Firefox and WebKit reruns match Chromium (#374). All the evidence so far is our own, and we want your real
cases. Details: [comparison](./comparison.md).
