---
work_id: physics-motion-nogo-2276
artifact_type: frozen-stack-contact-study
status: ready_for_build
owner_role: independent-algorithm-work
source_request: preserve NO_GO and diagnose original eight-box contact constraints
last_updated: 2026-11-01
---

# Original eight-box saved-data contact study

This contract adds one measurement to the parent CONTRACT.md. It does not
change an original physical gate or authorize a solver repair. The study
imports no World, solver, source geometry, or historical Python reference.

## Frozen inputs and bounds

All paths below are relative to
`examples/physics-rigid-full-pair-position-world/`.

| Input | Compressed bytes / SHA256 | Decoded bytes / SHA256 |
| --- | --- | --- |
| `evidence/native-final-a1b9e0a5/manifest.json` | SHA256 `b9f3a446022d8bedf65070f5ea43694fedcc7208b7de408c5067a6ce608cd42d` | Plain JSON, <=64 KiB |
| `evidence/native-final-a1b9e0a5/source-ALIGNED.jsonl.gz` | 54063016 / `daea697b1a04c1e3bb00189e76db69ebadfbedbec9bc5dad4590a42a0bb80959` | 420695755 / `a4e96c868909477d498eb66194b5ff350437b3e484c36c8d64b0b2882f7b526b` |
| `evidence/native-final-a1b9e0a5/source-ALIGNED.f64le.gz` | 1581367 / `8434ef44711481fddedf0583af23f4cf48257dcc9c37824365b080d259dfd15b` | 8986536 / `3749440ec8567ffe4384443d83e58927721eacb1f858c4ec5d1aef4d44cbec49` |

One attempt has a 180-second external deadline and170-second internal alarm.
The program authenticates both
complete compressed inputs and the complete decoded raw stream before contact
arithmetic. It then makes one decoded JSON stream pass, <=961 LF-terminated
records and <=2 MiB per record. After the first diagnostic violation it stops
point arithmetic and parsing, but completes a bytes-only decoded hash/count
check before writing a result. There is no arithmetic on later records.
Output is <=16 MiB; the selected point and two body snapshots are <=2 MiB.
The destination must be new. The process never overwrites a prior result.

The archive order is initial, then ALIGNED steps 1..960. Body order is
b0..b7,floor. One raw frame has nine bodies x104 bytes =936 bytes. Each body
stores position3, velocity3, quaternion4 and angular velocity3 as little-endian
binary64. Initial has one frame. Each step has ten frames in original consumer
order: before; free-ready.free; velocity-ready.free/velocity;
closure-ready.free/velocity/final; attempt.pre/hypothetical; after. Exact raw
bytes are kept. JSON zero signs are not used as raw-bit evidence.

## Contact constraint measurement

Use saved closure-ready free positions and velocity-phase velocities, at the
same fixed pose. The point's `final.normalNs` is the full current-step normal
impulse, including the once-applied warm impulse. Do not subtract `warm`.
Endpoint A receives minus the impulse; B receives plus. Normal points A to B.
The independently evaluated speed is
`vn = n dot ((vB + wB cross (p-xB)) - (vA + wA cross (p-xA)))`.
Report negative impulse, closing speed and `abs(lambda*vn)`. Gates are each
`1e-10` in N s, m/s and J respectively, as frozen by the parent contract.
Use Decimal80 and120 arithmetic from exact binary64 operands. Both
classifications must agree and each measured quantity must differ by <=1e-60
in its stated SI unit. Otherwise report UNRESOLVED and stop. Equality to a
gate passes. No global acceptance follows from a clean residual.

Visit saved point order, steps ascending. Stop at the first resolved point
with any violation. Maximum144 points/step,138240 point checks. Validate
endpoint/index/key identity, point uniqueness, final/warm impulse layout,
unit normal to1e-12 and saved endpoint positions before checking a point.
The fixed initial fixture is eight1kg0.5m cubes, floor half extents[2,.1,2],
gravity[0,-9.81,0],dt1/120,restitution0,friction1/.7; no actions.

## Independent witness at the selected saved pose

Only after selecting a violating point, derive normalized quaternion matrices
directly from saved quaternions. Do not call or copy a source basis function,
SAT selection, clipping polygon, manifold point list, or geometry oracle.
Enumerate the eight OBB corners and project them on the saved normal. Report
the extreme support corners and A-max/B-min signed plane gap. Independently
intersect the line through the selected point in the normal direction with
each OBB's three local slabs. Report the A outward/B inward surface witnesses,
their signed gap, and distance from their midpoint to the selected point.
Also report the point's local coordinates and maximum local slab violation.
Geometry comparison tolerance is fixed at1e-9m. Decimal80/120 geometry
classifications must agree, with numeric differences<=1e-60. Degenerate
normal, quaternion, or unresolved precision stops as execution failure.

These witnesses inspect one selected constraint. A support/line mismatch is
not, by itself, proof of a bad contact patch or the cause of the long-term
failure. Even a valid witness with a normal residual cannot separate finite
iteration error, friction coupling, patch sufficiency or other laws. Keep
`causalLawDefect=UNKNOWN` and `nativeLawFixAuthorized=false` in every result.

## Commands (parent execution only)

```
python3 -B examples/physics-motion-nogo-2276/stack-unit.test.py
python3 -B examples/physics-motion-nogo-2276/stack-study.py --output <new-absolute-result.json>
```

Synthetic tests cover valid zero/nonzero support, separated inactive contact,
each normal residual, a gate boundary, precision disagreement, point/index
layout checks, raw body layout/signed zero, and analytic axis-aligned witnesses.
They import only the new study. They do not open historical archives.
