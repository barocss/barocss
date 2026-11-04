---
work_id: D539
artifact_type: parametric-enclosure-composition
status: qualified-scoped
last_updated: 2026-11-05
---

# D539 — B02 enclosure and explicit edge selection

P1, rows 07/08/12/16, with a reproduced selection defect in row20. Parent `b463b8328a11728951c5916bcc0829a174b43205`. [B02 v1 ledger](../../roadmap-tracks/10-b02-evidence-ledger.md) fixes eleven groups. The selected true Shell, mounting rail, Through Hole row and four R1 corners pass those groups through joined actual creation and continuation evidence. This accepts the declared enclosure, not all Shells, patterns, finishing or P1. Whole CAD/core remains NOT_MEASURED; no aggregate baseline percentage is published.

Initial SMALL verification became FEATURE after actual Studio exposed a selection defect. Sol Medium authored the public-flow driver and minimal Studio fix. Sol High authored the physical observer/oracle and a separate Sol High agent reviewed source math and saved evidence. A separate Sol Medium agent reviewed the FEATURE delta. Root ran the controls and actual desktop Studio and viewed original PNGs. No public Model, geometry, tolerance, schema or dependency contract changed.

## Frozen input and composition

The exact retained D449 Shell is `/tmp/barocss-d449-category-run01/shell-edited.bcad`: 582 bytes, SHA-256 `17351eb2ad01ffbafcf9c76d21e2da5030b794600ca80a55a41a0928fdbaf6c9`. It has constrained width80/depth40, Extrude10 and open-top Shell Wall3. Wall3→2 is necessary public setup, not fresh Shell creation.

The public Box makes a separate rail at [0,-3,1]..[30,3,6]. Explicit ordered Shell→rail body picks create Union. A real `n4.top` pick makes Through Hole R1 with centers [5,0], [15,0], [25,0], then four original vertical outer corners receive R1. Width80→90 gives B, Wall2→3 gives C, and post-Open Copies3→2 gives D. The rail top stays at world Z6; its height above the floor deliberately changes. Floor overlap is180/360 mm³ and added rail volume720/540 mm³ at Wall2/3. This is a positive-volume join, not contact-only.

The controlled typed recipe omits `.made`; actual Box provenance remains raw and unchanged through all downstream edits. These are distinct source Docs. The built-in enclosure recipe has no current Studio dimension editor and is not substituted. Linear CUT requires a Difference source and cannot take this Hole; the existing Hole row is the selected pattern.

## First actual failure and repair

Run01 created the rail, Union and Hole row: three actual Doc/current Worker/native/Python bindings PASS. The first outer-edge click FAILS. With Edges shown and renderer hit edge1 at world [60,-20,5], Studio instead selects inner vertex [58,-18,2]. Root viewed the original failure PNG. The original fifteen snapshots and every packet remain outside Git.

`pickAt` correctly applies the explicit Edges filter. `vertexAt` excluded only Faces/Bodies; the click then let its nearby vertex override the edge. The tooltip promises only edges. The fix moves the existing nearest-endpoint search into private `vertexPick.ts` and allows vertex candidates only for All. It retains endpoint order, strict <7px, point copies, printed-layer exclusion and the existing section-cap guard. Actual hover and click share this path.

Run02 opens the exact Run01 Hole-row Doc, SHA-256 `2ceaf62baf257c0a3dba311f3435cb2ccea1c7e49b851c9c369732e4466e1581`, and pins its original native mapping packet `705419618dd10da92fb655570ae7936944114a6c1f7bbc0d02cc16f13a06f3fd`. It does not replay the passing public creation prefix. The first repaired click has the identical world point, pixel [707.3480131918337,584.1737160095995] and camera eye: pixel distance0, maximum eye-component difference0. It selects edge1. All four real edge picks and R1 Apply pass.

The original three bindings remain Run01 evidence at its exact source. The minimal guard does not affect Box without a pick, outliner Union or Faces-filter Hole, which already excluded vertices. Independent FEATURE review confirms that reuse boundary. Run02 is not relabelled as fresh current creation of those three operations.

## Current execution and independent authority

Controlled native admission passes all nine rows on its first attempt: Shell setup, two live outputs, Union, Hole row, finished A/B/C/D and expected invalid Width4/Wall3 refusal. The wrapper pins473 unchanged sources. Independent standard-library Python then consumes the eight preserved positive original native packets: eight PASS on its first attempt, without replaying native evaluation.

Actual Run02 passes the nine remaining bindings: finish A, B, C, refusal-retained C, FIRST document Undo B, Redo C, own project Save C, Open C and post-Open D. Together with Run01 this is twelve physical consumer bindings, seven positive native captures and five exact whole-Doc native reuses. Each consumer has a fresh original Worker observation and an independent Python check; native reuse requires exact whole-Doc JSON and unchanged numerical producers. Setup Open in Run02 is an antecedent, not a thirteenth accepted binding.

