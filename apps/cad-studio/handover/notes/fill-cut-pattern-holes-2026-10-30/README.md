# D345 — Bounded polygon-hole Fill CUT masks

Status: **BOUNDED_QUALIFIED** after retained run01 driver failure and run02 actual selection failure. Source `eaa1ec299`, driver correction `b22f7ba2e`, successful-Fill selection correction `283b48afb`. Baseline D344 `89b845615`.

[Qualification](qualification.json), [Korean report](report.ko.md), [independent source review](review/geometry-api-review.md), [final follow-up review](final-review/receipt.md), [actual run03](studio/run-03/receipt.json), [root visual review](root/visual-review.json). Hashes establish artifact provenance, never geometric correctness.

## Delivered contract

Optional readonly numeric `region.holes` extends the existing shared reference-point mask. Each straight simple ring has at least3 vertices; outer plus holes share the old total16 budget. Holes are strictly internal, pairwise disjoint, with no touching/nesting. Existing exact finite arithmetic, outer-boundary inclusion, original unconditional seed, j-major order and original `@i,j` names remain. An additional reference inside or on any hole is excluded. This filters reference points; it does not clip tools or require their complete containment.

Explicit empty region.holes remains invalid. Empty SketchNode.holes becomes omitted snapshot holes, preserving no-hole canonical form. Own data descriptors copy numeric inputs and reject getters without executing them. Model copies straight worldXY holes and resolves parameters; accepted snapshots stay independent until explicit reselection. Curves/frames/multiple outer regions and old unsupported inputs still refuse. No dependency, schema version, migration, tolerance or global budget change.

## Evidence boundaries

Clean Kernel build plus new9 and affected22 PASS; Model new6 plus related87 PASS. Kernel/Model types and scoped lint PASS. Root API/generated agent-tools/refusals checks, Studio types/build/chat23 and driver lint PASS. API delta has0 added/removed exports and3 exposures of one compatible optional holes field; old points unchanged. Source review runs no runtime tests itself.

Actual run03 uses one Chrome/WebGPU process and4 sequential contexts:15 states,8 native reads,6 independent Fraction geometry/mass checks,2 actual native downloads and fresh Opens. Actual UI authors rectangle/rectangle/triangle holes, excludes a17-vertex source in the picker, refuses zero spacing atomically, previews/Cancels/retries/Applies, edits7→9 cuts, edits the same hole-bearing source outer edge without changing accepted7, then explicitly reselects to5 cuts. Original seed stays even outside the new outer. Hole-coordinate numeric UI editing is not claimed. Undo/Redo, IDs/names/cutter corners/closed target, witness420 and editable file state pass.9 initial files expand to976 frozen/after/cleanup files; maps match. Page/console/watch errors0; contexts/browser/server close.

Root separately views6 final screenshots. Numeric results remain independent from rounded UI labels. Seven-cut V22950/C[545/18,6161/306,5]; nine-cut V22650/C[9159/302,6007/302,5]; reselected-five V23250/C[9299/310,1251/62,5], within the original1e-7 checks across public/Model/actual Studio. All expected native cutter corners and cell suffixes are inspected.

## Retained failures and correction

The first root documentation command omitted the Node22 PATH and ran Node18.10.0; generated child checks failed with ERR_INVALID_ARG_TYPE. Retain that launch error separately from product tests and use the required Node22 retake.

Run01: wrapped label accessible names include mm, so exact Corner X locator times out. Use actual unique rendered input IDs and exact value readback; no geometry assertion weakened. Run02: successful Fill consumes target index0 and reorders outputs to witness then result, leaving the witness selected. Root views actual failure image and records selection/body keys. Clear geometry selection only after successful Fill commit, alongside existing Offset policy. Cancel/refusal remain unchanged. Postfix Studio types/build/App+driver lint/chat23 pass before clean run03. Original run receipts and images are retained.

Full Kernel for D345, full Model/Studio, performance measurements and remote CI are NOT_RUN. D344 full Kernel is prior context only. No whole08, generic curved mask, arbitrary frames, full-tool containment, all selection remapping, universal Boolean/mass correctness, PR or release claim. Continue remaining08 before09; Electron15 remains queued.

## Next existing08 scope

[Read-only next proposal](model/next08-proposal.md) selects one genuinely curved polynomial quadratic fixed-orientation Path CUT profile. Current degree2 admission certifies only exact straight middle poles; simply dropping that guard would still place along a chord. High source-only planning must qualify bounded arc length/inversion before any implementation. This proposal is not delivered curved support and does not add another queue.

Final Node22 documentation check passes68 library pages/55shots/861labels. This structural check is not all handover-link or product validation. Publication follows the documentation commit; exact remote-head proof is retained separately to avoid self-referential commit hashes.
