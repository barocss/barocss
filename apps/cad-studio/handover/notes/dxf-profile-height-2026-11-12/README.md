# D733 — Preserve the DXF XY profile boundary

P0, rows 13 and 16. FEATURE qualification. Parent `f472588266cf405d51d861c5c1ecdfe0d207c9d0`. [#2297](https://github.com/barocss/barocss/issues/2297).

LINE group 30 is start Z and group 31 is end Z in WCS. LWPOLYLINE group 38 is elevation. The profile reader checks those fields before extracting XY coordinates or joining endpoints. Omission, explicit zero and the existing inclusive `1e-9` threshold in source units remain supported. An off-plane value returns `DXF_UNSUPPORTED`. A malformed or nonfinite value in the checked fields returns `DXF_MALFORMED`. Both diagnostics identify the entity and group. The profile's existing group 230 check also validates its numeric input. Block underlay transforms retain their existing reader and ±Z contract. [Autodesk LINE DXF groups](https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-FCEF5726-53AE-4C43-B4EA-C84EB8686A66.htm), [Autodesk LWPOLYLINE DXF groups](https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-748FC305-F3F2-4F74-825A-61F04D757A50.htm).

## Qualification

- **FAIL (parent)** — Actual Add drawing adopted the endpoint-only 5 mm Z discontinuity, elevations +5 mm and −5 mm, a nonnumeric endpoint Z and an overflowing elevation. Each became a 200 mm² XY region with box `[0, 0, 20, 10]`. Bundled native evaluation of those drafts at 3 mm measured 600.0000000000001 mm³. The source manifest shows a 5 mm gap at the join in the endpoint-only case. The start-only and both-end nonzero controls already refused. The baseline driver passed its seven reproduction assertions.
- **PASS** — Current desktop Add drawing and Model refuse all seven fixtures with the expected code and field. The existing draft, 600.0000000000001 mm³ solid, selected top face, document, dirty indicator, history and pending Redo stay identical. A zero-elevation control imports, extrudes 3 mm, and matches the independent 20×10×3 mm³ expectation within `1e-7 mm³`. Undo, Redo, browser-project Save and fresh Open preserve the accepted document and body. Native SHA-256 `ef34b0aa4967df9d91ec0445c0466ec435755e84f71bd676de53d04669d9a9bd`. Twelve current desktop states over 795 frozen inputs, zero page errors, console errors and downloads.
- **PASS** — Model 42/42, including omitted and explicit zero, decimal forms, malformed values, both sides of the source-unit threshold, millimetres, inches and metres, +Z and −Z profile controls, ordinary arcs/circles, R12 POLYLINE and nested DXF underlay behavior. D731 and D730 desktop replays passed eight and ten states. Studio 38/38, both type-checks, affected lint, driver syntax, production build and diff check passed.
- **NOT_RUN** — Arbitrary-plane profiles, new block-height behavior, other normal components, third-party DXF applications, full suites and mobile.

| Authored fixture | SHA-256 |
| --- | --- |
| LINE start only | `2f44f9f89c469134d38ca39fa6ce737450425cd7bb281bac4e8decd8e435a6fa` |
| LINE end only | `d83346f999b68f195de52814cb31c914be488b182ca30096cc0290dc83f1751f` |
| LINE both endpoints | `4abcc87407a7484339a2e91ff1a2235371ed709198dcbacd0cfabe12c40cbb56` |
| Positive LWPOLYLINE elevation | `81f0a8c574239a6d92de1ebd77fba3669aaa7630b30329c5382788de8eea51ac` |
| Negative LWPOLYLINE elevation | `4afaf61f44ba09fb5007c94ed9711017f0447cd7ce02d2ae5b1109b83a6bdda8` |
| Nonnumeric LINE endpoint Z | `7689f25c64389dd0c1ff8442cd4432b105bca88e3609b02d0737ae2f9e6d7ad1` |
| Overflowing LWPOLYLINE elevation | `e195b4f0cb8980eacd0442cdb2f03100efd4bd6b358fe467f0053aa419595f8e` |

Use Node 22.19.0 and existing Chrome and Playwright under the serial heavy gate. Keep raw evidence outside Git.

```sh
D733_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-profile-height-browser.mjs "$EVIDENCE/baseline" --baseline
D733_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-profile-height-browser.mjs "$EVIDENCE/studio-final"
D731_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-zero-chord-browser.mjs "$EVIDENCE/d731-replay"
D730_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-visibility-browser.mjs "$EVIDENCE/d730-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test dxf drafts
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test draft project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/sketch/dxfRead.ts packages/barocss-cad-model/test/dxf-profile-height.test.ts
node --check apps/cad-studio/test/dxf-profile-height-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D734 checks the remaining workspace-transition and reverse-delivery cases for pending sketch Finish, starting with D574 and D663. [#2364](https://github.com/barocss/barocss/issues/2364). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
