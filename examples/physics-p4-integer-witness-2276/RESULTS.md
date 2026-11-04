# Integer-matrix position proof: numerical PASS, cost NO_GO

Root implemented and executed the new private proof algorithm under the reviewed source pins on2026-11-03. The mathematical change is one common dyadic scale, one integer Bareiss factorization and full integer KKT checks before final fraction normalization. No old rational exact solver or fallback remains in this candidate. The independent design review is in `../physics-p4-integer-reference-review-2276/REVIEW.md` and did not inspect candidate source.

| Gate | Actual result |
| --- | --- |
| Fresh G0 |32 exact GCD/Bézout pairs PASS;466279 priced operations |
| Fresh U0 |16 integers,24 finite IEEE words and4 nonfinite rejection controls PASS;192217 operations |
| Fresh A |10 candidate replies and10 independent position/control checks PASS |
| Fresh B |6 full saved physical replies and6 independent checks PASS |
| One conservative cost gate |**NO_GO; candidate ENDED** |
| Engine World / original1200 / public API / desktop |**NOT_RUN** |

The bank compared87102 physical leaves and45408 Float64 words without normalization. All36 position inequalities,24 stationarity components, exact multiplier/complementarity/objective fields, original32-contact evidence and existing1e-12 gates remained. Maximum proof work was356696 units, below the unchanged2M limit. Final exact strings and RNE presentations match the original cold-QP oracle.

Accepted-kernel maximum translation difference was2.148164124373243e-36m, margin-report difference1.1102230246251565e-16m and objective difference3.8396260997499504e-22kg m². Expected invalid controls are recorded separately: the changed reported translation differs by2^-32m and is rejected; its residual must not be mixed into accepted maxima. Duplicate, dependent and omitted-ground controls also retain their expected refusal. No physical criterion was relaxed.

Cost:557970000ns parent context CPU +254303000ns owned Node whole-lifetime user/system CPU =812273000ns. Fixed threshold695832300ns; saved single-process baseline773147000ns. The new conservative envelope includes child startup/IO/shutdown and is wider, not identical to the old timing boundary. One genuine B bank, one cost decision and zero baseline reruns. No retiming or tuning after this NO_GO. The child processed exactly6 requests, closed at EOF, exited0 and was waited; stderr0, cleanup error absent. All reported allocation limits concern explicit owned data, not process RSS.

The corrected seal uses protocol SHA4286ed31d25fa07c129cbe44d4e743d91e9e2d717ba51bbca3c335e5deaea586 and182 frozen workspace inputs. An earlier incomplete freeze CLI was rejected by argparse before source seal creation or any numerical operation; that setup error is retained in the archive summary. Phase commands used installed pinned tools through the existing heavy gate and command-run.mjs180s outer guard:

```text
python3.13 -B examples/physics-p4-integer-witness-harness-2276/run-g0.py g0-01
python3.13 -B examples/physics-p4-integer-witness-harness-2276/run-u0.py u0-01 <absolute G0 summary>
python3.13 -B examples/physics-p4-integer-witness-harness-2276/run.py stage-a stage-a-01 <absolute U0 summary>
python3.13 -B examples/physics-p4-integer-witness-harness-2276/run.py stage-b stage-b-01 <absolute A summary>
```

Exact argv/timestamps/outcomes are in `examples/physics-world-p5-2276/evidence/p4-integer-{g0,u0,stage-a,stage-b}-01/`; all numerical outputs and audit receipts remain under the harness evidence. `evidence/cost-no-go-01/summary.json` pins SOURCE-01.tar.gz and PROOF-01.tar.gz, original inputs, accepted/control maxima and first cost failure.

Next dependency: review a genuinely different complete-reference algorithm before another implementation. Original full-stack geometry/ledger/quality/normal/transport/compression/output cost remains unqualified. No public body-cap increase,API adoption,1200-step or screen PASS follows. All original first failures, HOLDs, physical tolerances and8x8 iteration caps remain. No deployment.
