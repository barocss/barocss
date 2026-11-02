# G1a reference protocol

Author-only. No numerical/runtime call is authorized by this protocol.

CLI: `python3 -B repair-reference.py --run-id FRESH --freeze ABS --token SHA256
--out ABS_FRESH_REFERENCE_DIRECTORY`. The parent freeze must have status
`PARENT_AUTHORIZED_G1A_REPAIR_QUALIFICATION`, mode `G1A_STAGED_REPAIR_ONLY`,
runtimeAuthorized true, productionActivation false, runId matching this CLI,
complete repo-relative `files`, absolute `toolFiles`, `tools.python`, and a
pinned `highReview` with approved true. The output directory is fresh below
this example's evidence directory. Original authorities and baseline functions
are authenticated before math; no production module is imported.

Transport is one bounded JSON object per line on stdin/stdout. Maximum input
line262144B, output line65536B. Number payloads use `{$f64le:16lowercaseHex}`;
protocol stepIndex/request counters are ordinary JSON integers. Reference
numbers use `{numerator:string,denominator:string}`; intervals use `{lo,hi}`
of those rational records. No binary64 reference-output conversion occurs.
All new bank/artifact/summary paths are reference-output-directory-relative;
resolve/authenticate beneath the fresh CLI out directory. Use the common
parent freeze.runId as --run-id. Audit metrics are opaque physical payload;
the runner checks status/op/ordinal/graph/case/step/completion/counts and the
artifact pin. Full compact exact residual/bound proof lives in the artifact.

Startup emits `{status:'READY_G1A_REFERENCE',protocol:'G1A_REFERENCE_JSONL_V1',
requestOrdinal:0,runId,authoritySha256,counts}` after authentication and before
physical calculations. It is the only unsolicited stdout line.

Requests:

1. `{op:'init',authoritySha256:TOKEN,cases:[{caseId,pairRaw:{model,options}}]}`
   with exactly10 pairs already converted once by the runner. IDs in order:
   T01-isotropic-cube-dt60/dt120/dt240, T02-axisymmetric-off-axis-dt60/dt120/
   dt240, C01-principal-axis, C02-zero-positive,
   C03-zero-signed-negative-q, C04-off-axis-negative-q.
   Success: `{status:'PASS_G1A_REFERENCE_BANK',op:'init',requestOrdinal:1,
   counts,bank:{path,bytes,sha256},sourceGraphComplete:false}`.
2. `{op:'audit',graph:'source'|'native',caseId,stepIndex,stateRaw}`. Each case
   has initial step0 then consecutive accepted steps through its declared end;
   failure-state duplicates add no audit. Success:
   `{status:'PASS_G1A_STATE_AUDIT',op:'audit',requestOrdinal,graph,caseId,
   stepIndex,sourceGraphComplete,counts,metrics,artifact:{path,bytes,sha256}}`.
   Conservation is checked on every initial/accepted state. Matched-time and
   control/recovery steps also check the saved analytic enclosure. Grid
   refinement checks run as soon as their required source values exist.
   The last source audit (854 source audits) must include
   sourceGraphComplete true after all source/refinement gates PASS. No native
   audit is accepted earlier. Runner waits for that field before constructing
   any native World. No extra sourceComplete request is permitted.
3. `{op:'finish'}` after1708 audits. Success:
   `{status:'PASS_G1A_REFERENCE_FINISH',op:'finish',requestOrdinal:1710,
   sourceGraphComplete:true,counts,refinement,bank,summary:{path,bytes,sha256}}`.
   Reference exits0 after this reply. Runner closes stdin and requires stdout/
   stderr EOF+process close; no additional requests, warmup or stats call.

Exactly1710 successful requests: init1+audit1708+finish1;1711 stdout lines
including ready. Audit ordinals are2..1709. `counts.requestsReturned` means
durable completed reply records; runner separately counts actually received
replies. On failure, one `{status:'FAIL_G1A_REFERENCE',op,requestOrdinal,
counts,firstFailure,artifact}` is emitted if bounded output remains possible;
the server exits1 and performs no later request/math. EOF before finish is a
failure with the original durable prefix. In-flight transport may be UNKNOWN.

The init bank has2geometry certificates,10unique nonzero analytic samples at
80/120digits,<=80sin/cos evaluations with128fixed terms,<=24sqrt. The1708
observed-state audits include20initial+1688accepted states. Scalar Fraction
operations<=10M;0World/candidate/ODE/linear solves. Each reply carries actual
counters; caps are not substituted as observed counts. Bank/initial-state/
current-audit roots and serialization share the frozen8MiB reference bound;
evidence shares the parent's16MiB campaign limit. Full failure proof is kept;
success receipts stay compact. Parent owns actual execution and all physical
PASS/NO_GO classification.

The reference subcap for stored artifacts/replies is8MiB inside the shared
16MiB campaign evidence ceiling. Successful per-audit proof stores each new
L/E/q-norm residual/bound once and exact max linear/COM residuals; full initial
metrics are pinned once. Counts live in the reply, not repeated in each proof.
Full failed check data remains separate. This avoids duplicating all18 verbose
check definitions/initial values per frame. Source/native raw states and reply
receipts remain runner-owned; its full combined evidence check stays required.

The bank includes actual80/120 normalization Context settings/flags and a
symbolic t0 initial-condition certificate, with0 extra analytic/trig samples.
Registered owners include active raw line/packet/reply/response, input clones,
normalization endpoints/contexts, all bank/initial/current physical data.
Current analytic evaluation precharges an additional1MiB: at most2048 Decimal
endpoints at384B (rounded values<=120digits; largest exact Taylor conversion
<=510digits),1024 small containers/references and131072B scalar/frame margin.
This is inside8MiB, in addition to the baseline2MiB traversal/scalar envelope,
not an assertion that the old baseline reserve covers a different workload.
Incoming JSON decode precharges a lexical census before parsing: at most8192
nodes/depth32,512B per token+4B per string/input byte+131072B. The existing
live owners and this allocation envelope must fit8MiB before decoding. Old
active line/packet/reply/response owners are released before the next read. Peaks are
derived owned-data bounds, not measured process heap/RSS.

Finish summary counts are explicitly the snapshot before committing the finish
response; its durable reply packet has requestsReturned1710. Runner's received
reply count is separate. Remaining adoption limits include wider near-unit
zero-spin input q, x/y symmetry ranges and triaxial behavior; exact-unit G1a
literals do not qualify those broader current-admission ranges.
