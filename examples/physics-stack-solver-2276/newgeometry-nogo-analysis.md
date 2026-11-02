---
work_id: physics-stack-solver-2276
artifact_type: saved-evidence-analysis
status: measured-geometry-no-go-preserved
owner_role: independent-fixture-executor
source_request: "Issue #2276: diagnose the first strict contact-witness failures from saved source trajectory data"
last_updated: 2026-11-01
---

# Saved source trajectory geometry NO_GO

The source-world-02 receipts show a strict contact-line intersection failure.
They do not show a 1e-9 m distance-gate failure or an unresolved Decimal
precision comparison. Keep each first failure unchanged. The candidate's
normal KKT checks pass for the four reached solves, but the full independent
trajectory gate fails.

## Evidence and method

Read only the saved `evidence/world-source-02/{ALIGNED,OFFSET,YAW}.jsonl.gz`,
their scene result JSON, and existing geometry source. No helper was imported
or executed. No candidate, test, World, model, or archived campaign was rerun.
One local Decimal scalar calculation expanded the saved first ALIGNED bad
row's line intervals for diagnosis; it did not create a new reference verdict.
The saved reference verdicts remain the evidence for acceptance or rejection.

The compressed JSON archives read for this analysis are:

| Scene | Bytes | SHA256 |
|---|---:|---|
| ALIGNED | 96725 | `5b736f932da555d4f481770fa16d7b04bd3cfb6b98a57fc9ec60f36c84244dd9` |
| OFFSET | 23251 | `8668779657e073257dfd52c1289ab1b6babca773e7014df4c4b2371d6cf4647a` |
| YAW | 34794 | `a47d33315f99ad1569bf20c503cd8a0fd169c7c9e8c5e66c42333cf9b97ae8e2` |

## Observed boundaries

| Scene and step | World accepted steps at stop | Independently accepted steps | Bad contact rows | QR factorizations in that solve |
|---|---:|---:|---:|---:|
| ALIGNED step 1 | 1 | 1 | 0/32 | 1 |
| ALIGNED step 2 | 2 | 1 | 31/32 | 1 |
| OFFSET step 1 | 1 | 0 | 14/32 | 7 |
| YAW step 1 | 1 | 0 | 32/32 | 5 |

For every bad row, the only failed checks are `lineIntersectsBoth` and
`lineMidpointWithinTolerance`. Both `pointInsideTolerance` checks and the
signed support-plane distance check pass. Every row is precision-resolved.
In ALIGNED step 2, only row 7 passes the complete contact witness.

| Scene and step | Maximum local slab violation, m | Maximum signed support gap, m | Maximum precision difference |
|---|---:|---:|---:|
| ALIGNED step 1 | 2.7755575615628914e-17 | 2.7755575615628914e-17 | 0 |
| ALIGNED step 2 | 5.585281973284903e-17 | 5.538821354866525e-17 | 1.661234461561535e-62 |
| OFFSET step 1 | 2.7755575615628914e-17 | 2.7755575615628914e-17 | 0 |
| YAW step 1 | 1.3579765629312977e-16 | 2.7755575615628914e-17 | 1.1064081234719459e-80 |

These slab/gap distances are below 1e-9 m. Precision differences are below
1e-60, with matching classifications at Decimal 80 and 120 digits. Greater
reference precision therefore confirms the saved strict predicate result;
it does not turn these rows into a precision-unresolved result.

## Why the strict predicate can fail while distance gates pass

The unchanged `physics-motion-nogo-2276/stack-study.py:213-239` computes the
point and normal in each body's local frame. For local point l, half extent h,
and local line direction d, it checks line/slab intersection as follows:

- If d[i] is exactly zero and abs(l[i]) > h[i], the line does not intersect.
- Otherwise intersect the exact slab parameter intervals, then require
  `low <= high`.

Neither test adds the 1e-9 m point-inclusion tolerance to the slab interval.
The separate `pointInsideTolerance` predicate uses
`max(abs(l[i])-h[i],0) <= 1e-9`. A rounded contact point can pass this distance
test and still lie outside a strict side slab whose line has no inward
component. These are distinct requirements in the frozen wrapper.

