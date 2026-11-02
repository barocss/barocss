# Primitive integer-axis candidate — authored, NOT_RUN

This one offline candidate reduces nonzero integer SAT axes by their positive
common divisor after original zero/near-parallel classification. It keeps the
qualified scalar/full-position/QP/gates and saved physical-payload audit. Original
files and receipts are untouched; source transfers and complete diffs are saved.

Parent reviews/freezes the new files, then uses the existing180s heavy guard:

```
python3 -B examples/physics-p4-primitive-axis-2276/run.py <fresh-run-id>
```

Result: evidence/<fresh-run-id>/summary.json, all full replies and source-transfer
hash/diff. Required6coldQPs/432compact+scalar/12960axes and complete saved numeric
compatibility precede the single frozen cost decision. Minimum10% core CPU gain
against authenticated773147000ns baseline is required. A lesser gain returns
COST_NO_GO and ends this candidate; no tuning or cap increase is authorized.

SAT2M operations/16384bits, original separate QP limits,170/180s,64MiB explicit
data and16MiB evidence stay fixed. No World or old Decimal SAT run occurs.
Other32-point line,ledger,quality and full1200-step P4 remain NOT_RUN/NO_GO.
Author has not imported, syntax-checked or run the numerical modules.
