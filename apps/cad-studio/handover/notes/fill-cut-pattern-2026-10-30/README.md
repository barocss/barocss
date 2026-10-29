# D335 finite polygon-mask CUT pattern

Status: **BOUNDED_QUALIFIED_ACROSS_RETAINED_PREFIX_AND_TAIL**. One finite XY reference-point fill profile is qualified across retained browser segments. There is no clean whole-flow PASS. Roadmap08 remains open. The post-assembly documentation result is recorded in `qualification.checks.docs`.

Read [qualification.json](qualification.json) for source SHAs, contracts, checks, first failures and limits. [artifact-manifest.json](artifact-manifest.json) records stored SHA256 hashes and excludes itself. [source-provenance.json](source-provenance.json) records original and compressed hashes. Hashes establish integrity, not geometry correctness.

## Product boundary

The region is an owned snapshot of one simple world-XY straight loop with3..16 finite binary64 points. Exact rational authored reference plus represented grid offsets decides inside-or-boundary admission. This is reference-point masking. A tool may cross the region boundary. Counts describe the candidate grid, including the original CUT, with count×count2<=64 checked before masking. The original CUT stays even if its reference lies outside. Snapshot source edits do not change accepted cuts. Reselect the region to capture new points.

No holes, curved boundaries, arbitrary frames, automatic fill enumeration, full-tool containment or clipping is qualified. No schema, migration, dependency or WASM change is required.

## Actual browser evidence

All four runs use one Chrome WebGPU browser with serial contexts. Public UI performs mutations; read-only hooks observe. All receipts retain zero page errors, console errors and source changes, and closed contexts/browser/server.

| Run | Status | Evidence boundary |
|---|---|---|
| [native-first](root/native-first/receipt.json) | FAIL | Public L creation, preview, product66 refusal, Cancel/repair, ten-cut Apply22500, Undo/Redo, Save/fresh Open, Yspacing12 eight cuts22800 and Undo pass. Driver then selects a free sketch using a missing data-node-index attribute. |
| [native-tail](root/native-tail/receipt.json) | FAIL | Driver expects Sketch6 while History shows Sketch · outline. No new product proof. |
| [native-tail-retake](root/native-tail-retake/receipt.json) | FAIL | Source edit preserves the ten-cut snapshot; explicit reselect gives nine cuts22650. Undo/Redo/Save pass. Fresh Open reveals real source sketch ID loss: n5 becomes n7 and nextId7 becomes8. Geometry remains correct. This is a product failure. |
| [native-identity-retake](root/native-identity-retake/receipt.json) | PASS | Resume original accepted ten-cut file. Source edit preserves n5/nextId7 and the old snapshot. Explicit reselect gives nine cuts with stable filln6/parent. Undo/Redo, Save/fresh Open, semantic document identity and editable fields pass. Creation prefix is not rerun. |

The ordinary edited-sketch fix preserves its existing ID. New sketches still allocate one new ID. [Focused hook/file evidence](sketch-identity-fix/receipt.json) changes from1PASS/1FAIL to2PASS/0FAIL. [Independent bounded source review](review/review.md) finds no remaining actionable issue; reviewer runtime is NOT_RUN.

Independent stock-minus-prism volume and centroid tolerance is1e-7. Ten cuts:22500, centroid[4559/150,607/30,5]. Yspacing12: eight cuts22800, centroid[61/2,765/38,5]. Notch16: nine cuts22650, centroid[9159/302,6127/302,5]. Planning [Fraction oracle](plan/independent-oracle.json) and [plan](plan/plan.md) are PLANNING evidence, not runtime PASS. Native receipts contain the runtime observations. Semantic file identity and raw-byte identity are separate; no raw-byte identity claim is made.

Root viewed [applied ten cuts](root/native-first/05-ten-cuts-applied.png) and [fresh-open nine cuts](root/native-identity-retake/13-final-fresh-open.png).

## Checks and retained failures

Whole Kernel at feature1fc5c496 passes2229/0FAIL/6existingSKIP out of2235, with buildPASS. Later UI identity, driver and API expected metadata changes do not alter Kernel bytes. Focused fill10 plus related18 pass across separate receipts. Initial focused28 has23PASS/5FAIL from a shell-ID test helper; only the affected fixture and fill tests are rerun.

Model final fill8, related15 and Studiochat23 pass across retained receipts; root code-shape8 is overlapping coverage. Initial eligibility/empty-tool fixture failures remain. Studio initial25 has24PASS/1FAIL from missing HV metadata. Corrected fill5 passes; curve7 and Stop13 already passed. Initial NodeEditor docPick/parameters type error remains; final types/build/lint pass. The original P3 empty-vector plane guard finding is source-resolved with dense finite3-component canonical XY validation and strict holes containers. EditScope parameters remain optional for prior direct-only callers.

API six-rule check is SCOPED_PASS:11 added,0 removed,13 raw changed and12 semantic changed rows. FinitePlaneCylinderEquation union order is the one representation-only row. coreResultChecks changes only the feature-kind union. Agent-tools and refusals exit0. No whole API acceptance is implied.

A driver preparation SyntaxError remains in root/driver-syntax-first.txt. It was fixed before browser execution and is not a product error. All first browser failures remain FAIL. The ID-loss comparison is not normalized to hide the defect.

## Source and storage

Checkpoint32 inputs identify feature1fc5c496. First and first-tail before/after capsules match33/33. The failing ID retake retains before33 plus later prior-Git match, without a working-tree after attestation. Final identity-retake before/after35 and Git35/35 match0e76152de. Capsules do not attest the full served graph. No source edits occur during flows.

Lane directories retain logs, source capsules, original receipts, PNGs and native files. api-candidate.json and native-first/seed-generator.mjs are gzip-compressed with original hashes retained. Existing api-previous.json.gz is copied byte-for-byte. No duplicate old/new API fragments are present. The repository ignores *.log; staging must force-add every manifest path so logs are present remotely. Never add .claude.

No actual natural Boolean failure, full stale/Stop matrix, full Model/Studio/GPU/Viewer suites, performance, remote CI, release, commercial or wholeCG2 acceptance is established. Broader08 curve/fill and direct-face/surface gaps remain. The sketch identity repair belongs to existing09/12 but does not complete them. D336 is the next decision.09 follows08. Electron15 remains queued without implementation. There is no new queue.
