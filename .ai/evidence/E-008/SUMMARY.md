# E-008 — ring box-shadow parity (minimum fix)

Question: does the minimum change in `packages/barocss/src` close the ring family — do `ring-1`, `ring-2`,
`focus:ring-2`, `focus:ring-offset-2` compute a box-shadow matching Tailwind 4.1.13, with no regression?

## Verdict (proposed): INCONCLUSIVE — mechanism PROVEN at L2, contract unsatisfiable within `allowed.paths`.

The minimum, local, src-only fix achieves **exact** Tailwind 4.1.13 box-shadow parity for all four ring tokens with
no control regression. The only obstacle to a clean PROVEN is scope: 4 co-located exact-AST ring unit tests freeze
the pre-fix output and live outside `allowed.paths`, so `pnpm check` (a `proves_yes` requirement) cannot go green
without editing a file the contract does not allow Execution to touch.

## Environment
Same as E-007: `apps/barocss-site` unchanged, `vite` dev (arm D, 127.0.0.1:5190), `env.mjs` proxy. Tailwind 4.1.13
from the repo's node_modules is the reference (`classify.mjs`, unchanged from E-007). Browser: system Chrome via
`playwright-core` (`PW_MCP_DIR`). `classify.mjs`, `grader.js`, `grade.mjs`, `env.mjs`, `run.mjs` copied byte-identical
from E-007; `ring.mjs` is new L2 measurement wiring that imports the frozen `classify()` and adds the box-shadow /
Tailwind comparison (no change to any frozen classification/grading logic).

Rerun (repo root, after `pnpm install`):
- baseline (build at origin/develop): `pnpm --filter barocss build:library` then
  `PW_MCP_DIR=<dir/node_modules/playwright-core> node .ai/evidence/E-008/ring.mjs baseline` → `baseline.json`
- post-fix (this branch): rebuild, then `... node .ai/evidence/E-008/ring.mjs postfix` → `postfix.json`

## Results

| token | baseline | post-fix class | post-fix box-shadow == Tailwind 4.1.13 |
|-------|----------|----------------|-----------------------------------------|
| ring-1 | PARITY-MISS (box-shadow none; undefined --baro-inset-shadow/--baro-inset-ring-shadow/--baro-shadow) | RESOLVED | yes — `… 0 0 0 1px currentColor` |
| ring-2 | PARITY-MISS (same undefined vars) | RESOLVED | yes — `… 0 0 0 2px currentColor` |
| focus:ring-2 | PARITY-MISS (same) | RESOLVED | yes — `… 0 0 0 2px currentColor` (focused) |
| focus:ring-offset-2 | PARITY-MISS (no rule) | RESOLVED | yes — `none` == Tailwind `none` (offset alone emits no box-shadow) |

Controls (shadow-sm, shadow-xl, shadow-none, p-4, bg-blue-600, md:grid-cols-3, rounded-2xl): RESOLVED before and
after. Site renders styled before and after. No regression.

## Fix (`packages/barocss/src/presets/effects.ts` + one changeset)
1. Register the box-shadow composition bases `--baro-shadow`, `--baro-inset-shadow`, `--baro-inset-ring-shadow`
   via `@property` with `initial-value: 0 0 #0000` (Tailwind v4's mechanism) — attached to the ring width utilities.
2. Drop the hardcoded `--baro-ring-color: rgb(59 130 246 / 0.5)` (Tailwind v3 blue) so a lone ring falls back to
   `currentColor` — Tailwind v4's default. Needed for box-shadow *equality*, not just rendering.
3. Add `ring-offset-{0,1,2,4,8}` (were missing entirely).

`check.py --role execution`: OK. `type-check` / `lint` / `build:library`: pass. `compat/compare.test.ts`
(real-Tailwind comparison): passes with the fix.

## Blocker
`pnpm test` fails on 4 assertions in `packages/barocss/tests/presets/effects.test.ts` (outside `allowed.paths`,
which is only `packages/barocss/src/`): `ring → multi-var box-shadow`, `ring-2 → multi-var box-shadow`,
`ring → box-shadow variable combination`, `ring-4 → box-shadow variable combination`. They pin the v3 blue default
and the exact node list via `.toEqual`. Any parity fix must update them. Recommendation for Strategy: re-issue with
`packages/barocss/tests/` in `allowed.paths`, update the 4 frozen assertions to the Tailwind-v4 output, drop the
incorrect "focus:ring-offset-2 = non-empty offset ring" expectation, then it is a clean PROVEN + merge.
