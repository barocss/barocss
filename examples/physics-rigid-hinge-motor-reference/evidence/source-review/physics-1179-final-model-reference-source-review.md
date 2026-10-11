# #1179 final producer/reference source compatibility review

SOURCE ONLY. Read the current producer nine modules, C reference.py/reference-controls.mjs and B consumer.mjs/raw.mjs/fixtures.mjs against the root contract. No source edit, import, parser/AST, reference, model, solver, World, test, type or build execution. This review makes no numerical GO claim.

## Result

No concrete interface or semantic blocker found in the requested final source scope. The earlier partial-report mismatch is repaired: all five report-stage fields are copied only after diagnostics success, then stage becomes report-ready.

## Specific compatible boundaries

- Producer frames use sourceBodies/angularBodies/motorBodies/freeBodies/projectedBodies. B raw serializer maps these to wire source/angular/motor/free/projected, allocates exactly208B per reached A/B pair, and writes command vectors in original command-array order,24B each. Unreached wire frames are null; no old936B encoder is used.
- C actual_payload requires the same completed-stage thresholds: angular1/motor2/free3/projected4, and all jointReport/bodyCorrections/energyByPhase/work/reportCap only at report-ready5. Producer atomic assignments now meet that rule. No incomplete A/B frame is published.
- Cap is outside producer calculation catch and after its one copied report-ready callback. C expects actual cap request.error plus attempt.error=null. B checks exact original PhysicsError/NUMERIC_LIMIT/joint-specific cap message, reached report-ready/exceedsCap=true and callback count1. Cap cannot become an accepted output.
- Parent, original commands and new options admission occur before observer registration. Unknown ordinary/reflection/observer values are native identity controls and do not enter the known-error JSON wire. Parent typed-PhysicsError proxy effects remain explicitly inherited; B does not claim a stronger guarantee.
- C float helpers mirror original add/sub/scale/dot/cross, inverse-inertia rotations, quaternion multiply grouping, zero-speed copy, original angular update and A/B free-integration leaf order. It keeps scalar transcendental seeds separate from80/120 Decimal algebra. No new normalization/sphere-inertia shortcut or final-only Decimal FREE rounding was found.
- Motor uses incoming remembered report, with original blocked rule. C models this separately from fresh FREE pose/stop eligibility. Producer outgoing report is the exact adopted target; B checks native Object.is target authority and C independently checks the same selected relationship. There is no snap/slop/range-coherence admission.
- Native parsed inertia is reused for FREE-baseline J/K and spin midpoint. C independently reconstructs the original binary `.4*mass*radius**2` and inverse local inertia, then checks frame metadata bits. It does not replace K with a KKT multiplier or nominal ideal inertia.
- Signed midpoint order and A-then-B spin sums match. motorResidual/freeDeltaK/projectionDeltaK stay signed. Both source and comparator require only KE/objective nonnegative; no nonnegative motor-work gate or energy-conservation claim was found.
- C predict reads original config/carrier/source raw and commands, constructs own binary angular/motor/FREE, then invokes the unchanged independent parent pose/rows/Fraction path on that own FREE. Candidate projection/bodies/basis/results are accessed only after low/high predictions and observations are complete. Actual complete parent projection is used for comparison, not expected seeding.
- C preserves one complete parent reply in prediction/comparison/refused mode. Parent precision/resource unresolved remains execution failure. Known earlier parent refusals retain their actual stage/nulls and error; B compares mandatory CAP/RETURN expectation separately and records NO_GO when an earlier refusal did not meet it.
- B fixture table is exactly14: genuine first, rest/signed-zero, upper/lower memory, four directions, A/B+.001 angular impulses, B+.001 torque then+.001 impulse, translated Z1, mandatory+.1 overload. No candidate output, old optimum or old93 replay creates these inputs. Genuine source raw is checked against the authenticated208B parent BEFORE.
- B records actual callback/motor/projection call counts,12 returned expectations versus2 expected caps, and first mismatched case before any next physical call. C protocol controls do not invoke native producer/motor/projection/World. The separate+.9/-.9 helpers do not become hidden staged cases.
- Producer entry remains the three owned functions/types/original PhysicsError/ERRORS. Root's separate harness bridge supplies original helper controls. No World factory or injected physical solver was added.

## Limits

The review compares source and schemas only. Scalar library rounding, actual parent acceptance, exact raw parity, mandatory cap outcomes and first numerical failure remain unmeasured until root's complete source/input/reference freeze, original affected build/types and actual emitted ledger. Correct expected-cap semantics can qualify only staged report/cap behavior; it cannot close #1179 as full World/public/Viewer/release GO.
