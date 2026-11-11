# D741 — Refuse cyclic STEP curve wrappers

P0, rows 13 and 16. FEATURE qualification. Parent `f8f0546a9dbc5acf3d83de38dc2018d41ec83bc9`. [#2360](https://github.com/barocss/barocss/issues/2360).

The ordinary STEP reader follows curve wrapper references in a loop. The visited set belongs to one traversal and is allocated only when the reader reaches a wrapper. On a cycle the reader returns INPUT with the repeated instance number and type. EDGE_CURVE, linear extrusion and revolution use the same ordinary walk. The existing offset boundary policy retains its 32-wrapper limit, cone checks and diagnostic. Ordinary paths have no new depth limit. STEP geometry, unit handling and public signatures retain their existing contracts.

## Qualification

- **FAIL (parent)** — Isolated public reader runs returned RangeError for reached self, two-record and three-record cycles through each of the three paths. CAD Part returned GEOMETRY with the import feature ID. In desktop Studio, actual Worker read replies 6, 8 and 10 reported `unexpected kernel failure: Maximum call stack size exceeded`. The reproduction driver passed its four baseline states. A 12,000-wrapper acyclic edge chain also exhausted the parent stack.
- **PASS** — The independent Part 21 graph walk confirms reachability and the repeated entity for each fixture. Direct import returns BrepError INPUT. CAD Part keeps INPUT and the import feature ID. Missing reference `#90000` remains INPUT. A file with an unused OFFSET_SURFACE still rejects swept cycles through the ordinary path, and an edge on the existing offset route retains the previous refusal and CAPABILITY mapping. The 12,000-wrapper ordinary chain opens.
- **PASS** — Single and nested wrappers, a shared profile and edge and two distinct edges sharing one wrapped circle all pass strict B-rep checks. Independent expectations are `1400/3 mm³` and `[5,164/35,2.5] mm` for the parabolic prism, `666π/5 mm³` and `[0,0,377/111] mm` for the revolved quadratic, and `500π mm³` with centroid at the origin for two cylinders sharing the circle. The checks use absolute tolerances of `1e-7 mm³` and `1e-7 mm`. Sol High reviewed the original topology, swept consumers, offset policy and analytic integrals.
- **PASS** — Actual desktop Open reports `cyclic curve wrapper #1000 (SURFACE_CURVE)` on the ordinary edge and both swept paths. The accepted 785.3981634216773 mm³ cylinder, source bytes, document, selected body, dirty state, history and projected camera points are retained. Redo and Undo still reach the two authored names. The same Worker then opens and renames a wrapped extrusion with measured volume 466.66666666900954 mm³, followed by Undo and Redo. Six states over 328 frozen sources. No page errors, console errors or downloads. D722 desktop replay adds five states. STEP fixture SHA-256 in edge, extrusion and revolution order is `350cf3d80f8ab25f76de844861826d8c300a86fd23e5742180bdcb6239e6ab07`, `5474262f31c140a6ae821b95e1c897bc90fa9e8819f1a0161b1a36a5c2814b49` and `165477c0e54ed71feddac2e8f64c6d1a55f0f789c6f230f2955cff04c9eedd20`.
- **PASS** — CAD 146/146, Model 31/31, Studio 51/51, all three type-checks, affected lint and test syntax, production build and diff check.
- **NOT_RUN** — Full suites, mobile and broader Part 21 validation. No new STEP geometry capability is claimed.

Run with Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
node packages/barocss-cad/scripts/tool.mjs build:fast
D741_BASELINE=1 perl -e 'alarm shift; exec @ARGV' 30 node --test --test-concurrency=1 packages/barocss-cad/test/step-curve-wrapper.test.mjs
D741_SOURCE_FROZEN=1 node apps/cad-studio/test/step-curve-wrapper-browser.mjs "$EVIDENCE/studio-baseline" --baseline
perl -e 'alarm shift; exec @ARGV' 120 node --test --test-concurrency=1 packages/barocss-cad/test/{step-curve-wrapper,step,step-spline-knots,step-offset,step-cone-zero-offset,step-sphere-offset}.test.mjs
D741_SOURCE_FROZEN=1 node apps/cad-studio/test/step-curve-wrapper-browser.mjs "$EVIDENCE/studio"
D722_SOURCE_FROZEN=1 node apps/cad-studio/test/step-spline-knots-browser.mjs "$EVIDENCE/d722-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test api-step-report step-units step-offset-units
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test project-open-ownership step-metadata step-export
pnpm --dir packages/barocss-cad type-check
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad/src/io/step-import.ts
node --check packages/barocss-cad/test/step-curve-wrapper-fixtures.mjs
node --check packages/barocss-cad/test/step-curve-wrapper.test.mjs
node --check apps/cad-studio/test/step-curve-wrapper-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D742 reproduces the selected finite edge-to-face Measure error in the current display-mesh consumer. [#2302](https://github.com/barocss/barocss/issues/2302). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
