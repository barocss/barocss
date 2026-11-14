# D1174 — Offset and edit the top of an imported STEP box

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2465](https://github.com/barocss/barocss/issues/2465)

STEP import represents a planar face with a support larger than its trimmed boundary. The existing Offset admission required the support poles to coincide with the trim corners. For a STEP cardinal side, also accept a rectangular affine support when it lies on the exact trim plane and its two intervals enclose all four native trim corners. The existing source topology, straight edges, cap congruence and actual Boolean result checks still apply.

| Result | Check |
| --- | --- |
| FAIL | At the parent, Studio opened the native 20 × 10 × 5 mm STEP box and picked its top face `n0.box.top`. It refused a −2 mm Offset because the side support poles were outside the trimmed rectangle. |
| PASS | Desktop Studio applied −2 mm to that face, reducing volume from 1000 to 600 mm³ and moving the top from Z11 to Z9 mm. History opened at −2 mm, refused −5 mm and disabled Apply without changing the accepted document. With +3 mm it previewed a valid result and Apply moved the top to Z14 mm, giving 1600 mm³. Both states preserved the four opposite cap corners at Z6 and the X4–24 and Y−3–7 intervals. The native centroids were (14, 2, 7.5) and (14, 2, 10) mm. Direct comparisons of the native boundary and volume against the box dimensions passed within 1e−7 mm and 1e−7 mm³ respectively. |
| PASS | History retained the STEP bytes, original face reference, feature and output IDs. Undo restored the inward box and Redo restored the outward box. Fresh Open restored the accepted project and the signed History field. Cancel retained it. |
| PASS | D1173 cylinder desktop regression, Sol High geometry review, 71 focused Model tests including drafted STEP refusal, four focused Studio tests, both type checks, scoped lint, driver syntax, diff check and production build. |
| NOT_RUN | General STEP support orientations, imported curved and nonplanar caps, external STEP readers, full suites and mobile. |

The desktop checklist remains **29/54 (54%)** and initial scenarios **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [#2465](https://github.com/barocss/barocss/issues/2465) stays open for Draft, Hole and angled Split. D1175 starts with the signed Draft pull and neutral coordinate on the imported side.

D1173's 52-test focused Model receipt includes `native-offset-face`, `native-offset-result`, `native-quadrature-step` and `offset-face-native` coverage. Its command listing names a different filter from the captured groups. [Commands and hashes](qualification.json).
