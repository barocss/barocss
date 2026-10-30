# D344 consumer source preparation

Status: SOURCE_READY_RUNTIME_NOT_RUN. Root owns the active full Kernel heavy gate. This lane ran only node --check on the new browser driver; it passed. No Model test, types, lint, build, Studio server or browser ran in this preparation stage.

Owned repository files:

- packages/barocss-cad-model/test/native-quadrature-step.test.ts (two proposed tests)
- apps/cad-studio/test/native-quadrature-step-browser.mjs

No src files, existing browser drivers, benchmark or geometry algorithms changed.

The new Model test runs the existing actual Offset command build on the translated radius-3/H5.00009 cylinder with distance -5.00009. It exports target-only default STEP metadata through exportStudioStep, the exact function called by the Studio engine.step worker. It checks native stored-node rational Gauss reference, a separate rounded-pi guide, tangent centroid, exact normal interval, units, unmodified recipe and strict imported native geometry. The ordinary source is a separate control. Imported raw mass/wholePatch route is recorded as a separate provider observation, never used to substitute the export metadata reference.

The browser driver uses one Chrome and two serial contexts. It opens a public author API target-only seed; exports an ordinary STEP; performs an actual top-cap mouse click using only readonly __studioScreenOf projection; opens the existing Offset face palette/HUD; fills exact -5.00009; previews and applies; verifies cleared picks and source-prefix preservation; exports actual tiny STEP; uses Undo/Redo; saves .bcad and fresh-opens it; then exports STEP again. It captures all downloads, document observations, screenshots, errors, watch events and source caps. Virtual stdin is explicitly excluded from disk caps and its exact contents/hash are saved. Initial subset count and the expanded frozen dependency/Studio-source count are recorded separately. All owned resources close in finally.

STEP real() uses String(binary64), preserving numeric distinguishability without fixed decimal rounding. Point deduplication keys exact written strings. The default 1e-6 STEP uncertainty is a declared tolerance, not coordinate quantization. Importer applies entity tolerance override only when file uncertainty exceeds that baseline. No source evidence proves collapse; the intended four-ULP file/readback assertion remains strict. If runtime finds refusal, collapse or other file failure, preserve it before changing scope or source. No larger replacement fixture is allowed to hide it.

Prepared exact launch after root source freeze and runtime grant:

```sh
D344_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' /Users/user/Library/pnpm/nodejs/22.19.0/bin/node test/native-quadrature-step-browser.mjs /tmp/d344-studio/run-01
```

Working directory: /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio.

No runtime PASS is claimed. Root must review screenshot images separately; screenshots show UI presence and action only, not a resolvable four-ULP thickness. No commit/push.
