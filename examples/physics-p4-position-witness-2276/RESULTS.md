# Position witness revision 01: first resource failure

Root executed the frozen candidate on 2026-11-03. This is an offline saved-input result. It is not a World, public API, browser or 1200-step result.

| Check | Actual result |
| --- | --- |
| Original ALIGNED step1 | Exact all36-row KKT and independent saved-cold/RNE comparison PASS |
| Duplicate basis index | Expected `WITNESS_INDEX_INVALID`; independent control PASS |
| Dependent original row1 | Expected `WITNESS_BASIS_DEPENDENT`; independent control PASS |
| Omitted ground row7 | Expected `WITNESS_PRIMAL_INFEASIBLE`; independent control PASS |
| Reported translation changed by 2^-32m | Exact optimum certified, then expected `OBSERVED_RESULT_MISMATCH`; independent control PASS |
| Original ALIGNED step16 | FIRST NO_GO: `PROOF_PRIMITIVE_LIMIT` during all-row KKT |
| OFFSET1/16, YAW1/16, StageB cost, World1200, public API and desktop | NOT_RUN after first failure |

There were6 candidate calls and5 independent calls. The first ALIGNED solution used196234 priced primitives. Translation difference was0m, reported-margin difference1.1102230246251565e-16m and objective difference3.8396260997499504e-22kg m². Exact feasibility, negative multiplier, stationarity and complementarity residuals were all0/1. The original1e-12 gates were unchanged.

The ALIGNED16 refusal performed exactly2000000 primitives and reserved a denied2000001st primitive. It had completed one8-pivot factorization, with166809 GCD remainder operations; reduced/intermediate peaks were1760/3104bits. This is a resource failure, not a measured physical mismatch. No cost decision was made and no baseline was rerun.

The command was:

```sh
/Users/user/.volta/tools/image/node/22.19.0/bin/node examples/physics-world-p5-2276/command-run.mjs p4-witness-stage-a-01 . /opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-position-witness-harness-2276/run.py stage-a stage-a-01
```

The heavy gate admitted the command immediately. The external guard recorded exit1 after1837ms, without timeout. The actual harness summary is `../physics-p4-position-witness-harness-2276/evidence/stage-a-01/summary.json`. Full source authentication,130 frozen workspace inputs, raw replies, controls, independent reports and the first failure are retained in `evidence/first-failure-01/`. SOURCE-01.tar and PROOF-01.tar have hashes in that directory's summary.

Two earlier setup issues are separate from this numerical failure: Root corrected an exact-text instruction before execution, and the initial data-materializer command required its missing parent directory to be created. Their original records remain. Before freezing, Root also corrected a memory-table headroom statement and the harness placeholder detector. No physical limit changed.

The next bounded implementation uses common-denominator matrix products to avoid repeated reduction of each dot-product term. It must retain the same2M primitive pricing,8192/16385bit limits, all36 rows, exact output fields, four controls, original inputs and1e-12 gates. Revision01 sources and first failure remain immutable. StageB remains conditional on a complete fresh StageA pass. Existing HOLDs and all historical NO_GO results remain; no deployment or hardware validation occurred.
