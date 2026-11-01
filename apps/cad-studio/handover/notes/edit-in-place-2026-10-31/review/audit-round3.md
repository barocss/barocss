# Independent audit, round 3, targeted: roadmap 10 ⑧

**Verdict: ACCEPT.** Both round-2 findings are fixed and correctly wired.

## HIGH: a project open still running when Edit part is clicked — PASS

- `useProject.ts:124/144` counts the reads with `reading++`, inside try/finally. It covers the whole of `openPart`: the read itself, the log, the autosave and the link check.
- `startInPlace` (App.tsx:1392) refuses Edit part through `elsewhereOf({ projectOpening: project.opening() })`.
- **An open that finishes during a session:** `canOpen()` is asked after the read and its current-check (useProject.ts:132), before the part path and tag are set. App.tsx:447 returns false and shows a toast. The open is abandoned before the part path, tag, log or autosave change. A later Save or autosave still targets the assembly's file.
- The `onOpened`, `onLinked` and `openedImport` guards (App.tsx:439, 449, 1474) use `openAccepted`.

## MEDIUM: `make_version` in a session turn that ends after Finish — PASS

- `useStudioChat.ts:77-79` computes `moved` first. `back()` then receives only `versionsToMerge(moved, done.versions)`.
- The scenario: a turn starts in the session and ends after Finish, so `moved` is true. Nothing merges and nothing is applied.
- A turn that starts and ends inside the session passes `versions={undefined}`, so `back()` does nothing.
- A turn that starts on the assembly and ends in the session is dropped whole, including its log.

## Mutants (scratch copies, `mutate3.mjs`)

| Mutant | Result |
|---|---|
| `elsewhereOf` ignores opening | killed |
| `versionsToMerge` ignores moved | killed |
| unmutated | 0 failures |

## Follow-ups (not blocking)

- The call sites are wired correctly but no test covers them.
- A project *folder* open still in flight (`use`: reopen, picker or browser project) is not counted. When it lands, it clears the part path, so the next Save makes a new file and the existing-path check refuses an overwrite. Nothing is lost.
- From round 2: LOW items P6 and P8, and the "From pin.bcad" label.
