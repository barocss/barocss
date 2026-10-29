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
- **A file changed elsewhere.** When Save detects a different file version, it refuses the write as *file*
  **changed elsewhere**. Open it again, or save under another name.
- **A new document.** **New part**, opening a file, a template or a sample starts a document that isn't the project's
  yet. The card's versions clear, and Save writes it as a new file in the project; a name already taken is refused.

Within one open project session, overlapping writes to the same file wait their turn. Each checks its expected
file version after the previous write finishes, and keeps ownership until its result is read. A stale request
leaves the first successful bytes intact. Different file paths can progress independently. Coordination across
separate project sessions, browser tabs or external programs remains outside this qualified overlap protection.

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

## Placed parts linked to project files

- **Insert**, beside a document in the card's list, places that document in the one you have open. The placed part's
  panel then says `From ./`*file*: it is linked to that file.
- **Newer files.** When the assembly is opened from the project, or on **Check** beside "*N* placed parts linked to
  project files", each linked file is read. If one was saved with changes since, a toast says **Newer files for** *N*
  placed parts, and the part's panel shows **Revision waiting**: accept the new revision, which every copy of the part
  takes where it stands, or keep the one it has. Nothing changes until you accept.
- **A missing file** the project no longer has is named: "Not in the project any more: …".
- **It still opens anywhere.** The assembly keeps its own copy of each placed part, so its `.bcad` opens on its own.

## The agent's versions

The agent keeps, compares and merges versions too, through actions on its `history` tool. They work on the open
project's log, the same one the card shows. With no project open, or a document not in the project yet, the log is kept
for the session.

| Action | What it does |
|---|---|
| `history.version` | `name?`, `note?`: keeps the part as a version on the current branch. Refused when nothing changed since the branch's last version, or the name is taken |
| `history.versions` | `branch?`: the branches, the current one, and a branch's versions, newest first |
| `history.restore_version` | `id`: the part back as that version kept it (an id or a name) |
| `history.compare` | `from?`, `to?`: what changed, as the card's list gives it. Each is a version, `latest` or `current`; by default from `latest` to `current` |
| `history.branch` | `name`, `from?`: a branch made at a version, by default the current branch's last. It isn't switched to |
| `history.switch` | `branch`, `discard?`: the branch's last version becomes the part. Refused while there are changes not made into a version, unless `discard: true` drops them |
| `history.merge` | `from`, `resolve?`: another branch's work brought in, as **Merge into** does. The part must be its branch's last version first |

- **Merge conflicts.** They come back as data, and nothing is merged. Each has its code, where it is, and both sides:
  a short value whole, a long one as its kind and length. The agent merges again with `resolve`, `"ours"` (the current
  branch) or `"theirs"` for each.
- **Who made it.** A version the agent makes is recorded in the folder's log as made by `agent`.
- **What a turn carries.** A chat turn takes the whole list of versions and branches, but only the documents its
  actions need: each branch's latest version, and the version each other branch shares with the current one. A version
  the agent asks for whose document didn't come is refused with `VERSION_NOT_LOADED`, and that document comes with the
  next turn.
- **When the turn comes back.** Its versions are added to the project, and the ones you made meanwhile are kept. If you
  and the agent both moved a branch, yours stays the branch's latest and a message says so; the agent's versions stay
  in the list.
- **Edits made during the turn.** A restore, a switch or a merge brings back a whole earlier state, so it isn't
  replayed onto a part you edited while the agent worked. It waits in a proposal instead, as
  [other colliding changes](/agent/proposals#when-the-part-changed-meanwhile) do.

## Refusals

A project refuses rather than guess, each refusal with its code:

- versions, branches and merges: `VERSION_…`, `BRANCH_…` and `MERGE_…`, with `VERSION_NOT_LOADED` for a version whose
  document didn't come with the agent's turn;
- conflicts: `FEATURE_EDITED_BOTH`, `FEATURE_DELETED_EDITED`, `MERGE_DANGLING`, `ID_CLASH` and `ITEM_DELETED_EDITED`;
- storage: `STORAGE_PATH`, `STORAGE_CHANGED` (the file changed elsewhere), `STORAGE_DENIED`, `STORAGE_MISSING` and
  `STORAGE_UNAVAILABLE`.

See [Refusal codes](/reference/refusals).

## Not yet

- Renaming a document doesn't update the links to it.
- Sharing, comments and several people editing one project.
