# Bounded codec position witness: ended on cost

Actual Root execution on 2026-11-03. This private offline proof candidate adds bounded decimal formatting and IEEE-word guards to the entry-invariant GCD policy. Its GUARD-POLICY explicitly replaces the listed guard clauses. Original primitive prices, 2M budget, 8192/16385-bit limits, tolerances and first failures remain.

| Gate | Actual result |
| --- | --- |
| M1 separate immutable codec materialization | PASS; 16 integers, 24 finite words, 4 nonfinite controls |
| Fresh G0 exact GCD / independent Bezout | PASS 32 pairs; 466279 priced operations |
| Fresh U0 codec / independent IEEE audit | PASS all44 entries; 192217 priced operations |
| Fresh A position and rejection controls | PASS 10 candidate + 10 independent checks; max473056 operations |
| Fresh B full saved physical payload | PASS 6 physical + 6 independent checks; max497019 operations |
| One conservative cost decision | **NO_GO; candidate ENDED** |
| Original 1200 / World / public API / desktop | **NOT_RUN** |

B compared 87102 physical leaves and45408 Float64 words to the immutable bank. Exact reduced fractions, KKT, independent RNE, all36 position inequalities, original32 force contacts and existing1e-12 physical gates passed. No tolerance or iteration count changed. This is saved-frame proof, not long-time integration.

Cost is562091000ns parent context CPU +299711000ns owned Node whole-lifetime user/system CPU =861802000ns. The fixed threshold is695832300ns; saved single-process core baseline is773147000ns. The conservative new envelope includes child startup, I/O and shutdown and is **not the identical timing boundary**. One actual B bank, one cost decision and zero baseline reruns. Parent compact469359000ns, bridge22713000ns and residual70019000ns are nested breakdowns; legacy admission1776000ns is included in residual and must not be added again. No cost retry is permitted for this ended candidate.

Commands used the installed pinned Node22/Python, existing command-run.mjs180s outer guard and heavy gate; internal170s,2MiB per request/reply,16MiB evidence and64MiB explicit-data limits stayed fixed. Phase commands were:

```text
python3.13 -B examples/physics-p4-codec-reference-2276/materialize.py examples/physics-p4-codec-reference-2276/evidence/bank-01
python3.13 -B examples/physics-p4-bounded-codec-witness-harness-2276/run-g0.py g0-01
python3.13 -B examples/physics-p4-bounded-codec-witness-harness-2276/run-u0.py u0-01 <absolute G0 summary>
python3.13 -B examples/physics-p4-bounded-codec-witness-harness-2276/run.py stage-a stage-a-01 <absolute U0 summary>
python3.13 -B examples/physics-p4-bounded-codec-witness-harness-2276/run.py stage-b stage-b-01 <absolute A summary>
```

Exact argv, stdout, stderr, process outcomes and timestamps are in `examples/physics-world-p5-2276/evidence/p4-codec-{materialize,g0,u0,stage-a,stage-b}-01/`. Actual phase receipts are under the harness `evidence/`. `evidence/cost-no-go-01/summary.json` pins frozen SOURCE-01.tar.gz and PROOF-01.tar.gz. Original failure records and ended candidates remain unchanged.

Next dependency: one separately declared diagnostic may guide a genuinely different proof algorithm. It cannot revive this cost result. A future saved-frame cost PASS still requires complete contact/position/ledger/quality/normal/transport/output integration before original1200 and public adoption. Existing HOLDs remain. No deployment.

Source hygiene: the default staged whitespace check reports one extra blank line at EOF in the frozen independent codec audit.py. That source was not changed after numerical execution. A second whitespace check with only blank-at-eof disabled verifies the other whitespace rules; this formatting exception has no numerical PASS claim.
