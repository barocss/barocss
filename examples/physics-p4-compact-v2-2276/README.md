# Offline compact observer V2 — authored, NOT_RUN

This prototype retains the complete old compact physical/scalar payload except
the explicitly replaced algorithm-specific precision field. It authenticates
and executes only original Float64 scalar function definitions. It reuses the
qualified exact integer SAT backend unchanged, adding consumed-interval width
and physical-bound certificates under a new protocol. All saved payload words,
selection/ties layouts and signed zeros are checked. Unknown fields fail.

No World, QP, old Decimal SAT, old observer or fixture run occurs. Exact winner
is diagnostic only. Full position,32-point line,phase ledger,quality,total cost
and1200-step P4 acceptance remain NOT_RUN/NO_GO. Old schema/evidence and the
ended support-radius cache approach remain untouched.

Parent reviews/freezes new source hashes, then uses the existing heavy lane
and180s external guard:

```
python3 -B examples/physics-p4-compact-v2-2276/run.py <fresh-run-id>
```

Result: evidence/<fresh-run-id>/summary.json and records.jsonl. Bounds remain
2M metered integer ops total,16384bits,170s internal,8MiB evidence and64MiB
explicit data allowance. First failure stops the population. Author has not
imported, syntax-checked, executed or benchmarked these numerical modules.
