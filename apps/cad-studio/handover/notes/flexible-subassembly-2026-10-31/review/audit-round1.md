# Independent audit, round 1 (FULL tier): flexible sub-assemblies (roadmap 10 ④, RS7.4)

**Verdict: CHANGES_REQUIRED** (2 Medium, 3 Low, 1 pre-existing gap). The pose maths is correct.

Probes are in this folder (`node build.mjs <probe>.ts && node <probe>.mjs`, Node 22, run through the gate):
- `fx.ts`: the fixtures, with my own Euler, Rodrigues and canonical-axis arithmetic.
- `p1-pose.ts`, `p2-state.ts`, `p3-mates.ts`, `p4-cycle-*.ts`, `p5-bounds.ts`: the probes.

## Passed (independent arithmetic)
- **Tilted two-joint chain.** The axis is tilted 30/20/10. The empty base is the root, and the grounded frame is listed last. For (q1, q2) of (40,0), (0,35), (40,−70) and (−123,211):
  - The lid and the finger (the grandchild) match R(a1,p1,q1)∘R(a2,p2,q2)∘M within 3e-13.
  - The frame does not move.
- **World pose.** Through a rotated and translated occurrence ([17,−33,71], [100,50,−20]), the kernel-folded lid centroid is within 4e-12 of the expected value.
- **Prismatic joint.** The joint is `base~s`. 7 mm is stored unscaled, the part moves +7 along X, and the value reads back as 7.
- **Limits.** The limits are listed in degrees (−10/10). 5 is accepted and 20 is refused in degrees.
- **Offset convention.** With the saved pose at 40°, a value of 10 gives 50°.
- **Shared document.** Two occurrences can share one document with different joints. All-zero values return the very same `inst.doc`. `placedBase` differs per occurrence.
- **Mates.** A parent keeper holding `sub1/lid`: posing turns sub1 by −90 and the lid stays put (Δ ≤ 6e-17). With an over-constrained grounded sub-assembly, `unmet_mates` is returned and chat shows it.
- **Revisions.** `acceptRevision` with a vanished key does not crash. The part folds rigid and the problem is "has no joint base~lid". `replace {}` clears the value. `makeIndependent` keeps the joints.
- **Chat.** Infinity is refused. `get_assembly` lists `joint_problem` for a stale key.
- **Import cycle.** The doc ↔ flexible ↔ faces cycle loads in every entry order.

## Findings
**M1 (Medium): joints set on a pattern occurrence are silently dropped.** `flexible.ts:120` `setInstanceJoints` has no `drivenRefusal`. Its `solveDoc` runs `expandPatterns`, which regenerates the occurrence from its seed.
- Expected: a `PATTERN_DRIVEN` refusal, as `placePart` gives (edit.ts:123).
- Actual: success, with `joints` gone (probe `p2-state.ts` "joints on a pattern occurrence").
- Affected surfaces:
  - The facade `setPartJoints` reports success.
  - The Studio shows the joint boxes on occurrences (App.tsx:1966, InstancePanel has no `driven` guard for `joints`). A typed value reverts with no toast.
- Chat is safe only because `placePart` runs first.

**M2 (Medium): Open accepts malformed `joints`, which pose silently.** `readStudioDoc` (migrate.ts:68) does not check them. `poseOf` and `jointsProblem` (flexible.ts:62–103) do not check that values are finite numbers.
- A value of `"90"` is applied as 90 rad; the panel and tools list 5156.62°, with no problem reported.
- A value of `1e999` gives Infinity, and the lid placement becomes NaN, with no problem reported.
- Expected: a typed refusal on Open, or a problem with the occurrence left rigid.
- Probe: `p2-state.ts` "Open with malformed joints".

**L1: the cached problem names the wrong occurrence.** The `posed` cache (flexible.ts:85–96) is keyed by (doc, values) but stores text that includes `inst.name (id)`. Occurrence B's `poseOf`/`jointProblemsOf` problem reads "A (A) has no joint…" (p2). `jointProblemsOf` has no caller yet, so the impact is limited to the API.

**L2: a stale key with value 0 is not reported by `poseOf`.** flexible.ts:90 short-circuits all-zero values before validating the keys. `jointProblemsOf` returns [] while `instanceJointsOf` reports the problem (p2). The geometry is rigid either way.

**L3: the header comment is wrong about cams.** flexible.ts:10 says "Gear and cam couplings inside are not read". `treeOfSub` → `jointTreeOf` always passes `camFaces`, so cam followers are coupled; only gears are not passed. (Reasoning only, not probed.)

**Pre-existing (out of scope, informational): some consumers see only the sub-assembly's base bodies at any pose.**
- Affected: the robot view (verbs.ts:39, robotCore.ts:31) and `get_assembly` `world_bounds`. The evaluator folds no instances, so the `bodyDocOf` change at chat/assembly.ts:76 has no effect (p2 robot view, `p5-bounds.ts`).
- As a result, the links/meshes and inertia of a parent robot and the chat bounds leave out nested parts entirely.

## Consumers checked (posed or name-only, so OK)
- Posed: `placedBase`/`placedDoc` (Studio viewport, clearance, team clearanceMap, explode meshes, drawings `brepsFor`), and the face tables (`tablesFor`, Studio `take`).
- Name-only, unaffected by the pose: `pathTable`, `faceOriginOf`, the callouts, and the BOM (mass is pose-independent; the shape key uses the saved pose, so two posed copies are one line, which is correct).
- Not pose-specific: alignment (`faceTableOf(inst.doc)`) ignores nested parts anyway.
