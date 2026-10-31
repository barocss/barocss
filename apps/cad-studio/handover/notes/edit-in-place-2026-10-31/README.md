# D391 — Row 10 ⑧: edit a part in place inside an assembly (v1)

Tier: **full**: three audit rounds with mutation, and one actual run. The user asked for this on 2026-10-31. [Qualification](qualification.json).

## What it does

**Editing the part**
- **Edit part** in a top-level instance's panel opens the part's definition right in the assembly.
- Every existing tool works on it, including the History bar and Undo.
- The other parts stay visible see-through around it, where they are relative to it.

**Finishing or cancelling**
- A banner reads "Editing Cube 2 · shared by 2", with Finish and Cancel.
- **Finish** puts the edit into every instance sharing the part, at the next revision, as one assembly Undo step. Looks and joints are kept.
- **Cancel** asks before discarding changes.

**Blocked while editing**
- Saving, opening and other assembly-level actions are blocked, and so is autosave.
- Nothing else can slip in during the session: a chat turn, an import or a project file opening is refused or dropped.

## Audits ([1](review/audit-round1.md), [2](review/audit-round2.md), [3](review/audit-round3.md))

**Round 1** found two high-severity defects:
- the context was placed twice;
- another document could replace the session's and be committed.

It also found three medium and some low defects. All were fixed.

**Round 2** found one high defect: a project open in flight could write the assembly over another file. It also found one medium defect: agent versions could land in the assembly's history. Both were fixed, and five mutants were killed.

**Round 3**, targeted, returned ACCEPT.

## Verification

- **Tests:** model 2358/2358; Studio 607/607. The docs checks pass, including a fix for the missing document-field names left from D383.
- **Actual [run04](run04/receipt.json):**
  - Inside the session the width went from 20 to 30, and ⌘S was refused.
  - After Finish, both cubes were at Rev B and 30 wide.
  - Undo and Redo worked, and Cancel → Discard left nothing changed.

## Follow-ups

- The guard call sites are not covered by tests.
- Nested parts cannot be edited in place yet.
- The context is a snapshot taken at the start.
- In-context references are not supported.
