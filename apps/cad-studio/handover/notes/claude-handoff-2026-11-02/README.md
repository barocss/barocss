---
work_id: D609
artifact_type: current-cad-handoff
status: ready-for-next-bounded-task
last_updated: 2026-11-11
---

# CAD continuation — current entry point

Read this document completely, then the [current roadmap](../../roadmap.md), [D519 package and Studio audit](../cad-package-studio-audit-2026-11-04/README.md), [D520 replan](../cad-roadmap-replan-2026-11-04/README.md) and [P0 acceptance queue](../../roadmap-tracks/01-reliability.md). The roadmap is the only current status index. This D520 entry point supersedes the old chronological handoff and D445 execution order; preserve D445/D446 and later canonical proofs at their recorded scopes.

Read the [129-ID requirement registry](../../roadmap-tracks/07-requirement-registry.md) and [live issue destinations](../../roadmap-tracks/06-github-issues.md). They preserve15 CAD epics and map85 CAD-title plus16 related open issues; coverage is not yet adjudicated. Recent #2284/#2285/#2286 are research/interaction proposals, not ready implementation or lifted gates.

The November 10 issue follow-up routes #2288–#2422 separately from the D520 census. It records safety candidates, the bounded Studio harness pilot after D550, and the Automation/B09 sequence with an early AI experiment. Check current code when a recorded claim differs from implementation. [Issue follow-up](../../roadmap-tracks/13-issue-followup-2026-11-10.md).

The owner asked for the whole roadmap to be rebuilt after auditing both CAD packages and cad-studio. Product order is P0 safety/currentness, P1 daily parts, P2 drawings/exchange, P3 static assemblies, P4 platform/SDK, P5 advanced geometry/direct editing, P6 ecosystem. Existing automation/AI, CAD React and Physics library have separate acceptance tracks. Read the [first product baseline](../../roadmap-tracks/04-product-baseline.md) and [official reference review](../../roadmap-tracks/05-reference-review.md): ArtCraft CADCraft, separate CadCraft/PartCraft, SolidCraft and CadXStudio. Supplier claims are not comparative runtime proof. Existing34 row IDs and C1–C8 historical references remain intact.

## Checkout and identity

