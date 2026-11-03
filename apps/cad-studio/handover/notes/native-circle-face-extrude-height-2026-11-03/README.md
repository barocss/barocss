---
work_id: D476
artifact_type: native-circle-face-extrude-height
status: qualified
owner_role: executor
source_request: "Fix height loss in existing circular +Z face-picked Extrude Join"
last_updated: 2026-11-03
---

# D476 — Retain circular native face Extrude height

C1/C2, rows 07/08/12/16: the existing circular +Z face Extrude height defect is reproduced and corrected. Fixed native heights 5/8/12 and seven desktop lifecycle groups pass. Parent is `f0ef2ddb00fef6a7b073d1a51a15bef69974eb61`; the candidate has exactly two uncommitted product/test files. [Qualification](qualification.json) binds their hashes and receipts. General source and High native reviews ACCEPT, as reported by root. High audit ACCEPT_SEVEN_SELECTED_DESKTOP_NATIVE_CIRCLE_BINDINGS confirms the seven selected actual bindings.

## Original failure

One existing R3 circle at center [0,0] uses source H=10241/1024=10.0009765625. The cap map is an antecedent, not a separate seed physical qualification. Original native and independent minimal desktop cap/default Join 5 both return requested-geometry accuracy FAIL, exit 1, with capture readiness PASS. Generic mapping uses plane 10.001. Two cylinders and two shells remain, separated by 2.3437499999445777e-5 mm. Top is 15.001 instead of 15.0009765625. Native volume absolute error is 5.684341886080802e-14; centroid Z error is 7.8119914057595e-6 mm. Circle radial and pcurve proofs pass despite the placement defect.

Desktop shows two pieces and six display faces. Root viewed 4 of 10 failure states. The current Worker agrees with native volume, but its maximum centroid error is a nonzero 2.0940560510824758e-17 mm. Consumer coherence does not prove the requested geometry. Original helper source-after is absent/NOT_RUN_FIRST_FAILURE; separate frozen/cleanup/current equality is retained.

## Correction and native proof

The build-only correction resolves a fresh, pure, owned native +Z cap with one finite CCW full-circle loop. It clones the certified native sketch, exact frame and on reference. D475's polygon route remains. Typed unsupported fallback, stale BAD_REFERENCE and unknown/malformed propagation remain. Malformed guard behavior has source review only, not new runtime proof. B-rep core, global rounding, Offset resolver, API, schema and UI are unchanged. No ellipse or broader geometry admission follows.

Native preflight passes heights 5/8/12 and height 0 PARAMETER at n3. The ten-pin map retains exact H. Its ten source pins are distinct from the eight temporary manifest sources. Independent analytic pi-cylinder reference gives V=9π(H+h), centroid [0,0,(H+h)/2], bounds [-3,-3,0]..[3,3,H+h]. Expected volumes are 424.142619888804, 508.9656215357285 and 622.062957064961. Original 1e-9 volume-relative and absolute centroid/bounds/carrier/curve/pcurve budgets remain.

Each fixed native state is one closed body/shell with 4 vertices, 6 edges and 4 faces. Maximum radial and pcurve bounds are 2.5121479338940395e-15 and 5.974795500617759e-16 mm. These counts apply to this case.

## Desktop evidence boundary

Fixed desktop attempt01 stops at an early harness exact-equality assertion before any native/oracle binding. Chrome derives arc center and startY near -2.220446049250313e-16; the Node map has zeros. This is not a product-geometry FAIL verdict or a lifecycle PASS. Nine states and raw accepted data remain preserved. Normal after-success files are absent. Root confirms 2394 wrapper and 2395 helper frozen/cleanup/current pins equal, owned PID absent and gate free.

Separate inspection of the saved actual accepted document finds one strict closed genus-0 body, correct bounds/volume/centroid, and 4 vertices/6 edges/4 faces/4 loops/12 coedges. High curve audit ACCEPT is reported under the original 1e-9 budget. The revised oracle checks derived start/center vectors under that same budget; it does not snap product data. Root's single saved-raw oracle02 replay passes. Authored source/frame/DAG stay exact; derived start/center vectors use the existing budget. Later reuses preserve the exact accepted actual document, including derived coordinates. No passed three-state native baseline was repeated.

Final desktop attempt02 passes seven groups: real cap/default Join 5; tool Distance 8; Distance 0 refusal; FIRST Undo 5; Redo 8; own OPFS Save/Close/same-context reload/Open 8; post-Open Distance 12. Default Join/Draft 0 are observed. Seven bindings use three fresh native captures, four exact actual-document reuses and seven fresh Python/Worker bindings. Maximum native volume/centroid errors are 4.547473508864641e-13 and 1.7763568394002505e-15 mm. Selected final Worker errors are 0; the original nonzero Worker error remains recorded separately. Continuous radial/pcurve-lift bounds are 2.5121479338940395e-15/5.974795500617759e-16 mm; the native numerical nine-point pcurve gap is 3.552713678800501e-15 mm. These are different metrics, both below 1e-9. Root viewed 7 of 24 states. The selected cap and accepted Frame all cylinder are visible; initial preview top is cropped. No full preview-fit claim follows.

All 2384 wrapper and 2385 helper before/after/cleanup/current source pins match; normal final after files exist. Namespace D476-fixed02-face-join-run02 is removed and absent. Context, browser and server close; owned PID 2003 is absent, gate free, end load 7.28. Errors, console errors, downloads and watched changes are 0.

## Checks and closeout scope

Related Model tests pass 65/65, 0 FAIL/0 SKIP. Targeted lint, Studio types and final Model types pass after the last test edit; 1488 source pins match. Native inspector bundling passes separately. Production build and full kernel are NOT_RUN; retain D433's 2066 PASS/2 historical SKIP. Root runs use the gate and Node 22.19.0. Mobile is NOT_RUN_OWNER_RULE. Raw logs, images and B-rep files remain outside Git.

The owner approved FIRST-PASS CLOSEOUT of the current known C1/C2 reproduced-defect list through D476. This does not complete all C1/C2 or geometry. Other cap variants, off-grid XY and general breadth are deferred follow-ups; do not hunt variants automatically. D477 selects a C3 audit/measurement of existing PART DRAWING dimension loss/recovery after public Hole Suppress/Unsuppress. The fixture/group contract is pending; no defect is reproduced and no product change is selected. Check lost/DIMENSION_LOST and SVG mark removal while retaining the authored definition, same ID/ref recovery via Unsuppress/history, and own OPFS lost-state Open then restore. Delete is a separate intentional removal. Do not replay D454/D455/D459/D399. No new annotation, standards, export or download scope. #534 PART06 remains partial/open, core readiness NOT_MEASURED, legacy 43% frozen and all HOLDs unchanged.
