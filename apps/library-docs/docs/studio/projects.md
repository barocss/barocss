# Projects and versions

A project is a folder that holds your parts and their history. Inside it you can keep versions of a part, compare
them, go back to one, and work on branches that merge back together. Everything stays in the folder: nothing is sent
anywhere.

## Opening a project

**Project & versions**, the clock button after **Save** in the top bar, opens the project card in the right dock.

- **Open folder…** picks a folder on your disk, in browsers that have a folder picker (Chrome, Edge). The browser asks
  for access. After a reload, **Reopen** *name* brings the last folder back; the browser may ask again.
- **Keep in this browser** makes a project, with a name, in the browser's own storage. It's for browsers without a
  folder picker (Firefox, Safari), and the project stays in that browser only.
- **Close** closes the project. Its files stay where they are.

## Working in a project

- **Save** writes *name*`.bcad` into the project instead of downloading it. Its tip says where.
- The card lists the project's documents, and **Open** opens one.
- **Work since the last save.** It's kept in the project a moment after each change, in place of the browser's
  recovery copy. When you open the document again, it is offered back: **Restore** or **Discard**.
- **A file changed elsewhere.** If the file changed since you opened it, in another window or another program, it
  isn't written over: Save is refused as *file* **changed elsewhere**. Open it again, or save under another name.
- **A new document.** **New part**, opening a file, a template or a sample starts a document that isn't the project's
  yet. The card's versions clear, and Save writes it as a new file in the project; a name already taken is refused.

## What the folder holds

| Path | What it is |
|---|---|
| *name*`.bcad` | Each document, exactly as Save writes it. It opens anywhere on its own |
| `.barocss/versions/`*name*`.bcad.json` | Its versions and branches |
| `.barocss/snapshots/`*key*`.bcad` | Each version's document, written once and never changed |
| `.barocss/autosave/`*name*`.bcad` | The work since the last save |

The folder can be copied or synced: a version's files never change once they're written.

## Versions

![The project card with two versions, and the first compared with the working document: the second box listed as added, and drawn in green in the viewport](/shots/studio/projects/compare.jpg)

- **Make version**, with an optional name, saves the document and keeps this state as a version.
- **The list.** It shows the current branch's versions, newest first, with **latest** marking the newest.
- **Restore** brings a version back as the working document. Nothing is deleted: making a version of it adds a new
  one on top.
- **Compare** shows what changed from that version to the working document:
  - as a list: features added, removed, edited (with the values that changed) or moved; parameters; configurations;
    mates; placed parts; and other settings by name;
  - in the viewport: the material added, in green, and removed, in red, with their volumes. Where that can't be worked
    out, as for mesh bodies, the changed faces are tinted instead.

  **Hide** stops comparing.

## Branches and merging

- **Branch**, with a name, makes a branch from the latest version, and the **Branch** list switches between branches.
  Switching opens that branch's latest version, and is refused while there are changes not made into a version.
- **Merge into** *current* brings another branch's work in:
  - when the current branch has nothing of its own since they parted, it simply moves to the other's latest version;
  - otherwise a merge version is made, "merged from *branch*".
- **What merges on its own.** Features, parameters, mates and placed parts changed on one side only.
- **Conflicts.** The same thing changed differently on both sides, or a feature one branch deleted while the other
  built on it. Each conflict shows both sides, with the value when it is short, such as `main (3)` and `thick (5)`.
  Choose one side for each, or for a deleted feature keep it or drop what uses it, then **Merge with these answers**.

![A merge with one conflict: the parameter T is 3 on main and 5 on the branch thick, each side offered](/shots/studio/projects/conflict.png)

## Refusals

A project refuses rather than guess, each refusal with its code:

- versions, branches and merges: `VERSION_…`, `BRANCH_…` and `MERGE_…`;
- conflicts: `FEATURE_EDITED_BOTH`, `FEATURE_DELETED_EDITED`, `MERGE_DANGLING`, `ID_CLASH` and `ITEM_DELETED_EDITED`;
- storage: `STORAGE_PATH`, `STORAGE_CHANGED` (the file changed elsewhere), `STORAGE_DENIED`, `STORAGE_MISSING` and
  `STORAGE_UNAVAILABLE`.

See [Refusal codes](/reference/refusals).

## Not yet

- **Placed parts by their path in a project:** next, and described here when it lands.
- Sharing, comments and several people editing one project.
- The agent has no version actions yet.
