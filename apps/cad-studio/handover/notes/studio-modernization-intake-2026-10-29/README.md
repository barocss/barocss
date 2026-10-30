# Studio modernization proposal intake — 2026-10-29

Status: **proposal registered under existing roadmap 15 / 20 / 21; no implementation acceptance**.
This intake does not create an issue, start a new task, or change the current D325 clipping work and the owner's 07 → 08 → 09 order.

## Exact incoming documents

All three documents were read in full: review.md (108 lines), source-review.md (185 lines), and runtime-evidence.json (152 lines). Exact copies are in [sources/](sources/). [source-manifest.json](source-manifest.json) records original absolute paths, bytes, line counts and SHA256. Copy bytes were compared with their source bytes before and after copying. These hashes bind evidence; they are not product acceptance tests.

- [Design review](sources/review.md): `6064fbbea8035923c9ec57a2a7c133321879430ee12edc3b20a976190e63adea`.
- [Source review](sources/source-review.md): `9a766889f913ee22a31c0d72d7f3a41e428d010b539c63a787c59c305084ca1e`.
- [Runtime evidence](sources/runtime-evidence.json): `32656bc45647ea5bdbfc51b72ad70d2c6c8be14cb9de7937284656ab456cc7c8`.

The review fixes its source baseline at `a5d1acfa7e6834951819eaaeeaf6da314cae9b8f` and reports no Studio src/package change through `d85558ce0031d812341d5871743f8535520eb8d4`. It reports a 27-file hash/Git-blob audit. This intake preserves that author's source evidence; it does not repeat or independently certify the 27-file audit. Source line references in the copied review belong to its fixed commit, not an assumed future layout.

## Evidence scope and chronology

| Layer | What the supplied documents say | Intake boundary |
|---|---|---|
| Source review | Existing command registry, palette, dock, numeric/binding editors, work states and workspace controls were read at exact a5d1. The source reviewer ran no build/test/browser/server. | Design and source observations. No product defect or accessibility failure is established by styling or source order alone. |
| Retained author images | Three author PNGs were viewed by the review team: two 1440×900 images and one 299×343 Versions crop. Bytes are retained in a5d1. Original execution used 27500e219 plus D323 project.ts, not a fresh a5d1 run. | Visual observations of that retained author run. No new image inspection, pixel comparison, badge mass calculation, or independent UI run was done by this intake. |
| Initial attempted fresh run | runtime-evidence.json records missing exported samples/rows JSON, a Vite import/setup failure and seven product flows NOT_RUN. Partial source-resolution logging does not establish a loaded app. | Harness setup failure, not a product flow failure. Original failure and manifest remain preserved by the author. |
| Authorized repair attempt | Corrected snapshot 1169 files; manifest c7330b8c…; guard exit75 after 31 seconds. No new server/browser started and no further retry. | GUARD_DENIED_NOT_RUN. Do not count this as a repaired UI PASS. |
| Later author follow-up | review.md adds an exact d855 fresh isolated observation: **6 PASS / 0 FAIL / 1 NOT_RUN(Sketch)**. Cases: Model1440×900, tree selection, feature editor open/close without value edit, Render, Drawing, Model1280×800. It reports 0 page/console errors, 1042 pinned source inputs, 420 workspace resolutions, no source escape/own dist, and owned cleanup. | This is a later author-reported observation, separate from the earlier runtime-evidence.json. Its linked runtime-followup-072849.md and runs/studio-ux-20261029T072849/result.json are not among the three supplied copied documents and were not independently reviewed here. Do not silently replace the earlier NOT_RUN history or call this an intake-owned execution. |
| Modernized product | No modernization code or design implementation was supplied. | NOT_RUN: implemented tool discovery, edit/apply/Undo, Sketch constraints, Drawing annotation, assembly references, keyboard/focus/contrast/screen-reader, Save/Open and Stop/Save ownership after a UI move. |

The later follow-up reports that a feature editor can continue below Body details and needs scrolling to reach Apply. It does not say Apply is absent or unusable. It reports two Drawing settings columns and tools moving to overflow at1280×800 without horizontal overflow. These observations support the proposals below; they do not measure discovery time, accessibility conformance, geometry accuracy, CAD/GPU performance, offline render correctness, resource limits, deployment or customer files.

## Map to existing work, with bounded acceptance

