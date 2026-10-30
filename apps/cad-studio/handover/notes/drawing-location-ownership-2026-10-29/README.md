# Independent drawing location ownership — D331, 2026-10-29

The existing DA-DUP-1/#2243 defect removed an independent hole location when its displayed value
matched a location on another hole. Shared stock and equal coordinates supplied no authored relation.
The repair keeps both endpoints and actual hole owners in duplicate grouping, manual suppression,
automatic generation and missing-location diagnostics. Counted pitch direction, explicit patterns,
PCD, opposite rims and structurally associated counterbores retain their separate contracts.

Runtime source is committed at `ccbdf285e357f53a9bb070f119d6e625e6cd3070`, based on `2084eeb99`.
Driver setup observations and the guard diagnostic follow up in `5907c3931cce980f9beb99bfc857ede6654ee2e5`.
Sol High implemented and independently reviewed the dependency logic. Sol Medium wired the actual
Studio consumers and prepared browser drivers; root integrated and ran boundary/product checks.

## Evidence and retained failures

See [qualification.json](qualification.json) for counts and limits. Final related Model drawing tests
248/248, focused63/63 (overlap), Studio chat/section28/28, both types, Studio build and scoped lint pass.
API review adopts exactly four new wildcard exposures and three optional owner-contract additions;
no unrelated inventory delta. SCOPED_PASS covers six inventory rules, not whole API semantics.
Agent-tool/refusal generated checks pass. New schema, runtime dependencies and numerical tolerances
were not introduced. Kernel conformance changes only expected drawing outputs; authored inputs stay.

The valid original-source baseline is2PASS/6FAIL. Initial manual fixtures had invalid auto:false;
that first1PASS/3FAIL result and type errors remain separate. Two later review findings (counted
same-owner reversal and equal rendered counterbore text) have their own synthetic inputs/source hashes,
red tests, correction and bounded final review. Do not convert earlier failures into historical PASS.

An initial missing selected file caused accidental raw Node discovery:365 entries,2PASS and363 import
resolution failures. That is an invalid harness expansion, not a full Model run. The runner now exits
before bundling when no file matches. Its expected unmatched-name exit1 is preserved. Studio's separate
wrong `drawing` filter also matched no file and exited1; the final chat/section28 result is distinct.
Full setup context is in [setup-limits.md](setup-limits.md).

## Actual Studio scope

The new browser driver passes two profiles in one serial invocation: original captured L-bracket
Open/Fix all/Save/fresh Open, d9 removal/missing warning/Undo/Redo/fresh file/Auto repair; then a fresh
context with four independently authored grid holes and eight target-owned positions (twelve total
dimensions). Ten state/PNG captures are not ten test cases. Actual public renderer is WebGPU. No page
or console errors, no served-file change event; all owned contexts/browser/server closed. UI mutations
use public controls; development hooks only observe actual product state. The model15→17 edit is
covered through the public Model dispatcher, not claimed as a Studio edit in this browser driver.

The first existing R14 batch has one selected PASS (PCD), two selected FAIL (old History text waits),
and a separate starter PASS. Original timeout output/screenshots remain. Only those two failed flows
were selected for retake after driver observation corrections. First retake still failed its ambiguous
Selection panel lookup (two selected FAIL plus starter); final retake passes both plus starter.
Successful PCD is reused. Combined qualified scope is two new profiles and three distinct existing
cases, with starter reported separately. Original drawing assertions are preserved. These counts
must not be summarized as a single whole-browser run.

The grid adds four necessary positions; independent tapped-hole X20 adds one position in hole-row.
Grid locations have distinct placement rows and no observed placement issues. Its conservative
reserve report says top below. Some snapshots retain transient toasts over the sheet: this is no
clean whole-screen or manufacturing acceptance. Existing UI notification work remains separate.

## Boundaries

Source profiles/capsules and watches are provenance evidence, not product checksum tests, and cover
only the listed modules and inputs, not the complete served dependency graph. See each run's before/
after receipt and the planned driver-only observation change. Full assembly/section/pattern matrices,
independent manufacturing/numerical accuracy, PDF/external reader, full package/browser suites,
remote CI and release are not qualified. Instance owner selection is checked with targeted controls;
its placedDoc reconstruction cost has no performance/heap acceptance. No PR or release is created.

Post-note documentation check is recorded in qualification.json. No full suite was repeated for
the driver/guard observation-only followup; its positive selected13 and negative no-match exit1
verify both runner paths. Final scoped lint has zero errors/warnings; original lint warning is retained.
