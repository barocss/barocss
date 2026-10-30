# D338 Studio browser driver preparation

Source only. Runtime, syntax execution, build, and browser: NOT_RUN.

Owned source: apps/cad-studio/test/thicken-snapshot-browser.mjs
Strict gate: D338_SOURCE_FROZEN=1. Root must freeze all source writers before launch.

Run from the fixed worktree apps/cad-studio directory with Node 22:

```sh
D338_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/thicken-snapshot-browser.mjs /tmp/d338-studio/run-01
```

One Chrome process; serial fresh contexts; public UI mutation and read-only window observation. Seed uses public Model facade and direct import. Native document inspection uses public Part plus partBreps/checkBrep. Preview asserts displayed mesh volume 2820 (plate2400 + witness420); accepted native mass/centroid is separate. No preview centroid claim.

Face names are observed and preserved exactly; no assumed six-face topology. Root's focused kernel receipt observed 73 facet groups for the current nonunit-domain profile. This driver captures the actual Model name set and compares it through edits/reopen/source changes.

Fold evidence retains the actual HUD text and OFFSET_FOLDS diagnostic. It does not infer a structured CAPABILITY code from the UI.

Virtual esbuild stdin entries are excluded explicitly from disk input capsules. Their exact source text and hash are saved separately. Before/after capsules and watcher events detect source changes. Failure screenshots/state and cleanup are persisted.

No commit or push.
