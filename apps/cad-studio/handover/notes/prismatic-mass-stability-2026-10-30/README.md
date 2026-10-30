# D343 — Stable longitudinal prismatic mass

**BOUNDED_QUALIFIED.** Final source, affected checks and actual Studio run-03 pass within the scope below. Root separately reviewed four images. The documentation structural gate passes. Normal publication follows this document commit. This was not a clean first product pass: run-01 failed at circle qualification and run-02 failed public cap identity. Both failures and their corrections are retained.

The final local source checkpoint is `e1ff873c4e0de4dca628c6486c5e99e7b8bcc591`, based on published D342 `4ce1b35c753952010eb6961c62ccd6c6490bd01e`. The three source commits are `f9c17c146…` (11 files), `3177950c4…` (two files) and `e1ff873c4…` (three files), covering 14 distinct implementation paths. Normal push follows the document commit. See [qualification.json](qualification.json).

## Result and implementation boundary

The captured translated upright cylinder retains the exact native interval `[0.3456789, 0.34567890000000023]`, a positive four-ulp gap of `1 / 4503599627370496` mm. The old longitudinal integrals returned normal centroid `0.34375`, outside that interval. The corrected normal centroid is `0.3456789000000001`, at the independently computed midpoint and inside the actual stored interval.

The Kernel mass change factors only two longitudinal terms: `h2 = h * (a / 2 + b / 2)` and `h3 = h * (a*a + a*b + b*b) / 3`, retaining `h = b - a`. Area moments, accumulation order, density/error contracts, method, geometry and native SI bookkeeping remain on their existing paths. The independent Node oracle decodes represented values into normalized BigInt rationals and computes direct polynomial integrals. Midpoint error and physical closed-interval containment are separate assertions.

Corrected mass exposed an existing Offset consumer boundary: rotated X/Y composition could remove the target while a witness survived. The shared Offset build now checks the actual existing Extrude/Boolean candidate before returning it. It binds the exact recipe, final target key/ref, one strict-valid closed native solid, full cap support levels, strict boundary normal interval, bounded tangent extents and the actual Model mass provider. The witness cannot substitute for a missing target. Ordinary X/Y retries remain successful.

This is an **Offset build-time postcondition**, not a persisted Offset feature or a general guard automatically rerun for arbitrary Boolean calls, later parameter/feature edits or authored files. Normal/extent checks do not prove full material equivalence, arbitrary side interiors, tangent mass accuracy or quadrature accuracy.

Two actual browser failures required bounded follow-ups. The circle candidate check now accepts finite positive half-spans instead of requiring their exact equality; the existing complete rational whole-circle proof remains the authority and an ellipse still refuses. Cap provenance now selects the exact stored height (`cp.z === z`), preserving same-height membership/order and fallback. The captured result has three unique public groups and four native physical faces. Cap identity changed; replayed geometry, recipe and mass excluding names are exactly unchanged. No new tolerance, minimum thickness, coordinate rewrite or centroid clamp was added.

## Final engineering gates

| Gate | Result |
|---|---|
| Kernel mass baseline | 25 PASS, 19 FAIL, 0 SKIP; first failure retained. |
| Kernel mass candidate | 44 focused PASS and 68 related PASS. Forty-three shared recorded volume/mass bit pairs are unchanged. |
| Cap identity owner | 8 focused PASS, 105 related PASS; build, types and narrow lint PASS. |
| Final root full Kernel | **2,325 PASS, 0 FAIL, 6 existing SKIP / 2,331 tests**. The earlier pre-cap run, 2,317 PASS / 6 existing SKIP / 2,323 tests, is also retained. |
| Final affected Model | **86 PASS, 0 FAIL, 0 SKIP**; full Model types and changed-test lint PASS. Distinct public cap selection and file-reopen names are included. Full Model suite is NOT_RUN. |
| Independent source reviews | Kernel formula/oracle review and final v4 cap-identity review have no blocking finding. Reviewers did not execute the runtime gates. |
| API and Studio | Initial nine checks PASS, including Studio chat 23 PASS. Root explicitly reused unchanged API/generated/chat/type/driver contracts and rebuilt Studio after circle and cap repairs. Final Vite build PASS. Full Studio suite is NOT_RUN. |

API inventory adds one Model app function, `validateNativeOffsetResult`: 6,833 → 6,834 exposures, zero removals, zero existing **shape** changes and zero presentation-only changes. Private implementations intentionally change behavior. Circle/cap follow-ups add no further exports. There is no new document node, schema or persistence format.

## Actual Studio qualification

