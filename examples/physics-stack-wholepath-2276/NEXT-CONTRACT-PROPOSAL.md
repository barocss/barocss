# Bounded complete-path schedule proposal

Status: READ_ONLY_DESIGN_NOT_EXECUTED. This is a proposal for a NEW runner
contract. It does not change the census contract, OPT05, any reference, an ended
cost candidate, a resource limit or a physical gate. No production import,
arithmetic helper, compiler, reference, profile or test was executed for this
review. Root must freeze a concrete implementation contract before execution.

## Decision

A pipeline can overlap native preparation and independent reference work.
The current evidence does not establish that it can complete1200 steps within
170s internal/180s external. A geometry worker plus ONE position worker still
has one serial position bottleneck. The minimal schedule worth a new bounded
qualification is one producer, one unchanged geometry reference and TWO
independent position-reference processes. This means THREE CPython workers,
not two total. Keep their original routers and one pending request per worker.
Do not create a mixed geometry/position router to hide this process count.

Before any1200 execution, qualify the new scheduling, complete physical reply
parity, archive handling and explicit owned-data accounting on exactly one new
three-scene16-prefix campaign. Measure all owned CPU and report process RSS
separately. Unknown or exceeded64MiB explicit owned DATA is not permission to
run a larger pipeline. There is no newly invented64MiB RSS cap.

## Evidence and cost graph

The immutable census-01 result establishes48 preparations in7.184726545s,
48 position-world asks in9.510570873s,48 ledger asks in0.889276625s,
48 contact asks in0.853779080s,51 quality asks in1.377077248s and complete
parent wall20.931844875s. All195 request/reply pairs match run07 bytes.
These observations used OPT03, not OPT05, and only steps1..16.

The serial path in census.mjs is prepare -> normal KKT -> contacts ->
position-world -> ledger -> quality -> archive -> next step. Source inspection
shows each position-world request independently constructs36 PRE pairs,
executes the cold exact LP/QP, checks the native represented result, and
constructs36 HYP pairs. The ledger request checks one step, not a hidden
reference trajectory. Contacts and quality are separate geometry requests.

For orientation ONLY, repeating the observed early position-world+ledger ask
work1200/48 times gives about260s per scene. The position-world component
alone gives about238s. Neither is a measured1200 result or a guaranteed lower
bound: later poses, prepared reuse, contention and transport can change it.
The reliable scheduling bound is structural: a single serial worker must
complete all its actual service work regardless of producer overlap.

With two position shards, the structural wall floor is at least the largest
of: actual serial producer work; total actual position-shard service divided
by2; actual serial geometry work. Startup, dependencies, queue stalls, archive,
drain and cleanup remain. Dividing the old observed service by2 is a design
estimate only. It does not divide CPU consumption or prove an180s result.

OPT04's166.543/146.165/146.909s scene diagnostics contain preparation and normal
KKT, but omit all Python gates. ALIGNED leaves little observed headroom before
170s. OPT05 has no qualified long-run timing at this design boundary. The
prepared-reference candidate is still SOURCE_ONLY: request-local body/basis
reuse can reduce repeated preparation, but preserves all72 pairs,288 SAT
evaluations, axis work and cold LP/QP. Its actual gain remains unknown.

The single captured position profile locates72 compact-pair calls at0.199520s
and cold LP/QP at0.137311s inside0.363581s instrumented evaluate. These nested
figures overlap; do not add them or forecast their removal. No old profile or
ended799438000ns microcost campaign is rerun by this proposal.

## Exact schedule and acceptance

1. Authenticate and snapshot one qualified canonical OPT05 provider graph,
   helper graph, original fixture, unchanged references, prepared wrapper and
   executables. Reuse valid existing control/first32 receipts. Admit the
   prepared wrapper only after its separately frozen full old-reply parity
   gate passes. Keep original source/tool pins and Decimal contexts/flags.
2. For each scene, obtain its original initial quality result before allowing
   production. The producer alone advances a private speculative state with
   prepareStackStep. It does not publish World state. Separate producer calls
   from host verification and IO so synchronous preparation cannot prevent
   reference pipe draining or the supervisor's deadline enforcement.
