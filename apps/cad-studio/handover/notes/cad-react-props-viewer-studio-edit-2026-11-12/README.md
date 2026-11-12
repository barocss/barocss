# D775 — Verify CAD React props and the returned Studio edit

P4 B10-06, rows 04, 05, 16 and 32. SMALL qualification. Parent `51fe8ce5242fe6a4a58f426e56fa46f5aae98dfb`. [B10 v1 evidence ledger](../../roadmap-tracks/17-b10-evidence-ledger.md) · [D509 Profile composition](../cad-react-profile-composition-2026-11-04/README.md).

- **PASS** — The existing ProfileApp changes the radius prop from 6 to 8 mm and public Reset returns it to 6 mm. ReactDOM uses the actual Studio Worker module. Evaluation revisions 1, 2 and 3 each agree across the desired, native, mounted, rendered and frame owners, with the same body key and current display mesh counts.
- **PASS** — The existing Viewer reads 2,800,000 RGBA bytes per frame. The number of non-background pixels is 90,882 → 89,993 → 90,882. The first and restored frame SHA-256 values match exactly and differ from the middle frame. The first and restored document bytes also match.
- **PASS** — Studio opens the exact returned 8 mm-radius Doc with SHA-256 `97ced5846741fba2644f8ebdd6f03905315e4903f5f8810e15417a2356f45730`. Its Extrude Distance changes from 8 to 12 mm through the public feature editor. The body key, sketch and other document fields stay exact. Five independent Python checks use the plate minus circular void formula. Native volumes are 18,295.221, 17,591.505 and 26,387.257 mm³ for R6/H8, R8/H8 and R8/H12. The relative volume limit is 1e-3 and the length limit is 0.01 mm.
- **PASS** — Five current React/Studio states and six D529 observation regression states. Both runs retain 1,293 frozen files and report zero page errors, console errors or downloads. Reviewed the React frame and the Studio 12 mm edit. React 33/33 focused tests, React and Model type checks, driver syntax and diff check. The browser fixture bundles with two Vite dynamic import optimization notices.
- **FAIL, test authoring** — The first driver generation command rejected its quoting before writing files. The final driver passes.
- **NOT_RUN** — Worker failure and restart in this case, release builds, full suites, other geometries and mobile.

```sh
D775_SOURCE_FROZEN=1 node packages/barocss-cad-react/tests/observation-current-browser.mjs "$EVIDENCE/react-viewer-studio-current" --props-roundtrip
D529_SOURCE_FROZEN=1 node packages/barocss-cad-react/tests/observation-current-browser.mjs "$EVIDENCE/observation-regression" --expect=fixed
pnpm --dir packages/barocss-cad-react exec node --test tests/react-profiles.test.mjs tests/profiles.test.mjs tests/viewer-sink.test.mjs tests/observation-ownership.test.mjs
pnpm --dir packages/barocss-cad-react type-check
pnpm --dir packages/barocss-cad-model type-check
node --check packages/barocss-cad-react/tests/observation-current-browser.mjs
node --check packages/barocss-cad-react/tests/profile-props-roundtrip.mjs
git diff --check
```

B10 is pending at 6/7. Initial scenarios remain 7/10. Whole CAD and core readiness remain **NOT_MEASURED**. D776 checks failure, recovery and disposal without stale frame success.
