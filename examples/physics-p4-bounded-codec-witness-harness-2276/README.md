# Bounded-codec witness harness

AUTHORED_NOT_EXECUTED. Root reviews/seals/runs. Original GCD/position banks remain unchanged; separate M1 already generated codec bank-01 under guard p4-codec-materialize-01. Do not repeat M0/M1 or reuse old G0/A qualification.

After final source/protocol review, run freeze.py with the exact reviewed SHA, then each guarded phase in order:

```
python3 -B examples/physics-p4-bounded-codec-witness-harness-2276/run-g0.py g0-01
python3 -B examples/physics-p4-bounded-codec-witness-harness-2276/run-u0.py u0-01 /Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-p4-bounded-codec-witness-harness-2276/evidence/g0-01/summary.json
python3 -B examples/physics-p4-bounded-codec-witness-harness-2276/run.py stage-a stage-a-01 /Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-p4-bounded-codec-witness-harness-2276/evidence/u0-01/summary.json
python3 -B examples/physics-p4-bounded-codec-witness-harness-2276/run.py stage-b stage-b-01 /Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-p4-bounded-codec-witness-harness-2276/evidence/stage-a-01/summary.json
```

Use pinned Python/Node and the existing180s command guard. Each phase has an internal170s budget; U0 includes candidate+audit, not M1 generation. G0 has32 pairs, U0 has16 decimals/24 finite words/4 expected rejections, A has10 fresh checks, B has one six-frame bank/one cost decision. Policy path/hash/scope is reported explicitly; all-old-guards-unchanged is false. Fixed conservative cost authority and695832300ns gate remain. No source changes to old candidates, baseline rerun, direct API, World, desktop or1200-step claim.