3. Use exactly THREE credits for all uncommitted steps. A credit covers the
   in-progress engine call, detached packet, pending proof, pending replies,
   archive work and every associated encoding copy until release. A producer
   cannot start a fourth uncommitted step. Three credits permit preparation
   while two older steps occupy the two position shards. Two credits do not
   generally sustain that overlap. This is a fixed bound, not a claim that
   three credits are sufficient for every latency distribution.
4. Treat each detached step packet as untrusted. Bind scene/step, prior and
   candidate body words, all required diagnostics, point operands and immutable
   provider identity. The host checks step-chain linkage and input immutability.
   No transfer changes numeric words or signed zero. Bound the detached wire
   BEFORE full allocation; the final contract must select its exact byte cap
   from actual bounded packet sizes, not assume the old2MiB per-reference-line
   cap bounds a whole prepared graph. Failure to fit is a typed resource stop.
   Plain JSON alone loses negative zero and is insufficient for this packet.
   Freeze a bounded lossless process transport, then verify EVERY numeric leaf's
   words after detachment. Body-only sidecars do not protect point/normal and
   other diagnostic words. This transport choice is still an implementation
   dependency, not a permission for numeric exceptions.
5. Route a step's position-world and ledger requests to shard(step mod2).
   Each shard executes its original main/parser/evaluate/serializer, one
   request at a time. Do not share request-local prepared tables between
   shards, steps, world and ledger calls. Keep36 rows, one cold position solve
   and one working application per attempt. The one geometry worker handles
   every strict contact and quality request under the unchanged protocol.
6. Run the unchanged independent normal KKT checker and all original local
   assertions for each actual packet. Run contacts, position-world, ledger
   and quality on that packet's actual inputs. A result from a future packet,
   a producer's claimed pass, an old saved quality run or a repeated body hash
   cannot substitute for any required check.
7. Commit complete records in step order. Increment independentlyFullAccepted
   ONLY after all required gates for that step pass AND the complete record,
   original request/reply bytes and raw words are persisted. Release its credit
   only after archive completion. Track prepared, normalKktPassed, each reference
   attempted/replied/passed count, fullyVerified, archived and contiguous
   independentlyFullAccepted separately. A speculative producer step never
   increments independent acceptance.
8. Quality uses the actual current scene's frame960 for the original8–10s
   settling baseline. Bind its raw words and keep one bounded immutable copy.
   Do not import OPT04 frame960 or treat a saved3603-quality PASS as candidate
   acceptance. Preserve the existing terminal and8x8 requirements.

No higher step may be reported accepted across a missing or failed predecessor.
The complete-path result remains internal-phase evidence: API=false and no
public World transaction, recorder, rollback or desktop adoption follows.

## Failure and process ownership

On ANY unexpected physical, protocol, archive or resource failure, immediately
stop new producer work and later-step dispatch. Record the first OBSERVED
failure with scene, step, gate, arrival order and host monotonic time. A later
step can fail before an earlier shard has replied. Therefore firstObserved
is not automatically earliestFailingStep.

Resolve only already in-flight earlier steps, including their required remaining
checks, while the ORIGINAL remaining deadline permits. Do not start a new scene
or retry a failed packet. Save a distinct earliestFailureKnown flag. If an
earlier result is killed, missing, unresolved or unavailable, report the earliest
step as UNKNOWN rather than infer it. Never count ignored shadow work as passed.
Retain bounded reached packets and the last contiguous accepted state.

One external supervisor must own the producer, coordinator, all three reference
workers, compressors and every resource-helper process. Keep the original
170s inner and180s outer wall boundaries per scene, with owned group termination
and bounded reap. Include initialization, imports, serialization, decompression/
compression, output, drain and shutdown in the outer receipt. No child may escape
the owned group. Preserve the physical first failure separately from execution,
archive, integrity and cleanup failures. Missing receipts remain missing.

Record authoritative COMPLETE lifetime CPU for every owned process after
close/wait, plus supervisor CPU, using reviewed OS resource collection. Existing
per-handler Python self-report and parent process.cpuUsage cannot supply total
owned CPU. Do not sum a parent's descendants-inclusive total with the same
workers' separate totals. Reuse the prior resource-after-wait pattern only with
an explicitly reviewed multi-child ownership map. No old fixed microcost gate
is silently applied to this different complete-path boundary.