The independent oracle validates source locks, original graph ownership, native endpoints, all declared plane/cylinder roles, planar trimmed areas, complete bore-rim intervals, genus and finite rational surface/normal/pcurve witnesses. Product strict/default/output checks are labelled product observations. Original untrimmed carrier poles are not material bounds. The formulas and unchanged budgets are in the ledger. Across controlled and actual positive evidence, maximum relative-volume error is2.1717216120676632e-14, density1 mass error2.3408217858624674e-13 g, centroid error8.27574488030145e-14 mm, endpoint gap0, carrier gap1.3766765505351941e-14 mm and dimensionless normal-component error2.609024107869118e-14. Original pcurves are present; finite lift checks are exercised, maximum1.464821375527116e-14 mm. This is not a full-domain periodic/trim theorem.

Finished A/B/C have26 faces/34 loops/66 edges/44 vertices and genus3. D has24/30/60/40 and genus2. Native mass methods are closed-form, planar-exact or quadrature as appropriate, never mesh authority. Density1 grams are independent numerical controls; visible Aluminium6061 mass is a different density and is not certified by that assertion.

## Refusal, history and project custody

Actual Width4 at Wall3 produces Worker `PARAMETER` and the UI reason that the wall leaves no hollow. A passive journal on the owned existing Worker materializes only actually observed wire `added`/`ids`, fails on unknown IDs, matches request14 to its original failure reply and restores its listener/forwarding wrapper before Undo. It changes no request payload, transfer arguments, selection or Doc. The exact rejected evaluation Doc hash is `4c98f5e537ae130f3e2b473d11659f0fc7d60f1295638d0beaeb67477b161857`. A separately labelled native evaluation of that exact Doc reports feature `n2`. Worker FriendlyError itself does not carry that feature. This evaluation Doc strips `nextId` and is not a saved project Doc.

The accepted C Doc, body and history stay exact. After closing the refused editor, FIRST document Undo reaches B and Redo reaches C. No local sketch Undo substitutes. Own project C Save is3798 bytes, SHA-256 `9b3ebd4c9a6d3a05c62e79633da617422bd03cfb5b8109846708bfbc0ea0a042`; Close/same-context reload/Open returns exact C. Copies3→2 then changes the intended row only and keeps the finish references. Final D is dirty and is not resaved. The UUID project is absent before creation and removed/verified absent after the flow.

Run01 pins763 sources; Run02 pins767. Both retain0 source changes,0 page errors,0 console errors and0 downloads through cleanup. Owned contexts, browsers and servers close. Root viewed the old failure plus six current original PNGs: corrected edge, finish A, refusal, FIRST Undo, Open C and final D. Open C is cropped at its captured camera; this does not claim full-fit framing or cold-process recovery.

## Commands and result classes

All executions use Node22.19.0 and one heavy gate at a time. Existing Playwright and Chrome are used; no download or paid live run occurs.

- PASS — `gate.sh acquire heavy 60 D539-controlled-staged-admission01`; wrapper `node /tmp/barocss-d539-preflight01/bundle.mjs` invokes the bundled typed admission tool. Nine rows,473 unchanged pins.
- PASS — `gate.sh acquire heavy 60 D539-independent-preserved-native-oracle01`; `node /tmp/barocss-d539-oracle01/run.mjs`: eight original positive states, independent Python.
- FAIL retained — `D539_SOURCE_FROZEN=1 node test/enclosure-baseline-browser.mjs /tmp/barocss-d539-studio01`: three passing creation bindings, first edge wrongly replaced by a vertex.
- PASS — `node scripts/test.mjs vertex-pick-filter selection-edge` from Studio: four new focused controls plus six existing selection controls,10/10.
- PASS — `pnpm --filter @barocss/cad-studio-app type-check` and final `pnpm --filter @barocss/cad-model type-check` after the last test edit: `studio-types02.log` and `final-model-types02.log`. Three helper syntax checks and affected ESLint also pass.
- PASS — `D539_SOURCE_FROZEN=1 D539_CONTINUE_HOLE_ROW_FROM=/tmp/barocss-d539-studio01/10-actual-Hole-row-actual.bcad node test/enclosure-baseline-browser.mjs /tmp/barocss-d539-studio02`: nine remaining bindings, four captures/five exact native reuses,24 snapshots.
- REUSED — unchanged D537 focused Model/Studio controls68, docs185 and React types. These are eligible prior checks, not new D539 executions. The affected Studio types and selection controls run freshly above.
- NOT_RUN — full kernel (no B-rep-core change), general enclosure/feature families, full-domain geometry, cold browser profile, final D resave, catalog-material mass, inertia, mobile, exchange, release/develop integration.

Raw logs, PNGs, original native graphs and executed module copies stay outside Git. Small counts, commands and hashes are in [qualification.json](qualification.json). Run01 receipt hash `e0fccc604f5952b5ea08f7c3ed49d402af66b85de9257f35111c624f4af7f695`; Run02 `bd4b644c9398f84648e31b128c18ebf5e71f9c3998012f37cd48659e167f8692`. Executed helper/product copies match their after-cleanup capsules.

Live related issues #529, #534 and #551 remain OPEN: this bounded selection fix and enclosure do not satisfy their whole workspace, feature-family or general graph criteria. No completion comment or closure is posted. Existing HOLDs remain, including UI redesign, nonzero-cone, fitter/public-thicken/#2266 widening, manufacturing, Studio Physics/Motion and release. Next MAIN is D540 / P1 B03: adjudicate retained partial/full Revolve and distinct hole branches, then select the first missing supported interaction. Preserve D501 custody FAIL and positive tapped NOT_RUN; do not relabel a support bracket as a general shaft/flange.
