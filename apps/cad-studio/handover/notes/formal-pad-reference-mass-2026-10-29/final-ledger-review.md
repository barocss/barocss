# D306 final ledger and selected-quarter delta review

Date: 2026-10-29. Read-only static review of the actual designated worktree's `cylindrical-wrap-formal-mass.ts`, the affected receipt assertions, the carrier producer and its rational context. This is a review of changes since the prior independent mass review. No repository change, build, lint, test, probe, commit or agent launch was made. Root's running verification is separate evidence.

## Conclusion

No material inconsistency was found in the changed source import, totalWork/check/counts path or selected-quarter representation metadata. The accepted-request work check and returned work use the same pure totalWork method. Source exact operations and direct work are not omitted or imported twice by this helper. This does not certify all legacy source-reconstruction Number work or a combined native-binding/mass request.

## Exact ledger correspondence

Use these symbols for the actual source carrier receipt: Qs=`rational.operations`, Gs=`rational.gcdSteps`, Fs=`rational.floatSearchSteps`, Ds=`integerOperations`, Ws=`work`. Let Qm/Gm/Fm be the new formal q context counts, Dm its direct integer counter, and Sm its charged structural work.

The actual source producer is `certifyCylindricalWrapCarrier` in cylindrical-wrap-map.ts:286-297. It returns q.counts and the coefficient context's distinct integerOperations/work counters. `checked` at147-151 increments both integerOperations and context work. The coefficient context's charge at133 also covers other structural polynomial work. Consequently Ws already includes each source direct-integer work charge; adding Ds to imported work again is unnecessary. Rational arithmetic does not increment that carrier work field.

The new import at formal-mass.ts:58-65 therefore correctly records:

    sourceOperations = Qs + Ds
    sourceGcd = Gs
    totalImportedSourceWork = Ws + Qs + Gs + Fs

The helper calls the fresh UV source producer once at322 and imports its authentic carrier counts once. No caller receipt supplies these values. The carrier q snapshot is taken after bounds and proof serialization, so those q conversions/text operations are included. Its later recursive freeze does not change q or direct counters.

The formal integer method at76-79 increments Dm and checks integer size without also charging Sm. The separate `+Dm` in totalWork is therefore correct. Structural traversal/freezing and the fixed public Number-work allowance increment Sm. The resulting formulas are:

    E = Qs + Ds + Qm + Dm
    G = Gs + Gm
    W = Ws + Qs + Gs + Fs + Sm + Qm + Gm + Fm + Dm

At67-74, check rejects E>caller maximum, G>200000 or W>1048576. At338, counts.totalOperations is the identical E, counts.gcdSteps the identical G, and counts.work calls the identical totalWork method. Its q.counts reads are pure (section-rational-internal.ts:114-116). No q/direct/structural mutation occurs between the final check, q snapshot and returned work computation. Final freeze/spread publication adds no unreported q or direct operation. Thus there is no stale-prefix or check/report formula mismatch in these changed fields.

Both source and local q operations already include their own GCD and float-search loop steps: the rational implementation calls work inside both loops. Adding G/F to W is an explicit conservative work-policy overlap, matching the intended normalization style; it is not a second executed GCD or an exact CPU-instruction count. E includes each actual q operation once. Do not interpret the larger W as an elapsed-time result.

The prior draft's `sourceWork + structural + totalOperations` mixed source direct work into work again and omitted these additional G/F policy charges. The current method removes that source-direct duplication and applies the same conservative rational-work definition to source and new formal arithmetic.

Current native assembly's source import also conservatively adds Ds in its helper work in addition to Ws. This formal method intentionally does not make that extra overlap. Therefore its standalone work field must not be claimed literally identical to every native-assembly import formula for a hypothetical nonzero-Ds carrier. A future shared host must choose one explicit work convention and import executed costs once; the present correction is not evidence of native mass integration.

## Size, limit and source-accounting limits

maximumBits combines actual source rational/direct maxima and local rational/direct maxima. The authentic source producer, the local rational context and each local direct integer enforce8192 bits. The combined exact and GCD caps remain200000; maxOperations only tightens the former. No new cap or tolerance was added.

The source adapter still performs its original owned snapshot, comparison reconstruction, strict checkBrep and direct-copy extraction before returning the carrier certificate. Those legacy generic Number routines do not export a complete exact-operation ledger. countData(source) accounts for the returned structural traversal; it does not retroactively meter every instruction of reconstruction or checkBrep. The current source count is the real exported coefficient-helper count, not a new whole-source instruction certificate. A too-small caller cap may still reject after that once-run source helper returns. These are unchanged disclosed boundaries.

The focused receipt assertions at test:143-144 enforce the declared caps but do not independently reconstruct Sm or W. The check/report correspondence above is established by static control-flow/formula inspection. No runtime ledger sample or budget-boundary execution was performed by this reviewer.

## Selected-quarter metadata

The interface/comment at34-35 and result construction at335 now agree on exactly three fields: selectedQuarterRadial, selectedQuarterOuterRadial and includedInMassError=false. The first is the exact D297 radial bound taken from the actual extracted original quarter's carrier receipt; the second is its exact rational double. The helper's tests at139-142 check the field set, exact source-bound equality and the rational factor2 relation.

This is correctly narrower than the former sourceRadial naming. The data covers the extracted original U[0,0.5] quarter, including the requested interior rectangle as a subset. It does not cover both original source half-walls, every source cap or the full nominal cylinder used in formal source moments. The outer value describes the mathematical exact factor2 copy of that quarter; this helper does not construct or validate an installed outer B-rep surface. nativeBinding remains false.

The factor2 statement is sound: an exact pointwise bound |rho-R|<=delta transfers to |2rho-2R|<=2delta. This does not certify a whole-boundary correspondence or a volume/moment error. includedInMassError remains false, and literalStoredBrepMass, wrappedSolid, partMassProvider, nativeSIAccuracy and solidQualified remain false. The rename does not close the source-global, actual closed-reference or physical B-rep proof gaps recorded in the integration-frontier note.

## Verification status

PASS here means static correspondence only: import formulas, final checker/receipt equality, maxima scope and selected-quarter metadata were read and found consistent. Build/lint/focused/full tests, actual operation/work values, budget fit and benchmark results were NOT RUN by this reviewer. No repository file was changed.