| Proposal | Existing primary rows | Proposed bounded result and required acceptance |
|---|---|---|
| SUX-1 named tool groups/search | 21, with 15/20 | Reuse TOOL_GROUPS, registry, Palette and ToolsTray. Show category context and a Find-command entry. Rail/search must invoke the same command and show the same availability/refusal reason. Verify keyboard access and narrow overflow without losing commands. Do not register a new command system. |
| SUX-2 active transaction first | 20/21, with 15 | Put the active command's references, values/units, preview/refusal and Apply/Cancel before unrelated Browser/Versions detail. Verify reachability, independent scrolling, retained drafts and canvas reference selection on real 1440×900 and 1280×800 screens. Smaller 900px-class policy needs a separate measured decision. No preview may appear accepted. |
| SUX-3 readable numbers/units/bindings | 15/20; preserve 16 | A 13–14px work-text scale is a design target, not an accessibility certification threshold. Keep zero/negative/decimal/blank drafts, long names, supported named bindings and visible units. Preserve numeric precision, tolerances, conversion boundaries and current commit rules. Do not assume arbitrary expression editing or add a formula engine. |
| SUX-4 distinct work/file states | 20/15; preserve12/16 | Distinguish preview Cancel, main rebuild Stop, import/repair Cancel, queued Apply, geometry freshness, dirty/save and recovery. Preserve D321/D322 ownership below. Verify simultaneous states and actionable refusal/recovery without covering required model selection. A shared status region must not merge distinct cancellation handlers. |
| SUX-5 one contextual settings area | 15/20/21 | Preserve existing Model/Sketch/Render/Drawing behavior. Prioritize selected assembly instance/reference/placement in the existing UI; no new Assembly workspace is implied. Keep Sketch Finish/Cancel, Drawing annotations/export and frozen render source explicit. Prove the canvas is not squeezed by duplicate active settings areas. |
| SUX-6 named history/context | 21/15; preserve 16 | Show the current feature/edit boundary and a compact read-only context when appropriate. Keep pending-work edit refusals. Prove actual history existence and content; do not reuse missing-field equality as preservation evidence. |
| SUX-7 keyboard/focus/compact panels | 15/20/21 | Reuse Radix/cmdk and current shortcuts. Define Escape target, focus return, resize alternative and hover/focus access to tool reasons. Decide modal status per surface; do not apply a blanket focus trap to a nonmodal inspector. Actual focus/keyboard/assistive checks remain required. |

Existing row 20 drag/preview timing, Apply/Enter/Escape and notification-selection concerns remain distinct measurements and functional gates. Row 21 already owns category labels, tool layout, search, Browser and History. This intake adds evidence and bounded criteria there; it does not replace the owner's layout decisions with an unconditional new grid/ribbon design.

## Preserve current product contracts

- **D321:** Policy B refuses unsupported independent document edits before acceptance during main work. Stop owns only the exact originating accepted transition. A read-only history summary must not enable unrelated edits, consume old Undo, or reassign candidate/initial/variant ownership.
- **D321 evidence caveat:** the existing independent-review correction records three retained Render snapshots with no history field. Their both-undefined comparison is excluded from actual Render Undo-history preservation PASS. A future check must record history, assert existence/type and compare it, or provide equivalent explicit public Undo/Redo preservation evidence. Doc/recovery, Model/Drawing strings, source gate and public Undo/Redo remain separate valid evidence. This intake does not repair or close that gap.
- **D322:** UI layout changes must retain render-bound document dispatch token plus document/filename/session/path checks. A valid same-file Save tag can advance after a newer edit; an old completion must not clear the newer dirty/recovery state or reattach a closed/detached project. Keep saved-equal checkpoint hiding and avoid reintroducing Save's physical checkpoint-remove race. Native disk commit completion and current UI clean ownership remain different facts.
- **Existing implementation:** React 19, shadcn/Radix/cmdk/Tailwind, themes, docks, palette, overflow, numeric units/named bindings, Sketch constraints/DOF, Drawing and Render controls already exist. No framework rewrite, solver, storage schema, public API, or wholesale App rewrite is proposed.
- **Boundaries:** row 05 stays Viewer work/visual vocabulary; row 12 owns file/version/recovery; row 16 owns precision/reference/refusal support. Studio visual changes do not close those gates or overall commercial CAD readiness.

## Future checks and current status

Before an implementation is accepted, run one real supported workflow from tool discovery through references, values/binding, preview, Apply/Cancel, Undo/Redo and re-edit. Include supported Sketch/Drawing/assembly consumers, both target viewport sizes and keyboard/focus recovery. Preserve separate Save/Open, Stop/refusal, accepted-state failure and resource/file checks. Reuse unchanged receipts only within their original scope.

This intake performed document reads, exact copies/hash binding and roadmap mapping only. **Builds/tests/browser/remote messages: NOT_RUN. Product/runtime/test sources: unchanged by this intake.** The current D325 work and existing priority order remain in place.
