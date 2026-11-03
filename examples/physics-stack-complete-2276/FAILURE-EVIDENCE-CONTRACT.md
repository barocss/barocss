# Bounded received-packet failure evidence

Status: SOURCE_ONLY_NOT_EXECUTED. Root alone executes the new fixed8 controls
and later fresh physical prefix/campaign. Old full01 source/timed receipts are
already preserved under checkpoint cf743ae49; this change does not rewrite them.
The source author imports/runs no helper, compiler, codec, arithmetic or test.

## Observed gap and exact scope

Saved full01 ALIGNED accepted1114 contiguous steps, received1115 candidates, and
first observed a producer deadline at1116. Packet1115 existed in verify's local
closure, but `slot.value` was assigned only after all four references completed.
The first failure belonged to1116, so the same-step failureData backfill did not
retain1115. This is a failure-evidence gap, not evidence of a physical failure
at1115 or a returned candidate at1116. Old UNKNOWN/timeout classification stays.

Own only driver.mjs and new failure-evidence.mjs/test/contract/pins. Do not change
Window, baseline barrier, old fixed8 controls, package math, producer, references,
codec candidates, clocks, criteria, cap, counter, acceptance or cleanup order.
Normal success adds only one validated-frame alias per existing slot and deletes
it on successful archive completion before releasing that credit. No clone,
serialization, observer, extra queue or numerical call is added on that path.

## Alias retention and one-time selection

After the existing fingerprint, provider/scene/step and raw prior-word-chain
checks, store `slot.received=frame` in the already admitted credit. At most three
credit slots exist. No second strong global Map or packet history is created.
Availability means a candidate frame passed those guards, not an arbitrary or
rejected incoming message; this scope is explicit in the capture metadata.

At the FIRST observed failure only, preserve the existing window.fail record,
firstObserved/arrival ordering and immediate producer stop/barrier cancellation.
Then capture at most three scalar availability rows and ONE selected frame alias:

1. Prefer the exact firstObserved step if it has a validated returned frame.
2. Otherwise select the lowest-step received uncommitted frame.
3. Otherwise selectedStep/selectedFrame are null and reason is NO_RECEIVED_PACKET.

selectionReason, firstObservedStep and firstCandidateMissing distinguish the
failure from the chosen evidence. Rows record step, phase, returned and recordReady
AT CAPTURE. Later drain/commit or shadow arrivals do not rewrite this snapshot.
A selected earlier step can subsequently commit; final lastContiguous remains
the authoritative separate acceptance count. Selected does not mean failed.
The selected alias survives that deletion only until bounded failure output;
after first failure no new production starts, so unique candidate graphs remain
within the originally admitted three credits. Never fabricate1116 data.

Existing explicit same-step input/prepared data and typed producer partial
diagnostics remain separate failureData. A capture-helper error is secondary
CAPTURE_FAILED metadata with unknown candidate availability, not a replacement
first physical/protocol failure. No returned failure payload is a usable state.

## Finite numeric JSON and negative zero

Failure-only encoding wraps the ENTIRE included evidence, including lastAccepted,
failureData and selected frame, as STACK_FAILURE_FINITE_JSON_V1 with data,
negativeZeroPaths/count and aliasIdentityRestored:false. The old native JSON
policy keeps all finite binary64 numbers except zero sign. The encoder records
every Object.is(value,-0) as a sparse string-segment path relative to data.
It walks each JSON occurrence of a shared child; a global identity de-duplication
would incorrectly omit zero signs in later JSON copies. An ancestor Set rejects
cycles. Numeric strings and positive zeros remain unchanged. Object-valued
undefined host metadata is omitted as by the existing wire helper; array
undefined and unsupported types refuse.

Reuse the existing diagnostic data bounds: depth64 and262144 value occurrences,
plain dense data, own enumerable data descriptors, finite numbers, no proxies,
accessors, hidden/symbol fields or unsupported prototypes. Getter code is never
invoked. Each sparse path is charged using the existing bounded wire helper;
cumulative path bytes cannot exceed2MiB before a path is retained. The final
complete envelope uses the SAME existing2MiB wire/emergency bound, including all
payload, paths and metadata, with existing16MiB wire scratch checks. No new
global DATA/heap/RSS claim follows. The whole finite-data bit recovery claim is
for included data only; JSON deliberately does not restore graph alias identity.

The private diagnostic decoder accepts a<=2MiB Buffer, validates exact envelope
fields/count and plain finite data, rejects duplicate/invalid paths, resolves
ONLY own keys and requires a numeric zero at every leaf before replacing it by
-0. Empty path[] restores data itself. No eval or inherited property traversal.
Own __proto__/constructor data keys are ordinary own data, not prototype writes.

If total envelope/path/data admission fails, preserve an explicitly METADATA-ONLY
failure-metadata.json: fullPayloadOmitted:true, selectedFramePersisted:false,
unchanged firstObserved/earliest/execution fields, final contiguous count and
selection/availability scalars. It must not carry an incomplete zero-path list
with a complete-fidelity claim. The received-at-capture flag can remain true
while persisted is false. The bounded metadata itself uses the same finite
envelope. Charge exact bytes to the existing emergency reserve before writing;
do not enlarge2MiB or borrow ordinary output. Existing write/IO refusal remains
separate from original physical failure. Result metadata names included-number
recovery and alias limits explicitly. No success-path physical record changes.

## New fixed8 controls, frozen before Root execution

1. Use actual Window transitions through1114;1115 is received/proof-pending and
   1116 missing with unresolved deadline. Select actual1115 alias, explicitly
   mark1116 unavailable, preserve exact firstObserved identity/order/counters,
   contiguous1114 and earliest UNKNOWN. Entire lastAccepted/selected data -0
   survives the failure envelope.
2. Same failed-slot frame wins over older available frames; no frame gives
   explicit null/missing selection.
3. Three total credits, fourth refused; normal archive completion deletes the
   received alias before credit release. Selected alias survives later earlier-
   step drain without changing availabilityAtCapture. Capture refuses four slots
   without mutating their counters/state.
4. Reference failure before slot.value and archive failure after slot.value both
   preserve actual returned frame. Later ignored shadow packets neither rewrite
   capture availability nor become verified/accepted.
5. Independent literal IEEE words for ±0, subnormals, finite extrema, ±1 and
   minimum normal. Aliased child has a separate zero path in EACH JSON copy.
   Scalar -0 uses path[]. Alias identity is explicitly not reconstructed.
6. Unicode/lone surrogate, empty/slash/tilde/numeric and OWN __proto__/constructor
   keys. Own-path traversal rejects inherited, nonzero, duplicate and nonstring
   paths. Undefined object metadata follows original JSON omission policy.
7. Independent literal envelope overhead gives exact2MiB success and one-byte
   excess refusal. Repeated long-key negative-zero paths hit the cumulative path
   bound. Metadata-only omission remains explicit, preserves original failure,
   and separates received from persisted.
8. Nonfinite/BigInt/function/undefined root, undefined/sparse arrays, custom/null
   prototypes, proxies, cycles and accessors refuse without getters. Depth64
   succeeds/65 refuses; shared DAG expansion hits262144 occurrence bound; oversized
   or malformed decoder input refuses.

Old Window/baseline/control8 bytes and old failure evidence remain immutable.
Root runs pinned Node22 --test failure-evidence.test.mjs only after source/pin
review. This gate contains no provider/physics/codec-candidate/clock measurement.
New complete driver source/pins must then be resealed by Root before a fresh
physical prefix/full run. No original full1200/API/strict64 or release PASS is
inferred from this synthetic failure-data gate.
