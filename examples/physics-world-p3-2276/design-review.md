---
work_id: physics-world-p3-2276
artifact_type: before-code-hinge-design-review
status: candidate_overlay_authored_not_built_or_run
owner_role: independent-physics-algorithm-review
source_request: qualify only the original public two-disjoint-hinge profile and preserve every historical NO_GO
last_updated: 2026-11-02
---

# P3 design decision

Retain the original four-sphere, two-disjoint-hinge model and all exact gates.
Use the existing package `disjoint-hinge` projection and report modules. Do not
copy or change their arithmetic. The public World needs bounded admission and
phase orchestration. A new public result is a new qualification record. It
cannot qualify the absent historical candidate or remove its step 77 failure.

This review inspected source and saved reports. It made no World, projection,
solve, motor, FREE, contact or independent-reference calls. Parent subsequently
froze `CONTRACT.md` and assigned the new `candidate/` files and `candidate.patch`.
The overlay is authored only. Current package source remains unchanged. Parent
owns the contract, stage construction, build, provenance and numerical runner.

## Authorities and present limits

- Worktree: `/Users/user/Documents/ChatGPT/barocss-physics-motion-2276`.
- Selected parent: `2e270d3b2d452e684ca6abe333ee761f1247c10e`.
- Original mathematical and saved-bank authority:
  `f40123da0eedb19245688557f865e1beb09d47ef`.
- Original private result: `examples/physics-rigid-hinge-velocity-world-reference/RESULT.md`.
  Its source, separate repeat and genuine compiled-dependency graphs each
  accepted and independently qualified 1200 steps. This is a private result.
- Published internal transfer: `examples/physics-public-disjoint-hinge-reference/RESULT.md`.
  It qualifies only FIRST/LIMIT/FINAL × RENAME/PERMUTE saved POSTCONTACT mapping.
  It does not qualify a new public constructor or World step.
- Public authority: saved issue #1489 and its comments under `evidence/preread/`.
  Comment `6111755791` preserves the failed public SOURCE run. Candidate
  `7178434a0440d9dcce0be8c602cf3ba4f8ee5068` is absent from the current Git object
  database (`git cat-file -t` failed). Do not represent reconstructed source as
  that candidate.

The existing public failure accepted 77 steps but qualified only 76. Both angle
reports at step 77 were `0.30208212955718694`, F64LE `a4ddc9485055d33f`;
the bank value was `0.3020821295571869`, `a3ddc9485055d33f`.
All 416 final body bytes matched. The report target comes from POSTCONTACT
measurement before projection. Equal final bytes do not establish equal report
operands. The old candidate's actual preprojection operands and historical
V8/architecture/math provenance remain unobserved.

`examples/physics-motion-nogo-2276/hinge-contract.md` and its saved study result
provide an independent exact-rational rounding certificate for reconstructed
historical operands. That certificate covers those operands only. It does not
observe the absent candidate or qualify a full trajectory. Historical public
activation therefore remains NO_GO even if a new candidate passes exact gates.

## Admitted physical profile

Preserve the literal physical values in
`examples/physics-rigid-hinge-velocity-world-reference/fixture.mjs`:

| Field | Fixed value |
|---|---|
| Clock | `dt = 1/120 s`; main trace 1200 accepted and qualified steps |
| Bodies | Four dynamic 1 kg spheres; radius 0.1 m; primitive scalar inertia |
| Positions | `[-.1,0,0]`, `[.1,0,0]`, `[-.1,0,1]`, `[.1,0,1]` |
| Initial state | Identity orientation; zero linear and angular velocity |
| Material | Restitution 0; static/dynamic friction 1/0.7 |
| Scene | Zero gravity; no sensor, CCD, filter change, large or persistent mode |
| Joints | Two directed disjoint pairs; local A/B anchors `[.1,0,0]`/`[-.1,0,0]` |
| Axis and limits | World +Z; `[-.8,.8] rad` |
| Motor | Target `.5 rad/s`; impulse cap `.0001 N*m*s`; reaction cap `.01 N*m*s` |
| Commands | Empty only in the new public 4/2 profile |
| Contacts | No cross-component contact or touch |

Use the current `PhysicsModel`/`WorldOptions` API directly. Model/collider/frame
identity is a schema mapping; it is not a physical variation. Preserve existing
single-pair, fixed, static and kinematic behavior. Do not make a legacy factory.

The exact selected identity controls already exist in
`physics-public-disjoint-hinge-reference/variants.mjs`: RENAME uses
`zLeft,aRight,yLeft,bRight` and `jointZulu,jointAlpha`; PERMUTE reads bodies
`[3,0,1,2]` and joints `[1,0]`. A/B remains directed. Calculate Z0 then Z1 and
write results to caller body and joint order. Original IDs must be ordinary
identity data, not solver branch keys. These two first-step controls do not
establish every ID/order or a 1200-step variant result.

Current source rejects 4/2 during `model-admission.ts` → `parseJoints`:
`INVALID_CONFIG / dynamic pair supports one joint between two dynamic spheres`.
This is a source-backed prediction, not an observed constructor run. Even after
admission changes, `world.ts` currently admits commands for only its first
dynamic hinge and projects joints inside eight contact passes. Both seams need
the selected new path. Admission alone cannot adopt the qualified law.

## Required step and report order

