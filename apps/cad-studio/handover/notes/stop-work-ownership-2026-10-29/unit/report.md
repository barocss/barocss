# D321 Stop ownership — unit evidence (2026-10-29)

This worker owns only `test/stop-work-ownership.test.ts` and this unit evidence directory. The High worker owns
the private ownership helper and App integration. No production code was changed by this worker.

## Result

Node22.19.0, existing heavy gate, one scoped run:

- **17 total /17 pass /0 fail /0 skip**, exit0: 13 new ownership tests plus4 existing O9 lane tests.
- Changed unit-file lint: exit0.
- Owned-file `git diff --check`: pass.
- First test/lint failure: none. Fixture repair or overlapping rerun: none.
- Gate released through the owning shell's EXIT trap.

Original logs: `focused.log`, `lint.log`. Empty lint output is preserved; the shell captured exit0. The tested helper
and unit file hashes are in `source.sha256`. This helper is new, so there is no claim that this same unit file ran
against a pre-existing helper implementation. The separate original Stop/Grid execution and its exact controlled
Worker schedule remain in `notes/stop-operation-intake-2026-10-29/`; this worker did not rerun that browser probe.

## Tested decision contracts

The tests use immutable generic documents and evaluated-input identities, independently authored history entries,
and separate caller-owned history/dirty/recovery values. They check results of the private decision functions:

- A pending reservation/run refuses independent document acceptance; an ordinary work token grants no exception.
- Stop chooses only its originating exact history entry, document, input identity and rollback marker. It never pops
  the caller's history itself. No owner plus older history yields no target.
- Initial, variant and unaccepted parameter runs cannot borrow an unrelated accepted edit. Candidate/view-only
  runs also cannot inherit a pending accepted model reservation.
- The current opaque candidate token permits its private accept closure even though that closure captured the
  scope before the evaluation effect. Once acceptance replaces the run with a reservation, that token is unusable.
- Same-content document/input ABA and lookalike or unrelated history entries grant no rollback authority.
- An older completion/finally cannot clear a newer run or Render reservation. New Open invalidates old ownership;
  redo establishes a fresh token/entry even if it reuses the old document object.
- Two consecutive Render-only reservations settle without leaving a latch for later unrelated work. Changed
  evaluated input retains the reservation until the corresponding computation begins.
- A simulated pre-accept exception/finally releases the reservation against the actual unchanged document.
- Matching terminal completion clears ordinary/candidate ownership and allows the next edit, including the helper
  lifetime needed by hand-off/no-new-request paths.

The existing O9 lane tests separately protect stale reply exclusion, lane independence, cancel and subsequent requests.
The board/candidate CLI suite was not selected: it exercises a separate candidate-board workflow rather than this
App parameter/Stop acceptance boundary.

## Proof boundary and remaining work

These are **private helper and lane tests**. Caller document/history/dirty/recovery non-mutation is proved only at
that decision boundary. The helper does not receive or execute App's full Undo/Redo arrays, recovery storage callbacks,
Render reservation ref, parameter acceptance ref, Worker dispatch or React effect cleanup. Therefore these results
do not prove that every App entry point calls the gate or consumes its permission correctly.

Actual Box/Render/Stop, parameter-candidate acceptance, no-request hand-off, reservation cleanup after real callback
failure, Undo/Redo, dirty/recovery and new Open need the High worker's source/integration review and the consumer's
actual UI evidence. Studio types and production lint are assigned to the High worker after App source stabilization
and were not repeated here. Whole Studio/Model suites, builds, native/browser execution, public API changes,
dependencies, commit and push were NOT_RUN by this worker.

Commands from `apps/cad-studio`, with Node22.19.0 prepended to PATH and the existing gate held:

```sh
node scripts/test.mjs stop-work-ownership o9-lanes
node ../../node_modules/eslint/bin/eslint.js test/stop-work-ownership.test.ts
```
