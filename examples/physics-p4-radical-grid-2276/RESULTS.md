# R0 direct radical grid: pure17 PASS only

Root executed M2 once and R0 once on2026-11-03. The new algorithm directly proves the minimal dyadic enclosure of N/(D*sqrt(S)). It changes interval construction only; no old signed-square winner comparison, axis reduction, support cache or NodeSAT relocation was retried. No new runtime dependency or download was used.

M2 independently generated13 valid,2 invalid-input and2 resource-control cases. Its square-comparison binary search is different from the candidate quotient/isqrt algorithm. Its separate IEEE-word/midpoint calculation records strict and closed RNE containment independently. M2 used49034 reference major operations, made0candidate/World calls and completed under its separate170s/180s guard. Exact request10964B SHA798bbc18f8623214e44ce7bd342e967385d31205ae6ef16369d5d389018a611e; oracle13659B SHAb35acf846abd6e71c28f3318a6121cd2f9c55cb46e6a671a3e04e3dc12a5c6fb.

Actual R0 result: **PASS_R0_PURE17_ONE_GLOBAL_METER**. One actual immutable old SAT Meter served all17 calls, followed immediately by17 successful independent prefix audits. Final census:13 valid,2 invalid and2 expected resource refusals. Work18911operations, peak16383bits, axes/models0. Caps stayed2M/16384bits/64sqrt updates and precision table64,128,256,512,1024,2048. Sources and tools were reauthenticated after the final audit. Elapsed846459834ns is observed wall time including audits, not core cost CPU or a speed ratio. Explicit retained parent data peaked73880B; this is not RSS.

The independent checks prove the exact minimal grid inequalities and sign/equality for each valid case. Grid enclosure width is0 for exact cases and exactly2^-p otherwise. The largest observed nonzero width among these fixed cases is2^-64 in this scalar protocol (1/18446744073709551616); it is a pure scalar grid bound, not an observed physical engine error. Fixed-p nonzero q0 and exact RNE midpoint cases can have correct grids that fail strict binary64-cell presentation. The oracle records that limitation; R0 does not qualify those as public physical output. The later physical caller must still satisfy the original strict cell and1e-25 width gates.

D0/S0 return their declared typed input refusals. The two large controls retain INTEGER_SHIFT_PREBOUND and INTEGER_PRODUCT_PREBOUND. The latter is an exact grid point whose mandatory upper-certificate product cannot fit; no equality shortcut or larger allocation was allowed. These expected controls are separate from unexpected first failure, which is null.

Commands used the existing heavy gate and installed tools through command-run.mjs180s outer guard:

```text
python3.13 -B examples/physics-p4-radical-grid-reference-2276/materialize.py examples/physics-p4-radical-grid-reference-2276/evidence/bank-01
python3.13 -B examples/physics-p4-radical-grid-harness-2276/run.py r0-01 --reviewed-pins-sha 998a9d40552a3d51e10d4b53841c39673ac16ca1f7fec0a073a7672d3c1fca12
```

Exact commands/timestamps/outcomes are in `examples/physics-world-p5-2276/evidence/p4-radical-{materialize,r0}-01/`. Prefix replies and independent receipts remain in the harness evidence. `evidence/r0-proof-01/summary.json` pins SOURCE-01.tar.gz and PROOF-01.tar.gz. M2 was not regenerated. No baseline or ended cost candidate was rerun.

Next: a separately frozen new Python compact V3 interval backend and full six-frame position/physical/independent validation, with identical integer-proof Node component. Only proof endpoint/precision/protocol/tag and derived proof-width metric may change under the reviewed closed MAP; all physical words/scalar/selection/ties/axes/gates/KKT remain. One fixed695832300ns conservative cost decision follows all six passes. R0 alone is NOT full SAT, position, cost, original1200, World, public API or desktop qualification. All HOLDs, physical tolerances, original8x8 limits and first failures remain. No deployment or mobile test.
