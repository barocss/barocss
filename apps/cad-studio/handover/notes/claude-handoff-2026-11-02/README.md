---
work_id: D666
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

D610 reports a saved regression after a verified nested approval, even when the restored working document passes. It preserves the original and approved checks and returns unresolved if the later proof fails. [D610](../../notes/saved-requirement-regression-2026-11-11/README.md).

D611 admits a local worker checkpoint through the existing Studio Open control. It checks the embedded task plan, exact native files and current hard requirements before adoption. Save and fresh project Open preserve the accepted bytes in the tested profile. [D611](../../notes/worker-checkpoint-intake-2026-11-11/README.md).

D612 presents the original and approved requirement results from a verified worker checkpoint in the existing Versions panel. The working result can change independently. A native Save leaves the full review in the portable checkpoint file. [D612](../../notes/worker-checkpoint-review-2026-11-11/README.md).

D613 exports a pending task receipt and presents its read-only preview in Studio. The accepted model and local run remain unchanged by review. [D613](../../notes/pending-worker-candidate-review-2026-11-11/README.md).

D614 accepts or rejects the exact candidate named by a Studio review receipt. The desktop fixture refuses the superseded attempt, approves the new one and saves the reopened checkpoint. [D614](../../notes/review-bound-worker-decision-2026-11-11/README.md).

D615 completes two Studio reviews and exact terminal approvals on one local run. A later Studio edit keeps the historical requirement checks bound to their original revisions. Native project Save and reopen and independent 3MF readback pass. [D615](../../notes/two-task-editable-delivery-2026-11-11/README.md).

D616 derives both local work targets from a native Studio Save. The start command refuses stale source bytes or altered plan fields before creating the run. The planned run passes both candidate reviews, approvals, editable Save and 3MF readback. [D616](../../notes/saved-model-worker-plan-2026-11-11/README.md).

D617 reads the two selected height targets through Studio chat, reports unresolved input in structured data and refuses a stale revision. The same Model planning function drives the saved-file CLI. [D617](../../notes/studio-agent-worker-plan-2026-11-11/README.md).

D618 exports the reviewed Studio plan and exact native source as one file. The explicit CLI start produces two held candidates. Studio opens one terminal-approved checkpoint and retains the original saved file. [D618](../../notes/studio-local-task-handoff-2026-11-11/README.md).

D619 starts the verified saved plan directly from local Studio. Desktop verifies two held candidates, exact-source refusal, durable replay and a terminal-approved checkpoint. [D619](../../notes/studio-start-local-run-2026-11-11/README.md).

D620 opens both held candidates from the local run row in Studio. Desktop verifies each occurrence preview, exact baseline refusal, a terminal retirement during review, and the unchanged offline review path. [D620](../../notes/studio-local-candidate-review-2026-11-11/README.md).

D621 adds explicit run status refresh, shared revisions across cards, stale preview retirement and a rebuilt sibling review. Desktop verifies both terminal approvals and the final checkpoint. [D621](../../notes/studio-local-run-status-2026-11-11/README.md).

D622 opens both terminal-approved checkpoints from the same owned Studio run card. Desktop refuses corrupt and retired responses, preserves the newer working Open, and verifies the original saved source and durable run files. [D622](../../notes/studio-open-local-checkpoint-2026-11-11/README.md).

D623 adds a plain rectangular sketch width task beside the existing height task. Actual Studio verifies the two approved scopes and opens the earlier height-only artifact. [D623](../../notes/local-rectangle-width-task-2026-11-11/README.md).

D624 schedules three independent dimension tasks with two worker slots and one writer. Studio opens three approved checkpoints and refuses retired sibling pins. [D624](../../notes/three-occurrence-local-run-2026-11-11/README.md).

D625 adds the Studio run card approval history. Desktop verifies the three immutable native pairs, revision-bound checks, request refusals and preserved working edit with Undo/Redo. [D625](../../notes/studio-worker-approval-history-2026-11-11/README.md).

D626 adds the working-occurrence check to approval history. Desktop verifies a current failure, a changed criterion and two late Worker replies while the approval results stay fixed. [D626](../../notes/working-worker-approval-checks-2026-11-11/README.md).

