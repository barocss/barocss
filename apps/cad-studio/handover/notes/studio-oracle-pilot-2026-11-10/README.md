---
work_id: D551
artifact_type: bounded-studio-validation-pilot
status: adopted-bounded-pilot
last_updated: 2026-11-10
---

# D551 — Shared Studio oracle invocation pilot

P4, rows 22 and 33, with a row 11 drawing consumer. This pilot follows the owner's November 10 intake and [D550](../section-detail-auto-dimensions-2026-11-05/README.md). It selects one contract from [#2396](https://github.com/barocss/barocss/issues/2396). The shared helper must admit an explicit exact Python result status while retaining the default PASS and preserving original input, stdout, stderr and subprocess exit before interpretation.

## Frozen scope

Two desktop consumers use the existing `flow-helper.mjs` and unchanged scenario oracles. The first is the six-group D550 Auto-dimension flow with its custom status. The second is the existing Drawing units box flow with its default PASS status. Use the identical second-driver offline setup for its before and after runs. Freeze all worktree writers during each run and cleanup. Reuse the D550 control with its original pins and recorded native bounds. Check the changed consumer joins against current UI and files.

Only the shared private oracle helper, its focused contract test and at most these two drivers are in scope. Verify default and custom statuses, exact status mismatch, malformed output, and nonzero exit with apparently successful output. Check the raw artifacts and exit record on failure. Neither the scenario calculations nor their bounds change. Other #2396 contracts and all product HOLDs retain their own gates.

## Measurement

Use the D550 first actual run as the first before sample. Record the second before sample with the existing oracle runner and the local offline setup. For the two after samples, run the same user actions on the same inputs and compare oracle counts, output scope, source custody and owned cleanup. Separate wall time from the time spent preparing, waiting for the gate, validating, cleaning up and repairing failures. Report unavailable comparisons as NOT_MEASURED. The two runs per consumer cannot establish a general speedup. Decide adopt, revise or stop for this selected helper contract.

## Result

**Adopt the shared oracle invocation for these consumers.** One private helper accepts the existing default PASS and a declared exact status. It saves the exact stdin, stdout, stderr and exit record before decoding or asserting a result. The D550 browser delegates its previously copied invocation to this helper. The default Drawing units driver stays byte-identical between its two runs. Its test-local route blocks external HTTP and handles font requests locally before navigation.

Four syntax checks, all six focused contract tests and the final Model type check pass under Node 22.19.0. The focused cases cover default and explicit success, wrong and missing statuses, malformed JSON, and nonzero exit with a PASS payload. Each refusal retains its original subprocess artifacts.

Root ran both after flows under `gate.sh`. Auto-dimension passes six actions and six independent joins with the original D550 numerical control and 797 checked pins. Drawing units passes its independent 30 × 12 × 6 mm box SVG checks with 294 pins and one join. Both match their before snapshot, output and independent join counts. Their 7 original native and SVG outputs match the before bytes. Only the expected helper and custom driver pins differ. The comparison verifies the after exit and artifact hashes for each subprocess. Page errors, console errors and source changes are zero. Both contexts, Chrome and Vite close in each run. Owned PIDs are absent. Root viewed the three Drawing units before images and four selected after images across the two flows.

| Consumer | Before wall time | After wall time | Samples |
| --- | ---: | ---: | --- |
| Auto-dimension with explicit status | 22.77 s | 15.25 s | One before and one after |
| Drawing units with default PASS | 14.20 s | 12.78 s | One before and one after |

Wall time includes each launched driver and excludes gate wait. The first after queue attempt expired after 61 s with load 75.93 and exit 75. It launched neither flow. The second attempt waited 121 s and admitted the two runs in order at load 38.03. Each launched flow passed on its first attempt. The Auto-dimension resource close callbacks total 1.707 s before and 1.611 s after. Full cleanup time for Drawing units and comparable preparation, verification and active authoring or rework times are NOT_MEASURED. These samples do not isolate the helper's effect on runtime or establish a speedup.

The shared-helper contract improves evidence retention and removes one copied invocation. The runtime change is confined to private validation code. #2396 remains open for the remaining capsule, lifecycle and continuation acceptance. [Qualification](qualification.json).

- **PASS** — focused helper cases 6/6, final syntax and Model types, both actual consumers 2/2, seven independent joins and seven exact output comparisons.
- **FAIL** — first gate admission only. Both Studio launches were NOT_RUN for that queue attempt. No product, focused or launched Studio failure was observed.
- **NOT_RUN** — other #2396 contracts, full kernel, mobile, paid AI and unrelated workflow scope. Whole CAD remains NOT_MEASURED.

Next is D552, a bounded current Studio reproduction of [#2310](https://github.com/barocss/barocss/issues/2310) under D520 P0. Test whether a body copied from A can incorrectly duplicate B's same local key after Open. Preserve the original outcome before considering a correction.
