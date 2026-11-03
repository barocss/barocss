# Lehmer witness: GCD bank PASS, position resource NO_GO

Root ran the frozen candidate on2026-11-03. This candidate is not qualified for the original six-frame position profile. Its first failure and sources are preserved; B cost, World1200, public API and desktop are NOT_RUN.

| Gate | Actual result |
| --- | --- |
| Independent GCD32 |PASS: exact digits, divisibility and Bézout greatestness identities |
| One global G0 meter |1159878/2000000 primitives, reset0;8192-bit input/intermediate peaks |
| Guarded Lehmer blocks |319 accepted blocks observed; no performance claim |
| Position ALIGNED1 and four original rejection controls |5 independent PASS results |
| Position ALIGNED16 |FIRST NO_GO: PROOF_PRIMITIVE_LIMIT during KKT |
| OFFSET/YAW remaining kernels, B cost, World1200, API, desktop |NOT_RUN after first failure |

Reference generation M0 was a separate179ms guarded command, with32 math.gcd calls and separate plain extended-Euclid Bézout certificates. G0 was one separate guarded candidate/audit command and used one global2M meter over all32 pairs. The phases were declared separately before execution in `../physics-p4-gcd-reference-2276/ROOT-M0-BOUNDARY-01.json`. Do not claim M0 plus review/sealing plus G0 were one uninterrupted170s protocol.

The fixed pairs include zero, signs, reversed order, common factors,64/256/2048/8192-bit boundaries and four consecutive-Fibonacci cases. The auditor checks g divides both inputs and u*a+v*b=g, proving greatestness, with no candidate formula or gcd search in the auditor. This arithmetic PASS is not a physics or performance PASS.

ALIGNED16 performed exactly2000000 primitives; the next CMP reserved2000001 and was denied. Prepare used328707 units, factor1271624 and KKT392894, plus parse6775. One8-pivot factorization completed. Reduced/intermediate peaks were1760/3104bits. GCD remainder count dropped to9926, but the full context had1445962 comparisons. Fewer remainder operations therefore did not establish lower complete work or cost. No physical mismatch was measured because the all-row check did not finish.

The ALIGNED1 exact residuals remained0/1. Translation difference was0m, reported-margin difference1.1102230246251565e-16m and objective difference3.8396260997499504e-22kg m². Duplicate, dependent-row, missing-ground and changed-report controls retained their expected rejection reasons. All original1e-12 gates,2M pricing, bit caps and physical iteration limits remained.

Commands used the existing heavy gate and180s external guard:

```sh
/Users/user/.volta/tools/image/node/22.19.0/bin/node examples/physics-world-p5-2276/command-run.mjs p4-lehmer-g0-01 . /opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-lehmer-witness-harness-2276/run-g0.py g0-01
/Users/user/.volta/tools/image/node/22.19.0/bin/node examples/physics-world-p5-2276/command-run.mjs p4-lehmer-stage-a-01 . /opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-lehmer-witness-harness-2276/run.py stage-a stage-a-01 /Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-p4-lehmer-witness-harness-2276/evidence/g0-01/summary.json
```

G0 exited0; A exited1 without timeout. Actual summaries are in the harness evidence directories. `evidence/first-failure-01/` authenticates155 workspace inputs and retains compressed SOURCE/PROOF archives and hashes. Six position calls were attempted and five independently passed. There was no B command, cost decision or baseline rerun.

The next proposal changes the GCD guard architecture, not the old prices or physical tolerance: check both input magnitudes at entry, then use the exact nonnegative remainder invariant to prove subsequent remainders cannot exceed the recorded bound or peak. The original meter explicitly required per-remainder bit checks, so a new localized guard-policy addendum is required before that candidate runs. All other guards remain. Source authoring or the GCD32 result here does not qualify that new candidate. Existing HOLDs and every earlier failure remain; no deployment or mobile test occurred.
