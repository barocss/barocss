---
work_id: D541
artifact_type: true-flanged-shaft-composition
status: qualified-scoped
last_updated: 2026-11-05
---

# D541 — Coherent circular flange and shaft

P1, rows07/08/12/16. Parent `f4e9eca734c183878b36a8fe3e830aa0995e69a6`. SMALL verification only; no product/public/geometry change was needed. [B03 ledger](../../roadmap-tracks/11-b03-evidence-ledger.md) remains NOT_ADJUDICATED. D540 qualifies the existing rectangular support's full-Revolve source Depth, not this true circular shaft/flange composition.

A bounded retained-input inventory found no eligible same-Doc circular flange+shaft actual proof. The drawing fixture named flange.bcad is a100×100 rectangular plate with a central bore and bolt circle (SHA-256b147ca8d63c2905f96ca2ad9922ef24f73f5a2a3ebd8b1b7b36ccc3d0f902be1). The shaft-hub-keyseat fixture is a shaft with a separate keyed hub. Neither is relabelled as this part. Existing public Cylinder, Union, Hole and circular Fillet contracts are available; this is a missing composed proof, not a request to recreate those tools. The Shaft helper has estimated keyed/grooved defaults and is not used.

## Frozen candidate and eleven groups

Start with public New part in an owned fresh desktop context. Make flange Cylinder R20/Height6/Centre X0/Y0/At Z0 and shaft Cylinder R10/Height25/Centre X0/Y0/At Z5. Both use default+Z and explicitly typed coordinates. Cylinder makes separate bodies; it has no New selector. The shaft overlaps the flange by1mm, volume100πmm³. Select flange then Shift-shaft body rows for explicit Union. Pick the actual current upward shaft cap for central Through HoleR3 at worldXY[0,0]. Pick the actual current outer shaft-top rim for circular FilletR1. Source names/signatures must come from original prefix BReps and genuine public pointer mappings; do not invent ordinal aliases or discard anchors.

A has shaft top H30. Existing n3 NodeEditor **Distance25→35** produces B with H40; this is not the separate Edit Cylinder HUD route. Refuse Distance0, close its editor, FIRST Undo A/Redo B, own project Save/Open B, then Distance35→25. Preserve the first native or Studio failure and stop before changing the selected profile.

| Group | Required result | Current result |
| --- | --- | --- |
| D541-01 | Public New part and explicit first Cylinder create the true circular flange. | PASS: actual New part and explicit flange Cylinder. |
| D541-02 | Second Cylinder creates the declared shaft with two live bodies and positive overlap. | PASS: actual separate shaft, two live outputs and positive1mm overlap. |
| D541-03 | Real ordered body picks create one native Union with the intended circular shoulder. | PASS: real ordered flange/shaft picks and one native Union. |
| D541-04 | Real shaft-cap pick creates central Through HoleR3 across the full current part height. | PASS: actual cap pick and full-height R3 bore. |
| D541-05 | Real outer top-rim pick creates R1 while retaining the shoulder and bore. | PASS: actual complete outer-rim pick and R1 finish. |
| D541-06 | Public Distance25→35 regenerates the part and preserves original references/anchors. | PASS: Distance25→35, current H40 geometry and unchanged references/anchors. |
| D541-07 | Source-defined independent volume/moments/bounds and original native graph/trim/carrier authority agree with fresh Worker consumers. | PASS: six independent controlled states and twelve fresh actual Worker/Python joins. |
| D541-08 | Actual Distance0 Apply refuses without changing accepted Doc/body/history. | PASS: actual Apply refusal and exact B Doc/body/history retention. |
| D541-09 | FIRST document Undo restores original A; Redo restores B. | PASS: FIRST document Undo original A, Redo exact B. |
| D541-10 | Own UUID project Save/Close/same-context reload/Open restores exact editable B. | PASS: own project Save/Close/same-context reload/Open exact B, then namespace removed/absent. |
| D541-11 | Post-Open Distance35→25 restores A geometry and retains correct receipt cleanup. | PASS: post-Open height25 geometry, shaft receipt still absent and raw Doc different from original A. |