In `stack-study.py:251-258`, failure to intersect either endpoint makes the
line midpoint value null and `lineMidpointWithinTolerance` false. Thus the
second reported violation does not mean that a computed midpoint exceeds
1e-9 m. No common line midpoint exists under the strict intersection test.
The wrapper preserves these two failed booleans as required by the original
`stack-equilibrium.py:209-214` criteria.

## First bad OFFSET row

Row 0 is `face:b0:1:1:b1:1:-1:0`, directed b0 to b1. The saved point is
`(-0.2,0.49931875000000003,-0.25)` m. Both bodies have identity orientation,
and the normal is exactly `(0,1,0)`. For endpoint B=b1, the recorded local X is
`-0.25000000000000001387778780781445675529539585113525390625` m.
The excess beyond the negative X face is
`1.387778780781445675529539585113525390625e-17` m. The local line's X component
is exactly zero. The strict zero-direction slab branch therefore rejects it.
The same point remains inside the separate 1e-9 m inclusion tolerance.

This is a resolved boundary mismatch between the stored binary64 point and
the exact-decoded OBB side slab. It does not establish a macroscopic gap,
an impulse error, or an incorrect normal-only optimizer result.

## First bad YAW row

Row 0 has the same original point ID and directed endpoints. Its saved point
is `(-0.21218235741641117,0.49931875000000003,0.23719277278107198)` m.
The normal is exactly vertical. Both rotations are around Y only, so the
local X and Z line-direction components are exactly zero.

For B=b1, the recorded local X is about `-0.2500000000000000299173` m and
local Z is about `0.25000000000000000343562` m. The corresponding excesses
are `2.9917334736694303e-17` m and `3.4356171790658372e-18` m. These are
positive strict side-slab violations, although well below 1e-9 m. The saved
line intersection is false at both reference precisions. All 32 YAW rows
have at least one endpoint with a failed strict intersection.

## First bad ALIGNED step-2 row

Row 0 is again the b0/b1 row. Unlike step 1, the free poses contain small
nonzero quaternion X/Z components. For B=b1 they are approximately
`(-2.958220592982507e-19,0,1.4163957869901231e-19,1)`.
The saved normal is about `(-5.665583147960493e-19,1,-8.001156915687971e-19)`.
The saved B-local X and Z excesses are about `7.081978934950616e-20` m and
`1.4791102964912534e-19` m.

Here the direction is almost vertical rather than exactly vertical. Expanding
`R_B^T*n` from the saved operands gives local direction approximately
`(-2.8327915739802463e-19,1,-2.084715729722957e-19)`. The X slab requires
t <= -0.25 m; the Z slab requires t <= -0.7095021519734089 m. The Y slab
requires t >= -2.187308189986315e-19 m. Their intervals do not overlap.
The large negative line-parameter bound is caused by division of a tiny side
excess by a tiny transverse direction; it is not a 0.7 m physical penetration.
The saved independent B witness is `lineIntersects:false`.

The trace connects the first-frame residual spin to tiny next-frame
orientations and near-parallel geometry. It does not prove that the residual
spin is a solver correctness defect. The normal velocity and stationarity
checks accept it within the frozen numerical gates.

## Claims that remain separate

All four saved normal checks pass. Their maximum recorded closing normal
speed is `7.902537135448789e-16` m/s, and their largest recorded
complementarity residual is `1.5356404625889343e-16` J. The original quality,
position-reference, and phase-ledger replies contain no violations for the
reached attempts. None of these passes overrides contact geometry failure.

No trajectory reaches the 8 s terminal window or 1200 steps. The original
quality replies at these early times do not establish terminal settling or
eight-box stability. Source and emitted parity are separate parent evidence;
this document does not infer parity from these source archives.

No criterion, geometry helper, candidate, or runtime contract was changed.
The stored first failures remain the result. This diagnosis does not select
a tolerance change, contact geometry repair, new witness construction, or
further run. It does not change historical HOLD/NO_GO or native adoption.