D627 repairs one selected occurrence and checks both protected siblings. Desktop verifies the terminal-approved checkpoint and a fresh working pass on the repaired dimension. [D627](../../notes/single-occurrence-local-repair-2026-11-11/README.md).

D628 prepares a repair from the working failure in the Studio approval card. Desktop verifies exact saved source, explicit Start, terminal approval and the repaired working check. [D628](../../notes/prepare-repair-from-working-check-2026-11-11/README.md).

D629 reopens the existing run from its exact task handoff. Two fresh Studio sessions verify pending review and approved checkpoint Open without starting new workers. [D629](../../notes/reopen-local-task-run-2026-11-11/README.md).

D630 opens the exact native model from the reopened run card. Desktop verifies the held candidate with the original standalone file unavailable, and refuses a damaged reply and two late replies. [D630](../../notes/open-native-run-baseline-2026-11-11/README.md).

D631 rebuilds a stale independent candidate from its Studio run card. Desktop verifies retired pins, the new candidate and exact terminal publication. [D631](../../notes/studio-rebuild-stale-candidate-2026-11-11/README.md).

D632 prepares an independent replacement for a stale task from one revised saved dimension. Desktop and independent native checks confirm that the old attempt cannot publish and the earlier accepted sibling stays intact. [D632](../studio-replan-stale-task-2026-11-11/README.md).

D633 records the original task, attempt, accepted native file SHA-256 and task input digest on a replacement run. Studio reopens the approved replacement in a fresh session with that provenance. [D633](../studio-replacement-provenance-2026-11-11/README.md).

D634 verifies shared hole conflict refusal, stale task input rejection and exact Studio Open of the previous approved assembly. The local host retains the native gate code and known worker effort. [D634](../studio-shared-interface-conflict-2026-11-11/README.md).

D635 shows the exact native gate and finding on the task card. Desktop fresh Open retains both failed findings and the working approved model. [D635](../studio-native-check-findings-2026-11-11/README.md).

D636 lets a user attach one failed native check to the next chat turn. The real Studio/MCP path returns exact evidence and refuses a different model revision. [D636](../studio-agent-native-check-2026-11-11/README.md).

D637 uses a selected shared-hole finding to propose an exact p2 hole edit. Studio accepts the proposal explicitly, saves and reopens the model, and starts two held height candidates on the repaired native bytes. [D637](../studio-shared-hole-repair-2026-11-11/README.md).

D638 completes the repaired shared-hole pilot with two terminal approvals and exact fresh Studio project Open. Both height checks and H1 pass. A separate copied-run check reproduces unreadable status after Stop on a failed run. [D638](../studio-shared-hole-delivery-2026-11-11/README.md).

D639 makes stopped native runs readable across CLI status and fresh Studio Open, with historical findings retained and no active evidence controls. Chat no longer renders the local folder path. [D639](../studio-stopped-native-run-2026-11-11/README.md).

D640 displays the run after the saved baseline is recorded. Desktop Studio shows both workers running and a matching concurrent Start reuses the same run. The chat card omits the local path. One explicit terminal approval still controls publication. [D640](../studio-live-local-run-2026-11-11/README.md).

D641 adds explicit Stop to the live Start card. The original writer stops two native worker threads, cancels the queued task before dispatch, and leaves the saved native baseline intact. Fresh Studio Open reads the same stopped run. [D641](../studio-stop-live-local-run-2026-11-11/README.md).

D642 adds Stop after reopen. Studio refuses a live terminal writer and an older run revision. Stop cancels the remaining candidate and keeps the previous approval. Fresh Studio Open reads the exact approved checkpoint. [D642](../studio-stop-reopened-local-run-2026-11-11/README.md).

D643 adds explicit approval to the verified local candidate preview. The writer refuses a mismatched or retired receipt. The same approval can be retried without a second commit. Fresh Studio Open reads the exact approved checkpoint. [D643](../studio-reviewed-worker-approval-2026-11-11/README.md).

D644 completes both height tasks through Studio approval and rebuild. It saves a separate native project file and reopens the exact bytes with both current requirements passing. [D644](../studio-two-task-native-delivery-2026-11-11/README.md).

D645 rejects one reviewed candidate without changing the accepted native file. The same pending sibling remains reviewable and can publish after explicit Studio approval. Fresh Studio Open reads that checkpoint and the earlier rejection. [D645](../studio-reviewed-worker-rejection-2026-11-11/README.md).

