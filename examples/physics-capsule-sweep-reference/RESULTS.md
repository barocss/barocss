# Bounded sweep discovery: numerical pass, cost NO-GO

Parent e2965acb5af01383e0f9441f6f7c41f0449358d7; clean measured source `540c9a06cdbf2e7a779b45a2d6a334ac72831212` on codex/physics-character-sweep-830. Only new Physics-owned research files. The original rigid character rest/flat pass and step/slope NO-GO remain unchanged.

## Observed result

All22fixed cases pass numerical/refusal/reference gates. Thirteen hits, seven clear queries and two complete initial-overlap refusals. The query is pure: it does not move a rigid body, step up or apply a slope rejection policy.

- Wall/floor and rotated15°/30° planar TOI and normals match independent Hamilton/piecewise geometry and analytic fixtures.
- Step/three-axis corner points match exactly in these cases. Maximum independent fraction discrepancy3.764e−9; normal discrepancy3.764e−8. Against true analytic tangent, fraction error3.270458e−8 and normal error3.270458e−7 satisfy1e−6gates.
- Maximum witness gap8.022e−15m; independent gap8.050e−15m. Maximum normal-unit error1.111e−16. All reported hits use≤23advancement iterations, below64; source confirms100segmentpasses/iteration.
- Same selected originalF64 outputs and everyID/error/sidecar field repeat exactly. Copied scene/query/state/output, original near-unit q and signed-zero state, accessor0, eighteen actual refusals, cap1diagnostic, all-box overlap and global-minimum tie permutation controls pass.
- Reference-only analytical/ambiguity/refusal controls pass. Its minimum-presence band refuses unresolved data; no invented tangent or depenetration result.

## Canonical cost failure

Node22.22.0, clean540c9a06, executed from/tmp. Helpers stopped all numerical work. Single full campaign warmup, then THREE serial trials of100queries per20acceptedcases; sceneconstruction/reference/hash/output excluded, full snapshot.query admission/geometry/copies included.

CAP32_GRAZE has32identical authoredstepboxes. Trial p95ms:

| Trial | N | Query p95ms | Frozen limit |
|---|---:|---:|---:|
| 1 |100|3.506584|2.0 — FAIL|
| 2 |100|1.102958|2.0 — pass|
| 3 |100|1.070167|2.0 — pass|

Median1.102958ms; min–max1.070167–3.506584ms. Everyothercase/trial≤2ms. All THREE mustpass, so this is **bounded NO-GO** despite numeric correctness. Do not replace the failing trial with later warm values. No measured rootcause is assigned: JIT/allocation or repeatedgeometrywork are hypotheses, not verifiedphase timings. No phase/GPU/FPS claim. Actual Chromium is gatedoffanddidnotrun; its prepared driver is not evidence of a run.

## Raw proof and first failures

Two portableexplicitLEF64files/7048bytes carry originalquery/geometry inputs and numeric outputs; IDs/revision/errors have explicitJSONsidecar fields. The decoder imports no candidate/snapshot/fixture and independently re-evaluates all22inputs/outputs, earliestidentity, geometrymembership, witnesses, fractions/normals and rawSHA. Firstdirty and clean rawhashes agree. No negativezero occurred in these capturedprimarybuffers; the separate signed-zero snapshot control is retained.

The firstdirty22casecampaign passed but used100warmupcampaigns, so its timing is not the frozen canonical receipt. Read-only review found an untested three-hit pairwise tolerance chain: forward/reverse inputs chose different IDs and could include a hit1.6e−9afterthetrueminimum. Exact first failure is saved. The repair finds the globalminimum then qualifies ties within1e−9; permutationcontrol passes. Other repairs align near-unit quaternion evaluation with Hamilton q*v*qInverse without mutating originalq, requireanalytic hitpresence, comparecompleteID/error/sidecars plusrawF64 and useonewarmup. No primaryscene/tolerance/cap/target was retuned. Numericalprimaryrawbytes are unchanged by repairs. See evidence/EXECUTION-NOTES.md for pre-code policy and file-generation failure.

## Stage and next measured question

Only bounded numerical references passed. Full selected-query GO remains unmet because oneNodecosttrial failed and conditionalactualChromiumgate is unrun. #830 staysOPEN. Publicquery#1062/controller#1064/actualViewer#1065 stayPLANNED; no publiclibrary/API or actual3Ddisplay is admitted.

One evidence-grounded next private question: can reusing EXACTLYidenticalcopiedboxgeometry reduce repeatedquerywork while preserving originalfixtures, stableIDs/exclusion, all-boxinitialoverlap, global-minimumties, originalbits and singlewarmup2msgate? This is unfrozen/unimplemented; do not claim it fixes the first-trialcost or arbitrarily discardduplicatefixtures. It needs a new pre-codecontract and same-input independent/reference/runtime proof. No separate publicIssue is needed because existing#830/#1062 coverthegap.

Sole Integration may adopt originalbc38→e296 then additivee296→child once, or a single unadoptedaggregate once. No adoption is claimed. An exactactualmerge retainingnativeproof makescodeavailable underlatest674 while currentIntegrationUI/Save/Open/recovery remains separatelytrackedpending; missingqueryGOstillpreventspublicimplementation. No productpush/PR/pack/deploy/publish/release.
