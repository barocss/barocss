# D303 native D0 family: independent source review

Status: read-only inspection of frozen `/tmp` drafts, 2026-10-29. This note follows `/tmp/barocss-native-d0-family-design-review.md`. No repository edit, build, test, feature probe or subagent was made. Root's serial integration/run is separate; no runtime result is inferred.

Snapshots:
- `/tmp/barocss-native-d0-family-draft/core/native-d0-bound.ts`: SHA-256 b1341750c3b3abf7a370f791cefda3811e0e5d6eacd6e2079e9be8badc91fcc6
- matching test draft: SHA-256 0b64ec035a590dbc77ad4ae04e09992d32d325eddbb50a11b1f8f43d821c8bf2

A static diff against the D302 working-tree source was read before integration (diff baseline blob prefix64e579e05). The standalone numerical code changes only by adding a zero-initialized structural-work field to the shared work check/count; new family paths are separate.

## Result

No material false-acceptance defect was found. The implementation matches the monotone worst-template proof and explicitly validates the original repeated-knot branch family. It does not add pcurve binding, complete B-rep inventory authority or mass qualification.

## Actual source admission and full two-span domain

The entire input record is copied once by `record(input,['curves','surfaces'])` through ownSnapshot. Each source then passes an exact-field check and existing validateCurve/validateSurface without a new per-object snapshot/context. Malformed or unsupported members cannot become a partial success.

`familySpans` preserves D302's old one-span admission for degree<=3 and count=degree+1. The extra branch requires degree2,count5,knots length8 and equal middle entries3/4. Existing native validation already supplies the complete clamped endpoint multiplicity and valid finite knot order. The function explicitly reads a=knots[2], m=knots[3], b=knots[5], checks global endpoints in[-1,1], and uses q to prove both m-a and b-m are exactly.5. Returned domain uses the first span's left and last span's right, so it is[a,b], not the old one-span helper's[a,m].

The surface gate requires V degree1 and two columns, admits the U spans through the same function, and separately checks the V single span. Unsupported degrees, simple/nonrepeated interior knots, unequal half widths and translated global scales refuse. At the exact midpoint the actual native evaluator uses the right span; the explicit template has the same h=.5 fraction operation path on either side. This justifies reusing the global fraction bound rather than claiming a generic multispan result.

All stored poles/weights are collected, including the inactive half-span entries. Existing ranges then enforces[.5,1] weights and native coordinate bounds over the whole family. An outlier in the other branch is not omitted.

## Repeated IDs and complete slot preservation

There is no ID-keyed Map, uniqueness rule, rename or deduplication in the family path. Curves and surfaces retain their actual source record and index in their respective input array. Kind plus array index plus the complete snapshot is the binding identity. Repeated pcurve IDs and different geometry with the same ID each consume one source slot and all their stored poles.

The family bound applies to every provided member. The family helper does not assert that its caller supplied a complete actual B-rep object inventory. A later coedge consumer must bind the intended kind/index and full actual source fields, not search by the repeated ID alone.

## Worst-template bound is applied as designed

`ranges(points,weights,ctx)` forms one actual global minimum/maximum weight and axis-magnitude envelope, then the new path unconditionally replaces its constant tuple by[false,false,false]. It calls the existing fraction recurrence once, degree3 U and degree1 V basis recurrences once, tensorError once and finish with count8 once. It does not run separate200000-operation certificates for each object.

The old positive recurrence is monotone, so E3x1 dominates all admitted single-span curves/surfaces and the original two-span degree2 branches (three active curve terms or six surface terms). The global min/max/A envelope and eight-step accumulation then dominate the per-source errors. Source count and stored-pole count are not confused with active sum count: the native evaluator still reads only degree+1 basis values per axis.

Forcing the general nonconstant-axis formula is conservative. It avoids using an active-only constant predicate when the original five-pole/5x2 cached evaluator tests all original coefficients. A truly restored constant axis has actual error0 and is still covered by the positive general bound. No family mutation reaches old standalone range objects or source data; each call owns a fresh context and local range record.

## Caps and the structural-work clarification

Object count is checked across curves+surfaces, including repeated slots, with fixed maximum64. `familyPole` checks the current collected Point count before each push, allowing exactly512 and refusing the513th. The surface loop visits every row and both columns, so a5x2 source contributes10 rather than its six active terms.

`familyStructure` walks the one owned input tree, charges4 per value plus string lengths through Context.chargeWork, and returns the same accumulated cost. Its private structuralWork is added to the existing arithmetic-work check and returned counts.work. It is deliberately **not** added to q/direct totalOperations. Thus the declared accounting is:

- totalOperations=q.operations+directOperations<=requested maximum<=200000;
- work=q.operations+gcdSteps+floatSearchSteps+directOperations+structuralWork<=1048576;
- q/direct integer guards remain8192 bits.

This implements the clarified contract. The structural charge is a conservative bounded validation/walk work metric, not a count of every JavaScript instruction. The whole ownSnapshot retains its separate existing finite data budget; no claim of instantaneous cancellation before that copy is made. The long-ID fixture is a meaningful structural-work exhaustion case because the strings remain within each own-data string limit but their combined work exceeds the one family ceiling.

One Context covers every exact domain check, the global recurrence and all receipt conversions. Options cannot enlarge caps or inject numeric bounds/template flags. Final finish/check prevents an over-budget successful return; the previously documented small q-checkpoint timing qualification on refused requests is unchanged.

## Standalone D302 preservation

The static source diff leaves existing admission, fraction/basis/tensor/axis/finish arithmetic and their call order unchanged. Context.structuralWork starts at0 and is incremented only by the new familyStructure path. Adding zero to old work checks/returned work preserves their values and existing return-field order. Old constant-axis shortcuts and rejection of five-pole originals are unchanged.

The new test's before/after calls within the candidate module check that a family invocation does not contaminate standalone state/results. That is useful noninterference evidence when executed, but is not by itself a runtime differential against the previously committed D302 module. The static diff supplies the unchanged-order argument here; Root can report baseline/runtime equivalence only to the extent separately checked.

## Native63-slot fixture and test boundaries

`familyFromBrep` includes every edge Curve, every coedge pcurve and every face Surface, preserving all occurrences and repeated IDs. For the existing original cylinder plus one four-edge pad, the known assembly incidence gives18 edges+36 coedge pcurves+9 face surfaces=63 objects. The test loops over every returned slot, compares it with that actual input slot and checks native evaluation against an independent exact piecewise Bernstein oracle. It also retains distinct positive/negative half-wall weight bits and covers cached midpoint/neighbour transitions.

The current assertion is only objects<=64, rather than an explicit63 assertion. Adding exact63 (or the independent18/36/9 breakdown) would better lock the intended near-cap intake fixture; this is a test-strength observation, not a mathematical source defect.

The seven new definitions also cover repeated-ID different geometry, index/no-alias preservation,64/65 objects,512/overflow poles, malformed/unsupported members, structural work exhaustion, tightened operations/error and standalone noninterference. The explicit512 test is correct; a direct513 case would be a small additional off-by-one regression. An active-only constant five-pole case would also directly guard the forced-false rationale, which is already unambiguous in the source.

No test was run by this reviewer. All bounds remain numerical D0 bounds on unchanged provided stored objects. World/UV mixed envelopes may be too wide after future carrier metric propagation; pcurve binding, domain safety of computed UV, topology, source closure, mass, full B-rep and combined construction budgets remain outside this family certificate.