D646 binds an existing native through-hole and its cylindrical wall to a hard diameter requirement. Studio approves Ø4 to Ø6 mm, preserves the protected sibling and reopens the exact native checkpoint. The planner refuses shared H1. [D646](../studio-through-hole-diameter-task-2026-11-11/README.md).

D647 approves the height, retires the original diameter receipt, then rebuilds and approves the diameter. Fresh project Open preserves the exact final model and reports both current requirements passing. [D647](../studio-mixed-height-diameter-delivery-2026-11-11/README.md).

D648 converts the explicit inch bore and tolerance for native approval and preserves the authored criterion through Studio checkpoint Open. [D648](../studio-inch-through-hole-diameter-2026-11-11/README.md).

D649 qualifies three path-free CLI diagnostics, the existing step limit, and the next successful turn in Studio. [D649](../studio-chat-cli-diagnostics-2026-11-11/README.md).

D650 adds the D610 saved regression to the read-only Studio Versions comparison. Fresh Open, exact stored bytes, the restored passing working model and the retired late check are verified. [D650](../studio-saved-requirement-follow-up-2026-11-11/README.md).

D651 keeps a saved approval review in the project. Fresh Studio Open reads the v1 artifact without a check evaluation and refuses mismatched approval pins. [D651](../studio-persisted-approval-evidence-2026-11-11/README.md).

D652 lets the person attach a retained approval review to a Studio agent turn. The exact file is read-only and bound to the saved versions and occurrence. Document or project changes retire the pending attachment. [D652](../studio-agent-saved-approval-attachment-2026-11-11/README.md).

D653 retains one direct saved successor with the original failure and approval. Studio reads the three checked results after fresh Open and refuses a mismatched later pin. [D653](../studio-persisted-follow-up-evidence-2026-11-11/README.md).

D654 returns the exact retained follow-up through the selected Studio agent tool. The three saved pins, direct lineage and document ownership are verified. [D654](../studio-agent-retained-follow-up-2026-11-11/README.md).

D655 prepares a nested repair from a selected saved regression after fresh working and candidate checks. Desktop Studio verifies refusal of a moved or passing revision, explicit user approval, and native Save/Open. [D655](../studio-selected-follow-up-repair-2026-11-11/README.md).

D656 shows a newer user-approved repair against the retained regression in Versions. Studio rechecks the same occurrence and authored criterion, preserves the original failure, and refuses an unrelated passing version. [D656](../studio-saved-follow-up-repair-2026-11-11/README.md).

D657 retains a verified repair with the original report digest, exact saved lineage and requirement evidence. Desktop Studio reopens it with no evaluation and refuses a mismatched base pin. [D657](../studio-retained-repair-evidence-2026-11-11/README.md).

D658 qualifies a lost named face on one nested occurrence. Studio and MCP report the exact missing face, the sibling still passes, and the original saved approval stays intact. [D658](../studio-lost-nested-face-2026-11-11/README.md).

D659 attaches one current missing-face diagnosis to Studio chat. MCP rechecks the exact occurrence, authored criterion and working revision, and reports the unresolved reference. [D659](../studio-selected-face-diagnosis-2026-11-11/README.md).

D660 verifies explicit replacement of one renamed planar face on the same nested occurrence. Studio preview leaves the geometry unchanged, rejection preserves the model, and fresh Open measures 12 mm after acceptance. A lost face offers no replacement. [D660](../studio-renamed-face-reference-repair-2026-11-11/README.md).

D661 links the original unresolved face and the approved replacement to the exact saved versions. Studio keeps both results and the original approval after Open. [D661](../studio-saved-face-repair-lineage-2026-11-11/README.md).

D662 lets the user attach one saved face repair review to a Studio agent turn. MCP returns the exact pinned unresolved and passing results. The working model can still have the unresolved face. [D662](../studio-selected-face-repair-evidence-2026-11-11/README.md).

D663 protects a live sketch when switching to Model, Drawing or Render. Keeping the draft preserves dimensions, constraints and focus. The desktop flow finished one sketch and extruded it 18 mm. [D663](../studio-live-sketch-mode-exit-2026-11-11/README.md).

