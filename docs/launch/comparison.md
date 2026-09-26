> **DRAFT — not for publication until approved.** Issue #378. Every number cites its Issue and the release
> it was measured on. "dev after X" means unreleased source measured after release X (from `git describe`
> of the measuring commit). Nothing was re-measured for this page. Where a newer run exists, the older
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
- **No-build pages (MCP Apps, default CSP): BaroCSS is not unique.** twb already covers the scenario (#198).
  BaroCSS's default runtime injects no preflight, so on that page it scored below twb (92.3% default,
  98.1% with `preflight: true`, vs twb 100%; dev after 0.4.0). #305 (dev after 0.8.0) reports the #198
  probe unchanged; no newer release has been re-measured on it.
- **Bytes vs a pre-built sheet.** The BaroCSS ESM CDN bundle is 48 KB gz (#305, dev after 0.8.0; 0.10.x not
  re-measured). That is smaller than twb's 68.7 KB gz (#198) but far larger than a 3.2 KB gz built shell
  (#218).

## Measured axes

| axis | BaroCSS | `@tailwindcss/browser` | build-time pre-gen | no runtime | source (release) |
|---|---|---|---|---|---|
| Class parity corpora vs Tailwind 4.3.3 and 4.1.13 | 100% | reference implementation | – | – | #241 (dev after 0.4.0), #304 (dev after 0.7.0) |
| Held-out classes (567 unseen) | 100% (94.5% in #243) | – | – | – | held-out parity test (dev after 0.10.1); #243 (dev after 0.4.0) |
| CMS blocks (#253 set) on a strict-CSP page | **1.0 / 1.0** (nonce or constructable), 0 violations | broken (styles blocked) | – | – | #347 (dev after 0.9.0) |
| CMS blocks in shadow-root mode | **1.000 / 1.000** (site-only control) | cannot style shadow roots | – | – | #355 (dev after 0.9.0) |
| Real model specs in a built app (10 specs) | 0.859 of elements, shell 1.000 | 0.000, shell 0.969 | – | 0.163 | #231 (dev after 0.4.0); unchanged in #305 (dev after 0.8.0) |
| Shadow DOM widget, strict CSP, hostile host | parity **1.000**, host damage 0 | 0.000 | – | 0.000 | #364 (published 0.10.0), `scripts/o5-probe/NOTES.md` |
| Untrusted classes (22 adversarial shapes) | 0 host changes, 0 cross-origin `url()` hits (1 same-origin hit unless pre-filtered) | n/a | – | – | #364 (0.10.0) |
| SSR first paint | 1.0 match at FCP with `@barocss/server` plus app fixes; client-only leaves ~270–340 ms unstyled | client-only | 1.0 if the build knew the classes | – | #266 (dev after 0.4.0); unchanged in #305 |
| Agent adoption from the docs (AstroPaper) | strong model 0.983 at first paint, 0 damage; weak model unreliable (1 of 2 runs 0, 1007 elements damaged) | – | – | – | #289 (published 0.7.0) |
| Script bytes (gz) | 48 KB (ESM CDN) | 68.7 KB | 0 | 0 | #305 (dev after 0.8.0), #198 |
| Pre-generated CSS (gz) | – | – | 144 KB (families) to 342 KB (wide) | 0 | #218 |
| Cross-engine | Firefox and WebKit match Chromium (the Firefox diffs are quote-serialization artifacts) | – | – | – | #374 (0.10.x source) |

## History (superseded, kept for transparency)

- #253 (dev after 0.4.0): CMS companion 0.938 vs twb 1.000. The gap was `space-y-*`. Superseded by #347 /
  #355 (1.0 on 0.9.x).
- #182 / #198 (dev after 0.4.0): runtime script 37–41 KB gz, before #305's bundle change (64 → 48 KB gz for
  the ESM CDN bundle).

## Caveats

- Headless runs with small n (3–5 runs per arm; model outputs frozen). Firefox and WebKit are Playwright
  builds, not Safari/iOS (#374).
- Few rows were measured on the published 0.10.1 itself. #364 (0.10.0) is the closest.
- All evidence is self-generated. There are no external users yet.
