# Saved presentation failure diagnosis

Authored before execution, 2026-11-03. Audit only the emitted run03 construction.
No candidate, build, World, full reference, solver or original-case execution.
Do not modify candidate.ts, build.mjs, run.mjs, any old observer or receipt.

The selected saved packet is source/failure-pre-1, FACE ownerb/axis1/index4.
run03 attempted one Source case and returned typed UNRESOLVED at
FLOAT_PRESENTATION_LINE_MISSES_NATIVE_BOX, point FACE:4:2. Strict NodeNext and
the original32 controls were not reached. Do not borrow their earlier results
as amended-run acceptance. The earlier point3 failure and build02 setup drift
remain preserved separately.

Protected SHA256:

- candidate.ts: 15a1931ed4fc5cc91bbae4fde700258a039aa3e081c128bc61030474de38200d
- build.mjs: 224cc40840207e8c5620fc809132a8b952ef58c5531fb7cbbd639e92c10c8557
- run.mjs: 908a1a10cf369e52397f53d252aaeb7c58dde9107b0fb234062a3dc4b5e3e500
- run03 input: 5ff1fa80ef895e7b80d380b9686fb6a84411877072b15c943111a6acd09ad934
- run03 output: d142ab17da92628e9b98a05e2e7f08f71e4b162f009cd9900ca7d9404d91e58a

The standalone presentation-audit.py imports standard Python modules only.
It reads these saved input/output files, authenticates their words and hashes,
and uses Hamilton quaternion multiplication normalized by exact quaternion
norm squared. It imports no SAT, clipping, closest-segment or candidate code.

For every retained exact point, check exact midpoint, native endpoint surfaces
and all12 owning-box halfspaces, parallelism and actual native line exits.
Compare all9 represented endpoint/midpoint coordinates with Python's correctly
rounded float(Fraction), by binary64 words. Because this saved FACE direction
is exactly unit length, compare its3 normal components the same way. Report
the normalization distinction; do not invent a sqrt rounding authority.

For each represented midpoint/normal line, report exact native slab origins,
directions, lower/upper bounds and the active limiting axes. A missing interval
must identify either a zero-direction outside slab or incompatible bounds.
Record exact parameter gap and local slab violations at the conflicting bound.
No inside tolerance, shifted plane or repaired point is used for intersection.

CONFIRMED_PRESENTATION_NO_GO requires the saved typed failure to be reproduced
on FACE:4:2 while its exact certificate and nearest-even coordinate words are
verified. Any input/certificate/rounding discrepancy is a separate inconclusive
diagnosis, never PASS. Other retained points can be inspected without making
new candidate calls. Counts distinguish retained records, exact certificates,
rounding coordinates and valid/missing represented intervals. At most4saved
points/2boxes each and1MiB audit output. The existing180s outer guard applies.

Root runs once after source review:

```sh
python3 -B examples/physics-box-contact-features-2276/presentation-audit.py examples/physics-box-contact-features-2276/evidence/run-03
```

Write a new presentation-audit.json with exclusive create. Existing source,
build and receipts stay byte-identical. A confirmed diagnosis is preserved
NO_GO for this presentation protocol, not physical qualification or a proof
that every possible binary64 line is impossible.

Next fundamental option requires a NEW private contract: keep the native
feature/paired rational endpoints and rational normal line as authoritative
geometry; keep correctly rounded world coordinates for presentation only.
Retain every original32 row and every current strict native/surface/line gate
on the authoritative representation. This changes the representation being
tested, so it cannot retroactively pass the old binary64-midpoint-line
protocol. No production/API adoption follows. If the sole authority must
remain one binary64 midpoint plus unit normal, preserve NO_GO under the current
no-nudge constraints until a separate valid construction/proof is available.
