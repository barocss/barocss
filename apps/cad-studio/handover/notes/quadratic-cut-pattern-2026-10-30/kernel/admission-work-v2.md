# D346 corrected admission and checked classification

The first8192 reserve proof is INVALID and preserved in pre-audit/admission-work.md. It missed core/dyadic.ts's up-to52-iteration normalization loop for each legacy midpoint decode.

The new query does not execute that decoder. Its three-pole dispatch and all legacy quadratic-span midpoint checks use QuadraticCutWork.from/add/scale/cmp under the SAME per-query checked counter. from normalizes with a checked low-bit/bit-length operation, not a trailing-zero loop. Each before-operation budget guard can stop that qualification before it executes. No independent Section context runs.

For a legacy quadratic, query-only legacyQueryPath first verifies ORIGINAL weights1, every original pole's coordinate range, odd pole count, all original C0 double knots, and all exact midpoints. It then passes the SAME span endpoint values/order as an ephemeral degree1 polyline to the unchanged legacy Number function. Its synthetic parameter knots have no influence on the old point/length/offset calculations. That leaf now has no dyadic midpoint work in the query path. Unsupported original knots/weights cannot be erased by this conversion. The authored path and old Core legacy leaf are unchanged.

The same owner reserves16384 steps BEFORE bounded snapshot/native-validation/Number-only work. This is a reservation within the same unchanged200000 query limit, not an increased cap. All exact classification, norm bounds, integration, inversion and final conversion remain separately charged after that reservation. The prior8192 reserve is no longer advertised as sufficient.

Conservative finite non-BigInt admission reserve: at most64 poles,70 knots,64 weights,64 placements. Each Array permits exactly its own length plus canonical in-range indices; the first extra/symbol/accessor/sparse field refuses. Thus accepted data have at most390 index entries and67 Array length headers. A numeric key such as4294967295 is outside length and is refused before its descriptor value is read. Reflect.ownKeys allocation/Proxy trap execution is expressly not an adversarial JavaScript CPU/memory certificate.

The16384 reservation covers two bounded native validators, descriptor/key/finite scans and copying, original degree2 structural/range checks and temporary endpoint construction, and the Number-only legacy leaf (at most63 segment lengths,63 total segment advances,189 output-coordinate calculations). A conservative source-unit ledger is:

| Reservation group | Maximum scalar/descriptor steps |
|---|---:|
| Record/Array headers and canonical-key classification (<=461 own fields, <=8 each) | 3688 |
| Descriptor reads, required own-data tests and numeric copies (<=390 entries, <=8 each) | 3120 |
| Both validateCurve calls, bounded degree/knot/coordinate/weight checks | 4096 |
| Original degree2 structural/range checks and endpoint-list construction, excluding separately charged exact midpoint arithmetic | 1024 |
| Legacy Number norms, cumulative endpoints, ordered segment walk and189 coordinate calculations | 3584 |
| Spacing/count/dispatch and result overhead | 512 |
| Total reservation required | 16024 |

This ledger counts explicit bounded scalar/descriptor operations/calls in the same abstraction as checked arithmetic, not machine instructions inside Math.hypot, regexp, Reflect or the VM. The larger reserve is chosen before execution; it does not charge an after-the-fact report. The fixed64-placement and native64-pole caps are not raised. Actual accepted query totals must be rerun after this correction; previous188636 is historical pre-audit only.
