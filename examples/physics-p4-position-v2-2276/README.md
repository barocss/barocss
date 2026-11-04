# Offline full cold-position observer V2 — authored, NOT_RUN

This six-request prototype keeps original cold QP/validation/selection arithmetic
and physical gates. It uses an audited finite function-source transfer to
consume the qualified compact V2 certificates instead of old Decimal precision
metadata. Original files, schema and receipts are untouched. The entire retained
old physical reply must match saved authority, including signed-zero words;
unexplained field changes fail. Cold QP attempts/returns are counted directly.

Parent reviews and freezes all new files, then runs with the existing heavy
gate and180s external wrapper:

```
python3 -B examples/physics-p4-position-v2-2276/run.py <fresh-run-id>
```

Output is evidence/<fresh-run-id>/summary.json, six full replies and exact
old/new function text/diff. Required totals:6 cold QPs,432 compact/scalar calls,
864 convention problems,12960 axes and2592 compact numeric fields. SAT bounds
remain2M operations/16384bits and the QP retains its separate original budgets.
New evidence is bounded16MiB; internal170s/outer180s and explicit64MiB data
allowance stay fixed. First failure preserves its returned reply and stops.

Per-frame total CPU includes decode, validation, compact/scalar+SAT, QP,
serialization/write and complete saved-reply audit. Nested timing is attribution,
not additive totals. Historical prior885.643ms uses a different boundary; no
automatic speedup/cost PASS follows.32-point geometry,ledger,quality and full
1200-step P4 remain NOT_RUN/NO_GO. Author has executed no numerical module.
