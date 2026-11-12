# D773 — Verify Viewer resize and resource lifetime

P4 B10-04, rows 05, 16 and 32. SMALL qualification. Parent `b62ff68fa21ef565b9ffadbeb0d7182a52bfa22b`. [B10 v1 evidence ledger](../../roadmap-tracks/17-b10-evidence-ledger.md) · [D771 native source replacement](../viewer-native-source-replacement-2026-11-12/README.md).

- **PASS** — At both native revisions, the public Viewer resizes 320 × 240 → 480 × 360 → 320 × 240. All six RGBA reads have the exact dimensions. The centre pixel, selected surface and complete centre pick stay equal to the current revision at each size. Revision replacement changes pixels and its prior selection clears.
- **PASS** — Read-only Core counters report one active, retained and uploaded geometry at each of the six resized frames. Clear gives a uniform empty frame, no selection, no pick and zero active or retained geometry. Dispose reports zero active and retained geometry and refuses another read. These are geometry ownership counts.
- **PASS** — Studio opens both exact authored sources and retains the selected surface's public pointer path after resizing the desktop viewport. The canvas changes from 1140 × 1000 to 920 × 900 at both revisions. The accepted document and history stay exact. Four Studio states and two independent native/camera checks. Reviewed the resized revision 2 surface. The D771 source replacement regression passes with two Studio states and two checks. Both runs retain 853 frozen files and report zero page errors, console errors or downloads.
- **PASS** — Viewer 34/34 focused checks, Model type check, driver syntax and diff check.
- **FAIL** — None in these runs.
- **NOT_RUN** — Physical VRAM, long-duration stress, other devices, full suites, production builds and mobile.

```sh
D773_SOURCE_FROZEN=1 node apps/cad-studio/test/viewer-current-source-browser.mjs "$EVIDENCE/viewer-studio-first" resize-lifetime
D771_SOURCE_FROZEN=1 node apps/cad-studio/test/viewer-current-source-browser.mjs "$EVIDENCE/source-replacement-regression"
pnpm --dir packages/barocss-viewer exec node --test tests/presenter-lifetime.test.mjs tests/review-state.test.mjs
pnpm --dir packages/barocss-cad-model type-check
node --check apps/cad-studio/test/viewer-current-source-browser.mjs
git diff --check
```

B10 is pending at 4/7. Initial scenarios remain 7/10. Whole CAD and core readiness remain **NOT_MEASURED**. D774 measures desktop Studio drag cadence, update latency and retained geometry.
