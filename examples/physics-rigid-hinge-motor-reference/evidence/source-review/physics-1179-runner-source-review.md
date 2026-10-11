# #1179 runner/observer source review

SOURCE ONLY. Read ROOT runner.mjs/observer.mjs/bundle.mjs plus the selected consumer/control interfaces. No imports, AST/parser, reference, model, World, build, types or runtime checks. This is a source review, not an executed gate.

## Found defects — ROOT corrected before freeze

1. Earlier runner finalized the case writer before native controls and did not pass writeRecord to runControls. Completed controls could be lost if a later guard failed, and the promised zero-raw control records were not in the main flow. Current runner30-34 retains graph-flow through native controls and every independent protocol request/reply; writes them before the next request; finalizes only after the phases and reference close. It separately saves cases-complete before guards. The source physical-case count remains separate from the full flow record count.

2. Earlier runner could overwrite the primary graph error if saving a secondary reference-close failure failed. Current runner35 catches secondary-persistence errors and only logs safe metadata. It then preserves the original graphFailure. Outer catch39 similarly preserves its received primary error if emergency/failure persistence fails. Both emergency creation sites now use wx, as ROOT reported and selected before freeze.

## Current source result

No remaining concrete blocking defect found in the reviewed runner/observer path.

### Authentication and start order

- runner19-23 validates the source freeze, Node version, measured source, actual consumer HEAD, source-freeze hash, exact nonempty CAD+Physics emitted file set, every emitted size/hash, build/types receipt hashes, exit0 and source/head fields before importing a native bundle or starting the reference process.
- runner24 checks all6448 provider BEFORE bytes, its pinned hash and exact provider-native Git blob; slices exactly208B at offset0 and checks its SHA. Both consumeCases and runControls receive that buffer and also check fixed genuine bytes/hash.
- runner26 imports the generated bundle and starts reference only after those guards. First native operation is consumeCases with genuine first. Native guard/helper calls and reference protocol controls come after the named prefix.

### First prefix and parity

- The source consumer uses limit14 and stops its first mismatched physical case. Later graph limits use source observations.length, including the failed last record. No source failed-future state becomes an input; fixtures remain independently authored original inputs.
- Each graph bundles/imports a distinct path. Source-repeat bundle bytes are compared. The compiled plugin resolves original Physics helpers to actual dist JS and asserts Physics src0/dist>0; private provider/new code remain source as selected.
- Case data parity compares the complete result without graph/evidence metadata. Named records retain raw body/command hex plus the non-body negative-zero paths, so JSON zero normalization is not silently used as the named signed-zero authority.
- Main flow writer compares actual complete JSON+LF and actual raw bytes on every parity write, including zero-raw guard/protocol records. EOF and the four whole canonical metrics precede alias hardlinks. Writer is open until all selected flow phases finish; records and case counts are different units.

### Classification and counters

- stagedReportSemanticsGO depends only on all three actual named consumer GO values. Each consumer requires14 records,12 matched RETURN and2 matched expected CAP; valid independent frame/report/work/cap agreement is required. Native/control assertions do not manufacture that flag.
- Correct expected CAP means report semantics only, not accepted output or World step. An earlier parent numerical refusal keeps its actual code/null reached stages and fails mandatory disposition. Unresolved IPC/reference/schema is execution failure.
- reports carry named candidate/motor/projection counts; native controls carry separately scoped candidate/direct helper counts; protocols carry independent request receipts. +.9/-.9 are direct original motor helper calls with projection0. There is no old93 replay or hidden case15/16.

### Exceptions and import boundary

- observer serializes one pending request, rejects malformed/unsolicited output and nonzero process exit, and checks exit0 on close. Spawn occurs only when observer() is called; none occurs when its module is imported.
- Ordinary unknown received values are not JSON-coerced into fake known producer errors. Root describeThrown reads only safe own Error descriptors, and copied attempt never contains the thrown payload. The inherited typed-PhysicsError proxy bridge boundary remains unchanged.
- consumer/control module imports construct only authored data/function definitions and standard-library utilities. They do not call original parser/motor/projection/reference/World at import time. Root helper bridge exposes the selected original helpers; it does not run them.

## Evidence limits

The review confirms code paths, not actual build/type logs, file bytes, reference responses, gate passes or native GO. Those require ROOT's later frozen actual flow and byte audit. Runner verifies the pinned build/type receipt files and exit/head/source fields; raw stdout/stderr byte provenance remains the ROOT build/controller and final artifact audit responsibility unless separately checked by an extended receipt gate. Main stored budget is64MiB compressed bytes, fixed budget8MiB unique physical files, and emergency2MiB decoded record bytes; logical aliases are reported separately.
