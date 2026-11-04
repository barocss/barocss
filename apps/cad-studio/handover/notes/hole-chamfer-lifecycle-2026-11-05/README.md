---
work_id: D533
artifact_type: composed-hole-chamfer-workflow
status: qualified-bounded-with-retained-harness-failure
last_updated: 2026-11-05
---

# D533 — Composed ordinary Hole and Chamfer lifecycle

P1, rows07/08/12/16. Parent `84cc6ed07040addad34893546277f3cf474effab`. [Core workflow acceptance](../../roadmap-tracks/02-core-workflows.md) · [Qualification](qualification.json).

## Frozen profile before execution

D449's Chamfer branch and D508's project closeout qualify an isolated Chamfer. D448's bracket is separately qualified; neither is a new composed Hole+Chamfer result. This item selects the missing finishing/Hole dependency lifecycle rather than rebuilding an implemented feature.

Exact input: /tmp/barocss-d449-category-run01/chamfer-edited.bcad,607bytes, SHA-256 bff9ee71ea46e2432a186016c8e74d639c15b08803fe388f6a9dd5980059b7bb. It has n0 constrained rectangle[-20,-20]..[60,20] and e1..e4 side tags, n1 height10, n2 Chamfer3 of n1.side[e1]|n1.top with its original line signature, outputb2 and nextId3. Its bytes are retained actual authoring input, not a synthesized passing replacement.

Proposed states fixed by Sol High before current native execution:

| State | Chamfer distance / Hole radius mm | New action |
| --- | --- | --- |
| A | 3 / 2 | Real top-face pick, Through Hole Diameter4, world CentreX20/Y0 |
| B | 2 / 2 | Public upstream Chamfer3→2 Apply |
| A then B | 3 / 2 then2 / 2 | FIRST Undo and Redo; exact whole-Doc retention |
| B | 2 / 2 | New back-top Chamfer1000 preview refused, disabled Apply, Cancel |
| B | 2 / 2 | Own project Save/Close/same-context reload/fresh Open |
| C | 2 / 3 | Post-Open public Hole Diameter4→6 Apply |

The Hole must append the actual observed n1.top reference with parentn2, center[20,0], radius2 and n3/outputb3; the command's X/Y fields are world coordinates. Do not substitute an invented face if current admission differs. Upstream editing changes only n2.distance and post-Open editing only n3.radius. Retain sketch constraints/sideTags, Chamfer signature, parents and stable IDs.

NodeEditor has no live preview: valid upstream edits evaluate only on Apply. The invalid control is a NEW Chamfer candidate on the actual surviving back-top edge, not a claim about NodeEditor Apply refusal or the consumed b2 idle gizmo. No candidate is accepted. Prior accepted Doc, history and current b3 must remain exact through refusal/Cancel.

## Independent numerical authority

Literal stock minus a straight triangular wedge minus a disjoint Z cylinder. For d=Chamfer distance, r=Hole radius:

V=32000−40d²−10πr² mm³; Cx=20; Cy=40d²(20−d/3)/V; Cz=[160000−40d²(10−d/3)−50πr²]/V. Density1g/cm³ gives V/1000grams; raw native SI and common MMGS must remain distinct. Bounds[-20,-20,0]..[60,20,10]. The hole disc stays at least15mm from the Chamfer strip; cylinder/slant intersection is excluded.

Retain existing D508/D500 limits: relative volume1e-9; absolute centroid/bounds/carrier/endpoint/D1/pcurve lift1e-9mm; normal components1e-9; density1 mass1e-9g. Native strict checks remain unchanged. Native product inspection is an observer, not the independent oracle; independent literal/topological checks import no product. Original whole Doc/native BRep must be captured before selected assertions. Mesh/display geometry is not numerical truth.

## Initial execution status and selected tier

Current composed native admission, refusal and actual Studio lifecycle: NOT_RUN at profile freeze. Root will first run only the declared current native A/B/C admission and refusal preflight under the serial heavy gate. Preserve the first failure; no alternate geometry, relaxed budget or passing replacement is authorized by this plan.

Ordinary driver implementation uses GPT-6.1 Sol Medium; native/physical judgment and oracle source use GPT-6.1 Sol High. Tier SMALL for a bounded verification-only case unless a reproduced product change requires escalation. Root owns actual desktop execution and original screenshot review. All worktree writers freeze during actual Studio, through cleanup. Versioned reusable drivers are source; raw logs/images/archives stay external.

No full P1/B01–B10, general Hole/Chamfer/Boolean or new geometry acceptance follows from this case. Whole CAD/core stays NOT_MEASURED; existing HOLDs, no mobile, download approval and release/develop restrictions remain.

## Current qualified result and preserved first failure

PASS: all three controlled native accepted classes and three independent Python numerical/graph checks. Existing focused finish-limits/hole-types give5 PASS/0 FAIL/SKIP/cancelled. Both new modules pass syntax, diff passes and final Model tsc runs after the last browser-driver edit. No product TypeScript, geometry, tolerance or admission changes.

Root Studio01 qualifies six physical bindings: actual Hole4 creation, upstream Chamfer3→2, FIRST Undo A, Redo B, refused new Chamfer1000/disabled Apply/Cancel B and own exact project Save B. Its seventh binding, reopened B, fails the freshness assertion: the expected Doc is installed but Worker still has the old startup sample b2 while pending. The immediately later failure capture has fresh current b3 and correct B geometry. Sol High confirms this boundary from original saved data; no geometry defect is established. The original FAIL receipt and exact executed driver/module bytes remain preserved. Its source closure757 is unchanged through cleanup; page/console/source errors and downloads are0.

