---
work_id: physics-stack-pipeline-2276
artifact_type: implementation-validation-result
status: bounded_component_pass_full_p4_open
owner_role: independent-physics-algorithm-work
source_request: continue actual stack engine through bounded independent validation
last_updated: 2026-11-04
---

# Actual bounded pipeline result

Root executed the new hard16 composition twice with preserved source versions:

```sh
$NODE22 examples/physics-stack-pipeline-2276/run.mjs prefix-01
$NODE22 examples/physics-stack-pipeline-2276/run.mjs prefix-02
```

Prefix01 STOPPED in synthetic control12 BEFORE any physical/provider/reference
call. The control incorrectly requested verified step2 after an earlier missing
step1 result had stopped that step's eligibility. Window.canResolve correctly
refused. Source, old seal and receipts were archived before editing. The test
now requires refusal/unchanged state and also retains the original unknown-gap
scenario. No implementation, physical tolerance, row or iteration limit changed.
The historical initial controls01 PASS source was reconstructed and checked
against its original declared hashes. See FIRST-FAILURE-CORRECTION.md and the
immutable baseline archive; the failed receipt remains FAIL.

Prefix02 passes all18 current synthetic controls, then the actual pipeline:

| Actual count | Result |
| --- | ---: |
| Producer-returned steps | 48 |
| Independent normal KKT passes | 48 |
| Fully verified phase steps | 48 |
| Archived and contiguous physically accepted steps | 48 |
| Strict contact / position-world / phase-ledger replies passed | 48 each |
| Initial and per-step quality replies passed | 51 |
| Ignored shadow replies | 0 |

The three complete16-step scene records, raw body/point fields and425916 numeric
leaves exactly match run09 Native. All195 request/reply pairs match by semantic
scene/step/operation identity. Every source packet is detached; its bounded
canonical transcript protects type, keys, UTF16 strings, numeric binary64 words
and aliases before/after Worker crossing. The accepted host state advances only
after all gates and the matching complete record/raw bytes persist in order.

One producer Worker shares its Node process; three Python references execute
in one geometry lane and two position shards. Each has at most one pending
request. The fixed three-credit window includes in-progress production, proof
and archive. Producer exits0 with no output/fatal error; all three Python pools
exit0 with complete EOF, zero stderr/trailing bytes and matching request/reply
counts. Source/dependency hashes remain unchanged.

This gate does NOT measure authoritative whole owned CPU or whole DATA/RSS;
its deadline/output controls remain separate. No new wall-time ratio or1200
forecast is derived from filesystem timestamps. independentlyFullAccepted=0,
API=false, full1200=false and fullP4Qualification/resourceQualification=false.
Original180s/output, numerical gates and all older failures remain. The scope
of stricter offline64MiB profiles versus the original runtime exit is under
source-contract audit; no such threshold is silently raised or relabeled PASS.
Next: exact after-wait CPU on the same composition, original full campaign's
archive/cost boundary, and only then qualifying World/recorder/desktop adoption.
No mobile tests, deployment or resumed HOLD workers.
