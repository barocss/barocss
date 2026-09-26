# #383: #198 / #231 / #266 rerun on published 0.10.1

No model calls: #231 uses the frozen specs in `scripts/json-render-probe/e2e/specs/`, #266 the frozen #253 blocks,
#198 the fixed sections. Same harnesses, same arms. Numbers: `result.json`.

## Method

- BaroCSS: a temporary `git worktree` at tag `@barocss/browser@0.10.1` (package.json versions 0.10.1), `build:library`
  for kit, browser and server. Its `dist/cdn/barocss.umd.cjs` has the same sha256 as jsDelivr
  `@barocss/browser@0.10.1`, so the browser arms ran the published bytes. The probe scripts at the tag are identical
  to the ones on develop. The worktree was removed afterwards.
- `@tailwindcss/browser@4.1.13` came from jsDelivr, in memory (`twb-shim.mjs`, preloaded with `node --import`).
- Chromium: Playwright chromium-1223. Ports 7500 (#198), 7510 (#231), 7520 (#266).

```
# from a checkout of the 0.10.1 tag, after build:library of packages/barocss, barocss-browser, barocss-server
PW_DIR=... CHROME=... TWB_DIR=/__twb_mem__ PROBE_PORT=7500 node --import <this dir>/twb-shim.mjs scripts/mcp-html-probe/run.mjs 5
PW_DIR=... CHROME=... TWB_DIR=/__twb_mem__ PROBE_PORT=7510 node --import <this dir>/twb-shim.mjs scripts/json-render-probe/e2e/run.mjs 3
PW_DIR=... CHROME=... PROBE_PORT=7520 node scripts/ssr-probe/run.mjs 3   # develop's run.mjs (adds hydrateMs)
```

## Old -> new

| metric | old | published 0.10.1 |
|---|---|---|
| #198 parity, typical CSP, BaroCSS default | 92.3% | **100%** |
| #198 parity, BaroCSS `preflight: true` | 98.1% | 100% |
| #198 parity, twb | 100% | 100% |
| #198 dynamic classes styled (baro / twb) | – | 20/20, 7 ms / 20/20, 8 ms |
| #198 strict CSP (no inline style) | – | every runtime arm 73% (= no runtime); the probe passes no nonce |
| #198 script gz (baro UMD / twb) | 37–41 KB / 68.7 KB | 52.8 KB / 68.7 KB |
| #231 element parity (baro / build / twb) | 0.859 / 0.163 / 0.000 | **0.904** / 0.163 / 0.000 |
| #231 shell parity after mount (baro / twb) | 1.000 / 0.969 | **0.997** / 0.969 (baro before mount 1.000) |
| #266 match at FCP, `@barocss/server` | 1 / 1 | 1 / 1 |
| #266 unstyled after FCP, client only (opus / haiku) | 324 / 275 ms | 412 / 346 ms |
| #266 server render warm / cold | 0.18/0.11 ms, 16–20 ms | 0.19/0.11 ms, 22–28 ms |

## What changed and why (reasoning, not measured separately)

- #198: the default runtime now matches the built reference (#336 preflight). BaroCSS no longer scores below twb on
  the no-build page; twb still paints the final state sooner (24 vs 43 ms) and remains the official runtime.
- #231: 0.859 -> 0.904. The 22 remaining misses are composites (18 base-class cascade-order conflicts, 4 layout
  knock-ons); no unsupported token. The shell dropped from 1.000 to 0.997 after mount: slightly worse, not investigated here.
- #266: server-side result unchanged. The client-only unstyled window is 70–90 ms longer (worse). Likely causes: the
  UMD bundle grew (212 KB -> 241 KB decoded) under 4x CPU throttling, and the runs overlapped with the #198 run on the same machine.
  Server cold start 22–28 ms (was 16–20).

## Confounds

- The reference build for #198 and #231 is Tailwind 4.3.3 (the release commit's dependency); the original runs used
  4.1.13. Part of a parity change may come from the reference.
- n = 3–5, one machine, Chromium only.
