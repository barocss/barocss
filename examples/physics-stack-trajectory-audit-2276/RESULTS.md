---
work_id: physics-stack-trajectory-audit-2276
artifact_type: saved-trajectory-quality-result
status: pass_saved_quality_only_full_p4_open
owner_role: independent-physics-algorithm-work
source_request: continue library implementation and original eight-box1200 validation
last_updated: 2026-11-04
---

# Saved original trajectory quality

Root executed the original pinned independent Decimal80/120 geometry reference
on every frame from the one actual OPT04 runtime. No producer/World/solver was
called or retimed. Original raw streams, failures, tolerances and HOLDs remain.

```sh
$NODE22 examples/physics-world-p5-2276/command-run.mjs stack-trajectory-audit-01 . \
  $PYTHON -B examples/physics-stack-trajectory-audit-2276/audit.py audit-01
```

Actual result: **PASS_SAVED_ORIGINAL_QUALITY_ALL_3603_FRAMES**. ALIGNED, OFFSET
and YAW each pass1201 states including initialization, and241 frames at8–10s.
Each uses its exact saved frame960 as the8s baseline. All51 initial/first16
quality results equal the earlier live census complete evaluate result exactly.
The raw streams, initial metadata and fixed floor words are authenticated.
All original floor, penetration, finite footprint, precision, tilt, drift and
speed gates apply unchanged. No expected violation or input-integrity failure
occurred. Guard exit0,93.37679625s; audit self wall93.299553959s.

| Metric maximum | ALIGNED | OFFSET | YAW |
| --- | --- | --- | --- |
| Pair penetration m | 1.5058647339611058e-17 | 1.98622439071868e-17 | 1.6330147618063505e-17 |
| Floor penetration m | 7.330075454912672e-17 | 6.123965321974271e-17 | 8.438665936843748e-17 |
| Horizontal drift m | 5.203700649481272e-14 | 3.6521159735908117e-14 | 7.890185519243812e-14 |
| 8s-baseline vertical drift m | 2.7755575615628914e-17 | 2.7755575615628914e-17 | 2.7755575615628914e-17 |
| Linear speed m/s | 1.2464943404954969e-14 | 7.893115122768814e-15 | 2.395448185421987e-14 |
| Angular speed rad/s | 2.7912237565712937e-16 | 4.53297471746802e-15 | 1.600739038489591e-14 |
| Quaternion norm error | 6.959556198971135e-34 | 5.793409891294373e-29 | 2.1859158090345802e-16 |

The contact list was unavailable in the runtime archive. Its explicit empty
list supplies only the unchanged overlapWithoutContactCount diagnostic, which
is0 in these states. This does not establish actual contact presence or force
point correctness. The original cosine tilt gate passes; the original public
acos metric rounds to0 and is not an exact zero-tilt certificate.

Every request digest and original physical reply is saved in the three JSONL
files. This qualifies captured trajectory quality only. Full force-point strict
witnesses, all36-row position optimum, phase-ledger/work, live deadline plus
complete owned resource qualification, Source/full-emitted/API transaction,
recorder rollback and new desktop adoption are still open. Independently fully
accepted steps remain0; API/resource/fullP4Qualification are false. Physical
accuracy, deterministic reproduction and output/resource constraints remain
separate claims. No new dependency, deployment, mobile or equipment work ran.
