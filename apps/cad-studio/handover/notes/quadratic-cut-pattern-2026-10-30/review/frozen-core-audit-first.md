# D346 first frozen Core source review

Verdict: CHANGES_REQUIRED for the admission/ownership proof. This is not a finding that the certified curved offsets are numerically wrong. No runtime, tests, build, browser or benchmark was run by this reviewer. The plan-review receipt and provisional audit remain unchanged.

All seven source hashes matched frozen-hashes.json when read. Findings were sent immediately to High and root.

## Required correction 1: admission reserve is not proved by the supplied table

admission-work.md budgets at most16 dyadic decode/shift/add/compare steps per exact midpoint test. But core/dyadic.ts binary64Dyadic normalizes trailing zero bits with a while loop. For input0.5, the mantissa is2^52 and exponent-53, requiring52 iterations for one decode. A valid63-pole straight quadratic can have constant Y=Z=0.5 and31 exact straight spans. Those two coordinates alone cause31*2*3*52 =9672 normalization iterations, already above the whole8192 admission reserve before snapshot/validation/other midpoint/placement work. Each loop also contains several primitive operations.

This is a source counterexample, not an executed runtime case. The public legacy query must not advertise the existing reserve as a proved complete scalar/descriptor-work ceiling. A permitted correction can preserve the old Core numerical leaf while using a bounded charged classifier for the new query, or use a proved before-execution reserve large enough for its actual path. The one-query200000 ceiling must remain honest and must stop before a disallowed operation. The new3-pole curved branch is much smaller, but the public query also promises legacy diagnostic bounds.

## Required correction 2: extra array properties can pass admission

curve-cut-pattern.ts list checks a decimal-string regex for each own key but never proves that the index is less than array.length. An own data property named4294967295 on an Array does not extend its length, and passes the current regex. It is ignored by the later0..length-1 copy. Thus the public query accepts an unknown extra array field, contrary to the stated snapshot contract. Arbitrarily many such decimal keys also invalidate the finite own-key scan count used in the reserve table. Check canonical in-range indices, not only digit syntax. Preserve the existing explicit limitation that Proxy traps/Reflect.ownKeys allocation are not an adversarial-JavaScript CPU or memory certificate.

## Corrections and source proofs that passed inspection

- Negative underflow now retains the binary64 sign bit. Tests explicitly cover nearest/up/down negative tiny values, positive tiny values, ties and normal carry.
- No t=0 shortcut remains for positive targets. Endpoint uncertainty uses the interval refinement/refusal path. Each inverse starts with a fresh[0,1] bracket; previous placement only proposes a guess.
- Math.sqrt only proposes an integer sqrt. Exact adjacent-square inequalities certify every fast return, otherwise the checked integer Newton fallback runs. No estimate decides interval direction, endpoint admission or accepted geometry.
- Exact coefficient construction precedes differences. Simpson remainder exponents, panel-local minima, outward quantization, prefix sums, directed chord/control-polygon bounds, and exact relative Bernstein output evaluation match the approved mathematical contract.
- Exact final rounding L1 is added to the arc/bracket positional bound under the old1e-7 policy. No new epsilon/minimum or geometry rewrite appears.
- The same work object is passed from public-query reservation through the planner and final conversion. Private work/caches are query-local. Numeric step/bit/speed/split/depth guards remain present.
- The legacy calculation body is byte-identical to HEAD after normalizing only its private function rename: SHA25674a4dc4a0df3eba25d40f4896fadf2fa2508f769d378c06daa1c46e08e45ca3a. Core straight calls preserve that leaf. Public diagnostics separately produce directed true segment-norm bounds enlarged to contain the unchanged legacy Number estimate.
- One new API query and its result type are exported from api/index.ts. API failures map through existing VALUE. No schema or package export-path change appears. Input snapshot and returned numeric result do not retain caller arrays. This does not change the existing curveFeaturePatternSpec raw-path alias contract; compilation still replans before tool copy/Boolean.

## Test and evidence boundary

The new registered source has nine tests. It covers three independently certified positive-quadrant fixtures, ordinary names/corners/mass/native round trip, represented translation/nonzero constant Z/nonunit domain, early-tail requests, count one, endpoint uncertainty/refusals, malformed/getter inputs, legacy metadata, conversion and63 added ordinary placements. Source oracle uses no CAD imports and uses exact BigInt fixed-point Simpson bounds rather than product offsets as its authority. The corrected final world radius includes decoded binary64 output error. The analytical Number integral is only a crosscheck.

Signed/reflected/cardinal curved controls are not explicit in these nine tests. Root was informed. Do not equate scalar signed-underflow coverage or old straight controls with executed reflected curved geometry. Existing full-product Studio behavior remains NOT_RUN. The count64 private180444 and public188636 figures are supplied owner/root evidence for one fixture, not a universal request-cost or all-quadratic acceptance proof. Final API/generated/full-suite/model/product/performance gates remain separate.

## Reviewed frozen SHA256 values

- `src/features/curve-cut-pattern.ts`: `f4c435337229921935906f8a55877ba7226fbeac49efc08d779348688643d24a`
- `src/features/quadratic-cut-arithmetic.ts`: `47fe4a5f2c9b9853828b3315e3f0cdb5f20867e70c6db1c5a290c6e038563563`
- `src/features/quadratic-cut-plan.ts`: `de244b7826e9424d7b121b95c56275ea1b760956801841d1d280a81dd7c7ef5b`
- `src/api/curve-feature-pattern-plan.ts`: `9ced2ad6b7f58027ba8e820188623da7c12ace027f9bd47fce123ffa2ddca067`
- `src/api/index.ts`: `46c4e80584ec19603127795e9f28f6cfb5d74d22f815cf27177ddd333b4c5f26`
- `test/quadratic-cut-pattern.test.mjs`: `06be27bc92d7bbf7edb0a946dc98bbf33a3a0e2fd07046e92a94d6fad66699c4`
- `test/helpers/quadratic-cut-oracle.mjs`: `bfc9c3bc8aa02524b11057b8c9c7a3dafca0328d49fbe3b0c9535768c066faf5`
