---
work_id: physics-world-p5-2276
artifact_type: private-stage-implementation-proof-boundary
status: AUTHOR_ONLY_RUNTIME_NOT_RUN
owner_role: p5a-kernel-implementation
source_request: implement frozen private stages without public cutover
last_updated: 2026-11-02
---

The three new production modules are private candidate stages, not full P5
profile admission. initialize* assumes trusted, already-admitted inputs. Current
private checks are not proof of complete public-schema/global-ID/material/
filter/transform/topology admission. In particular cloth counts/ranges alone
permit other rest data/topology/masses. P5b must validate the exact selected
cloth population and complete schema/roles before World runtime allocation.
No old production file, public export, World/recorder or frozen receipt changed.

The harness scope is exactly four frozen fixtures, two captured nominal steps
and three failure/recovery pairs per fixture. It consumes actual original
FLUID_SMOOTHING_RADIUS_M per clarification01, not literal0.09, and the native
static-input receipt/results plus clarification02 before constructing models.
It performs no new CAD call. Existing RecordedState remains unchanged.

Parent execution freeze is JSON with `files:{repoRelativePath:{bytes,sha256}}`;
include all new modules/helpers/runner, implementation contract/recipes/freeze,
clarification01/02, static-input-results and its actual receipt, baseline
providers/receipts, installed TypeScript/esbuild JS/package/binary inputs and
old original providers. The CLI receives that file's externally frozen SHA256.
Missing pins fail before provider imports/model construction. Child repeats
full inherited baseline and execution-pin authentication before/after trials.

NOT_RUN command after parent freeze, explicit authorization and heavy gate:
`node kernel-run.mjs --run-id FRESH --graph source --freeze ABSOLUTE_PATH --freeze-sha256 HEX --authorize-kernel`
A native invocation must be separate, fresh and authorized after source PASS.
No automatic second graph or retry. The outer child guard is copied into this
new file from the proven baseline guard; it requires actual close, both pipe
EOFs and owned group absence. Frozen baseline files were only read, never edited.

Progress persists logical prepare/init/kernel/helper calls and complete counters
at normal return or caught first failure. Dense leaf counters (175393 cloth
projectDistance entries) stay in memory during their inner loop, then persist
at the next logical callback. A killed process therefore has a last durable
lower-bound leaf count, explicitly not invented completion. No fs write per
projection is used. Actual inner counters are fully compared on normal completion.
No extra numerical trial is added to measure counters or create controls.

The native helper compiles with the installed tsc and a fresh evidence outDir,
then instruments only the owned emitted copies. It never runs build:library or
generate-provider. Source uses a single private stage/helper bundle. Both graphs
reject World/CAD/recorder imports in the actual loaded closure. Native may contain
unused old emitted files because tsc compiles the package; they are not imported.
That distinction is recorded in its graph metadata.

Normal authored writes20MiB + native emission32MiB + wrapper logs4MiB total
56MiB, leaving8MiB within64MiB for first-failure data. Actual files are checked
before final success. Compile output is bounded1MiB, source bundle8MiB, native
emission32MiB and wrapper logs4MiB. Actual aggregate storage must also be checked
before success. No recording support, 240/720/3600-step stability, public API
admission, active static-box response, browser/UI or physical-accuracy PASS.

All scalar fingerprints use recursive binary64 LE encoding, including lambda
and diagnostic signed zero; typed arrays use raw bytes. No extra production
canonicalEncode calls are used for fingerprints. Captured diagnostic JSON may
have erased historical negative zero; equality to its parsed values does not
prove historical diagnostic binary equality. Raw typed-array receipt bytes
remain the nominal numerical authority, with any discrepancy stopping the run.

Author checks: gated source-text overlay01 failed on emitted loop whitespace;
its immutable FAIL receipt is retained. Authorized authoring repair accepted
whitespace, and fresh gated overlay02 PASS parsed original source/emitted math
text without evaluating it. Final own-harness format/syntax check used the
existing heavy gate and passed for all six new mjs files. The earlier private
stage tsc --noEmit check exited0 without acquiring the gate; it is explicitly
reported as a process-policy miss and was not rerun for acknowledgement.
