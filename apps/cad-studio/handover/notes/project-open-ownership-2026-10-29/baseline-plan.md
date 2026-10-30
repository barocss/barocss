# D326 / A05 project Open ownership baseline plan

Status: **prepared, NOT_RUN**. D325 source/test freeze remains in force. Only the new D326 test and this evidence directory were written. A06 worker-sender disposal stays queued.

## Bound source and driver

`baseline-source-manifest.json` records current HEAD at preparation, exact bytes and SHA256. `baseline-source/` preserves the exact App, useProject, project codec, handle adapter, access, linked-revision sources and new test driver before repair. No checksum is an acceptance oracle. The copied driver is `project-open-ownership.test.ts` and is not changed when a later regression test expands.

The real test is `apps/cad-studio/test/project-open-ownership.test.ts`. It reuses D322's React server.edge hook capture and structural DirHandle pattern through the actual handleStore/project codec. No new test seam, package dependency, API or production change was added. Hook callback observations are not App rendering, Undo/dirty/recovery or native filesystem proof.

## Proposed first baseline execution

After D325 push and explicit root approval, acquire the serial heavy gate under Node22.19.0. From apps/cad-studio run only:

`node scripts/test.mjs project-open-ownership`

Capture unchanged raw stdout/stderr as `baseline.log`, actual process exit and source/driver hashes. No build, whole suite, browser, heap or native OPFS run is needed for this first hook baseline. No execution log exists yet.

Seven grouped cases are prepared:

1. Unchanged positive control: actual part document, version log and autosave offer all publish normally.
2. A readPart held → Close: old completion must return false, emit no replacement callback and retain no old log/offer.
3. A readPart held → New's existing detach path: retain the new callback fixture document and detached binding; subsequent autosave must not write to A.
4. A readPart held → B completes: A cannot replace B or claim current acceptance.
5. A versions read held → B completes: old log/autosave metadata cannot replace B's.
6. A autosave read held → B completes: old autosave offer cannot replace B's.
7. A checkLinked listing held → B completes: old linked revision offer cannot reach B's callback. Actual linkedRevisions and shared-definition inputs are used.

Each pause is in a real adapter await. Diagnostics record acceptance bool, callback path order and relevant current/log/offer/linked metadata before assertions. The driver races a hold-entered signal with early completion, so a fixture error is reported instead of silently waiting for a boundary never reached. Pause releases are in finally. Later-await tests preserve the callback state observed when B completes; they do not require an incidental early A callback timing.

The intended source-only failure is useProject.openPart's lack of an Open request/session check after readPart/readVersions/readAutosave/checkLinked. D322's invalidateSaves affects Save receipts only. No actual failure is claimed before this baseline executes.

## Scope after baseline

Root will confirm failures and the bounded repair before production edits. Required actual product acceptance remains separate: latest document/history/name/dirty/recovery, project path/tag/log/offer and stale error behavior after Open B, New, Close/store switch. This hook baseline observes callbacks and live action state; it cannot certify all those App/UI facts.

App's direct .bcad File Open and verifyOpened await ownership remain part of A05 investigation and are not covered by this initial project-hook driver. Non-bcad formats and general Open redesign are not automatic additions. Existing D322 Save receipts and D318/D323 positive file/project flows stay qualified only in their original scopes.
