# Decision records — data lane (DA-numbers)

The CG6 lane's records (owner, 2026-10-24: "CG6(파일 저장·버전)부터 로드맵 순서에 넣고 진행해줘", then "CG6(파일 저장·버전)을
맡을 새 줄 세션을 시작해줘"). The lane owns `packages/barocss-cad-model/src/versions/**` (the version model) and
`apps/cad-studio/src/storage/**` (the studio's storage). The .bcad container, App.tsx's open/save and the recovery
code stay with their lanes; each change there is named to the coordinator first. What was decided, why, what it binds.
Newest last. Branch `claude/brave-rhodes-492ca7` (worktree `brave-rhodes-492ca7`), flow port 52891; the coordinator
merges.

## DA-0 — the CG6 plan (2026-10-24)

- **What**: the design sent to the coordinator (full note in the session notes, `cg6-design.md`): V1 the version log →
  V2 compare → V3 merge (pure, cad-model) → S1 the storage interface, a project folder and autosave → S2 the Project and
  Versions panels → S3 branches and merge in the studio → S4 placed parts referenced by path in a project. Later in
  the lane: sharing and comments, then multi-user editing; the agent's v2 version actions (budget ≤ 25,000).
- **Why this order**: the model first, pure and checkable without a browser; the studio's files then build on it; UI
  last, each step a FLOW_ONLY step.
- **Binds**: no change to the .bcad container or the StudioDoc schema. Every file a project writes is a .bcad as Save
  writes it today. A placed part referenced by path uses the instance's existing `part.source` and the existing
  "Revision waiting / Accept" path (`offerRevision`).

## DA-1 — the version log: whole-document snapshots, content-made ids, branches as the only moving refs (2026-10-24)

- **What**: `src/versions/log.ts`, `src/versions/codes.ts`.
  - `VersionLog { format: 'barocss-versions', schema: 1, versions, branches, current, snapshots }`. A `Version` is
    `{ id, parents, snapshot, revision, branch, name?, note?, by?, at }`; a `Branch` is `{ name, head, from }`.
  - **Snapshots** are whole documents, kept by a content key: the 64-bit FNV-1a of `canonical(doc)` over **every**
    field. Not A7's `revisionOf`: that covers only the revision fields (no mates, drawing, render), so two different
    documents can share a revision. Equal documents share a snapshot. A key already holding another document is
    refused (`VERSION_KEY_COLLISION`), never written over. `revision` (A7) is kept beside it, so results tied to a
    revision (O9) can name their version.
  - **Ids** are made from what a version is: its parents, snapshot, branch, author and time (`idOf`). Not its name
    or note, which can change (`nameVersion`). Two copies of a project, or two people, never hand out the same id for
    different versions; the same version made twice is the same id. This is what multi-user editing needs later: only
    branch heads move, and those can be compare-and-set through the storage's tags (S1).
  - **Time and author are the caller's** (`at`, `by`): no function reads the clock.
  - **Restoring never rewinds**: `readVersion` gives the old document as the working one; making a version of it is a
    new version on the head, so nothing made is lost.
  - Verbs: `makeVersions`, `makeVersion`, `nameVersion`, `versionsOf` (a branch, newest first, by first parents),
    `readVersion`, `headOf`, `isUnsaved`, `ancestorsOf`, `findBase` (the nearest common ancestor; with several, the
    latest made), `makeBranch` (does not switch), `applyBranch` (switches; refused with unsaved work,
    `BRANCH_UNSAVED`, unless `discard`), and `checkVersions(value) → Problem[]` (shape, ids, parents earlier in the
    log, snapshot keys and revisions, branch heads), which never throws.
  - Codes: one union `VersionCode`, with its own `refusal` builder of engine/refusal.ts's shape (the refusal table
    reads it). Folding `VersionCode` into `CadModelCode` is one line in engine/refusal.ts, the outer lane's file:
    proposed, not done.
- **Why**: whole snapshots (not patches) keep each version readable alone, and make compare and merge plain functions
  of documents. Mesh arrays are blobs named by hash, so a snapshot repeats only the document's JSON.
- **Oracle**: a scripted session with the expected list written by hand; every version reads back canonical-equal to
  the document made into it; refusals by code; ids equal across two independent logs and different for another
  author; JSON round trip and three tamperings caught by `checkVersions`; branch histories by hand.
- **Note**: `keyOf` repeats util/revision.ts's FNV loop over any text (`revisionOf` inlines it over its own canonical
  JSON). Exporting the hash from util/revision.ts would remove the copy: proposed to the outer lane.

## DA-2 — compare in "id form" (2026-10-24)

