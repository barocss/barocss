# Complete P4 cost boundary

Read-only receipt review, 2026-11-03. This is an input map, not an executed new cost gate or a1200-step forecast.

The original six saved frames are ALIGNED/OFFSET/YAW at steps1 and16. `examples/physics-world-p4-2276/evidence/observable-census-01/summary.json` authenticates each original9-body/32-force-point frame and four operations: contacts, position-world, step-ledger and quality. Two original calls came from `cost-census-01`;22 were newly made in `observable-census-01`. Keep that census distinct from24 fresh calls.

Both folders retain request/response bytes, per-call authentication and raw comparison, `geometry.timing.jsonl` and `position.timing.jsonl`. Reference compute is the original dispatch/evaluate boundary. Parent timing includes serialization, write/flush, reference scheduling, transport and decode. Subtracting compute from parent time does not isolate pure IPC cost.

The saved `examples/physics-world-p4-2276/cost-profile.json` aggregates wall time over those six frames: contacts68.095ms, position886.494ms, ledger89.583ms and quality129.545ms. These come from two sessions. Do not add them to the different position-V2 core CPU baseline773147000ns or call the result an observed complete-run time.

The actual old16-step source/emitted integration receipts are:

- `examples/physics-contact-boundary-2276/evidence/world-source-03/world-result.json`
- `examples/physics-contact-boundary-2276/evidence/world-emitted-01/world-result.json`
- Their commands, compressed JSON records and Float64 streams.

Each qualifies three16-step prefixes and exact emitted parity under its own provider. The separate308-step ALIGNED timeout remains the earliest observed original long-run stop.

After a new position algorithm passes its numerical and same-boundary cost gates, a new complete-path campaign must measure these operations in the SAME run: World.step, cold normal solve and KKT, original32-point strict geometry, full36-row position proof, phase ledger, quality, transport, compression and output. Record actual attempts/returns, accepted steps, first failure and retained bytes. Include initialization and shutdown. Keep nested timing roots separate instead of summing overlapping timings.

The6-frame subset does not contain the8-second baseline or8–10-second settling window. The full original1200-step scenes must still pass those original checks and180s/output/memory limits. A position-only improvement cannot authorize a whole-run PASS, a raised public body cap or API adoption. Existing8x8 loops, tolerances, first failures and HOLDs remain unchanged.
