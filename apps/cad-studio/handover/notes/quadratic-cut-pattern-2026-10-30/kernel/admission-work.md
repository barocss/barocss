# D346 admission reserve audit (source-only)

The public query reserves 8192 checked steps before descriptor snapshot, native validation, legacy dispatch and Number-only legacy placement. This reserve is part of the same 200000-step owner subsequently used by every certified operation and final conversion. It is charged before these bounded operations execute, not after a separate context runs.

Input caps are 64 poles, 70 knots and 64 weights, with four permitted record fields, ordinary Array lengths, three coordinates per pole and no permitted extra array fields. Unknown properties refuse on the first unknown key; sparse/accessor elements refuse before their values are read. Reflect.ownKeys allocation itself is not an adversarial-JavaScript CPU/memory certificate (neither are Proxy traps); the work contract concerns the bounded geometry query on owned data.

Conservative admission/legacy upper bounds in scalar/descriptor units:

| Step | Bound |
|---|---:|
| Record/array headers, known-key decisions and descriptor reads | 1024 |
| Numeric finite checks and snapshot coordinate copies | 768 |
| Native validateCurve, degree/domain/multiplicity/weight/coordinate checks | 1024 |
| At most31 quadratic straight spans x3 exact midpoint tests; each <=16 dyadic decode/shift/add/compare steps | 1488 |
| Legacy segment norms/sums at most63 x12 scalar operations | 756 |
| Legacy ordered segment advance at most63 plus63placements x3axes x12 arithmetic/decision operations | 2331 |
| Spacing/count/dispatch/result overhead | 512 |
| Total | 7903 |

The midpoint integers are bounded by finite binary64 inputs and coordinate range, at most approximately2200 bits after common exponent alignment, below8192. Legacy valid input arithmetic is unchanged; only the new diagnostic query pays this admission reserve. Curved Core dispatch pays the reserve before snapshot, and passes its owner to the same planner. Public new curve getters are refused, not invoked. Legacy Core non-three-pole malformed input retains its previous contract and is not newly advertised as the strict shared-query descriptor boundary.

This table is a deliberately conservative static reserve, not timing evidence. Postimplementation source review is pending.
