# E-010 — parity-lane batch (ring + translate + preflight border)

**Verdict: PARTIAL.** F1 (ring) and F3 (preflight border-style) reach exact Tailwind-4.1.13 parity
per token (L2) with `pnpm check` green and no control regression; they land. **F2 (single-axis
translate) is dropped** — it is *not* a composition-default gap, so no composition-default change can
bring it to parity. Strategy re-scopes F2 separately.

## What was measured

Two reproducible L2 artifacts, both against tailwindcss 4.1.13 from the repo's `node_modules`:

- `parity.mjs` → `parity.json`: boots `apps/barocss-site` (arm D, `vite` dev, `baroStart preflight:true`),
  puts each family token on a bare probe in the live BaroCSS page, and compares its **computed**
  declaration to Tailwind 4.1.13's for the same token on a same-element reference page. Reuses the
  frozen E-007/E-008 `classify()` + `env.mjs` unchanged (only output/path wiring added).
  Rerun: `PW_MCP_DIR=<dir resolving playwright-core> node .ai/evidence/E-010/parity.mjs`
- `translate-gap.mjs`: browser-free probe that prints, per translate token, BaroCSS's emitted
  `translate` value vs Tailwind's, isolating the F2 value-formula defect.
  Rerun: `node .ai/evidence/E-010/translate-gap.mjs`

## Results (parity.json)

| family | token | class | computed BaroCSS == Tailwind 4.1.13 | parity |
|--------|-------|-------|-------------------------------------|--------|
| F1 ring | ring-1 | RESOLVED | box-shadow equal | ✅ |
| F1 ring | ring-2 | RESOLVED | box-shadow equal | ✅ |
| F1 ring | focus:ring-2 | RESOLVED | box-shadow equal | ✅ |
| F1 ring | focus:ring-offset-2 | RESOLVED | equal (both `none`) | ✅ |
| F2 translate | translate-x-4 | PARITY-MISS | `none` vs `16px` | ❌ |
| F2 translate | translate-y-4 | PARITY-MISS | `none` vs `0px 16px` | ❌ |
| F2 translate | -translate-x-1/2 | PARITY-MISS | `none` vs `-50%` | ❌ |
| F3 border | border | RESOLVED | 4×(1px solid) equal | ✅ |
| F3 border | border-t | RESOLVED | top 1px solid, others 0 equal | ✅ |

Controls (shadow-sm, shadow-xl, shadow-none, p-4, bg-blue-600, md:grid-cols-3, rounded-2xl): all
RESOLVED — **no regression**. App booted styled (`styled.ok: true`). `pnpm check`: **GREEN**
(type-check + lint + 1451 tests + build:library, exit 0).

## Why F2 was dropped (not a composition-default gap)

The contract's F2 hypothesis was: the only defect is the unregistered sibling axis var
`--baro-translate-*`, fixable by registering it via `@property` initial values. Measurement disproves
this for the integer tokens:

- `translate-x-4` → BaroCSS emits `calc(4 * 100%)` (400% of the element); Tailwind emits
  `calc(var(--spacing) * 4)` (= 16px). `translate-y-4` is identical on the y axis.
- The integer path in `transform.ts` routes plain numbers through `parseFractionOrNumber` (the
  fraction/percentage branch) instead of the spacing branch. Registering the `@property` default —
  the only F2 change the contract allows — would make the declaration *valid* but still **400% ≠ 16px**,
  so the token still misses Tailwind parity.
- `-translate-x-1/2` (a fraction) *does* compute correctly (`-50%`); its only problem is the undefined
  sibling var. But a family reaches parity only if every listed token does, and two of three cannot with
  a composition-default fix.

Fixing the value formula is outside the contract's allowed F2 action ("register the missing
`--baro-translate-*` axis vars via `@property` initial values … no new utilities beyond the parity
defaults") and its non-goals ("Any change beyond the minimum composition-default fix per family").
Per `stop_when`/`budget`, F2 is dropped and recorded; F1 and F3 still land.

## Product change that landed (F1 + F3)

- `packages/barocss/src/presets/effects.ts` (F1): register `--baro-shadow` / `--baro-inset-shadow` /
  `--baro-inset-ring-shadow` via `@property` initial `0 0 #0000`; drop the hardcoded v3 blue
  `--baro-ring-color` (lone ring now defaults to currentColor via the var() fallback); add
  `ring-offset-{0,1,2,4,8}`. (Brought forward unchanged from branch `ai/E-008-ring-parity`, K11.)
- `packages/barocss/src/css/preflight.ts` (F3): add `border: 0 solid` to `preflightFullCSS`'s universal
  `*` reset (matches Tailwind v4's universal `border: 0 solid`), so a bare `border`/`border-t` renders.
- Frozen tests updated to the parity-correct node list: `tests/presets/effects.test.ts` (the four ring
  assertions). No transform.ts / transform.test.ts change (F2 dropped). No preflight test pins the reset.
- `transform.ts` untouched — F2 dropped.

## L3 corroboration rerun

Not run this session. The decisive finding — F2 is a value-formula gap, so the single batched
composition-default change does **not** close all three families — is established at L2, which makes
the batch PARTIAL regardless of the rerun. A G1/G2/G3 rerun now would only re-show translate failing (a
known result) at the cost of three fresh agent contexts. Strategy should trigger the rerun after
re-scoping F2 as a value-formula fix, so a single rerun covers a build where all three families are
actually fixed.