[Run-03](studio/run-03/receipt.json) and the separate [root flow/image review](root/flow-review-run03.json) pass at the final checkpoint. The flow uses a public API-authored translated cylinder and witness, actual mouse cap selection, the literal Offset `-5.00009`, preview/Apply, cleared geometry picks, Undo/Redo, native Save/fresh Open and an ordinary visible `+2` control. Raw generated height/from and the source prefix are checked. Three unique public groups, four native physical faces and their names remain stable. Witness `b4` retains its names and the 420 mm³ / `[86, 0.5, 3.5]` control within the recorded tolerance.

Run-03 uses **one Chrome process and three serial contexts**. It records 14 observational states, six native reads, four independent Fraction oracle checks, four actual Studio mass reads, two actual mouse picks, two cleared-selection checks, one native file and one download. These are observations and operations, not 14 registered tests.

Actual Studio tiny volume is `6.278163296415537e-15` mm³; the Node public result is `6.278163296415536e-15` mm³. This is a one-ulp cross-engine difference, not bit identity. Both pass the independent rounded-circle volume guide and exact native interval/midpoint checks. Raw normal centroid is `0.3456789000000001`. Native B-rep quadrature is recorded separately and is not an accuracy oracle for this repair.

The source capsule starts with a 13-file subset, then freezes 728 listed bundle inputs after generation. Frozen/after/after-cleanup sets match at 728. This is not a whole served-graph attestation before generation. Page errors, console errors and watched changes are zero. All three contexts, browser and server close.

Root viewed preview, thin-result Iso, reopened-thin Iso and visible-control Iso images. This is **SCOPED_VISUAL_AND_PRODUCT_FLOW_PASS** for actual UI/renderer presence and behavior. Pixels and Float32 display bounds cannot resolve the four-ulp height or prove exact native geometry or raw mass; native coefficients and the four independent oracle checks provide that separate evidence.

## Preserved failure and review history

- Historical Model expectations: 36 PASS / 2 FAIL. Actual corrected Z command/native/public/Model/file success was proved before changing only obsolete circle mass-refusal expectations. Strict-invalid polygon refusal remains.
- Actual-result helper: 0/6 → 4/6 → 6/6 PASS. Broader integration then found 79 PASS / 2 FAIL on ordinary X/Y retries, reopening the v1 source review. A later overrestriction gave 7 PASS / 1 FAIL by treating unused side-support poles as trimmed material. Final helper tests pass 8/8 and v2 integration passes 83/83. Earlier source PASS is not promoted over later runtime failures.
- Run-01: original mouse selection succeeds, then preview refuses `[VALUE] Offset face: the native circular cap needs one finite circular bound.` The historical phase label remains at viewport pick, but the timeout is in preview. Chrome cap half-spans are 3 and 3.0000000000000004 versus Node's 3/3. The private candidate check is repaired; full-circle proof remains unchanged. Focused tests pass 26/26 and integration 86/86. Failed captured STEP attempts and their admission boundary are preserved.
- Run-02: preview/Apply and raw corrected mass succeed, but public names `n1.bottom`, `n1.bottom`, `n1.side0` alias two distinct caps. The unique-name assertion is not removed. Exact-height cap provenance repairs this identity, followed by fresh Kernel full, Model and run-03 gates. Both failed product runs have zero page/console/watch errors and complete cleanup.

See [actual-result history](actual-result/receipt.md), [v2 review](result-review/review-v2.md), [circle repair](circle-browser/receipt.md), [v3 review](result-review/review-v3.md), [cap repair](cap-identity/receipt.md), [v4 review](result-review/review-v4.md), and [final Model receipt](model/final-cap-model-receipt.md). Original logs remain separate; counts from overlapping stages are not added into a fabricated total.

## Unrepaired scope and next priority

Native B-rep quadrature remains **UNREPAIRED**. On the same tiny native cylinder it reports volume `6.180191251439208e-15` mm³, about 1.56% below the rounded circle guide, and a shifted tangent centroid. The upright provider's success does not qualify that provider. General central inertia, 2D Green integration, overflow/subnormal extremes, other providers, generic naming/material guarantees and performance remain outside D343.

The [next source-only plan](next-plan/native-quadrature-review-plan.md) addresses existing roadmap16/CG10 native quadrature conditioning, including a STEP consumer route. It is not implemented or qualified. Existing unresolved 16 work precedes remaining ordinary 08; 08 stays open, 09 follows 08, and Electron 15 stays queued. No new parallel queue is created.

The final documentation gate passes. The document commit and normal push follow the staged artifact checks. Remote CI, release, full Model/Studio suites and performance benchmarking are NOT_RUN. Source hashes establish provenance; they do not replace geometry or product evidence.

The first staged artifact check flagged raw unified-diff context blank lines as trailing whitespace. The exact diff is preserved as deterministic gzip with decoded/stored hashes; no product or historical evidence bytes were trimmed. This packaging failure is separate from runtime checks.
