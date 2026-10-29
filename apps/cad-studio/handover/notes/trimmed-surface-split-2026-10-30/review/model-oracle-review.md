# D340 Node-only Model oracle supplement

## Scope and verdict

Source-only supplement after the original seven-production-file review. Reviewed `packages/barocss-cad-model/test/helpers/trimSplitOracle.ts`, its actual public160 consumers in `test/direct-trim-split.test.ts`, and `/tmp/d340-plan/oracle.py`. No runtime, build, test, browser, heavy work, repository edit or production re-review was performed. Only this `/tmp/d340-review` capsule was written.

No required arithmetic or algorithm-independence finding. The helper is a faithful exact-arithmetic slab oracle for the frozen simple-loop fixture and its known world map. It has no product imports, clipping/arrangement calls, child support calls or external Python process. The reference algorithm and the Node implementation are independent of the Kernel half-edge arrangement under test.

## Checks

- `rational` makes the denominator positive and normalizes by a native BigInt Euclidean GCD. A zero numerator safely normalizes to 0/1; zero denominators refuse. Add/subtract/multiply/divide/comparison preserve exact fractions.
- `fromNumber` sets and reads the same default big-endian DataView. It decodes the sign, 11-bit exponent and 52-bit fraction exactly. Normal exponent `e-1023-52` and subnormal exponent -1074 match binary64. Both signed zero values become exact zero, as in Python Fraction. Finite input validation rejects NaN/infinities.
- The split coordinate and perpendicular coordinate are exchanged consistently for U/V. Unique exact sweep levels include domain endpoints, the represented cut and every polygon vertex within the sweep domain. The midpoint of each slab cannot be a vertex level. Edges crossing that midpoint are therefore unambiguous, nonparallel edges; strict crossing comparisons avoid vertex double counts. For the admitted simple polygon their sorted crossing order is fixed throughout a slab.
- Crossing pairs encode the inside intervals. The complement intervals against the perpendicular domain endpoints encode outside material. Zero-width intervals are omitted only when they are not positive at the slab midpoint; a linear interval width on a slab cannot hide a positive interior region while being nonpositive at its midpoint in the admitted simple-loop profile.
- `integral` computes sum(c_i*(hi^(i+1)-lo^(i+1))/(i+1)) exactly. Area coefficients are right-left. Split-coordinate first moment is t*(right-left). Perpendicular first moment is (right^2-left^2)/2. The three coefficients at lines80-84 are the correct expansion of that quadratic.
- Union-find joins adjacent slab nodes only when sides agree and the boundary intervals have a strictly positive exact overlap at the common level. Thus point-only contacts cannot bridge material interiors, and no node connects across the split. A simple polygon boundary on a horizontal sweep level cannot cause a positive overlap across an excluded positive-length boundary: inside material lies on only one local side of that boundary. This supports the frozen simple-loop profile without borrowing Kernel graph decisions.
- Aggregation preserves exact area and both first moments. The centroid axis swap is correct. The fixture world map [20+5u,-11+5v,3] has area Jacobian 25 and gives the implemented affine centroid formulas. This is intentionally fixture-specific and is not a generic geometry/mass API.
- The four actual registered consumer cases cover U/V and inside/outside using the real `trimByCurve`-produced stored160 UV array (lines169-175). They compare Model component counts and world polygon moments with oracle results, and cross-multiply the exact original/selected native area fractions against the sum of oracle component areas (lines204-205). Kernel report data are not fed into the oracle computation. The ordinary Number conversion used for these fixture comparisons is not used for oracle connectivity or arithmetic.

## Nonblocking test note

At lines187-188, expected and actual components are sorted separately by Number area. The two symmetric 45-area components can tie at this conversion precision, or their approximate polygon-area errors can perturb the order. This does not invalidate the oracle; it could create an incorrect centroid-pairing failure. Sent to Model author: if the focused runtime exposes such a mismatch, match using a deterministic geometric key or an explicit component matching rule for this fixture, and retain the exact oracle arithmetic. No failure was observed by this reviewer.

## SHA256

```
4db7bc5bd06939116af797eb59d76614d891fc7bce22f833d623fdde0ae8c018  test/helpers/trimSplitOracle.ts
20183e3cf447ab150465548b43fa7793cd1903d933f13b5aac6dba7cff5792ce  test/direct-trim-split.test.ts
1eefc438074a34d4587a66d7d4fdedfc4ae0c504a4b5db917fcd0abf554e2b69  /tmp/d340-plan/oracle.py
```

Reviewer runtime status: NOT_RUN. The existence of the helper and assertions is source coverage, not evidence that registered tests or product/browser flows passed.