D664 restores the title, authored model, history and dirty flag when Undo or Redo crosses New part. The desktop run reopens the corrected recovery copy and preserves both saved project files. [D664](../studio-new-part-history-identity-2026-11-11/README.md).

D665 keeps all nine Drawing toolbar controls clear of the collapsed chat rail at both desktop sizes. Pointer and keyboard activation, 64 mm dimension placement and Fit sheet passed. [D665](../studio-drawing-toolbar-inset-2026-11-11/README.md).

D666 enables keyboard navigation and activation in More tools. Desktop Studio reached each enabled item, opened STEP options and Insert part, and returned focus on Escape. [D666](../studio-more-tools-keyboard-2026-11-11/README.md).

D667 restores Space activation to focused Browser buttons. Desktop Studio verified Box selection and focus on Escape, and the workspace palette retained the model selection when closed. [D667](../studio-browser-keyboard-2026-11-11/README.md).

D668 fits model bounds to the visible work area. Desktop Studio verified both chat states, keyboard F, the right dock sheet and automatic native-file fit. [D668](../studio-model-work-area-fit-2026-11-11/README.md).

D669 enforces a recognized approval requirement on the current Studio chat turn. Desktop Studio verified refusal of the direct L2 edit, user review and acceptance, exact Undo and the ordinary L2 controls. [D669](../studio-turn-approval-2026-11-11/README.md).

D670 carries the current approval requirement into state-backed CAD MCP. Direct edit and agent acceptance refused. Desktop Studio opened, reviewed and approved the pending proposal and restored it on Undo. [D670](../state-backed-turn-approval-2026-11-11/README.md).

D671 exposes all ViewCube directions to keyboard users. Desktop Studio verified keyboard focus and direction changes, pointer selection and drag orbit at two sizes. [D671](../studio-view-cube-keyboard-2026-11-11/README.md).

D672 synchronizes Ortho and AO with the live viewport. Desktop Studio verified keyboard toggles, line-only AO, a saved Render camera and Print preview restoration. [D672](../studio-view-toggle-state-2026-11-11/README.md).

D673 shows one startup instruction for an absent Chat server and the existing diagnostic for an unavailable CLI. Desktop Studio verified recovery on the same page and a successful controlled turn. [D673](../studio-chat-startup-2026-11-11/README.md).

D674 qualifies current-sheet SVG output for one Top-view leader moving between two A4 sheets at 5:1 and 2:1. Four actual SVGs and eight desktop sheet observations pass. [D674](../two-sheet-leader-svg-2026-11-11/README.md).

D675 verifies the depth-edited counterbore callout in four actual current-sheet SVG exports. [D675](../two-sheet-counterbore-svg-2026-11-11/README.md).

D676 prevents pitch-circle member signatures from changing the prior Undo document. Three real SVGs verify active, suppressed and restored states. [D676](../lost-diameter-svg-2026-11-11/README.md).

D677 verifies two late STEP reply orders across a same-name document switch in Studio. [D677](../step-preview-late-reply-2026-11-11/README.md).

D678 verifies STEP preparation across Master → Tall → Master and prevents automatic mate writeback from changing master placements during a variant preview. [D678](../step-shown-variant-2026-11-11/README.md).

D679 binds the actual STL geometry and companion record to the shown source through Master → unsaved Variant → Master. [D679](../stl-variant-source-2026-11-11/README.md).

D680 verifies Open of the exact D679 STL under mm and cm, with Cancel retaining the prior 8 mm draft. [D680](../stl-variant-roundtrip-2026-11-11/README.md).

D681 fixes binary STL Float32 collapse and verifies Studio refusal with no partial STL set and intact native Save/Open. [D681](../stl-float32-collapse-2026-11-11/README.md).

