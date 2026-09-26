# E-003 — blocked at the pre-run self-test (no agent runs)

Rerun (repo root, after `pnpm --filter @barocss/browser build:cdn`):
`PW_MCP_DIR=<dir with node_modules/@playwright/mcp> node .ai/evidence/E-003/grader-selftest.mjs` → writes `selftest.json`, exits 1.
Files: `index-A.html` (byte-identical to E-002's page), `index-B.html` (+ `window.baroRuntime = runtime;`), `grader.js`, `grader-selftest.mjs`.

## Self-test: 22 of 23 expectations pass; the gating arm B positive control fails

Passing, in both arms: baseline fails Y1 and Y2. `bg-brand` alone and `rounded-4xl` alone fail. `bg-[#5B21B6]` and
`rounded-[2rem]` fail on the class check, though both style checks pass. Inline style-attribute and `<style>` tag
controls pass the style check and fail through the detector. The tool-call scan flags `updateRuleContent` and
`textContent = '…{…:…}'` writes, and does not flag an `updateConfig` call or a computed-style read.

Failing: no config call makes Y2 pass (stop_when #2 → blocked). Each shape was tried with the token class added next to
the conflicting class and with the token class replacing it (`bg-blue-600` / `rounded-md`):

| Route (arm) | Config | Y1 `bg-brand` | Y2 `rounded-4xl` | `:root` vars emitted |
|---|---|---|---|---|
| `baroRuntime.updateConfig` (B) | `theme.extend {colors.brand, borderRadius.4xl}` | PASS, no regression | FAIL, `ast is empty rounded-4xl` | `--color-brand`, `--radius-4xl: 2rem` |
| same (B) | `theme {…}` (no extend) | PASS, no regression (deep-merged, defaults kept) | FAIL, same | both |
| same (B) | `extend.colors.brand = {DEFAULT}` | FAIL, `TypeError: value.startsWith is not a function` | FAIL | `--color-brand-DEFAULT` |
| same (B) | `extend.radius.4xl` (v4 name) | PASS | FAIL | `--color-brand` only |
| same (B) | `theme.colors.brand` only | PASS, no regression | FAIL | `--color-brand` |
| import CDN + 2nd `BrowserRuntime` + `observe` (A) | `theme.extend` | PASS, no regression | FAIL | both |
| same, distinct `styleId` (A) | `theme.extend` | PASS, no regression | FAIL | both |

With the class replaced, Y2 radius goes 6px → 0px. There is no rule, so the grader's style check fails.

## Cause (read from source to classify, not to fix)

`packages/barocss/src/presets/border.ts`: `rounded-{none,sm,md,lg,xl,2xl,3xl,full}` are hard-coded `staticUtility`
entries. The functional `rounded` has no theme key: it accepts only a number (`calc(var(--spacing) * n)`), an arbitrary
value, or a custom property. So `theme.borderRadius` feeds `:root` vars and nothing else. No theme or config shape can
create a new `rounded-*` name. `Config` has no plugin hook either: `ctx.plugins` is commented out in `core/context.ts`.
Owner: BAROCSS (config semantics). This is not APP (arm B exposes the instance and still fails) and not AGENT (the block
comes before any agent).

The Y1 path works through both routes, including arm A's second runtime. So a colour token needs only a reachable
config API, while a radius token needs BaroCSS itself to change.
