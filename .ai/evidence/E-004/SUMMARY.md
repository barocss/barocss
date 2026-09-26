# E-004 — live colour token via BaroCSS config, arm A ×2 and arm B ×1

Actor: headless `claude -p`, model `claude-opus-4-8[1m]`, CLI 2.1.173, Playwright MCP 0.0.76 only (`--tools ""`), fresh
context per run, empty cwd, `--setting-sources ""`. Server allowlist is `/` (→ `index-<arm>.html`) plus
`/packages/barocss-browser/dist/cdn/*`. Prompt and task are E-003's, word for word (see `runs/*.json` → `prompt`).

Rerun (repo root, after `pnpm --filter @barocss/browser build:cdn`; `PW_MCP_DIR` = dir with `node_modules/@playwright/mcp`):
- self-test: `node .ai/evidence/E-004/grader-selftest.mjs` → `selftest.json` (exit 0, 13/13)
- runs: `node .ai/evidence/E-004/run.mjs A A1`, `… A A2`, `… B B1` → `runs/<label>.json`
- route probe: `node .ai/evidence/E-004/route-probe.mjs` → `route-probe.json`

Files copied unchanged from E-003: `index-A.html`, `index-B.html`, `grader.js`. The self-test is E-003's with the Y2
expectations and Y2 route attempts dropped. The runner is E-002's `run.mjs`, changed to take the arm and label as arguments
(commit f445480, before any run).

## Runs

| Run | Route | Discovery (call #) | Config call | Verify | Final claim | Grader Y1 | Agree | Turns / cost |
|-----|-------|--------------------|-------------|--------|-------------|-----------|-------|--------------|
| A1 | second runtime via import (`getRuntime()`) | page source → script import path (#3); `Object.keys(await import(cdn))` → `getRuntime` (#5); proto + `updateConfig.toString()` (#6–7) | #9 `getRuntime().updateConfig({...current, theme:{extend:{colors:{brand}}}})`; #10 `addClass('bg-brand')` | `getCss('bg-brand')`, computed bg `rgb(91, 33, 182)` | done | PASS, no regression | yes | 14 / $0.29 |
| A2 | second runtime via import (`getRuntime()`) | page outerHTML (#3); module exports (#4); `getRuntime()` proto (#5); `updateConfig.toString()` (#6) | #8 `getRuntime().updateConfig({theme:{extend:{colors:{brand}}}})` + `addClass(['bg-brand'])` | `getCss`, computed bg, screenshot | done | PASS, no regression | yes | 13 / $0.41 |
| B1 | page runtime via global (`window.baroRuntime`) | page outerHTML (#2) shows the global; proto (#3); `updateConfig.toString()` (#4) | #5 `window.baroRuntime.updateConfig({theme:{extend:{colors:{brand}}}})`; #6 `addClass(['bg-brand'])` | `getCss`/`has`, computed bg, screenshot | done | PASS, no regression | yes | 11 / $0.34 |

No run took a raw-CSS route (detector: 0 direct writes, 0 style-attribute changes). All three swapped `bg-blue-600` → `bg-brand`.
Nobody fetched or searched the bundle. Discovery was page source, then module exports or the global, then `Function.toString()`.
No environment failures, no retries.

## Route classification (route-probe.json)

Both arm A agents said they had configured "the live `BrowserRuntime`" via `getRuntime()`. They had not. `getRuntime()`
(`packages/barocss-browser/src/baro-boot.ts`) is a lazy singleton that `new`s a runtime on first call. The page builds its
runtime with `new BrowserRuntime()` directly, so the call created a **second** runtime. The probe replays A1's calls on
arm B, where the instances can be compared:

- `getRuntime() === window.baroRuntime` → `false`. The page runtime's `getCss('bg-brand')` stays `null`.
- The second runtime injects duplicate `<style id="barocss-runtime-partition-0">` and `…-css-vars` elements. `.bg-brand`
  lives in the duplicate partition-0.
- The second runtime does not observe the DOM. `bg-brand` exists only because the agent called `addClass` on it.

Under the contract's rule (a new runtime with config is a BaroCSS route, per K6), both arm A runs pass. The outcome claim
("done", bg = #5B21B6) agrees with the grader. The mechanism claim ("the live runtime") is wrong in both A runs. A2 had
read the page source showing `new BrowserRuntime()` and still assumed the singleton was the page's instance.
Proposed owner for the misattribution: BAROCSS (`getRuntime()`'s name suggests "the page's runtime", but it silently
creates a new one) plus AGENT (did not check identity). It caused no grader failure.

## Arm B vs arm A

An app-exposed runtime did not change the outcome (3/3 pass). It changed the route (the real page instance instead of a
second one, with no duplicate style elements) and was slightly shorter (11 turns vs 13–14). Cost was in the same range
($0.34 vs $0.29 / $0.41).
