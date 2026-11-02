# P4 integer SAT micro — numeric subset PASS

Revision02 passed the saved numeric subset; full P4 stays NO_GO. See [results](RESULTS.md).

This files-only experiment computes all15 integer SAT axes for all36
original box pairs, PRE/HYP, raw/normalized quaternion models, in six saved
CURRENT frames. It does not construct or advance a World. It does not invoke
an old reference or QP, and does not revive the failed support-radius cache.

Parent must review/freeze CONTRACT.md, METHOD.md, corpus.json, integer_sat.py,
verify.py and run.py before its guarded first run. Author has not imported,
executed, syntax-checked or benchmarked these numerical modules.

```
python3 -B examples/physics-p4-sat-2276/run.py <fresh-run-id>
```

Use the existing heavy gate and180s external command guard. The internal guard
is170s. The entire micro has2M metered integer operations and16384-bit bounds;
resource exhaustion is NO_GO, not permission to increase the limits. The first
failing input/pair and accepted prefix remain in a fresh evidence directory.

Only six independent saved numeric fields can be checked exactly: raw and
normalized margin/depth and their absolute differences. A separate observer
checks every proposed binary64 word and exact rounding-bin enclosure. Full
feature-selection, signed-zero-sensitive scalar normal/point/tie outputs,
legacy80/120 algorithm-specific precision delta, full compact_pair output
compatibility and total reference cost remain NOT_QUALIFIED/NOT_RUN even if
the numeric subset passes. The original P4 full-duration result remains NO_GO.

The separate fixed six-pose192-row boundary report is authenticated only. Its
line/surface witnesses do not supply missing SAT winner authority.