- **What**: `src/versions/idForm.ts`, `src/versions/compare.ts`.
  - Nodes name earlier nodes by **index** (`BodyRef.node`, a sketch, a gear's mate: what chat/features' `renumber`
    rewrites). In id form each such index is replaced by the serial of the feature it names, so inserting a feature
    early moves no reference. `indexForm` turns an order of ids back.
  - `changesOf(a, b) → DocChanges`: features `added`, `removed`, `edited` (field paths, from → to, to depth 4, then the
    value whole) and `moved` (not in the longest common subsequence of the shared ids; a swap of two independent
    steps is a tie, either may be named); parameters and configurations by name; mates and placed parts by id; every
    other field by name; `same` when the canonical documents are equal.
  - A node's stored face signatures (`sigs`) are left out of the comparison: they follow the geometry of the faces it
    names, which the geometry diff shows.
  - The geometry's difference is the worker's `proposalDiff` (G12) and the GPU lane's overlay, unchanged (S2).
- **Oracle**: hand-written change lists for documents made by the existing commands (withNode, replaceRange,
  deleteFeature, moveFeature); a box inserted before a filleted box: exactly the two new features, though the fillet's
  index reference moved; the mirror (b → a) is a → b with added and removed swapped and from and to swapped; the id
  form's round trip equals `withIds(doc).nodes` on all 18 shipped robot samples and model fixtures.

## DA-3 — three-way merge with typed conflicts as data (2026-10-24)

- **What**: `src/versions/merge.ts`. `mergeDocs(base, ours, theirs, { resolve })` and `applyMerge(log, { from,
  working, at, by?, name?, note?, resolve? })`.
  - **Features** by id in id form: one side changed → that side; both the same → it; both differently →
    `FEATURE_EDITED_BOTH`; deleted on one side and changed on the other → `FEATURE_DELETED_EDITED`.
  - **Ids both sides handed out.** When any feature theirs added has an id ours also handed out, every feature theirs
    added (except one ours added identically) takes the next free serials, in theirs' order. Renaming uses chat/remap's
    `renameIds` over theirs' document, except the placed parts' own documents and mates' faces on placed parts.
  - **Order**: ours', with each feature only theirs has placed after the one before it in theirs' order. A reference
    that would then point forward is refused (`MERGE_ORDER`): merge those branches by hand.
  - **Dangling**: a kept feature naming one not kept (by index or by persistent name `n<k>.`) is `MERGE_DANGLING` on
    the missing one. Answered for the side that has it, it comes back with what it is built on; answered for the side
    that deleted it, what uses it is dropped (`dropped`).
  - **Records** per key (parameters `PARAMETER_BOTH`; configurations, body looks, waiting part revisions
    `FIELD_BOTH`); **lists** by id (mates, placed parts, underlays, proposals, history: `ITEM_EDITED_BOTH`,
    `ITEM_DELETED_EDITED`, and `ID_CLASH` when both added different items under one id; placed-part ids are referenced
    by mates and inputs, so they are not renamed); **every other field** whole (`FIELD_BOTH`); `outputs` recomputed
    (prefixDoc).
  - **Conflicts** are returned as data `{ code, where, message, base, ours, theirs }`; the caller merges again with a
    resolution per `where` (`ours` | `theirs`). Nothing is chosen for the person.
  - `applyMerge`: refused into itself (`MERGE_SAME`), with unsaved work (`BRANCH_UNSAVED`), when already merged
    (`MERGE_UP_TO_DATE`) or with no common version (`MERGE_NO_BASE`); a fast-forward when the current branch has
    nothing of its own since; otherwise a merge version whose parents are both heads, made even when the document is
    ours unchanged, so later merges see theirs as merged.
