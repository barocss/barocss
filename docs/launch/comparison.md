> **DRAFT — not for publication until approved.** Issue #378. Every number cites its Issue and the release
> it was measured on. "dev after X" means unreleased source measured after release X (from `git describe`
> of the measuring commit). #198, #231 and #266 were rerun on published 0.10.1 in #383 (`scripts/rerun-383/`). Where a newer run exists, the older
> number is kept only under "History".

# BaroCSS vs `@tailwindcss/browser` vs build-time pre-generation vs no runtime

Published version: `@barocss/kit`, `@barocss/browser`, `@barocss/server` **0.10.1**.

## Where the others are better (current evidence only)

- **Fixed, known catalog → build-time pre-generation.** Parity 1.000 with zero runtime work; 144 KB gz for
  the "families" arm (#218, dev after 0.4.0, `scripts/json-render-probe/pregen.mjs`). When the class set
  is known in advance, pre-generate instead of using BaroCSS.
- **Official and mature: Tailwind / `@tailwindcss/browser`.** `@tailwindcss/browser` is the upstream
  project's own runtime, with Tailwind's ecosystem and support behind it. BaroCSS is a reimplementation: it
  is 100% on its own parity corpora (#241, #304) and 100% on a held-out corpus of 567 unseen classes (vs Tailwind 4.3.3, dev after 0.10.1;
  it was 94.5% when #243 first measured it on dev after 0.4.0). Plugins such as typography are untested (#253).
- **No-build pages (MCP Apps, default CSP): BaroCSS is not unique.** twb already covers the scenario. On
  published 0.10.1 BaroCSS ties it on parity (100% vs 100%, dynamic classes 20/20 both), but twb reaches the
  final styled state sooner (24 vs 43 ms) and is the official runtime (#198 rerun in #383, published 0.10.1).
  Under a strict CSP without a nonce, both runtimes are blocked alike (73%, same as no runtime).
- **Bytes vs a pre-built sheet.** The BaroCSS UMD CDN bundle is 52.8 KB gz (published 0.10.1, #383; the ESM
  CDN bundle was 48 KB gz in #305, dev after 0.8.0). That is smaller than twb's 68.7 KB gz but far larger than
  a 3.2 KB gz built shell (#218).
- **Shadow DOM root mode (fixed in 0.10.2).** Found during launch prep: @property-backed utilities (gradients,
  shadow, ring, translate) didn't render in shadow roots because browsers ignore @property there. Fixed in
  0.10.2 (#384): full-corpus shadow vs document mode differs on 0/905 classes in Chromium, Firefox and WebKit.

## Measured axes

| axis | BaroCSS | `@tailwindcss/browser` | build-time pre-gen | no runtime | source (release) |
|---|---|---|---|---|---|
| Class parity corpora vs Tailwind 4.3.3 and 4.1.13 | 100% | reference implementation | – | – | #241 (dev after 0.4.0), #304 (dev after 0.7.0) |
| Held-out classes (567 unseen) | 100% (94.5% in #243) | – | – | – | held-out parity test (dev after 0.10.1); #243 (dev after 0.4.0) |
| CMS blocks (#253 set) on a strict-CSP page | **1.0 / 1.0** (nonce or constructable), 0 violations | broken (styles blocked) | – | – | #347 (dev after 0.9.0) |
| Real model specs in a built app (10 specs) | 0.904 of elements; shell 1.000 before mount, 0.997 after | 0.000, shell 0.969 | – | 0.163 | #231 rerun in #383 (published 0.10.1) |
| Shadow DOM widget, strict CSP, hostile host | host damage 0; @property-backed utilities fixed in 0.10.2 (0/905 in 3 engines, #384) | 0.000 | – | 0.000 | #364 (published 0.10.0), #384 |
| Untrusted classes (22 adversarial shapes) | 0 host changes, 0 cross-origin `url()` hits (1 same-origin hit unless pre-filtered) | n/a | – | – | #364 (0.10.0) |
| SSR first paint | 1.0 match at FCP with `@barocss/server`; client-only leaves ~350–410 ms unstyled | client-only | 1.0 if the build knew the classes | – | #266 rerun in #383 (published 0.10.1) |
| No-build HTML, default CSP | parity 100% (default and preflight), final 43 ms | 100%, final 24 ms | – | 73% | #198 rerun in #383 (published 0.10.1) |
| Agent adoption from the docs (AstroPaper) | strong model 0.983 at first paint, 0 damage; weak model unreliable (1 of 2 runs 0, 1007 elements damaged) | – | – | – | #289 (published 0.7.0) |
| Script bytes (gz) | 52.8 KB (UMD CDN) | 68.7 KB | 0 | 0 | #383 (published 0.10.1) |
| Pre-generated CSS (gz) | – | – | 144 KB (families) to 342 KB (wide) | 0 | #218 |
| Cross-engine | Firefox and WebKit match Chromium (the Firefox diffs are quote-serialization artifacts) | – | – | – | #374 (0.10.x source) |

## History (superseded, kept for transparency)

- #198 (dev after 0.4.0): no-build parity 92.3% default, 98.1% with `preflight: true`, vs twb 100%; #305 (dev
  after 0.8.0) reported it unchanged. Superseded by the #383 rerun (100%).
- #231 (dev after 0.4.0; unchanged in #305): 0.859 of elements, shell 1.000. Superseded by #383 (0.904, shell 0.997
  after mount: slightly worse, not yet investigated).
- #266 (dev after 0.4.0; unchanged in #305): client-only unstyled 275–324 ms, server cold 16–20 ms. #383 on 0.10.1:
  346–412 ms and 22–28 ms (worse; likely the larger bundle under 4x CPU throttling, not isolated).
- #364 (0.10.0) Shadow DOM parity 1.000 and #355 (dev after 0.9.0) shadow-root CMS blocks 1.000: withdrawn; the
  probes missed @property-backed utilities inside shadow roots (#384).
- #305 (dev after 0.8.0): ESM CDN bundle 48 KB gz.

- #253 (dev after 0.4.0): CMS companion 0.938 vs twb 1.000. The gap was `space-y-*`. Superseded by #347
  (1.0 on a strict-CSP page, dev after 0.9.0).
- #182 / #198 (dev after 0.4.0): runtime script 37–41 KB gz, before #305's bundle change (64 → 48 KB gz for
  the ESM CDN bundle).

## Caveats

- Headless runs with small n (3–5 runs per arm; model outputs frozen). Firefox and WebKit are Playwright
  builds, not Safari/iOS (#374).
- #198, #231 and #266 were measured on published 0.10.1 (#383). The #198/#231 reference build moved from Tailwind
  4.1.13 to 4.3.3 between runs. Other rows are older releases.
- All evidence is self-generated. There are no external users yet.
