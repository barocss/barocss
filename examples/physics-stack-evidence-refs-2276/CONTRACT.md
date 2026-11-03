# Fixed ALIGNED2 duplicate-byte and footprint measurement

Status: SOURCE_READY_AUTHOR_NOT_RUN. Root alone runs ONE data-only inspection. No new evidence codec, framework, compressor, physics producer, Solver/World/reference import, compiler or test exists here. Author imports/data/decompression/compression/math/test/compiler calls are zero. All ended gzip/q1/q2 sources, outputs and first failures remain unchanged. High's production arithmetic work is outside this scope.

Run with the pinned Node22.19 executable:

`node inspect-record.mjs FRESH_OUT REVIEWED_PINS_SHA`

Only captured ALIGNED:2 is admitted. Source authority is the existing pipeline PINS record and all eight request/reply files for contacts, world, step-ledger and quality. The complete original record JSON is483481 bytes, with8842 numeric leaves/70736 sidecar bytes,3744 raw body bytes and1536 raw point bytes. All files and the original input manifest are SHA/byte pinned before and after inspection. Two built-in bounded gunzip reads unpack the immutable record/body authority; no new compression or numerical evaluation occurs. Requests/replies are parsed only by NativeJSON.

## Fixed mapping bank

Target record paths map to these RPC views; there is no generic subtree, substring or field-selection search:

| Target | Source |
|---|---|
| contactGeometry | contacts reply root |
| positionCheck | world reply root |
| ledgerCheck | step-ledger reply root |
| quality | quality reply root |
| prepared.diagnostics.positionAttempt.problem | world request.problem |
| prepared.diagnostics.positionAttempt.rowSources | world request.rowSelections |
| prepared.diagnostics.positionAttempt.result | world request.result |
| prepared.diagnostics.positionAttempt.preBodies | world request.preBodies |
| prepared.diagnostics.positionAttempt.hypotheticalBodies | world request.hypBodies |
| prepared.diagnostics.beforeBodies | step-ledger request.ledger.beforeBodies |
| prepared.diagnostics.freeBodies | step-ledger request.ledger.freeBodies |
| prepared.diagnostics.velocityBodies | step-ledger request.ledger.velocityBodies |
| prepared.candidateBodies | step-ledger request.ledger.finalBodies |
| prepared.diagnostics.pointLedger | step-ledger request.ledger.points |
| before.bodies | step-ledger request.ledger.beforeBodies |
| after | quality request.request.state |

The inspector requires original whole record bytes to equal `JSON.stringify(parsedRecord)+'\n'`. A NativeJSON size walk counts UTF8 scalar/key encodings, brackets, commas and colons to locate exact structural byte spans in that original record. Each fixed source view's canonical NativeJSON bytes MUST equal its actual target span, including key order and every character. Missing path, mismatch or unexpected overlap is a measurement refusal, not permission to modify the bank.

For each row report target offsets/length/SHA, source identity/path and exact equality. Also search that one actual raw RPC Buffer for the complete projection bytes and report its first exact occurrence or absence. That occurrence is an exact byte-copy location, not a claim that the Python raw wire uses NativeJSON's structural whitespace/number spelling. Canonical projection and raw wire are explicitly different alternatives. Original raw RPC bytes are never changed, regenerated, dropped or replaced.

## Required counts, without a codec

Report the disjoint target-byte union once; do not sum nested duplicates. Report the subset available as exact contiguous raw-wire spans separately from canonical-projection-only bytes. Count unique COMPLETE projection buffers by SHA plus actual byte equality. This is conservative whole-buffer deduplication, not an optimal substring dictionary. Report largest projection and raw wire.

For a provisional representation cost ONLY, freeze64 bytes per reference,8 bytes per literal run and a16-byte program header. Hypothetical record JSON cost is original JSON minus disjoint duplicated target bytes plus that overhead. This is not an implemented format, compressed size, adopted contract or measured speed. ALL numeric-word sidecars and raw body/point fields remain literal and unchanged in this hypothetical accounting. The captured JSON has already lost native negative-zero signs; this analysis cannot qualify live word transport.

Compare two retention alternatives, without implementing either:

1. Retain all eight raw wire buffers for the current credited step.
2. Retain only the selected unique canonical projection buffers, deriving them from the already persisted raw RPCs and discarding the raw input buffer after acknowledgement.

Both alternatives preserve all raw RPCs first in the archive. Evaluate a GLOBAL2MiB dictionary bound shared across three credits, not2MiB per step. Report one captured step and three identical captured copies for each alternative. This is a local stress/count, not an upper bound for three different trajectory steps or a whole1200 population. Canonical views are produced one at a time; no double retention is silently assumed free.

Keep the original16MiB explicit combined-scratch check. Let J be record JSON bytes, W=8 times numeric leaves, R combined body/point bytes, Q=8MiB pending allowance. Existing serialization model B=Q+4J+2W+2R+16+1MiB is unchanged. Add each alternative's three-captured-copy dictionary D, conservative projection staging3×largest projection and raw-input parse staging3×largest raw wire. Report B+D+those staging terms against16MiB. The staging deliberately overcounts where an implementation might reuse buffers; no cap rises. The inspector itself preflights a separate bound for its input/canonical/projection byte buffers before constructing them. Native parsed graphs, GC timing and total JS/native heap/RSS remain NOT_QUALIFIED.

The output is one bounded measurement.json,<=128KiB, with source identity, every fixed mapping, union/footprint/overhead counts and refusal limits. Internal data-only deadline is170s; Root supplies its normal180s command guard. No measurements are generated by this author.

This inspection can establish actual duplicate bytes and necessary local footprint compatibility. It CANNOT establish the80MiB compressed screen or forecast whole-trajectory storage/time. It must report `compressed80MiBScreen:NOT_DETERMINED_BY_BYTE_COUNTS`. Only after these measured bytes are reviewed may Root authorize ONE bounded reference-codec candidate and its later fixed full-archive replay. No codec GO, q3/window tuning, cap raise, public API or full1200 permission follows from this source task.
