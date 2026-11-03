# Exact revision boundary

Ancestor: `../physics-coupled-dynamic-2276/candidate.ts`, SHA256 a211f1e3e92e9e3eebc56985b1f457d1cef78e054c0f2f201c5c8cfc83c97dac. The new source was copied into this new folder before editing. No ancestor file or saved answer was edited. CANDIDATE.diff is a source-only comparison, not test execution.

Allowed diff regions are:

- Add a readonly Chain type and readonly Point fields.
- Extract positive integer-content normalization from the existing primitive conversion.
- Replace fraction-based negative Euclidean remainder with sign-correct integer pseudo-remainder, normalizing positive content after each elimination. Skip only a redundant second content normalization when the already-primitive result is negated.
- Freeze the complete Sturm chain/coefficient arrays and Point objects; accept readonly arrays in evaluation/derivative functions.
- Replace duplicate one-sided evaluations with one complete paired variation result, a frozen per-call chain-identity-bound memo and pre-growth258-entry cap.
- Replace redundant polynomial endpoint/midpoint evaluations with the root flag from that same complete checked variation result. The isolation/refinement traversal and policy are unchanged.

The file prefix containing the exported API, fixed limits, static-helper invocation and work counters/wrappers is unchanged except for readonly type declarations. The section from `const singleton` through the complete representation/physical/native/branch certificate result is unchanged. All original prices and counter increments remain unchanged. Integer pseudo-division and memo misses use these same wrappers; a cache hit reuses only an already-completed exact result.

## Sign proof

Let rem(R,B) be the rational Euclidean remainder, with nonzero integer leading coefficient b of B. One elimination gives

`rem(abs(b)*R-sign(b)*LC(R)*x^k*B, B)=abs(b)*rem(R,B)`.

Because abs(b)>0, its sign scale is positive even when b<0. If content g>0 is removed after that step, the scale becomes abs(b)/g, still positive. Repeating to degree below B yields a positive rational multiple of the ordinary remainder. Negation therefore has exactly the sign of the next ordinary Sturm member at every real argument. Removing only positive content gives the same primitive signed integer polynomial as clearing positive denominators in the ancestor algorithm. A zero remainder remains zero and triggers the same repeated-root refusal. No assertion depends on all leading coefficients being positive.

## Memo proof

For a nonzero polynomial f at a dyadic x, evaluate successive derivatives until the first nonzero derivative of order m. The Taylor coefficient's factorial is positive, so the right limit has that derivative's sign and the left limit has its sign multiplied by(-1)^m. One such evaluation supplies both exact limits. A complete frozen chain's left/right sign-variation pair at a frozen Point is immutable. Reusing it under the same chain/Point identity yields the same open-interval count as repeating the old work. The root flag is the sign-zero test of the original first member before differentiating. No approximate or sampled sign enters the cache.

There are exactly2 initial memo endpoints and at most one new Point per accepted midpoint operation. The old global256-subdivision cap therefore bounds memo population by258 across all roots and refinements; the implementation checks that bound before insertion. The integer/gcd/rational cost reductions are not measured yet. Root must retain any new first cap or mathematical failure instead of changing limits, precision or inputs.
