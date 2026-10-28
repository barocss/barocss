# D300 fixed context initializer/factory: final independent static review

Scope: read-only comparison of the frozen repository D299 chart source against the D300 `/tmp` core replacement, plus the corrected Root component pair branch. No repository source edit, build, test, probe, commit or subagent was made for this review. Test/counter equivalence is a static expectation until Root runs it.

Snapshots:
- Repository `packages/barocss-cad/src/features/cylindrical-wrap-chart.ts`: SHA-256 1f6d2abeb8a0948f44875a074b751da61fbdf43dde502671e5c0af6f6324e124
- `/tmp/barocss-wrap-component-core-draft/cylindrical-wrap-chart.ts`: SHA-256 1f6d2abeb8a0948f44875a074b751da61fbdf43dde502671e5c0af6f6324e124
- `/tmp/barocss-wrap-component-root-draft/cylindrical-wrap-chart-component.ts`: SHA-256 5fd35c7a1db11488faf5d3a093be5d39b5874ccf9b14eaa8c08c10cb93a71836

## Result

No concrete defect was found in the reviewed initializer/factory or corrected receipt branch. The fixed profile split does not widen the ordinary pair constructor, create an upgrade path for released pair contexts, or change the existing numerical algorithm/order. This conclusion covers these drafts only; it is not runtime or product qualification.

## Fixed2 versus fixed32

`CHART_LIMITS` remains the same exported frozen pair profile with curves2. `LOOP_CHART_LIMITS` is an unexported frozen copy whose only changed field is curves32. Both profiles retain operations200000, integerBits8192, work1048576, nodes256 and depth8.

The ordinary constructor can only call the module-private initializer with `CHART_LIMITS`. The named factory always creates a fresh object from `ChartContext.prototype` and can only call that initializer with `LOOP_CHART_LIMITS`. There is no caller profile token, arbitrary limit record, maxCurves option, ambient mode or upgrade method. Extra constructor arguments are ignored rather than becoming profile data, and unknown option keys are rejected by the shared own-data snapshot/validation.

Calling the factory with a pair context as `this` still creates a fresh loop object; the implementation does not read or alter `this`. `Object.create` alone does not brand a context. The initializer is module-private, so a caller cannot initialize a copied object with a different profile through the supported API.

## Complete initialization, state and ownership

The Object.create path does not rely on class field initializers. `initializeContext` explicitly allocates a new SectionRationalContext, copies/validates options, defines own q/maxOperations/maxDepth/limits properties, installs fresh WeakMap state (including its fixed profile and fresh curves/nodes/splits/boxes), then freezes the context.

Object.defineProperties defaults make those own fields nonwritable and nonconfigurable; the selected limit record is frozen too. A fabricated object inheriting ChartContext.prototype, a shallow copy or another context's curve/node cannot acquire the private WeakMap state/membership brands. `stateOf` remains the identity gate. prepareChartCurve reads `ctx.limits.curves`, which is safe here because the genuine context's own limits field and selected profile cannot be changed; there is no caller limits getter or mutable profile behind that access.

Each new context gets its own q ledger and mutable private counters/caches. The public q reference is immutable; its rational counters retain the existing internal mutability needed for accounting. This is the prior trusted runtime API boundary, not a promise against arbitrary mutation of library prototypes or internal q methods by hostile executable caller code.

## Existing numerical operation order and hard caps

The source diff changes profile initialization, the curve-cap lookup and the work-limit lookup. commonControls, exact derivative numerator/progress, ratio comparisons/hulls, half-split arithmetic, integer helpers, node creation and cache algorithms are unchanged.

The old class field allocated q before constructor option copying. The new initializer still allocates q before that same option copying. Neither initialization path performs q/direct proof operations. Property definition and the extra private profile field do not increment the specified numerical ledger. For the ordinary pair profile, allowed input geometry therefore traverses the same proof arithmetic in the same order. The two-curve refusal text is retained. Actual counter equality still needs Root's differential/regression execution; no test was run by this reviewer.

The shared check still compares q.operations+directOperations against the caller-tightened maxOperations. The work check now reads state.limits.work, but both immutable profiles supply the exact previous1048576 value. Integer guards still use8192 bits, node guards still use256 global nodes, and maxDepth remains restricted to0..8. The family profile increases only the count of freshly admitted source curves. It does not increase an operation/bit/node/depth budget per source, pair or winding query.

The pre-existing bounded q-checkpoint timing qualification from the D299 review is unchanged: aggregate checks occur at defined checkpoints/direct operations, not through a hook on every q primitive. There is no new context reset or successful receipt undercount from this factory refactor.

## Corrected component receipt ordering

The corrected `pairProof` still dispatches closing adjacency using predecessor/successor incidence. Its returned outer names now come from `certificate.curves[0]` and `[1]`. Therefore the enclosing first/second names agree with the cone's curve order, endpoint indices and first/second functional signs even when the closing pair reverses unordered iteration order. This resolves the receipt-order ambiguity identified in the earlier design note without changing the certified unordered pair or its geometric predicate.

## Remaining verification boundary

The draft test additions include fresh-profile identity, fixed2/fixed32 and33 refusal, frozen own fields, forged/cross-context graphs, equal prefix receipts/counters, common hard caps and profile-knob/getter refusal. They were read as definitions and were not executed here. Root must validate the integrated source and winding/component paths before reporting PASS. Source/carrier/B-rep/physical solid/mass/global evaluator qualification remains outside this factory and receipt review.
