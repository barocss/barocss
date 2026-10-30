# D309 final independent static review

Date: 2026-10-29. Reviewed the actual `cylindrical-wrap-bound-reference.ts`, the actual `formal-mass.ts` ORDER change, and the bound-reference test source. No repository edit, build, test, probe, benchmark, commit or agent launch was made. This document is frozen after writing.

## Finding

No actionable correctness defect was found in the reviewed implementation. The new function couples two fresh existing proofs for one owned request and one exact stored-UV rectangle. Its result does not claim a closed reference, literal B-rep mass, physical solid or product feature.

The parent reports focused 24/24 after fixing ORDER, standard counts of 193290 operations / 395157 work, central counts of 192736 operations, and an asymmetric formal BUDGET refusal. These are parent-run results, not executions performed by this review. Full-kernel verification was still running when this review was requested.

## Input and rectangle correspondence

`owned` creates bounded plain-own-data copies and deeply freezes each copy before either producer is called (`bound-reference.ts:88-108, 150-158`). Neither child receives the caller's Part, component arrays or budget objects. Getters, hidden/inherited fields and nonfinite data are rejected by the shared own-data boundary. Both child calls receive exactly the same owned Part and id. Child receipts or caller authority flags are not accepted as inputs.

The fresh native child runs before rectangle derivation. Its existing single-four-edge/no-hole, simple rectilinear ring, strict native-domain margins and height==source-radius gates remain authoritative. The wrapper then selects min/max by comparisons only and retains the original stored Numbers. It requires positive extents, exactly two U and two V endpoint values, and one occurrence of each of the four corner combinations (`bound-reference.ts:110-144`). This excludes a bounding box substituted for another four-point polygon.

`rectangleOf` reads the same frozen input components rather than the returned normalized ring (`:160`). This is sound for the current native implementation: `ringSnapshot` copies each point unchanged and can only reverse the order; no coordinate repair, snapping or replacement occurs (`assembly.ts:263-289`). Cyclic starts and reversal therefore produce the same min/max rectangle. Strict positive native U/V margins also exclude signed-zero ambiguity. If future native normalization starts changing coordinate values, this correspondence must be revisited or the rectangle must be derived from the installed ring.

The formal child independently revalidates that same Part and uses the derived native-U/V endpoints with the same owned density and scalar budgets (`bound-reference.ts:161-162`). The factor2/height==R condition remains a fresh native-child condition, not a caller receipt. No radius, source-certificate, separate rectangle or second geometry override is introduced.

## Reservations and complete accounting

The ledger imports the complete `nativeBinding.counts` and complete formal `counts`, rather than the earlier assembly-phase prefix (`:67-80`). Both source admissions stay inside the two imported child totals. Nested component/family/source counters are not added again or deducted for matching inputs.

Both reservations use `maximum - totalOperations()` after checking a strictly positive remainder (`:62-65`). The optional maximum only tightens 200000. The formal remainder is calculated after native import, rectangle guards and rectangle freezing. The two successful child imports require three safe-integer and three nonnegative guards each: twelve comparisons total are prepaid before the first reservation. No additional wrapper direct charge occurs after the formal reservation (`:40-43, 83-85, 154-164`). Thus the reported formal reservation includes all remaining direct-operation allowance.

Final operations are native + formal + outer direct. Final work is complete native work + complete formal work + outer structural/direct work. Maximum integer size is the maximum of child maxima; the wrapper creates no BigInts. Accepted results pass the unchanged 200000-operation, 1048576-work and 8192-bit caps, with a requested tighter operation cap when present (`:49-81`). Final count/reservation/limit/result construction is conservatively prepaid by the fixed 128 work allowance. The dynamic inputs, options and rectangle were already recursively frozen and charged; both children are already frozen, and MEANING is frozen at declaration. No unbounded late traversal is hidden behind that fixed allowance.

Independent child internal checks remain intact. This is an aggregate accepted-result ledger, not one physically shared SectionRationalContext or a new aggregate GCD-counter certificate. A failing child can execute before the parent observes its final work total because the child interface has no remaining-work argument. No partial result is published, and no retry, allowance reset or tolerance change is introduced. Child refusals propagate without namespace/message replacement.

## ORDER fix and deterministic work

The only formal-mass diff is `const ORDER = Object.freeze([... ] as const)` (`formal-mass.ts:49`). ORDER is subsequently read only when attached to the result. Its entries are primitive strings, so the declaration-time shallow freeze is complete for this constant.

`freezeData` charges the array visit on every call, but descends only into an object that is not already frozen (`formal-mass.ts:141-146`). Previously the first successful request traversed the ten ORDER strings and froze the shared array; later requests skipped those ten visits. Freezing at declaration makes every request take the same already-frozen branch. It removes the cold/warm difference of ten structural work units without changing array content/order, mathematical intervals, returned Number arithmetic or exact rational/direct operation sequence. Module initialization of this input-independent constant is not request geometry work.

The first full child comparison remains strict: the wrapper's native and formal results are compared in full with fresh standalone results using the same child reservations (`bound-reference.test.mjs:86-101`). The assertions were not weakened to ignore work. The test also covers owned output freezing, min/max under reversal/rotation, exact-total versus total-minus-one refusal, input immutability and preserved child refusal wording. Those are meaningful source-level checks; their runtime PASS is attributed to the parent above.

## Scope

Top-level meaning flags explicitly keep closedReferenceCertified, physicalBrepCertified, retainedFaceClosureCertified, representedVolumeCertified, partMassProvider and productFeature false, and solidQualified is false (`bound-reference.ts:15-35, 166`). The complete unchanged child results retain the more detailed open source-global, orientation, Math.hypot, stored-mass and native-SI boundaries. Joining the two fresh results does not change those meanings. No further static blocker was found.
