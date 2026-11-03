---
work_id: D475
artifact_type: native-face-extrude-height
status: qualified
owner_role: executor
source_request: "Reproduce and fix native cap height loss in existing face-picked Extrude Join"
last_updated: 2026-11-03
---

# D475 — Retain native face Extrude height

C1/C2, rows 07/08/12/16: the reproduced height-loss defect is fixed. Seven desktop lifecycle groups pass for one dyadic source height. Parent is `fa860edf9d781f7bade94ae8564d8c980a2b1e2a`. [Qualification](qualification.json) records exact receipts, source hashes and limits. High native, general source and seven selected desktop native-binding reviews ACCEPT. No broader admission or HOLD changes follow.

## First failure and correction

The retained D462 integer XY footprint is min [10,20], max [30,50]. Only source height changes to H=10.0009765625 (10+2^-10), input SHA256 `7f6626f558f008851ef72fb45aa90cc89543ddc54a9687c46e27ca5319db82ef`. Current native cap mapping is an antecedent, not a separate seed physical qualification.

Original native run01 and the minimal real desktop cap/default Join 5 run01 both return accuracy FAIL, exit 1, with capture readiness PASS. Generic plane rounding produces 10.001: two native solids and two shells remain, with a 2.3437499999445777e-5 mm axial gap. Top is 15.001 instead of 15.0009765625. Aggregate volume error is 0, but centroid Z error is 7.811991406647678e-6 mm. Desktop shows two pieces and twelve faces. Raw document, Worker and all native bodies are preserved before ideal-box assertions; Worker coherence 0 does not establish correct requested geometry.

The build-only correction uses the existing native resolver for a fresh, pure, owned +Z polygon cap. It clones the native loop, exact plane and on reference. Existing render/available/default/handle paths, global rounding, Offset resolver, B-rep core, schema, API and UI stay unchanged. Deliberate unsupported fallback requires an exact typed reason, current native identity, complete finite geometry and strict validity. Stale BAD_REFERENCE, unknown and malformed failures propagate. Malformed/unknown guards have source review only, not direct regression coverage. Unkeyed, holed, arc, side, -Z and circular profiles retain the generic route; no wider geometry case is qualified.

## Fixed native and desktop proof

Native preflight passes tool heights 5/8/12 and the existing PARAMETER n3 height 0 guard. The current ten-pin cap map retains exact H in generated n2. Independent Fraction integration gives V=600(H+h), centroid [20,35,(H+h)/2], bounds [10,20,0]..[30,50,H+h]. Volumes are 9000.5859375, 10800.5859375 and 13200.5859375. Unchanged 1e-9 volume-relative and absolute centroid/bounds/pin/carrier/normal budgets apply.

Seven desktop groups pass: real cap pick/default Join 5; generated tool Distance 8; Distance 0 refusal; FIRST Undo 5; Redo 8; own OPFS Save/Close/same-context reload/Open 8; post-Open Distance 12. Default Join/Draft 0 are observed, not set. Seven bindings use three captures, four exact-whole-document reuses, seven fresh Python oracles and seven current Worker bindings. Native volume error is 0; maximum centroid error is 3.552713678800501e-15 mm; selected Worker volume/centroid errors are 0.

Observed topology is one closed solid/shell, 8 vertices, 12 edges, 6 faces, 6 loops, 24 coedges. Native supports, exterior areas, reciprocal trims and pcurves pass (maximum sampled gap 0 mm), with no exposed cap interface. These counts describe this case. Root viewed 7 of 24 fixed states/images and 4 of 10 original failure states. Selected caps are unobstructed; later Iso views remain partly hidden by the fixed palette. No full Fit claim follows.

## Checks, cleanup and limits

Related Model tests pass 64/64, 0 FAIL/0 SKIP; targeted lint, Studio types and final Model types pass after the last test edit. Native inspector bundling passes separately. Production build and full kernel are NOT_RUN; retain D433's 2066 PASS/2 historical SKIP. Node requires explicit 22.19.0 PATH. Desktop only; mobile tests are NOT_RUN by owner rule.

All measured source capsules match after cleanup. Owned processes are absent, contexts/browser/servers close and the gate is free. The fixed OPFS namespace is removed and absent. Errors, console errors, downloads and watched changes are 0. Original failure helper source-after.json is NOT_RUN/absent; separate cleanup/current equality is preserved. Root preparation 01 misread a top-level manifest array before gate/build/SUT; only its reader changed. Preseal driver protocol corrections also precede SUT. Original failures remain immutable.

D474 integer lifecycle and D342–D344 Offset proofs are retained. No XY off-grid, live base following, inertia or general polygon claim. #534 PART06 stays partial/open without checklist promotion. Core readiness remains NOT_MEASURED, legacy 43% frozen and all HOLDs unchanged. D476 is only a source-only circular +Z dyadic-height audit candidate; no probe, runtime, fix or admission is selected.
