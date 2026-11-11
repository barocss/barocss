# D742 — Measure finite segment crossings at zero distance

P1 intake, row 16. The reproduced wrong distance meets P0 correctness priority. FEATURE qualification. Parent `71c4b115588e8e9a0c83806d6d5b3f82ece38549`. [#2302](https://github.com/barocss/barocss/issues/2302).

Measure now includes crossings between finite display segments and triangles in both pick orders. The triangle-plane side tests bound the segment. The three directed side tests bound the triangle. An exact dyadic determinant resolves ambiguous binary64 signs. A proven crossing rounds the exact barycentric point to the nearest binary64 coordinate and assigns that point to both witnesses. Positive gaps retain the existing closest-feature search. Angle, normal distance and axis metadata retain their own calculations. The planar dimension placement can move the two witnesses only for a positive distance.

## Qualification

- **FAIL (parent)** — The synthetic triangle crossing reported 1 mm in both pick orders. The current two-prism producer gave the same failure. Actual Studio selected `n1.top` and edge `n3.side0|n3.side3`, reported 1 mm and displayed one measurement line in both orders. The Worker edge spans `[2,4,9]..[2,4,11]` mm. Its point `[2,4,10]` is strictly inside one Worker top triangle by independent oriented XY edge signs.
- **PASS** — Desktop Studio reports 0 mm and 90° in both orders and displays zero measurement lines. Escape and re-entry, local-project Save, Close, reload and Open, and the same measurement pass. The gap fixture raises the edge endpoints to Z=11 and 13 mm. Studio reports 1 mm and one measurement line for that control. The accepted document, body summaries, history controls and dirty state are stable in each measurement. Seven current desktop states over 329 frozen source files, no page or console errors and no downloads. Saved native SHA-256 `274cb6a1b7eaa46bbb54df39e5f1401eb8119bc3326326c168a243bce9b89fd0`.
- **PASS** — Model 36/36 and Studio 36/36 focused tests, both type-checks, affected lint, driver syntax, production build and diff check. Model covers segment reversal, endpoints, sides, vertices, finite misses, coplanar and degenerate controls, scales from `2^-400`, translation by `2^30 mm`, tilted-plane tests, near-parallel metadata, and positive gaps down to selected cancellation cases. Exact witness controls retain `x=-2^-60 mm` beside a side and round midpoint ties to even. Sol High independently derived and exercised the counterexamples for rounded side tests, a lost witness coordinate and the planar metadata overwrite. The existing native offset proof tests pass with the shared binary64 conversion.
- **FAIL (initial driver)** — The first fixed desktop driver observed the raw Worker delta before mesh reuse was expanded. Its positive-gap check could not read the reused plate mesh. The final observer reads the decoded response from the existing client callback.
- **Known boundary** — The pre-existing closest-feature fallback can round a positive sub-ULP gap to zero. One independent triangle fixture gives exact gap `2^-54/√3 mm` and rounded closest-feature distance zero. The new crossing predicate rejects that segment. This decision qualifies the missing finite crossing case and the measured positive controls.
- **NOT_RUN** — Full suites, mobile, general curved native distance and broad closest-feature precision. The Studio result is a display-mesh measurement.

Run with Node 22.19.0, existing Chrome and Playwright, the serial heavy gate and an external evidence directory.

```sh
D742_BASELINE=1 TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test measure-segment-face
D742_SOURCE_FROZEN=1 node apps/cad-studio/test/measure-segment-face-browser.mjs "$EVIDENCE/baseline" --baseline
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test measure native-offset
D742_SOURCE_FROZEN=1 node apps/cad-studio/test/measure-segment-face-browser.mjs "$EVIDENCE/studio-pinned"
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test viewport-pick viewport-overlay project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/app/{measure,measureIntersection,nativeOffsetFace}.ts packages/barocss-cad-model/src/engine/binary64.ts packages/barocss-cad-model/test/measure-segment-face.test.ts
node --check apps/cad-studio/test/measure-segment-face-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist-exact"
git diff --check
```

Next D743 verifies that Measure displays an already computed positive gap without rounding it to zero. [#2355](https://github.com/barocss/barocss/issues/2355). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