The minimal driver repair waits for exact expected Doc before existing freshness guards. It does not wait for expected numeric values, weaken the oracle or overwrite failed evidence. A bounded continuation mode hard-pins the actual1764-byte saved B file SHA-2565ef280347fcc0f2d923d64b998b9646948bd0b7f3fa310c59851a2f9fbf3c9d9 and checks its whole Doc against B derived from the original seed. Root Studio02 passes current B Open, necessary new owned project Save/Close/reload/Open and geometry-changing post-Open Hole4→6. Its4 physical bindings use2 captures/2 exact reuses;758 source pins remain exact through cleanup. The757 common pins differ only in the intentionally corrected browser driver:756 common input/producer/oracle/helper pins stay identical. No passed creation/history/refusal prefix is repeated or relabelled.

Together these prove the8 selected action groups through10 successful physical bindings, not10 distinct scenarios:4 actual native captures for3 unique A/B/C classes plus6 exact whole-Doc reuses. Two earlier native captures/four reuses and two continuation captures/two reuses retain fresh current Worker joins. The failed original Open binding remains separate. There is no single corrected full-from-scratch runtime PASS.

All accepted native results have1 solid/1 shell/9 faces/11 loops/21 edges/14 vertices and genus1. Maximum observed volume relative error3.113e-15 and centroid error1.422e-14mm stay inside unchanged1e-9 budgets. Native default/strict/output checks, independent original boundary/plane/bore/rim/rational/D1 checks and exact references pass. Original optional pcurves are absent; no lift-presence proof is fabricated. Density1 mass is an explicit native MMGS comparison, not a claim about the visible default Aluminium catalog mass. Inertia and full-domain proofs remain unqualified.

Root views original Studio01 accepted/refused/Save and Studio02 reopened/post-edit PNGs. Both owned OPFS namespaces are removed and verified absent; contexts/browser/servers close. There are0 page/console errors,0 watched changes and0 downloads in both runs. Saved B is reopened; C is the accepted subsequent in-memory edit, not a claimed C resave. Persistence is same-context reload, not cold process restart. All raw logs/images/native snapshots remain external.

NOT_RUN: corrected whole default replay, invalid NodeEditor Apply, general feature/Boolean families or cylinder/slant intersection, whole kernel/Studio build, packed/declaration consumers, fresh external/OCP reader, mobile/CI/paid live/release/develop integration. Broader #536 and #2259/#2260/#2261 remain open; a Hole+Chamfer lifecycle does not meet their whole-family requirements. No held geometry or UI redesign is started. Whole CAD/core stays NOT_MEASURED and B01–B10 NOT_ADJUDICATED.

## Executed commands and reusable entry point

```sh
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
# All heavy jobs serial under gate.sh acquire heavy60/release.
node /tmp/barocss-d533-admission01/run.mjs
node /tmp/barocss-d533-oracle01/run.mjs
TEST_CONCURRENCY=1 node packages/barocss-cad-model/scripts/test.mjs finish-limits hole-types
node --check apps/cad-studio/test/hole-chamfer-lifecycle-browser.mjs
node --check apps/cad-studio/test/hole-chamfer-lifecycle-oracles.mjs
pnpm --filter @barocss/cad-model run type-check
# From apps/cad-studio, freeze all worktree writers through cleanup; choose fresh external outputs.
D533_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/hole-chamfer-lifecycle-browser.mjs /tmp/barocss-d533-studio01
D533_SOURCE_FROZEN=1 D533_CONTINUE_PROJECT_FROM=/tmp/barocss-d533-studio01/11-own-native-opfs-save.bcad PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' CAD_STUDIO_CHAT_PORT=52391 node test/hole-chamfer-lifecycle-browser.mjs /tmp/barocss-d533-studio02
git diff --check
```

The versioned oracle module contains the inspector/Python sources and exact607-byte seed provenance. External preflight launchers retain executed source/inputs/hashes; the browser driver is the reusable end-to-end entry point. Existing output paths above are immutable evidence and must not be reused for new runs. The first command's original native capture remains reusable only with the recorded inspector/producer closure. A new setup does not inherit old runtime PASS.

Sol High's final read-only saved-evidence audit approves the six prefix and four continuation bindings, exact native C bytes, all unchanged producer/oracle pins and preserved original failure. Maximum density1 mass error is9.948e-14g. Root also preserves the exact executed Studio02 driver/module bytes before later work.

Next D534/P1, rows08/12/16: continue D373's existing Linear cut pattern using its versioned accepted Doc SHA-256020a7942b1fb4cc177b13c43bf0561c2002094ea5afc82ca3841cbccd900944c. First freeze Sol High's native/independent integer-prism profile for source Width4→6, Spacing16→12, Count3→4, invalid Spacing0, suppression/restore and project/post-Open edit. The current command requires an active difference result; a Hole node is not eligible. Reuse D373's creation/Count2↔3 proof at its historical scope, and do not count body-pattern/linked-skip proofs as this new feature-cut lifecycle. No geometry widening or lifted HOLD follows.
