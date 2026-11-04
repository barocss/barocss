# Independent rounded-box reference

Status: authored, execution pending the parent freeze. This file states the
method. It does not report a numerical PASS.

`cases.json` contains the fixed 16 local-space cases in their approved order.
Every scalar is a little-endian IEEE 754 binary64 word. C03 copies the saved
`g2-corner-source-01/input-raw.json` start, `candidateEndM`, half extents and
radius. The other cases use directly authored dyadic IEEE words. There is no
runtime rational-literal conversion or replay of the old sweep. `boxCenter`
on S01 is fixture metadata. The reference operates on local coordinates; it
does not subtract a world-space center or perform a rotation.

`reference.py` imports Python standard-library modules only. It imports no
candidate code. It decodes each finite word as an exact `Fraction`. A
nonempty subset of fixed axes and their signs identifies one feature:

- One fixed axis gives the six offset face patches.
- Two fixed axes give the twelve finite edge cylinders.
- Three fixed axes give the eight vertex spheres.

A face uses its plane equation. Each cylinder and sphere uses the exact
squared distance to its supporting line or point. Free coordinates must be
inside the original finite face or edge. Fixed coordinates must be in the
feature's outward half-spaces. All restrictions and the time domain are
closed. The script never splits a trajectory into active-coordinate intervals.

The initial squared closest-point distance decides initial discrete ownership
before boundary enumeration. A constant feature equation intersects its linear
patch restrictions exactly and retains the first feasible point. This keeps a
contact plateau. A zero discriminant retains the exact tangent root. A later
root is never moved into the legal time domain.

For an irrational root `t=(-B+s*sqrt(D))/(2*A)`, the sign of every affine
restriction `p+q*t` reduces to the sign of `u+v*sqrt(D)`. Sign agreement or an
exact rational square comparison decides this sign. There is no numerical
feature tolerance. Exact rational roots use exact arithmetic. Irrational roots
of proportional rational quadratics with the same branch are identical. Other
irrational roots must have disjoint fixed-precision enclosures to establish
their order. An overlap fails as `UNRESOLVED`.

The two fixed Decimal contexts use precision 80 and 120, exponent bounds
-999999 through 999999, and directed floor/ceiling division. Decimal square
root rounds to nearest. The script takes one adjacent representable value on
each side, converts it to an exact Fraction, and validates both squared
inequalities. It reuses each radical certificate across both quadratic roots.
The 120-digit enclosure must lie inside the 80-digit enclosure. Root and normal
widths must be at most 1e-65 and 1e-105, respectively. There is no precision
retry. The selected closest-point displacement divided by the exact radius
gives the independent normal. The selected feature equation proves that this
displacement has length equal to the radius.

Each case certificate retains the initial predicate, all feature/root outcomes,
the first failed exact restriction index, root-order decisions, selected exact
coefficients, the selected rational root or two directed root enclosures,
required radical square witnesses, and both normal enclosures. The feature
descriptor and immutable raw geometry reconstruct every unselected polynomial.
The feature ledger uses restriction index 0 for `t>=0`, 1 for `t<=1`, followed
by axis order. A free axis contributes upper then lower restrictions. A fixed
axis contributes its outward restriction. Identity roots use that same patch
domain. A no-root feature records its exact polynomial class. A rejected root
needs no approximate square root: its restriction decision is exact.

Build the reference bank once:

```sh
python3 examples/physics-rounded-ccd-2276/reference.py --build-bank \
  --input examples/physics-rounded-ccd-2276/cases.json --output BANK.json
```

Audit raw observed results against the same bank:

```sh
python3 examples/physics-rounded-ccd-2276/reference.py --audit \
  --input OBSERVED.json --bank BANK.json --output REPORT.json
```

For the fixed one-child campaign, use the server interface instead of those
two standalone commands:

```sh
python3 examples/physics-rounded-ccd-2276/reference.py --serve \
  --input examples/physics-rounded-ccd-2276/cases.json --bank FRESH_BANK.json
```

The server builds and persists the bank once. It emits one bounded JSON line
with `status: READY_BANK`. Each stdin line then supplies
`{"case": OBSERVED_CASE}`. The server audits that case immediately and emits
`PASS_CASE` or `FAIL_CASE`. It accepts exactly the fixed 16 source cases,
then the same 16 native cases, in bank order. It exits on the first failure.
EOF succeeds only after all 32 accepted cases. Every request and response is
at most 8192 bytes. The 170-second timer and operation counters cover the
whole child. The bank path must be fresh. Parent receipts own the server's
small response records; the server does not duplicate those records on disk.

`OBSERVED.json` has a `cases` list. Each record supplies `id`, `start`, `end`,
`half`, `radius`, and `hit`. A hit supplies `fraction` and `normalLocal`. All
numeric fields use the same `$f64le` wrapper. An optional `classification`
permits an explicit check of the private classification. With null `hit`, the
auditor checks the public null result against the bank; it does not infer an
observed private initial/MISS distinction. An optional raw
`unbiasedCenterLocal` supplies the candidate's actual unbiased interpolation.
Without it, the auditor uses separate binary64 subtract, multiply and add
operations in `start + (end-start)*fraction` order.

The auditor requires a strict finite fraction in [0,1], error at most 1e-12
against both selected 120-digit time endpoints, unbiased distance at most
`radius+1e-12m`, normal component error at most 1e-12, squared norm error at
most 1e-12, and outward component signs. Exact axial normals must retain exact
axis values, including zero-valued components. Zero signs in computed normals
are not specified. Input sign words remain in the raw input and geometry hash.
Caller, fixture and candidate preservation, stop bias, provider parity and
source/native admission remain the parent harness's responsibility.

The process stops on its first failed point. It caps 16 unique cases, 736
feature candidates, 640 integer square checks, 640 interval square-root
constructions, 1280 Decimal square-root endpoint operations, 2 million counted
Fraction operations, 2 million Decimal operations and 170 seconds. Each
Fraction integer is at most 4096 bits. Each saved case proof is at most 32768
bytes; input and combined output are each at most 1 MiB.

The logical live-DATA checks count retained Python containers, strings,
Fractions and their integer payloads, plus the current encoder string. They
reserve 2 MiB for the active exact/Decimal scratch and overlap. A conservative
static bound for that reserve is 46 current roots with at most four 4096-bit
Fractions and four Decimal endpoints each, 20 two-precision radical records,
26 current feature equations, 46 decision rows, six geometric vectors, and
at most 32 live wide arithmetic operands. This is below 1.5 MiB with Python
object headers and duplicate references included; the remaining 0.5 MiB is
reserved for decode and output overlap. Large retained bank/input/encoder
objects are counted separately before each output and after each case. The
script reports logical owned DATA checks only. It makes no heap or RSS claim.

The fixed bank proves only the approved local sphere/identity-box cases when
execution succeeds. It does not prove rotated-box handling, world response,
multiple fixtures, arbitrary binary64 scales, release readiness or the public
installed package. The parent's combined 1 MiB evidence inventory remains the
authority for all campaign artifacts.