D682 cancels STL preparation on accepted document replacement and verifies real late replies after Cancel, same-name Open and document-boundary Redo. A genuine unavailable-family case for [#2425](https://github.com/barocss/barocss/issues/2425) stays open. [D682](../stl-late-reply-2026-11-11/README.md).

D683 exports the current Tall assembly through Studio and reopens the exact STEP bytes. Two independent readers verify AP214, units, world placement and the declared structure loss. [D683](../step-variant-roundtrip-2026-11-11/README.md).

D684 fixes file-name Undo/Redo and focused-button Space. Root reproduced both failures and verified the repair and its Browser and Clipboard controls. [D684](../studio-shortcut-focus-2026-11-11/README.md).

D685 fixes top toolbar clipping at the two reported desktop sizes. All 14 tools remain reachable, and the existing More tools and Templates keyboard flow passed. [D685](../studio-top-toolbar-overflow-2026-11-11/README.md).

D686 protects the Box draft on workspace requests and checks focus, Apply, Undo/Redo and simultaneous sketch and feature drafts in Studio. [D686](../studio-feature-mode-exit-2026-11-11/README.md).

D687 qualifies the compact Model rail, named Sketch and Extrude, selection-aware Hole and Fillet, and access to the grouped tools and search at the two selected desktop sizes. [D687](../studio-model-command-rail-2026-11-11/README.md).

D688 verifies actual 3MF output from Master, Tall and restored Master with an independent ZIP/XML reader. Studio refuses export while the placed mesh replies are pending. [D688](../three-mf-shown-variant-2026-11-11/README.md).

D689 freezes the B07 exchange cases. Automatic STL now discloses omitted visible placed parts. Actual export independently verifies the root-only mesh and Fine refuses the same assembly. [D689](../stl-assembly-loss-2026-11-11/README.md).

D690 reports editable CAD and assembly losses in the existing 3MF notice. Actual Studio and independent ZIP/XML checks cover Master, Tall, restored Master and a standalone part. [D690](../three-mf-loss-disclosure-2026-11-11/README.md).

D691 verifies the 80 × 50 × 10 mm standalone STEP box through actual Export, independent Part 21 checks and fresh Open of the same bytes. [D691](../step-standalone-roundtrip-2026-11-11/README.md).

D692 opens the exact D689 assembly-derived STL through the unit selector in a fresh Studio context. The independent reader confirms only the 160 × 60 × 4 mm plate. [D692](../stl-assembly-root-open-2026-11-11/README.md).

D693 verifies real Worker Float32 refusal and zero files written in Automatic and Fine. Its 35-input scan finds no eligible genuine unavailable fixture. [D693](../stl-worker-availability-2026-11-11/README.md).

D694 verifies the actual 3MF of a two-axis occurrence rotation, with independent world-coordinate and mesh checks. Pending placement refuses, and Undo/Redo restore the corresponding export. [D694](../three-mf-rotated-occurrence-2026-11-11/README.md).

D695 verifies late 3MF compression across a same-name Open and accepts the six frozen B07 v1 profiles. [D695 ledger](../b07-neutral-file-acceptance-2026-11-11/README.md).

D696 retains authored drawing tolerances through Auto rerun, first Undo/Redo, fresh Open and a real source edit. Independent SVG and DXF reads pass. [D696](../auto-dimension-tolerance-retention-2026-11-11/README.md).

D697 verifies Auto-layout refusal with two actual sources, retained Undo/Redo and output, and the agent proposal boundary for a failed continuation sheet. [D697](../auto-layout-refusal-2026-11-11/README.md).

D698 verifies Detail Hidden lines across the same sheet and split sheets, with native Save/Open and independent reads of six SVG/DXF pairs. [D698](../detail-hidden-lines-2026-11-11/README.md).

D699 verifies translated native caps, the actual Studio cut and miss, history and fresh Open, and late drawing-reply ownership. [D699](../section-translation-2026-11-11/README.md).

D700 applies Hidden lines to fully occluded axial cosmetic threads. Studio and eight independent SVG/DXF pairs cover history, fresh Open and a source edit. [D700](../axial-thread-visibility-2026-11-11/README.md).

D701 preserves detail dimensions and frames through deletion refusal, safe reuse, native Save/Open and eight SVG reads. [D701](../detail-annotation-ownership-2026-11-11/README.md).

Next MAIN is D702 / P2 B06, row 11. Freeze the B06 v1 acceptance checklist and check whether an accepted general tolerance note keeps its units on an inch drawing. [#2368](https://github.com/barocss/barocss/issues/2368).

Owner[#2287](https://github.com/barocss/barocss/issues/2287) stays later P4 contextual Inspector/command/focus research in tracks03/06; no immediate UI framework/redesign/download. B01/B02/B04 retain12/12,11/11,26/26 scope, D548two-sheet10/10/D549output3/3 are supplements, wholeB06 NOT_ADJUDICATED, B03positive tapped data-blocked, whole CAD/core NOT_MEASURED/noaggregatepercentage. Broader#540 remains open; no comments/closure.

D537 remains the public driven-sketch v1 single named LINE contract; it does not add general/multiple/radius bindings or bound topology editing. B01 uses a separate fully-defined ordinary rectangle, not that mixed2DOF profile. All34 stable rows remain unchanged. Whole CAD/core NOT_MEASURED; B01 v1 accepted12/12 scoped groups, B02 v1 accepted11/11, B04 v1 accepted26/26, B07 v1 accepted6/6, B09 v1 accepted9/9, B03, B05, B06, B08 and B10 NOT_ADJUDICATED, no aggregate baseline percentage. Legacy43% is historical.

Use the required SMALL/FEATURE/FULL tier and root's own actual desktop Studio flow. One bounded category milestone gets one decision and normal push to origin/local/cad-dev. Ordinary implementation/tests use Sol Medium; difficult geometry uses Sol High. Heavy work is serial under gate.sh. All writers freeze through actual execution and cleanup. Reuse exact eligible evidence; preserve every first failure. Downloads/paid live need owner permission each time. No new develop merge, release or UI redesign follows.

## Parallel tracks and gates

P2 in the new order means drawings/exchange. The historical manufacturing gate named P2 remains a separate held gate.

- CAD React: existing injected Model/Worker and Viewer architecture; D509 current runtime/docs functional PASS remains bounded. Readability and stable active-color screenshots remain partial. P0-R08/R09 precede dependent breadth. New component work needs actual props-change rendering and returned-document Studio proof; it does not block unrelated MAIN work.
- Physics library: D518 investigation completed, uncommitted local EXACT04 not adopted. Preserve represented/physical rank10/9 and tilted4908/7, published512/866 NO_GO boundaries and missing final checkpoint/archive qualification. Assess/carry the declared library candidate only; do not resume stopped chats/workers or infer Studio Physics authority. [D518](../physics-exact04-takeover-audit-2026-11-04/README.md).
- Hold Studio Physics/Motion, manufacturing/equipment/P2/PG11, broad fitter/NURBS/public-thicken/#2266 widening, nonzero-cone expansion, owner UI redesign, ASME PDF mismatch, schema5/migration, new WebGPU CI, release/npm/deploy under existing gates. Downloads and paid live executions need prior permission every time. Do not test mobile.

## Operating rules and proof boundaries

Read and retain the [previous handoff §5](../codex-handoff-2026-11-01/README.md#5-지킬-규칙-오너-결정). Latest owner instructions override old operating text. Use Sol Medium for ordinary implementation/testing and Sol High for difficult Boolean/B-rep/tolerance/geometry judgment; record the actual model used. Replies are short Korean; code, decisions, commits and issues are English. Keep UI explanation layers limited under the owner's later instruction.

Run one heavy job under gate.sh at a time. Do not write anything in the worktree while an actual Studio flow runs. Terminate only owned PIDs. The last test edit requires final Model tsc; whole kernel runs remain B-rep-core-only. Public API/geometry/tolerance changes need FULL review/mutations; new behavior needs FEATURE review/actual; private bounded repair needs SMALL checks/actual. Numerical claims require independent physical/native evidence, not display geometry or hashes alone. Raw logs/screenshots/archives stay outside Git; record commands/counts in small decision notes/qualification JSON.

When a new fix request comes from another lane while MAIN is active, assign the request to a separate agent. Keep MAIN moving. Coordinate file ownership and reserve the heavy gate for one run at a time.

D519/D520 do not claim new Studio/runtime/physical PASS; D521–D536 add only their recorded bounded controlled and actual Studio proofs. D482's later historical full-kernel result supersedes the old D433-latest wording but is not a current-head suite pass. D501/D505 custody failures and the owner-deferred PDF mismatch remain recorded. Close a related issue only after all its acceptance is supported; no issue is closed by this plan.

The exact previous handoff remains in [history-through-D518.md](history-through-D518.md). Its old next-item/WIP/latest statements are historical; use current roadmap for state. Earlier [D445](../core-cad-priority-2026-11-02/README.md) and [D446](../develop-integration-2026-11-02/README.md) remain scope/integration records, not current execution order.
