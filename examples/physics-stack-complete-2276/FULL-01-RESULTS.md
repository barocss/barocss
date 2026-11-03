# First original complete campaign: cost NO_GO

Root ran the original population after the same-source prefix02 PASS:

```sh
$PYTHON -B examples/physics-stack-complete-2276/run.py full \
  examples/physics-stack-complete-2276/evidence/full-01 \
  8fecc7607f12c94107018d29edd03acd356f70fdc31e1e0f4e820b852d751235 \
  examples/physics-stack-complete-2276/evidence/prefix-02
```

Actual result: **COMPLETE_CAMPAIGN_STOPPED / NO_GO**. ALIGNED contiguously
verified and archived1114 steps. It returned1115 preparations and passed1115
normal KKT checks. First observed refusal is the producer deadline at step1116;
the position reference at1115 was also unfinished. Therefore the earliest
failing step is **UNKNOWN**, not1116. OFFSET/YAW were NOT_RUN. No observed
physical residual failure preceded the timeout; the remaining duration is
unqualified.

The fixed scene170s bound includes a4s cleanup reserve, so actor work stops
at166s. Owner observed wall before its final receipt is166.32361983298324s.
Returned preparation spans total152.252122367s; nested record archive waits
22.756840062s. These overlap with other work and are not additive CPU totals.
Closed-tree CPU qualification is **CPUUNKNOWN**, because this failed path
terminates workers/references. OS sample observations are retained without
relabelling them complete successful-lifetime CPU.

Actual step960 was verified and archived before baseline promotion. Its raw
body SHA is `47914bcfb4b3a2b4e53c5667f7de0573560ff07603bd74f2a9563d57d631b014`.
There are155 committed quality frames from8s through1114/120s, fewer than the
required241 through10s. This is an actual baseline-boundary result, not full
settling or1200 qualification.

The archive closes with10034 data entries,206516742 compressed bytes and SHA
`a7d9a3aa99dad8b1be00f0291765e01a38e3db33868ff2973a6359b4110d5e99`.
The shared charged budget is214911630 bytes within293601280 bytes, including
prepaid fixed metadata and its existing emergency reserve. No output-cap
failure was observed. Remaining three-scene storage fit is unqualified.

Root then ran `recover-full-01.mjs` once under a separate180s command guard.
Actual **PASS_OFFLINE_RECOVERY_OF_FAILED_CAMPAIGN_PREFIX_ONLY**, outer
10723.851667ms. It recovers1115 record groups (initial+1114), all JSON/numeric
words/body/point data, complete recorded RPC bytes and the one pending
`position1,1115:world` request. Every recovered post-step body matches the paid
runtime05 raw frame, and body-only SHA matches the live writer. No solver,
World or reference call occurs. This separate recovery time is not inserted
retroactively into the failed live run or used to promote it.

Recorded independent maxima across the recovered committed prefix are:

| Measurement | Observed maximum | Existing gate |
|---|---:|---:|
| Closing normal speed | 3.9347037177948765e-13 m/s | 1e-10 m/s |
| Loaded tangent speed | 1.7717391747829367e-13 m/s | 1e-10 m/s |
| Ledger velocity-phase angular velocity difference | 5.219862990033883e-13 rad/s | 1e-10 rad/s |
| Strict local slab violation | 8.32641864620115e-17 m | 1e-9 m |
| Independent position translation difference | 2.3504760590950475e-35 m | 1e-12 m |
| Raw/normalized final depth | 7.015761172389557e-17 m | 1e-12 m |
| Vertical drift from actual960 | 2.7755575615628914e-17 m | .005 m |

The gates above retain their source scopes: ledger velocity updates use
`physics-rigid-signed-closure-world/reference.py:562`, strict slab geometry uses
`physics-motion-nogo-2276/stack-study.py:237`, and position agreement uses
`physics-rigid-full-pair-position-world/reference.py:178`.

These are recovered values of the original live independent checks, not newly
computed physical oracles. All detailed metrics and distinctions remain in
`evidence/full-01/offline-recovery.json` and the untouched live receipts.

`baseline/full-01-source.tar.gz` and `baseline/full-01-preserved.json` preserve
the exact source and timed evidence hashes. The large original archive stays
local and unchanged; a hash alone is not a claim that its bytes are in Git or
published remotely. Current source work addresses duplicate exact integer bit
checks and a distinct bounded lossless codec. No unchanged cost rerun, tolerance
increase, World/API promotion, mobile test, HOLD restart or deployment follows.
