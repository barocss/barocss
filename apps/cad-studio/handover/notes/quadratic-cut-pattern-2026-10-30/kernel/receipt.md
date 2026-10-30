# D346 Kernel candidate receipt

Status: FOCUSED_KERNEL_PASS; independent implementation review, full Kernel, facade/API inventory, Model/Studio and browser qualification remain separate root-owned gates. No commit or push by this owner.

## Bound source and API

Authoritative worktree: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, `local/cad-dev`, published baseline `024475e5e62457bb66c7b49c6f26138d0c1a3b88`.

`frozen-hashes-v2.json` contains the seven owned final files. The only new public function is `planCurveFeaturePatternPath(raw, spacing, count)` in `@barocss/cad/api`. Its plain result is `{offsets,length:{lower,upper,estimate}}`; internal work telemetry is not returned. Known input/profile/budget refusals are existing `BarocssError` code `VALUE`. Unexpected exceptions are not caught. No feature schema fields change.

The new profile is a single clamped degree2 polynomial span with three noncollinear XY poles, weights1, and constant finite Z. Coordinates and offsets retain the authored10000 bound. Offsets remain relative to the first stored pole, with unchanged tool orientation and `@k` names. The scalar tolerance is the existing `CadNumericPolicy.linearTolerance`1e-7. Rational curves, curved multispans, nonconstant Z, collinear nonmidpoint curves and cusps are outside this profile.

The old straight function body is byte-identical after export/name normalization: `legacy-leaf-proof-v2.json`. The new diagnostic query separately encloses true represented straight-segment norms while preserving the old Number estimate, offsets and endpoint admission. The legacy Core fast path does not pay this diagnostic cost. API input snapshot reads only own data descriptors and copies every coordinate. Proxy traps are not a JavaScript execution-safety contract.

## Numerical authority and bounded work

All quadratic coefficients and relative Bezier coordinates use exact dyadics. Sqrt proposals from `Math.sqrt` are untrusted: exact adjacent-square inequalities certify the integer root; a failed proposal uses integer Newton. No `Math.sqrt` accuracy or `Math.log` assumption is used in geometry admission. Simpson intervals include outward scalar rounding and a proven local fourth-derivative remainder. Prefix refinement is request-aware; total-length precision is not required for early targets. Endpoint overlap is refused if the request cannot be certified within the work limits. Positive targets use an internal inverse bracket, without a special t=0 shortcut.

Each accepted offset satisfies a joint arc-residual plus exact Number-conversion L1 error bound within1e-7. Number conversion is under the same work owner, with ties-even, carry and signed underflow tests. The Number length estimate never admits a curved endpoint.

One query owns the unchanged200000 checked-step and8192-bit ceilings, across all placements, discarded panels and final conversions. It also has16384 speed evaluations,512 integration subdivisions and integration depth16. Inverse iterations have no falsely borrowed depth16 claim; each is charged to the same checked owner. Bounded snapshot/native admission and Number-only legacy work reserve16384 steps before execution, with the corrected static ledger in `admission-work-v2.md`. Exact midpoint classification is separately charged through the same dyadic owner. The query authenticates original quadratic weights/range/odd-count/C0 knots/midpoints before passing the same ordered endpoints as a temporary degree1 path to the unchanged Number leaf. It does not execute the old decoder normalization loop. These are per-query caps, not the total work of a Studio action that may invoke multiple queries.

Actual ordinary right-quadratic spacing0.5/count64: private planner180444 checked steps, maximum observed operand285 bits,609 speed evaluations,106 subdivisions, depth7,289 inverse iterations. The strict public query, including16384 admission reserve and actual checked classification, uses196882 steps. The63-pole legacy query with constant Y/Z0.5 uses28477 steps; both are captured in `public-work-audit.jsonl`. This is one tested ordinary profile, not a guarantee that every admitted raw quadratic or every64-placement request fits the budget. Ill-conditioned profiles can refuse without extending the geometry tolerance or work caps.

## Checks

- Full package build: PASS, `build-audit-first.log`.
- New twelve independent/consumer tests plus nineteen existing straight-curve/numeric tests:31PASS0FAIL, `focused-related-audit-first.log`.
- Package TypeScript: PASS, `types-audit-final.log`.
- Narrow source ESLint: PASS0diagnostics, `lint-audit-final.log`.
- No full Kernel suite, browser, remote/publication or performance acceptance claim from this owner.

Tests include three independently generated certified curve-position balls; actual asymmetric cutter corners, mass, centroid, names and native editable save/open; represented translation/nonunit knots/constant nonzero Z; early placement on a large curve without forcing precise full length; endpoint/conditioning/input refusals; no getter invocation; legacy diagnostic bounds; signed/subnormal conversion; all63 added ordinary query placements under one owner;63-pole constant0.5 coordinates; original rational/C0 unsupported forms; out-of-range decimal property keys without getter invocation; and small signed reflections/XY swap against independent certified balls.

The registered independent helper `test/helpers/quadratic-cut-oracle.mjs` uses fixed80-bit scalar intervals and128 uniform panels for its integer fixtures. Those are oracle-specific choices, not production minimum scales or caps. It includes exact-offset-to-Number rounding in each world residual ball. Its analytic Number formula is a crosscheck, not the rigorous authority. Medium's separate Decimal80 crosscheck and root's15-case old-behavior differential are independent follow-up evidence.

## Preserved first failures and optimization boundary

- `quick-first.log`: count3 succeeded; count64 hit the work cap.
- `quick-second.log`, `counts-first.log`, `counts-second.log`: repeated-candidate/initial-guess variants and budget refusals.
- `focused-first.log`:7PASS2FAIL. One was a test harness seed missing `parameters`; the other exposed public admission reserve pushing count64 over200k. Both corrected without raising a cap or weakening the assertion.
- `lint-first.log`: harness used an incorrect node_modules path; narrow lint reran with the correct package-relative dependency path.

Before efficiency changes, root recorded the source/dist-bound WIP baseline at `/tmp/d346-perf/baseline`, with matching `hashes.json`, `baseline-timings.json` and `baseline-shape.json`. It is a pre-optimization WIP baseline, not published D345. Root owns the frozen benchmark script and candidate timings/shape comparison. The changes remove repeated canonicalization and constant arithmetic, reuse an untrusted warm-start proposal, and certify a fast sqrt proposal before the unchanged integer fallback. This receipt makes no performance improvement claim until root's matched comparison.

Heavy gate was released after the final checks. All source remains frozen for independent review and root qualification. Geometry/native mass/cap/fill modules outside the owned files were not edited (`frozen-unrelated-check.json`).


## Required independent-audit corrections (v2)

The first frozen Core audit found two real source-contract defects. The previous8192 reservation table omitted binary64Dyadic's trailing-zero loop; additionally, digit-only array keys outside Array.length were silently ignored. Historical pre-audit source/dist/receipt/hashes are preserved under `pre-audit/`. The first review is not overwritten.

The query now uses checked exact midpoint authentication, verifies the original quadratic contract, and adapts only the exact endpoints to the unchanged Number leaf. Thus the old uncharged decoder loop is outside the new public query. Non-BigInt bounded admission/Number work is conservatively pre-reserved16384 within200000, and exact classification is individually charged. Extra numeric keys must be canonical and less than length; the accessor regression verifies no invocation. These are correctness changes after the provisional performance result; root must take the final matched candidate benchmark again.

No published API/schema change was required. Final seven source/test hashes are in `frozen-hashes-v2.json`. Independent final source review remains a separate gate when this receipt is written. Heavy gate is released.