All eleven frozen groups pass:11/11 for this selected B03-SHAFT profile, not the whole B03 matrix or whole-CAD denominator. Twelve actual physical bindings are observed: flange, shaftNew(two outputs), Union, Hole, finish A, B, refusal-retained B, Undo A, Redo B, Save B, Open B, post-Open height25.

## Builder receipt and source intent

Actual Cylinder nodes carry `.made` receipts. Existing `App` calls `dropStaleMade` after a NodeEditor source edit; editing n3 Distance removes its receipt while leaving n1's unchanged. Thus original A/Undo A have both receipts, B has only the flange receipt, and post-Open height25 keeps the shaft receipt absent. That final source is not raw-Doc-identical to original A despite restored geometry. Verify this existing behavior; never preserve a stale receipt as current dimension authority or fabricate a receipt for control equality. The typed NON_UI admission source intentionally has no `.made` and stays separate from the later actual source.

## Independent physical targets

Only H30/H40 are selected. Let `a=1−π/4`, `D=2π(9a+1/6)` for the outer R10/top FilletR1 removal. Then:

`V=π(1800+91H)−D`

`Mz=π(5400+45.5H²)−(H−1)D−13π/4`

Centroid[0,0,Mz/V], density1 gramsV/1000, bounds[-20,-20,0]..[20,20,H]. A→B adds910πmm³. Original material boundaries must establish flange R20/Z0..6, exposed shaft R10/Z6..H−1, bore R3/Z0..H and convex torus major9/minor1/axisZ/centerZ(H−1), outer quarter. Planar trim areas: bottom annulus391π, shoulder300π and top annulus72π. Genus1. Original complete cap/rim intervals, cylinder axial extents, torus trims and rational normals are required besides aggregate mass. Untrimmed carrier poles are not material bounds; finite witnesses are not general full-domain or periodic proofs. Optional absent pcurves stay NOT_EXERCISED.

Native relative volume1e-9, absolute centroid/bounds/carrier coordinates1e-9mm and density1 mass1e-9g remain. Existing source constraint budgets stay separate. No tolerance widening, healing, mesh fallback or unapproved fitter/geometry expansion is allowed.

## Admission before the actual category flow

High first authors the smallest staged NON_UI admission tool. Root runs it serially under gate.sh, capturing every original Doc/native graph before assertions: flange, separate shaft, Union and observed cap, Hole and observed outer rim, finish A and captured signatures, edited B, invalid Distance0. The first unknown is exact coaxial Union identity and subsequent Hole+Fillet admission; source implementation or an old circular-finish test is not this composition's PASS. Only admitted stages proceed to a new independent physical oracle and root's own public creation/edit/history/project test. Ordinary driver work uses Sol Medium; geometry/oracle work uses Sol High.

PASS: bounded source/retained-input/UI audit, all seven controlled native admission rows, six independent positive-state checks and twelve actual Studio bindings. No product edit or dependency change is selected. Heavy jobs are serial; every writer freezes through actual execution and owned cleanup. Raw PNGs/logs/native graphs remain outside Git. B01 v1 accepted12/12, B02 v1 accepted11/11 and D540's selected support supplement8/8 retain their own limits. B03–B10 remain NOT_ADJUDICATED; whole CAD/core NOT_MEASURED, no aggregate percentage. D501 custody FAIL, positive tapped without eligible data and every existing HOLD/download/paid-live gate remain.

## First controlled admission

Root command `node /tmp/barocss-d541-preflight01/bundle.mjs`, under `gate.sh acquire heavy 60 D541-controlled-flanged-shaft-admission01`, passes all seven rows on the first attempt. All474 source pins stay unchanged. The executed admission module SHA-256 is `782fe2169e9d1c06d86df7cfaef70ce7dcecb9fd149e2a58797df8c78505e3b7`. Original Docs and native graphs precede assertions and remain external.