Maintain the original64MiB explicit owned DATA cap across ALL live graphs and
buffers. Reserve producer/coordinator graphs, three loaded reference closures,
per-request rationals and scratch, three-credit storage, pending requests/replies,
JSON strings/UTF8 buffers, pipe buffers, hashes, zlib state/output and auxiliary
walkers before allocation. Shared physical pages do not excuse owned data.
Correct direct-key/value graph walkers must include integer storage and bounded
seen sets; no ephemeral-entry-tuple identity trick. Unknown aggregate bounds
remain NOT_QUALIFIED. Three CPython closures may make this schedule a data-cap
NO_GO; source inspection alone cannot settle that.

Measure whole-process RSS separately with its OS units and observation method.
Per-process peak RSS, simultaneous tree samples and an explicit-data bound are
different quantities. Sum-of-peaks can be a conservative upper envelope, but
it is not an observed simultaneous peak. Do not declare a new RSS limit or
relabel a sampled value as a proved explicit-data bound.

## Lossless archive under the existing280MiB cap

The old per-record gzip members reset compression state and duplicate physical
wires in loose files. The next runner may use bounded CONTINUOUS gzip streams
for complete original record JSONL, raw936-byte frames, and EACH worker's exact
request and reply byte streams. Keep each original newline byte. A small index
records worker/ordinal/scene/step/op, uncompressed offsets/lengths and SHA256.
This changes storage only; recovery must yield the original full wire bytes,
complete record trees and all numeric binary64 words, without normalization,
field omission, sampling or evidence regenerated from producer summaries.

Use gzip backpressure. Bound all pending input/output chunks and zlib state
inside the three-credit/data ledger; do not accumulate unbounded write promises
or gzip output. Count compressed bytes BEFORE disk writes against ONE shared
280MiB campaign cap, including all three scenes, source provenance, failure
records, indexes, timing, stderr and fixed final-receipt/cleanup reserves.
Count compressed completion before releasing a step credit. Reserve a bounded
failure slot before production. A cap stop remains a failure, never truncation
presented as full evidence. Do not delete or recompress old immutable receipts.
Compression ratio and archive CPU remain measured properties, not assumptions.

## Proposed next gate and unresolved dependencies

The next concrete implementation contract should authorize ONLY the new runner,
resource observer and archive adapter in a new folder. First run one fresh
ALIGNED/OFFSET/YAW16 campaign after OPT05 and prepared-reference qualification.
Compare all complete old physical reply bytes, all record fields and binary64
words against the qualified prefix authority, with only previously declared
arithmetic counters and separate scheduling/resource metadata exceptions.
Also decompress its archives and verify original wires, record hashes and raw
body bytes. Scheduling controls must cover out-of-order replies, an earlier
unresolved step after a later failure, oversized packet, backpressure and owned
worker termination. Never run numerical samples whose complete old physical
reply parity is missing, and never interpret their timing as qualified.

That short campaign measures the NEW composition once. It does not retime an
ended candidate or establish a speed ratio. Report whole wall, owned lifetime
CPU, data bounds, observed RSS, archive bytes, queue stalls and the actual
acceptance frontier. Stop at the first unexpected failure. If parity, ownership
or data bounds fail, preserve the failure and do not start1200.

Only after that new gate passes may Root freeze one complete1200 per-scene
campaign with all original physical/settling/resource requirements. Even a
short-prefix PASS provides no180s forecast. Producer contention, late-step cold
LP/QP service, total output size and three-worker data ownership are still
unsolved. A further production arithmetic change or a smaller reference graph
would need its own contract; no cap increase follows from this proposal.

The qualified exact KKT proof components remain a possible SEPARATE protocol
design. They reconstruct an optimum from an UNTRUSTED basis and verify all-row
primal/dual/stationarity/complementarity, with independent saved cold authority
on the original six-frame bank. That finite mathematical evidence neither
reopens their ended cost NO_GOs nor qualifies replacement of the unchanged cold
LP/QP on later trajectory packets. This proposal keeps cold LP/QP intact.

Evidence sources: wholepath CONTRACT.md, census.mjs and evidence/census-01/
result.json; PROFILE-CONTRACT.md and evidence/profile-01/result.json;
stack-library RESULTS.md and io.mjs; stack-next COMPLETE-COST-INPUTS.md;
rigid-full-pair-position-world reference.py; stack-solver trajectory-reference
and verification contracts; position-witness-v2 CONTRACT.md and RESULTS.md.
