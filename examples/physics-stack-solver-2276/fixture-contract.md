---
work_id: physics-stack-solver-2276
artifact_type: frozen-fixture-contract
status: ready_for_parent_execution
owner_role: independent-fixture-executor
source_request: "Issue #2276: independent solver candidate on the actual saved eight-box first patch"
last_updated: 2026-11-01
---

# Authenticated first-patch fixture

Freeze this contract before writing or running the extractor. Write only this
file and `extract-fixture.py`. Do not change historical inputs. Parent owns
execution, candidate invocation, and result classification.

## Authentication and budget

Verify the old `physics-motion-nogo-2276/stack-equilibrium.py` SHA256 before
import: `43918b579209d55d52991bb2f20da9612e8a7f97d5bbb735711bfb2c3b91dc8c`.
That module verifies its immutable observer helper SHA256
`70a34672ef53f034fa714bcd54a120a60c672fea3fd740841064dc8ac43263e2`
before importing definitions. Import starts no study or World.

Call that module's unchanged `load_inputs` with its original diagnostic:
`evidence/stack-study-01/result.json`, 16407 bytes, SHA256
`f8941733862d59a49730c5f5624d99186e7d9f8a1f307dda3026371efc2b89db`.
It rehashes the original manifest and complete compressed archives, including
the 54063016-byte JSON archive and 1581367-byte raw archive. The original
manifest SHA is `b9f3a446022d8bedf65070f5ea43694fedcc7208b7de408c5067a6ce608cd42d`.
Reuse the receipt's complete decoded authentication; do not run that old
campaign again. Preserve the exact archive compressed/decoded pins reported
by the authenticated helper.

Parse only the ALIGNED initial record and step 1, and select only 10296 raw
bytes: 936 initial bytes plus 9360 step bytes. The step JSON SHA256 is
`f588b8d940c75dc246b164b7ab0b0182e6cf32604672986bcdabbe81b2108840`;
the step raw SHA256 is
`b156e035caaa3c94f5885a24a2541b9913869221a22311a416af64d58121ecc2`.
Repack the ten restored raw frames with the unchanged little-endian field
layout and check that same step raw hash. This preserves signed binary64
operands without a second archive decode/read. Hash the free/old-output
raw frame operands separately for traceability.

Independently authenticate the existing exact certificate JSON, 166333 bytes,
SHA256 `e570e89c488bc89f6a22c5a34875156b1a43628f3af1312c9437826f3b8020f9`,
at `evidence/equilibrium-study-01/result.json`. Do not recompute its witness.

## Restricted data mapping

Use `closure-ready.free`, the actual 32 saved points, and the original
`closure-ready.velocity` control output. Call the old restricted `profile`
validator after authentication. Require nine bodies, eight four-point face
interfaces, the original static root/cube geometry and materials, identity
orientations, zero warm impulses and the common downward free velocity.

The candidate DTO is `problem.bodies` with fields `id`, `positionM`,
`velocityMps`, `angularVelocityRadps`, `inverseMass`, and row-major
`inverseInertiaWorld` (3x3). Copy all physical values. Identity orientation
means the verified dynamic inverse local inertia `[24,24,24]` is also world
inverse inertia. Require static inverse inertia `[0,0,0]` and inverse mass 0.
No implicit coordinate rotation or material adaptation is allowed.

`problem.points` has `id`, `aId`, `bId`, `pointM`, and `normalAtoB`.
Use a globally unique, JSON-encoded `[pairKey, pointId]` as `id`. Retain
original point IDs, pair keys, indices, and mapping outside the DTO. Preserve
the ledger's directed A/B endpoints and normal: A receives `-lambda*n`,
B receives `+lambda*n`. Do not infer loads from body names.

## Independent oracle and old-output control

`oracle.bodies` contains `id`, `velocityMps`, `angularVelocityRadps`,
`netImpulseNs`, and `netTorqueNms`. Copy these from the authenticated prior
certificate, converting Fraction strings to numeric vectors only through
`float(Fraction(value))`. Preserve the original Fraction fields in
`oracle.exactCertificate`. Verify exact zero predicted velocity/spin, and
verify exact Fraction stationarity with the saved free velocity, net impulse,
net torque and verified mass/inertia. This is a check of the copied witness;
it does not invoke or derive an answer from the new candidate.

Copy the prior certified point rows, geometry witness and control's old
observed body velocities. Require that the latter exactly equal the restored
raw velocity frame. Include the saved final normal/tangent impulses and the
prior first violation/residual, with provenance. The old result remains a
NO_GO control; no positive finding replaces it.

## Output and stops

CLI: `python3 -B examples/physics-stack-solver-2276/extract-fixture.py --output <fresh-absolute-fixture.json>`.
The output must be absolute and absent. Create it exclusively, never replace
it. Output is deterministic JSON, at most 2 MiB, with no timestamp or timing.
Keep source/receipt/archive hashes and parent baseline identity `7105c4755`.
Internal deadline 170 seconds. Any authentication/profile/oracle disagreement
fails with nonzero exit and no fixture. No World, solver, sweep, source
geometry, old campaign, dependency install, or runtime dynamic candidate call.

An emitted fixture proves only authenticated data extraction. It does not
prove the candidate passes, full eight-box stability, convergence, a native
law repair, or product acceptance. All historical HOLD/NO_GO decisions remain.