1. Keep active/owner/step-limit and command-copy/parser error priority. Apply
   axis-only admission to each canonical pair, then reject a nonempty new-profile
   command list with `INVALID_COMMAND / disjoint hinge profile supports empty commands only`.
2. Copy accepted transaction state. Preserve the original global body-order
   angular update, including empty additions and signed-zero behavior.
3. Run the original motor once per canonical pair. Feed its previous accepted
   report angle. Do not substitute a newly measured geometric angle.
4. Run original global FREE integration once. Preserve each operation's order,
   orientation update, bounds and linear update. Do not call a full pair driver
   after FREE; it would repeat motor and integration.
5. Retain eight contact passes and four cross-component pairs. Exclude the two
   connected A/B body pairs. Remove old per-pass joint projection only for this
   new profile. A real cross-component hit refuses with
   `NUMERIC_LIMIT / disjoint hinge contact profile is unsupported`.
6. Call `projectDisjointPostContact` once, with two local directed joints whose
   A/B indices are 0/1. Keep original global body indices, caller joint indices
   and immutable original pair origins separate. The function already projects
   then reports once per pair, and checks both report caps before returning.
7. Validate the complete candidate result, movement, reports and caps. Commit
   bodies, contacts, events, reports, cursor/time and other accepted store fields
   together. A refusal retains accepted state. Preserve unknown thrown identity.

`disjoint-hinge/pose.ts` measures the POSTCONTACT relative angle and clamps it
to form `targetAngleRad` before its orientation/position correction. The report
uses this target. Raw final twist remains a separate diagnostic.
`disjoint-hinge/report.ts` computes `J = scale(vFinal-vPost, 1/inverseMass)` and
`K = scale(omegaFinal-omegaPost, nativeScalarInertia)`, then reports B's values.
Do not regroup reciprocal/scaling, add motor/contact impulses to correction
reports, normalize zero, or interpret impulses as calibrated forces. Cap is
strict `norm(KB) > .01`; equality passes without a tolerance.

## Independent authority and exact proof boundary

For the original main trajectory, authenticate the original complete archive,
request/output records and 104-byte raw13 body slices as DATA. Restore signed
zeros from raw bytes or authenticated pointer roots. Use archived independent
proof only after actual BEFORE, AFTER, raw, report, corrections and cap inputs
match the original authority bit for bit. Tolerance agreement alone does not
permit certificate reuse. The new public schema needs an explicit lossless
mapping; public identity metadata is checked separately from numerical parity.

The saved FIRST record is an old asymmetric angular-command control. It is not
the new empty-command main first step. LIMIT is source196→accepted197; FINAL is
1199→1200. Do not seed a new expected state from actual final values or select
FIRST as an empty-command bank record.

Existing independent Python code derives input-only angular/motor/FREE phases,
Decimal80/120 separation, original pose/velocity rows, Fraction solutions and
reports. The saved-phase wrapper intentionally leaves pairReplies null in a new
derive. Preserve that boundary. Do not add hidden solve calls to populate them.
The original public plan uses exact bank correspondence for main and adds no
cold main IPC. If correspondence fails, stop certificate reuse and retain the
failure. A new reference campaign or cross-runtime tolerance claim requires a
separate selected contract before execution.

Do not widen any original gate. Binding sources are the original selected
reference contracts and saved `expected-gates.py`, `reference.py` and
`actual-compare.py`. These include pair metrics `1e-12`; body position/quaternion
`1e-12`, velocity `1e-10`, projected angular velocity `1e-9`; original physical
anchor/axis/COM/P/L/kinematic/work/certificate gates; exact report/raw comparison;
strict cap; full trajectory and source/repeat/compiled equality. A short scalar
or saved-phase PASS is not a public World PASS.

## Execution and stopping recommendation

Retain the selected public budget from #1489 comment `6106432428`: original
1200-step main × source/repeat/genuine emitted, plus RENAME and PERMUTE first
steps in each graph. Historical full control ceiling is constructor47,
World-attempt4182, query18, explicit-dispose4, internal-cap12; normal cleanup33
is separate, giving normal total dispose37. The selected public preparation and
compatibility table supply the exact case ledger; their current P0 API adaptation
belongs to the parent runner freeze.
The older private World 1096 MiB contract is not the public storage budget.

Public storage remains main128 MiB per graph + fixed32 MiB + separate emergency8
MiB = 424 MiB. Preserve raw actual streams, counters and first failure. Measure
attempted/completed/accepted/qualified work separately. Do not count a compiled
build as an executed compiled trajectory or transfer old calls into new counts.
Do not rerun the completed saved-phase or old private numerical campaigns.

Freeze actual source/provider closure, strict types, source graph, owned builds,
and genuine emitted graph before new numerical calls. Stop at the first exact
mismatch, unresolved reference, unknown exception, storage/process failure or
budget exhaustion. Do not execute later graphs or controls after a failed main
prefix. Keep numerical NO_GO distinct from execution failure. Never repair a
failure by changing a physical input, tolerance, raw-bit gate, cap or budget.

For a new candidate that clears all gates, report the exact new revision and
runtime as a separately qualified bounded public result. Keep the old step77
NO_GO, absent operands and unexecuted historical later graphs visible. General
contact/joint composition, connected mechanisms, cross-platform replay, Viewer,
the original stack exits, all existing HOLDs, merge, deploy and release remain
outside this review's authority.