Use only `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, branch `local/cad-dev`. Do not modify the main checkout or another worktree. The audit/planning parent is `ccce78c671c8a5c09718c1cf6005a90027b75adc`; do not check out that old SHA to continue. D516 normally merged develop `0a838f9543a29a864df5917ac2bb877540c8aa73` at `4d733c0f622dadf0b8d84d4395b696779e9b1e84`. Fetch current refs and compare HEAD with origin/local/cad-dev and origin/develop before work; preserve and investigate unexpected WIP or divergence.

```sh
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
node --version
git fetch origin develop local/cad-dev
git status --short
git rev-parse HEAD origin/local/cad-dev origin/develop
git config user.name
git config user.email
```

Node must be22.19.0; before each commit verify easylogic <cyberuls@gmail.com>. Use named add paths. No stash/amend/rebase/reset/force push and no .claude/raw evidence commits. Ordinary milestones push to origin/local/cad-dev. No new develop merge, PR, release, npm publish or deployment is authorized by this plan.

## Next item

D550 qualifies the recovered original H12 Section A and Detail B through Auto-dimension, first Undo and Redo, native Save and fresh Open, and one independently read annotated SVG. Root's first actual Studio run passed 6/6. Auto adds six source-linked dimensions and clears three warnings on this sheet. The first Undo restores exact A and the warnings. Redo and the file consumers retain exact B. [D550](../section-detail-auto-dimensions-2026-11-05/README.md).

The original 1,767-byte input and the D455 helpers match their historical hashes after recovery. The original D549 native artifacts were unavailable. D550 captures one new current physical class with source and split evaluations, independent native proof, and 495 control pins. Two fresh Worker pairs and five exact pair reuses cover seven observations. The final 797 Studio pins and all owned cleanup checks pass. Actual Worker internal computation is NOT_MEASURED. D549 remains separately accepted at its historical 3/3 scope. [D549](../section-detail-svg-output-2026-11-05/README.md).

D551 adopts one shared Python invocation with default and explicit result status. Two actual after flows pass. The seven independent joins and seven original file outputs agree with the before flows. The first queue attempt timed out before either launch. The next queue admitted both runs. Whole development speed and the broader #2396 acceptance remain unmeasured. [D551](../studio-oracle-pilot-2026-11-10/README.md).

D552 confirms the original same-tab Copy A, Open B and Paste defect. The fixed Studio run preserves B and first Undo/Redo, then passes two valid pastes after a fresh B Copy. The remaining #2310 acceptance stays open. [D552](../body-clipboard-owner-2026-11-10/README.md).

D553 moves the selection and sketch action policies to viewport modules. SceneViewport accepts two typed groups in place of 13 flat callbacks. Its App call has 68 attributes including ref, down from 79. The first actual desktop body/context and inline sketch groups pass. [D553](../studio-viewport-interactions-2026-11-10/README.md).

D554 extracts the private active-sketch overlay and its model imports. Viewport.tsx has 1,582 lines, down from 1,780. Both selected actual consumers pass. The first Band run retains its observer selector failure. The package exports stay at their existing module paths. [D554](../viewport-sketch-overlay-2026-11-10/README.md).

D555 extracts canvas pointer input into a private module. Viewport.tsx goes from 1,582 to 902 lines. The desktop evidence covers picking, sketching, wheel, captured pan, marquee and the Width X handle. [D555](../viewport-pointer-input-2026-11-10/README.md).

D556 reproduces and fixes stale body Paste across Open Undo and Redo. The fixed desktop run retains the accepted document and normal same-document repeat Paste. [D556](../body-clipboard-history-2026-11-10/README.md).

D557 extracts Studio document file actions. App.tsx has 2,365 lines, down from 2,444. Native Open, malformed refusal, STL Cancel and exact browser project Save passed in Studio. [D557](../studio-document-files-2026-11-10/README.md).

D558 prevents a refused pending Paste from consuming its spacing or overwriting selection. The fixed desktop run retains b4 after evaluation, adds the next copy at +44 mm and preserves exact history. [D558](../body-clipboard-pending-2026-11-10/README.md).

D559 verifies that two failed native opens preserve the body clipboard, selection and both history stacks. The next Paste remains at X +44 mm. [D559](../body-clipboard-failed-open-2026-11-10/README.md).

D560 qualifies New part clipboard isolation when a distinct new box also has key b1. Studio verifies no stale Paste history entry and a successful fresh Paste at X +18 mm. [D560](../body-clipboard-new-part-2026-11-10/README.md).

D561 verifies that starting from a saved local template clears the prior body clipboard even when both documents use b1. Studio preserves history and a fresh Copy allows Paste at X +20 mm. [D561](../body-clipboard-template-2026-11-10/README.md).

D562 verifies same-key clipboard isolation across browser project file Open and named version Restore. Desktop Studio preserves history on both routes and a fresh Copy allows Paste at X +20 mm. [D562](../body-clipboard-project-2026-11-10/README.md).

D563 verifies same-key clipboard isolation when restoring a real browser-local recovery document. Actual Studio retains exact history and a fresh Copy allows Paste at X +20 mm. [D563](../body-clipboard-recovery-2026-11-10/README.md).

D564 verifies same-key clipboard isolation when entering Edit part and returning through Cancel or Finish. Actual Studio preserves history and a fresh assembly Copy allows Paste at X +22 mm. [D564](../body-clipboard-in-place-2026-11-10/README.md).

D565 verifies that deleting the copied body leaves Paste inert while other bodies remain. Undo restores the original source and the next Paste retains X +44 mm. [D565](../body-clipboard-deleted-source-2026-11-10/README.md).

D566 fixes same-document clipboard rebinding when a new edit reuses an ID from an undone branch. Actual Studio retains normal Redo and prevents the old clipboard from duplicating the new b1. [D566](../body-clipboard-history-branch-2026-11-10/README.md).

D567 verifies same-key clipboard isolation on Restore of a real browser-project autosave. Exact Undo and Redo pass, and the saved native document is retained. [D567](../body-clipboard-project-autosave-2026-11-10/README.md).

D568 verifies that two admitted copies survive native browser-project Save and a fresh public Open of the exact saved bytes. Actual Studio retains both offsets and all feature references. [D568](../body-clipboard-save-reopen-2026-11-10/README.md).

D569 verifies four trusted text-input shortcuts, exact CAD state and both history stacks, and the next body Paste at X +44 mm. [D569](../body-clipboard-text-focus-2026-11-10/README.md).

D570 verifies a trusted Chromium file-input cancel after Open and preserves clipboard, document, selection and exact history. [D570](../body-clipboard-cancel-open-2026-11-10/README.md).

D571 clears the Copy notice on five clipboard invalidation paths in actual Studio. Ordinary history keeps the valid Copy notice, and New keeps an unrelated Open error. This verifies the remaining [#2310](https://github.com/barocss/barocss/issues/2310) acceptance. [D571](../body-clipboard-notice-2026-11-10/README.md).

D572 fixes Studio Insert and Place resolving the embedded library instead of the selected local replacement. Desktop checks verify the 12 mm replacement, an identical-name/version case, first Undo and Redo, and native Save and fresh Open. [#2361](https://github.com/barocss/barocss/issues/2361) remains open for the remaining acceptance cases. [D572](../library-source-selection-2026-11-10/README.md).

D573 clears unsaved Variants inputs at accepted document boundaries. Studio verifies the first B evaluation, malformed and cancelled Open, ordinary Reset, Save and Update, and Undo/Redo across Open. [#2362](https://github.com/barocss/barocss/issues/2362) remains open for remaining acceptance. [D573](../variant-document-draft-2026-11-10/README.md).

D574 rejects late Finish responses for an ordinary reopened sketch. Desktop Studio preserves cancel and the newer draft, then verifies the current 60 mm Finish, first Undo/Redo and two local Save/fresh Open cases. [D574](../sketch-finish-ownership-2026-11-10/README.md).

D575 blocks stale BOM row actions and CSV during recomputation. Actual Studio verifies the current B purchase list, current bought override and first Undo/Redo. [#2356](https://github.com/barocss/barocss/issues/2356) stays open for remaining acceptance. [D575](../bom-currentness-2026-11-10/README.md).

D576 reports Front and Auto-dimension success only after the actual drawing commit. Desktop Studio verifies stale refusal, a valid current action and first Undo/Redo in both cases. [#2359](https://github.com/barocss/barocss/issues/2359) stays open for remaining acceptance. [D576](../drawing-commit-ownership-2026-11-10/README.md).

D577 rejects obsolete Texture and Environment imports. Desktop Studio verifies the latest selections, Render exit, current decode error and first Undo/Redo. [#2419](https://github.com/barocss/barocss/issues/2419) remains open for remaining acceptance. [D577](../render-image-ownership-2026-11-10/README.md).

D578 evaluates bbox, volume and mass before display rounding. The root desktop flow checks verdicts, warnings, Undo/Redo and native Save/fresh Open. [D578](../requirement-numeric-precision-2026-11-10/README.md).

D579 ranks snapshots with all hard checks passing before exploratory snapshots. Root runs the actual controlled Studio and MCP recovery with first Undo/Redo, native Save/fresh Open and a dimension edit. [D579](../requirement-best-snapshot-2026-11-10/README.md).

D580 keeps unresolved body material IDs and reports their mass requirements as unknown. Actual desktop Studio and native-file MCP verify provenance, and Studio verifies repair, refusal, history and native readback. [D580](../unresolved-body-material-2026-11-10/README.md).

D581 refuses incomplete current BOM evaluations and retains their original reasons. Actual desktop Studio verifies the BOM panel and Drawing export gates, recovery, Save/fresh Open and the separate stale BOM regression. [D581](../bom-evaluation-completeness-2026-11-10/README.md).

D582 classifies the existing keep-out chord interval against the full requirement. Actual desktop Studio and local MCP verify unknown reasons, retained definite verdicts and native readback. [D582](../keepout-chord-interval-2026-11-10/README.md).

D583 binds override reasons and response mode to each typed tool invocation. The same-module native overlap tests, actual Studio through controlled chat, and serial local MCP verify separate surfaces. [D583](../tool-call-context-2026-11-10/README.md).

D584 binds two independent Model tasks to a frozen spec and verifies scoped candidates with an independent geometry oracle. Actual desktop Studio opens the host-approved native document, saves it in the browser project, opens it fresh and edits the lid. The task and drawing receipts remain on the host. [D584](../spec-task-contract-2026-11-11/README.md).

D585 qualifies one-process CandidateBoard publication, including both commit orders, late cancellation, authority revocation, duplicate operation IDs and native replay. Actual desktop Studio opens the single winning file, saves it, opens it fresh, edits the extrusion and checks first Undo and Redo. [D585](../candidate-atomicity-2026-11-11/README.md).

D586 qualifies the local two-worker CAD CLI and six process crash boundaries with one durable writer. Actual Studio edits the accepted assembly and reopens its saved project bytes. Local BOM and independent measurements agree. [D586](../local-task-run-2026-11-11/README.md).

D587 records B09 v1 at 8/9 passing groups. Direct CLI authoring refused solver sketch metadata. The typed-seed continuation passed actual Studio preview, approval, edit, history, project Save and fresh Open. The final BOM has the correct mass but omits the known material. [D587](../../notes/b09-editable-consumer-2026-11-11/README.md).

D588 repairs the known standalone BOM material field. Actual Studio changes material and verifies mass and first Undo. Two actual stdio MCP reads return the expected material and mass. [D588](../../notes/single-part-bom-material-2026-11-11/README.md).

D589 maps the existing provenance and diagnostic contracts for #2279. Actual Studio distinguishes stale, failed and passing results after a held Worker reply and first Undo and Redo. [D589](../../notes/requirement-report-freshness-2026-11-11/README.md).

D590 accepts B09 v1 at 9/9. The CLI starts from empty, writes the same constrained plate and hands it to the local MCP and actual Studio workflow. The D587 refusal remains in its original record. [D590](../../notes/cli-constrained-rectangle-2026-11-11/README.md).

D591 delivers a read-only requirement evidence artifact. The final actual Studio and MCP run distinguishes the failed and corrected saved revisions. [D591](../../notes/requirement-evidence-artifact-2026-11-11/README.md).

D592 links a user-approved Studio occurrence edit to before and after evidence. Actual Save and fresh Open preserve the approval and the fresh MCP report. [D592](../../notes/proposal-approval-evidence-2026-11-11/README.md).

D593 verifies the placed candidate and the −200 mm³ delta in desktop Studio. Before and Hide restore both accepted placements. [D593](../../notes/placed-proposal-preview-2026-11-11/README.md).

D594 shows approved requirement transitions in the existing Versions panel. The project reload keeps the native file, version log and snapshots byte-identical. [D594](../../notes/approved-requirement-version-compare-2026-11-11/README.md).

D595 compares the first failed snapshot and the approved saved snapshot while the later failing model stays open. [D595](../../notes/historical-approval-evidence-2026-11-11/README.md).

D596 reproduces the unreadable-copy warning with a first native autosave interrupted before close. Actual Studio recovers the saved document, preserves an earlier committed copy and still reports nonempty corruption. [D596](../../notes/interrupted-project-autosave-2026-11-11/README.md).

D597 qualifies the human-transcribed bracket through an atomic refusal, a single bore correction, independent native geometry and desktop Studio edit and Save/Open. [D597](../../notes/dimensioned-bracket-control-2026-11-11/README.md).

D598 verifies exact PNG delivery and ordered traces for same-name drawing revisions. It fixes pending images crossing New conversation. [D598](../../notes/drawing-image-intake-2026-11-11/README.md).

D599 reproduces the seventeenth image disabling later text turns. Actual Studio now refuses before dispatch, preserves the draft and reuses the original sixteen image indexes. [D599](../../notes/chat-image-capacity-2026-11-11/README.md).

D600 connects two local worker commits and the final accepted file to read-only MCP evidence and Studio Versions. A later working edit fails its check and keeps the historical approval available. [D600](../../notes/worker-checkpoint-evidence-2026-11-11/README.md).

D601 keeps the original saved failure visible after Studio approval widens a tolerance or withdraws the only criterion for an occurrence. [D601](../../notes/saved-requirement-change-2026-11-11/README.md).

D602 verifies both reused child IDs in actual Studio and retains the current explicit MCP refusal for full nested paths. The same assembly query reported zero bodies and volumes for both nested-only hosts. The assembly scope belongs to row 10. [D602](../../notes/nested-requirement-scope-2026-11-11/README.md).

D603 repairs the zero body and volume summary for the D602 nested-only hosts. Desktop Studio and MCP agree before and after Save/Open. A failed host keeps its error and the other host keeps its numeric result. [D603](../../notes/nested-assembly-summary-2026-11-11/README.md).

D604 reads current requirements for exact visible leaf paths. Actual MCP retains distinct local results and effective materials after Studio project Save/Open. [D604](../../notes/nested-requirement-evidence-2026-11-11/README.md).

D605 uses that report in the existing desktop nested inspector. Two late reads cannot replace the selected path or a reopened document's verdict. The committed cut control refuses a result. [D605](../../notes/studio-nested-requirement-verdicts-2026-11-11/README.md).

D606 verifies a user-approved host-file repair, a separate root revision acceptance, Undo/Redo and the original saved failure. Exact nested proposal authoring from the root is refused. [D606](../../notes/nested-requirement-repair-2026-11-11/README.md).

D607 repairs the direct proposal blocker for an independent static leaf. The existing Studio approval records the root pair and retains the original failure and same-ID sibling. [D607](../../notes/root-nested-parameter-proposal-2026-11-11/README.md).

D608 links the exact saved nested failure and approved repair in Studio Versions. The working failure remains separate, and a retired read cannot change the comparison. [D608](../../notes/saved-nested-approval-comparison-2026-11-11/README.md).

D609 returns the saved nested approval report through Studio chat, with exact version and occurrence pins. A later failing working revision remains separate. [D609](../../notes/agent-saved-approval-evidence-2026-11-11/README.md).

Next MAIN is D610 / P0 automation, B09 follow-up, rows 04, 12 and 16. Check the version-linked defect lifecycle on the same nested leaf. Use the saved failure, the verified approval and a later regression as separate inputs. Preserve the original failure and identify the exact revision and occurrence for each state. Inspect existing report contracts first. [#2279](https://github.com/barocss/barocss/issues/2279).

Owner[#2287](https://github.com/barocss/barocss/issues/2287) stays later P4 contextual Inspector/command/focus research in tracks03/06; no immediate UI framework/redesign/download. B01/B02/B04 retain12/12,11/11,26/26 scope, D548two-sheet10/10/D549output3/3 are supplements, wholeB06 NOT_ADJUDICATED, B03positive tapped data-blocked, whole CAD/core NOT_MEASURED/noaggregatepercentage. Broader#540 remains open; no comments/closure.

D537 remains the public driven-sketch v1 single named LINE contract; it does not add general/multiple/radius bindings or bound topology editing. B01 uses a separate fully-defined ordinary rectangle, not that mixed2DOF profile. All34 stable rows remain unchanged. Whole CAD/core NOT_MEASURED; B01 v1 accepted12/12 scoped groups, B02 v1 accepted11/11, B04 v1 accepted26/26, B09 v1 accepted9/9, B03, B05–B08 and B10 NOT_ADJUDICATED, no aggregate baseline percentage. Legacy43% is historical.

Use the required SMALL/FEATURE/FULL tier and root's own actual desktop Studio flow. One bounded category milestone gets one decision and normal push to origin/local/cad-dev. Ordinary implementation/tests use Sol Medium; difficult geometry uses Sol High. Heavy work is serial under gate.sh. All writers freeze through actual execution and cleanup. Reuse exact eligible evidence; preserve every first failure. Downloads/paid live need owner permission each time. No new develop merge, release or UI redesign follows.

## Parallel tracks and gates

P2 in the new order means drawings/exchange. The historical manufacturing gate named P2 remains a separate held gate.

- CAD React: existing injected Model/Worker and Viewer architecture; D509 current runtime/docs functional PASS remains bounded. Readability and stable active-color screenshots remain partial. P0-R08/R09 precede dependent breadth. New component work needs actual props-change rendering and returned-document Studio proof; it does not block unrelated MAIN work.
- Physics library: D518 investigation completed, uncommitted local EXACT04 not adopted. Preserve represented/physical rank10/9 and tilted4908/7, published512/866 NO_GO boundaries and missing final checkpoint/archive qualification. Assess/carry the declared library candidate only; do not resume stopped chats/workers or infer Studio Physics authority. [D518](../physics-exact04-takeover-audit-2026-11-04/README.md).
- Hold Studio Physics/Motion, manufacturing/equipment/P2/PG11, broad fitter/NURBS/public-thicken/#2266 widening, nonzero-cone expansion, owner UI redesign, ASME PDF mismatch, schema5/migration, new WebGPU CI, release/npm/deploy under existing gates. Downloads and paid live executions need prior permission every time. Do not test mobile.

## Operating rules and proof boundaries

Read and retain the [previous handoff §5](../codex-handoff-2026-11-01/README.md#5-지킬-규칙-오너-결정). Latest owner instructions override old operating text. Use Sol Medium for ordinary implementation/testing and Sol High for difficult Boolean/B-rep/tolerance/geometry judgment; record the actual model used. Replies are short Korean; code, decisions, commits and issues are English. Keep UI explanation layers limited under the owner's later instruction.

Run one heavy job under gate.sh at a time. Do not write anything in the worktree while an actual Studio flow runs. Terminate only owned PIDs. The last test edit requires final Model tsc; whole kernel runs remain B-rep-core-only. Public API/geometry/tolerance changes need FULL review/mutations; new behavior needs FEATURE review/actual; private bounded repair needs SMALL checks/actual. Numerical claims require independent physical/native evidence, not display geometry or hashes alone. Raw logs/screenshots/archives stay outside Git; record commands/counts in small decision notes/qualification JSON.

D519/D520 do not claim new Studio/runtime/physical PASS; D521–D536 add only their recorded bounded controlled and actual Studio proofs. D482's later historical full-kernel result supersedes the old D433-latest wording but is not a current-head suite pass. D501/D505 custody failures and the owner-deferred PDF mismatch remain recorded. Close a related issue only after all its acceptance is supported; no issue is closed by this plan.

The exact previous handoff remains in [history-through-D518.md](history-through-D518.md). Its old next-item/WIP/latest statements are historical; use current roadmap for state. Earlier [D445](../core-cad-priority-2026-11-02/README.md) and [D446](../develop-integration-2026-11-02/README.md) remain scope/integration records, not current execution order.