Actual native Union cap name is `n3.top`. Original complete outer rim aliases are `n3.side0#1|n3.top` and `n3.side0#2|n3.top`, observed producer names rather than invented ordinals. Existing helper signatures are kind curve, p[10,0,30], s0, n2; these are historical identity anchors, not physical curvature/length measurements. Both names/anchors survive B H40 admission. Distance0 yields native `PARAMETER`, feature `n3`, message `n3: height must not be zero`; At this admission stage, actual UI retention was pending; it is qualified below.

The final original graph has11 faces/14 loops/22 edges/14 vertices, genus1. Product face classification calls both Fillet patches `other`; the independent oracle must establish their source-defined torus equation and normals from original rational coefficients, without inventing a product torus classification. The padded top plane carrier origin extends by approximately1e-6mm; it is not the material boundary. Original trim checks retain1e-9mm. All44 final coedge pcurve fields are null: actual non-null pcurve count0, so final UV lifting is NOT_EXERCISED. Per-stage pcurve presence must be read separately; key presence alone is not a pcurve. This admission alone does not qualify independent physical or public Studio behavior.

## Independent physical and actual Studio qualification

Sol High authored native admission and the independent oracle; a separate Sol High agent reviewed source math and saved evidence. Sol Medium authored the public-flow driver. Root ran all qualifications and viewed six original PNGs: two live bodies, finish A, refusal, FIRST Undo A, Open B and post-Open height25. No product source, dependency, public API, tolerance or geometry admission changed.

Root `node /tmp/barocss-d541-oracle01/run.mjs` under `gate.sh acquire heavy 60 D541-independent-preserved-native-oracle01` consumes the six preserved positive native packets: all PASS on the first attempt, without replaying native evaluation. Original directed graph ownership, nominal complete circle intervals, planar trimmed areas, cylindrical axial extents and rational point/normal equations pass. The raw Fillet patches retain product OTHER classification; their original rational coefficients independently match the source-defined outer-quarter torus. Original vertices lie near Y0 at half-circle seams, so they are not falsely treated as full material bounds: original rational curve extrema witnesses, complete nominal circles and source-defined carrier limits supply the bounded extrema evidence. This is a finite profile qualification, not a full-domain trim or general periodic theorem.

Root actual command from Studio: `D541_SOURCE_FROZEN=1 node test/flanged-shaft-baseline-browser.mjs /tmp/barocss-d541-studio01`, under `gate.sh acquire heavy 60 D541-actual-flanged-shaft-Studio01`, using Node22.19.0 and existing Playwright/Chrome. All12 fresh actual Doc/current Worker/independent Python bindings PASS on the first attempt: seven positive native captures and five exact whole-Doc native reuses,31 snapshots. Native reuse keeps original packet metadata and requires exact raw Doc/source ownership; it is not a replacement for fresh consumer checks. Post-Open height25 is a third raw final Doc class because its shaft receipt remains absent, so it gets a new native observation despite restored A geometry. There are two final physical height classes, not three different shapes.

Across controlled and actual evidence, maximum relative native-volume error5.8057370796094934e-15, density1 mass error9.928715318468622e-14g and centroid error2.632603823837262e-14mm. Maximum endpoint gap5.709847617720292e-15mm, carrier gap3.2307490016592055e-13mm, rational-observation gap2.597568272670903e-14mm and dimensionless outward-normal component error2.290390099801698e-13. Prefix pcurves are genuinely present: flange12, shaftNew12+12, Union24, Hole36, with finite lift maximum7.944109290391274e-15mm. Final A/B/post-A have0 non-null pcurves and null lift gap: NOT_EXERCISED. All original1e-9 budgets remain. Density1 controls do not certify visible Aluminium6061 mass or inertia.

