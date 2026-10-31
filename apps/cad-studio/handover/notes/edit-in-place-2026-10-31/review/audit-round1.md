# Independent audit, round 1, FULL tier: roadmap 10 ⑧ edit part in place

**Verdict: CHANGES_REQUIRED**

Probes: `probes.test.ts` in this folder (built by `build.mjs`, run through the heavy gate). All 5 fail, which confirms the defects below. The feature's own tests pass: edit-in-place 5/5 and definitions 5/5.

## Findings

1. **HIGH: context bodies of other instances are placed twice.** At `editInPlace.ts:47-51`, `inPlaceContext` assumes `instanceBodies` hold each instance's own coordinates. They are already in assembly coordinates: App.tsx:946 gets them from `engine.placed`, which calls `evaluatePlaced` → `placeBody(..., place.m, place.t)` (evaluate.ts:373) and `placedDoc` (adds rotate/translate nodes).
   - Probe P1 places `a` at (10,0,0) with a 90° Z turn, and `b` at (30,5,2).
   - b's vertex is expected at (5,−20,2) and lands at (10,−50,4).
   - The unit test missed this because it fed bodies evaluated locally with `evaluatePart`.
   - Fix: use `base` (E⁻¹) for instance bodies too.

2. **HIGH: other paths can put the assembly, or another file, into the session's working document. Finish then commits it into every sharer.**
   - a. **Chat.** A turn that starts on the assembly and ends during a session is merged onto `latest.base()`, which is the part (`useStudioChat.ts:78-101`). Probe P5: the assembly turn's box is applied to the part (2→4 nodes). The reverse also happens: a turn started in the session that ends after Finish is merged onto the assembly. Chat stays enabled during a session and gets `versions={project.chat}`, which is the assembly's project log. So `restore_version` or `switch_branch` can make an assembly version the working document. `make_version` writes part snapshots into the assembly's log (`useProject.ts:214-224`).
   - b. **Imports.** `editInPlaceRefusal` ignores an import in flight (`stage`, STEP reading takes seconds), an open `meshAsk` and an open `repairAsk`. `startInPlace` does not call `beginOpenIntent()`. When the import completes, `openedImport` (App.tsx:1464) runs `replaceDoc(next)` with no session check. That replaces the part, renames the file and detaches the project.
   - c. **Project open.** A project `openPart` still in flight goes on to `checkLinked` → `onLinked` → `commitParts(l.doc)` (App.tsx:441, useProject.ts:130-138). That writes the assembly's instances into the part.
   - d. **No last guard.** Probe P4: `finishInPlace(s, assembly)` is accepted, and the definition then holds 2 instances, itself included.
   - Fix:
     - Call `beginOpenIntent()` when a session starts or ends.
     - Refuse to start while a chat turn or an import is running.
     - Guard `openedImport`, `onOpened` and `onLinked` with `inPlaceNow`.
     - Withhold chat versions during a session, or block chat.
     - Have `editDefinition` refuse a part that contains the owner or its part id.

3. **MEDIUM: the revision goes backwards.** At `definitions.ts:71`, the rule `own !== 'A' && own !== seed.part.rev ? own : next` reuses the part document's drawing revision. That revision is never bumped. Probe P2: two edits of a part whose drawing says C produce **D, then C**. Fix: use `own` only when it is newer than the placed revision, or bump `part.drawing.revision`.

4. **MEDIUM: a waiting revision or a linked file silently reverts the edit.**
   - `editDefinition` leaves `pendingParts[id]` in place. Probe P3: the instance and the waiting file are both Rev B, and Accept overwrites the edit.
   - A part linked to a project file (`source: './x.bcad'`) still points to the unchanged file. On the next project open, `linkedRevisions` (linked.ts:38-41) offers the old file as "Newer files…", and Accept reverts the edit.

5. **MEDIUM: rows inherited from the assembly are lost during the session.** The Studio evaluates a placed part through `placedBase(inst, parent)`, which resolves inherited stock and section rows (doc.ts:890-895, shopRows.ts:17-32). The session's working document is the bare `inst.doc`, so a part that relies on parent rows evaluates differently, or is refused (`FRAME_SECTION_UNKNOWN`). This one is from code reading only (L0).

6. **LOW:**
   - When the assembly or the session has a rollback marker, `replaceDoc` → `commit` shows a false "Removed N later features. Undo restores them" toast, but the undo stack is empty (App.tsx:822-833).
   - Context ignores joint and explode poses (`instancePoseMap`).
   - Finish does not require the part to evaluate.
   - STL, 3MF and STEP exports during a session are named after the assembly.

## Verified correct

- Undo at the first step of a session does nothing (the stack is empty).
- Stop at the start of a session cannot restore the assembly, because `stopOwnedWork` needs `origin.entry === top`.
- Finish and Cancel restore the undo/redo stacks, marker, dirty flag and selection.
- Save, Save shared, ⌘S, Open, New, Templates, Project and recovery Restore are blocked during a session.
- Autosave and recovery are skipped, and `beforeunload` warns (through the ref).
- Ghost bodies cannot be picked (gpuRenderer.ts:647). They are not in `bodies`, so interference, BOM and exports exclude them.
- `verifyOpened` is guarded by document identity.
- Slow commits started before the session are refused as stale by `canChangeDocument`.
- Nested sub-assemblies keep their own part-id namespace, so separate copies there diverge by design.
