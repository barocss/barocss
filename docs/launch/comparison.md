> **DRAFT — not for publication until approved.** Issue #378. Every number cites its Issue and the release
> it was measured on. "dev after X" means unreleased source measured after release X (from `git describe`
> of the measuring commit). #198, #231 and #266 were rerun on published 0.10.1 in #383 (`scripts/rerun-383/`). Where a newer run exists, the older
> number is kept only under "History".

# BaroCSS vs `@tailwindcss/browser` vs build-time pre-generation vs no runtime

Published version: `@barocss/kit`, `@barocss/browser`, `@barocss/server` **0.10.3** (0.10.2 fixed the Shadow DOM @property gap, #384; 0.10.3 is a security patch, #392).

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
  final styled state sooner (median 24 ms, range 21–32, vs 42 ms, range 33–237 with 14 of 40 BaroCSS loads at
  176–237 ms; N=40 page loads per arm, interleaved in one session, twb 4.1.13 vs BaroCSS 0.10.3, #404) and is the
  official runtime (#198 rerun in #383, published 0.10.1). BaroCSS's fast mode is the ~42 ms median; the slow tail
  was a boot race, not generation cost: when the browser rendered a frame before the runtime inserted its CSS,
  `transition` utilities animated from unstyled values for 150 ms (#405). The next release removes it (#407: boot
  finishes the transitions its first insert started; with a frame forced before boot, 0 of 40 loads animate vs 40
  of 40 before).
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
| SSR first paint | 1.0 match at FCP with `@barocss/server`; client-only leaves a median 408 / 360 ms unstyled (0.8.0 in the same session: 390 / 327 ms; N=3) | client-only | 1.0 if the build knew the classes | – | #394 same-session rerun of #266 (published 0.10.1) |
| No-build HTML, default CSP | parity 100% (default and preflight), final 42 ms (33–237, N=40) | 100%, final 24 ms (21–32, N=40) | – | 73% | parity: #198 rerun in #383 (published 0.10.1); timing: #404 same session (twb 4.1.13, BaroCSS 0.10.3) |
| Agent adoption from the docs (AstroPaper) | strong model 0.983 at first paint, 0 damage; weak model (haiku) 2/2 after the #306 doc fixes (first paint 0.983 / 0.958, hydrated 1.0 / 0.975, 0 damage; it was 1 of 2 in #289) | – | – | – | #289, #306 recheck (published 0.7.0, `scripts/cms-starter-probe/results-306-recheck.json`) |
| Script bytes (gz) | 52.8 KB (UMD CDN) | 68.7 KB | 0 | 0 | #383 (published 0.10.1) |
| Pre-generated CSS (gz) | – | – | 144 KB (families) to 342 KB (wide) | 0 | #218 |
| Cross-engine | Firefox and WebKit match Chromium (the Firefox diffs are quote-serialization artifacts) | – | – | – | #374 (0.10.x source) |

## History (superseded, kept for transparency)

- #198 (dev after 0.4.0): no-build parity 92.3% default, 98.1% with `preflight: true`, vs twb 100%; #305 (dev
  after 0.8.0) reported it unchanged. Superseded by the #383 rerun (100%).
- #231 (dev after 0.4.0; unchanged in #305): 0.859 of elements, shell 1.000. Superseded by #383 (0.904, shell 0.997
  after mount). The 0.997 is not a regression: #394 got 0.9972 on the #231 commit, 0.8.0 and 0.10.1 alike.
- #266 (dev after 0.4.0; unchanged in #305): client-only unstyled 275–324 ms, server cold 16–20 ms. These numbers come from a
  different session and are not comparable with later runs. Same-session rerun in #394 (N=3 per release, 4x CPU
  throttle): client-only window median 390 / 327 ms on 0.8.0 and 408 / 360 ms on 0.10.1 (opus / haiku spec);
  the step is at 0.8.2 → 0.9.0 (+17 / +17 ms, up to +37 ms by 0.10.x), in line with the ~+5 KB UMD growth
  (#336, #327). Server cold median 23.5 / 19.5 ms on 0.8.0 and 25.9 / 20.9 ms on 0.10.1; the +1.5–2.4 ms comes
  from the 0.8.1 security guards (#323).
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

## Security and known issues

- Fuzz campaign on class input (#319, #339); fixes shipped in 0.8.1 / 0.8.2 and 0.10.3 (changelog); multi-seed
  fuzz ratchet in CI (#392); security guide (#345, `apps/barocss-docs/docs/guide/security.md`).
- Known: when two utilities on one element set the same property, BaroCSS can pick a different winner than a
  Tailwind build; fix in progress (#401).
