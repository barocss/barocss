# D310 validation

Runtime: db529cb774a48019e5296b1e8671cacbf356ffa7.
Node22.19.0. Heavy gate held for each build/test/docs group, with one heavy group at a time.

| Check | Result |
| --- | --- |
| Kernel build | PASS |
| Kernel lint/code-shape | PASS;119/32/273/75 unchanged |
| First focused four suites |36/36 PASS;745.217459ms |
| Final focused four suites |36/36 PASS;692.357458ms |
| Full kernel |2171 total;2165 pass;0 fail;6 existing skips;249201.900917ms |
| Agent tools/refusals | PASS; no generated delta |
| API inventory | unchanged SCOPED_PASS; existing EX001/EX002/EX003/DA001/IV001/IV002 only |
| Docs | PASS;68 pages;53 shots;4488KiB;852 labels |
| Actual fresh D309 result comparison | deep equality PASS including counts/Numbers |
| D309 retained serialized two results and frontier | all three equal |
| Model/Studio/types/browser | NOT RUN; latest whole consumers/types D299901b4ce45 |
| Performance timing | NOT RUN; no speedup claim or old runtime path modification |
| Push/PR/release | NOT RUN |

First implementation measurements hit the unchanged aggregate cap in both newly extended
requests. The raw result is first-budget-refusals.json. Exact common-denominator arithmetic
now accepts both without weakening the theorem, tests or cap. The asymmetric fixture still
refuses inside the original formal child and retains its exact prior output.

The premature receipt read produced the FileNotFoundError retained in setup-diagnostic.txt.
The file was then read after generation. It did not alter source or interrupt validation.
No lint, build or focused unit-test failure occurred.

Reproduce the full three-case receipts from packages/barocss-cad after building:

    node ../../apps/cad-studio/handover/notes/cylindrical-wrap-source-walls-2026-10-29/measure.mjs

Use the prescribed Node22 and heavy gate. Full temporary logs are /tmp/barocss-source-walls-*.log;
full receipt output is /tmp/barocss-source-walls-final-receipts.json. Committed receipts.json
contains the complete new wall proof/counts plus the prior child counts, excluding repeated
large child geometry. This evidence contains no source-checksum acceptance pin.