Distance0's actual UI source reason matches `height must not be zero`, while the separately recorded native classification is PARAMETER/n3. No actual Worker error code/feature is inferred. Accepted B source/body/history remain exact; closing the failed editor precedes FIRST Undo original A and Redo B. Original A/Undo A retain both Cylinder receipts. B/Redo/Open/post-A retain only the flange receipt, as existing `dropStaleMade` requires. The original R1 aliases and historical helper anchors stay unchanged across all states.

Own project B Save is1881bytes, SHA-256 `040377833c4cc200d4d52eddb927ab37297ac95e0eaa020c1a484cfd0b5cfd87`. Close/same-context reload/Open restores exact clean B. Post-Open height25 is dirty and not resaved. The UUID namespace is absent before creation and removed/verified absent afterward. All760 recorded actual source pins remain equal through cleanup, with0 watched source changes,0 page errors,0 console errors and0 downloads. Owned context/browser/server close. Initial two-body framing is cropped; later finish/Open views are reviewed. No general viewport-fit or cold-process recovery is claimed.

## Execution-source inventory and result classes

The actual executed driver SHA-256 is `47f0026f09f821ded4d49dcb908e8db9b77f4fd281e282e9f7191eb66bf07c81`; its exact bytes are preserved externally. Oracle module SHA-256 is `b84a4e1afec6d39a4d92752d2c6d90762809d268267cd4863880413d64e473a6`. The760 actual capsule entries omit four imported MJS recipe/utility helpers. Their generated Python/inspector bytes are independently hash-joined to the executed `.py`/`inspector.ts` and recorded effective-source hashes; the helper files match their committed/control hashes. Root then adds those four helper paths to the future driver freeze inventory only. The actual receipt is not rewritten or promoted to a new run. This one-line manifest change does not alter the UI actions, observer or oracle; no passing Studio flow is repeated merely to add bookkeeping. Final Model tsc runs again after that last helper edit.

- PASS: first controlled native7 rows/474 unchanged pins; preserved-native independent Python6 states; first actual Studio12 bindings/31 snapshots; independent source/saved audits; root six original PNG views; three helper syntax checks; final `pnpm --filter @barocss/cad-model type-check` in `final-model-types02.log`; changed-file JSON/links/diff checks.
- FAIL: no new native/oracle/actual runtime failure. A static source-inventory gap is corrected as described, with executed bytes and the original760-entry capsule preserved. D501 historical custody FAIL remains untouched.
- REUSED: D539 Studio types and10 selection controls; D537 focused Model/Studio controls68, docs185 and React types. No product source changed, so these are prior eligible checks, not fresh D541 runs.
- NOT_RUN: actual replay with the added manifest entries (effective executable strings are byte-identical and independently joined), full kernel (no B-rep-core change), other shaft/flange/finish families, whole B03, absent final UV branch, full-domain geometry, cold process, final resave, catalog mass/inertia, mobile, exchange, develop integration or release.

Actual receipt SHA-256 `c039b8919fa848c2fe86065b3c910bdebd31603436e298b50dabc189983e22cb`; independent controlled receipt `1395f86180d02bd942daafb37c178444bcd028637e58642a8fa1d97ce59ad109`. Raw logs, PNGs, native graphs and executed module copies remain outside Git. [Qualification](qualification.json) retains small counts, commands, hashes and limits.

B03-SHAFT's selected profile passes11/11; B03 remains NOT_ADJUDICATED until its remaining partial Revolve/Hole/finish/tapped candidates are adjudicated. B01 v1 accepted12/12, B02 v1 accepted11/11 and D540's support supplement8/8 retain their own scopes. Whole CAD/core remains NOT_MEASURED; no aggregate percentage follows. Related #534/#551 stay open for their broader acceptance, with no completion comment/closure. Next D542 / P1 B03 audits exact retained partial Revolve and blind/counterbore/countersink proof eligibility, then runs only the first missing/affected consumer scope. Preserve D501 custody FAIL and positive tapped NOT_RUN without eligible person-loaded data. All existing HOLDs and download/paid-live rules remain.