- **Oracle**: the kernel. Ours fillets box A; theirs makes box B taller and adds a box (with ids clashing with the
  fillet's). The merged document's evaluated volumes equal those of ours with theirs' edits made on it by the same
  commands, its ids are unique and in order, and `changesOf(ours, merged)` is exactly theirs' changes. One side
  unchanged gives the other byte for byte. Conflicts and resolutions by hand, the dangling case both ways (kept: the
  volumes of theirs; dropped: the volumes of ours), an assembly (arm-6r) with a rename on one side and a hidden link
  and a parameter on the other, and a log with a merge version, then up to date, then a fast-forward.
- **Not covered yet**: a drawing dimension or body look naming a feature the merge dropped is kept as it is (the
  studio's own deletion path drops them; S3 runs the merged document through the same check before keeping it).
  Conflict codes built from a variable (`PARAMETER_BOTH`, `ITEM_EDITED_BOTH`, `FIELD_BOTH`) are not in the scraped
  refusal table until it reads code unions (R7.3).

## DA-4 — storage: one store interface, a project as plain files, compare-and-set tags (2026-10-24)

- **What**: `apps/cad-studio/src/storage/` — `store.ts` (the interface, paths, codes), `memoryStore.ts`,
  `handleStore.ts`, `project.ts`, `access.ts`. Not wired into App.tsx yet (S1b, after the coordinator's OK).
  - `ProjectStore { kind, name, list(dir?), read(path), write(path, bytes, { expect }), remove(path) }`. Paths are the
    project's: relative, `/`-separated, no `..`, empty part, reserved device name or a character a common file system
    refuses (`STORAGE_PATH`).
  - **Tags.** Every file has a tag (a folder: size and time; a cloud: its ETag). A write may expect a tag, or `null`
    for "no file yet"; anything else there is refused, `STORAGE_CHANGED`, and nothing is written. This is the hook for
    a second tab or program now and for several people later: no locks, the loser re-reads and merges (DA-3).
  - **Backends.** `handleStore(dir, kind)` over a directory handle: the person's folder from `showDirectoryPicker`
    (Chromium) or, where there is none, the browser's private file system (`navigator.storage.getDirectory()`,
    `projects/<name>`), which every current browser has. One code for both. `createWritable` commits a file whole on
    close; a browser without it refuses `STORAGE_UNAVAILABLE`. `memoryStore` for tests and where neither exists (Save
    then downloads, as today). The last picked folder's handle is kept in IndexedDB (`studio.projects`) for Reopen;
    access is asked again on a click.
  - **Layout** (`project.ts`): `<part>.bcad` as Save writes it; `.barocss/versions/<part>.json` the log without
    documents; `.barocss/snapshots/<key>.bcad` each version's document, written once (never rewritten, so a copy or a
    sync of the folder can't corrupt one); `.barocss/autosave/<part>.bcad`. A log is written documents first, then the
    log naming them (O9's rule for recovery); read back, it is checked whole (`checkVersions`) and refused, never shown
    half, when a document is missing. Autosave is offered only while it differs from the saved file.
  - Every file is the .bcad container unchanged (engine/container.ts): mesh arrays travel by hash as in a saved file.
- **Why**: plain files the person can see, copy and put under their own sync; write-once documents make the folder
  safe to sync; the tag makes concurrent writers visible instead of silent.
- **Oracle**: one contract test run against both stores (the handle store over an in-test stand-in that answers the
  browser's calls and error names), the project's files on both, a mesh-container fixture written and read back
  byte-identical as a container; and a real Chrome run (scratch script, not committed) on the private file system:
  part, two versions and autosave written, a second handle (as after a reload) reads them all back equal, a stale tag
  refused `STORAGE_CHANGED`, the project listed and then removed.
- **Not covered yet**: the folder picker itself (a native dialog a headless browser cannot drive; the same handle
  calls as the private file system). Large histories load every version's document when the log is read; lazy
  loading waits for a measured need.

## DA-5 — the studio: a project open beside the document, versions in the dock (2026-10-24)

- **What**: `src/storage/useProject.ts`, `src/storage/VersionsPanel.tsx`, and the wiring in `App.tsx` (coordinator-
  approved; the top bar is the GPU lane's shell, told by the coordinator). App.tsx, after the change:
  - 65–67: the two imports;
  - 444–452: `useProject` (opened → `replaceDoc`, the file name from the path), the panel's open state, the version
    compared and its overlay, Reopen's folder read once;
  - 455: autosave into the project instead of the browser's recovery copy while the document has a path in an open
    project (469: the effect's dependency); recovery.ts is unchanged and still used without a project;
  - 1501–1505: Save writes into the open project (its tag expected), else downloads as before;
  - 1802–1808: compare — the worker's `proposalDiff(version, working)` on the O9 'proposal-diff' lane, as a proposal's;
  - 2544–2545: the Project & versions card in the right dock (beside Variants, not with it);
  - 2854–2855: Save's tip names the project; a "Project & versions" button after Save;
  - 2870: the viewport's `proposal` overlay is the compared version's when no proposal is shown.
  - The card: Open folder… / Reopen <name> / Keep in this browser; the project's documents (Open); autosaved work
    offered (Restore, Discard); Make version (a save with a name); the branch's versions newest first with Compare
    (the change list and the overlay: material added green, removed red, with volumes) and Restore; branches (switch,
    make from the latest); Merge with each conflict answered ours/theirs.
  - Restoring, switching and merging go through `replaceDoc`: one undoable step, the document then unsaved.
- **Oracle**: the flow step "CG6 project" (port 52891), on WebGPU: a box; Open folder (the picker handed a real
  directory handle of the browser's private file system, since a native dialog cannot be driven headless); version
  First (the folder then holds the document, the log and one snapshot); a second box; Save writes into the folder with
  no download; version Second; Compare First lists exactly "added sketch n2, added extrude n3" and the overlay shows
  +16,384 mm³ (the 32×32×16 box); Restore First gives one box with both versions still listed; the autosave file holds
  the restored work; after a reload, Reopen and Open read both versions back and offer the autosaved work, which
  restores one box.
- **Not covered yet**: the face-tint fallback for a compare the Boolean refuses (proposals tint faces; compare shows
  only the change list then); the flow on WebGL2; branches and merge in the flow (S3); parts by path (S4).

## DA-6 — branches and merge in the studio; compare by faces; a new part leaves the project's document (2026-10-24)

- **What**:
  - **The card's branches** (DA-5's card, now exercised end to end): switch with the Branch list (refused with unsaved
    work, `BRANCH_UNSAVED`); make a branch from the latest version; Merge from another branch into the current one. A
    merge with conflicts lists each with its two sides, short values shown (`main (3)`, `thick (5)`, `(deleted)`), one
    choice each; Merge with these answers merges again with them. A merge version carries the note `merged from
    <branch>`, shown in its row when it has no name.
  - **Compare by faces**: when the kernel's Boolean refuses the two sides (facet or mixed bodies), the changed faces of
    the working document are tinted as a proposal's are (App.tsx's `proposalTint` reads the compared version's overlay
    when no proposal is shown). `__studioCompareOverlay` (DEV) reports it as `__studioProposalOverlay` does.
  - **A new part, another file, a template or a sample** replaces the document through `replaceDoc`, which now detaches
    it from the project's open document (`useProject.detach`): the versions leave the card, and the next Save is a new
    file in the project (refused when that name exists). Replacements from the project itself (opening its document,
    restore, switch, merge) pass `fromProject` and stay attached. Without this, Save after New part would have written
    the new part over the project's file.
  - App.tsx (approved scope, DA-5): `replaceDoc` gains `fromProject` (its two project callers pass true); `proposalTint`
    reads `compareOverlay` when no proposal is shown; one DEV hook.
- **Oracle**: the flow step "CG6 branches", on WebGPU and WebGL2: Base; a branch `wide` adds a box along X (version
  Wide); main adds one along Y (Deep), its history still only Base; Merge gives three bodies, six unique ids, a merge
  version "merged from wide" over Deep and Base; a branch `thick` sets parameter T = 5, main T = 3; Merge lists one
  conflict with `main (3)` and `thick (5)`; answered for thick, T is 5. New part empties the card's versions; a mesh
  (block-cm.stl, cm) made a version writes a second .bcad and leaves Untitled.bcad byte-identical; a box added and
  compared with the mesh's version gives `method: 'faces'`, faces tinted. The whole studio suite 298/298.

## DA-7 — placed parts referenced by their path in a project (2026-10-24)

- **What**: `src/storage/linked.ts`; the card's **Insert** and **Check**; App.tsx's `insertPart(file, source)`.
  - A document of the project placed in another (**Insert** beside it in the card) is inserted as any part is — its
    own copy in the assembly, so a .bcad stays whole on its own — with `part.source` = `./<path>`. A part inserted
    from disk keeps its bare file name, so a project link is never confused with it. No schema change: `source` was
    already "the file it came from"; the instance panel shows "From ./arm.bcad".
  - When an assembly is opened from the project (and on **Check**), each linked definition's file is read: one that
    differs from the part as placed is offered through the existing path, `offerRevision` → **Revision waiting** →
    **Accept Rev B** / **Keep Rev A** (assembly/definitions.ts), named `./<path>` so accepting keeps the link. A file
    already waiting as the same content is not offered again; a file the project no longer has is named
    ("Not in the project any more"). Nothing changes until the person accepts.
  - App.tsx (approved scope): `insertPart(file, source = file.name)`; `useProject`'s `onLinked` commits the waiting
    revisions as one undoable step and says which; the card's `onInsert` reads the document and inserts it with
    `./<path>`.
- **Why**: the owner's "multi-part projects with their placed parts referenced by path", on the shared-definition and
  revision model the studio already has, so linking is a check, not a new kind of reference the kernel or the container
  must resolve.
- **Oracle**: storage test (memory store): the file as placed offers nothing; saved with a fillet it is offered once
  (rev B, name `./parts/arm.bcad`, both copies untouched), not again while waiting, and accepted both copies take it
  with the link kept, after which nothing is offered; a removed file is named missing; a bare-name source is left
  alone. Flow step "CG6 linked parts" (WebGPU): arm.bcad saved; assembly.bcad with arm inserted (`./arm.bcad`); arm
  opened, a second box, saved; assembly opened: "Newer files for 1 placed part", the placed part still one box, Rev B
  waiting; accepted: two boxes, the link kept; Check offers nothing more.
- **Not covered yet**: renaming a document in the project (its links then read as missing); a linked part's own
  versions are not consulted (the file as saved is what is offered).
