# #407: remove the boot transition race (#405 tail)

Rerun: `pnpm --filter @barocss/kit build && pnpm --filter @barocss/browser build:library`, then
`PW_DIR=... CHROME=... node scripts/first-paint-407/run.mjs 10` (writes result.json). The base/A arms used a
measurement-only switch (`window.__baro407='off'`) that the shipped code no longer has; on the shipped build they
behave like B.

One session, headless Chromium 148, 10 interleaved rounds x 4 sections x 6 arms, N=40 per arm, warm-up discarded.

| arm | natural: animated loads | natural: median boot ms | forced frame before boot: animated | forced median | transition after boot |
|---|---|---|---|---|---|
| base (head script, DCL) | 2/40 | 32.5 | 40/40 | 132.1 | 40/40 |
| A (script at end of body, sync insert) | 0/40 | 32.3 | 40/40 | 133.6 | 40/40 |
| B (finish boot-started transitions) | 0/40 | 33.5 | 0/40 | 132.8 | 40/40 |

A needs no runtime change (`baroBoot` already scans and inserts synchronously when `document.body` exists) and
only narrows the window: any frame rendered before the insert (a slow script, the forced trigger) still animates.
B removes the race wherever it comes from. Shipped: B, as `finishBootTransitions` in `baro-boot.ts` (a few lines,
no stylesheet, so no CSP/nonce/constructable surface; also run after a shadow-root boot). The spec's example guard
rule (`.baro-boot-doing * { transition: none !important }`) would need its own nonce/constructable/shadow insertion
paths, so the equivalent without a stylesheet was built instead.
