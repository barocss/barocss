# Invariant-GCD witness harness

AUTHORED_NOT_EXECUTED. Root reviews/seals/runs. Use original32 GCD requests/oracle/manifest bytes and existing position bank without materialization. Fresh G0 then fresh A10 then one B6 are mandatory; no old G0/A reuse.

The new GUARD-POLICY.md overrides only the old per-remainder GCD guard clause: checked entry plus proven Euclidean range invariants. It does not claim all old guard checks remain unchanged. Primitive prices,2M caps, bit/time/data limits, physical proof/payload gates and695832300ns conservative cost gate remain unchanged. Every phase records the policy path/pin/scope.

After Root reviews final protocol/source pins:

```
python3 -B examples/physics-p4-invariant-witness-harness-2276/freeze.py --candidate-directory examples/physics-p4-invariant-witness-2276 --reference-directory examples/physics-p4-position-witness-reference-2276 --protocol examples/physics-p4-invariant-witness-harness-2276/PROTOCOL-01.json --reviewed-protocol-sha EXACT_REVIEWED_SHA256
```

Use pinned Python and the existing180s guard for these commands in order:

```
python3 -B examples/physics-p4-invariant-witness-harness-2276/run-g0.py g0-01
python3 -B examples/physics-p4-invariant-witness-harness-2276/run.py stage-a stage-a-01 /Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-p4-invariant-witness-harness-2276/evidence/g0-01/summary.json
python3 -B examples/physics-p4-invariant-witness-harness-2276/run.py stage-b stage-b-01 /Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-p4-invariant-witness-harness-2276/evidence/stage-a-01/summary.json
```

Stop at the first failure. G0 has32 pairs/one global2M meter, A has10 fresh checks, B has one measured six-frame bank and one cost decision after all physical/independent gates pass. Cost authority remains parent context CPU plus owned Node entire-lifetime resource CPU after close+wait, not an identical baseline boundary. No baseline rerun, old candidate edit, World/direct API/desktop/1200-step/public qualification.
