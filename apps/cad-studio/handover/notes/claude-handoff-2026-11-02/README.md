---
work_id: D549
artifact_type: current-cad-handoff
status: ready-for-next-bounded-task
last_updated: 2026-11-10
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

Latest delivery [D549](../section-detail-svg-output-2026-11-05/README.md), P2 rows11/12/13/16, qualifies existing D455 exact H12 Section A/Detail B Open/current actual SVG/post-export retention3/3 on root's first actual run. No creation/edit/refusal/Undo/project loop is replayed. One new current Drawing pair is raw-V8 sealed and reused exactly twice across3current Doc/UI/Python observations. New controlled inspector calls during Studio0 does not mean zero actual Worker/native computation; internal Worker/kernel call counts are NOT_MEASURED. Source-body control and explicit split are2separate evaluations of one H12physical class, with controlled section provider0.

New independent whole-body V27834.34520557/C[30.4834813927,19.9839044544,6], full graph/genus1/42presentUV and current native first moments pass1e-9; same original section cut genus0 hasY23/chord8/cap624. Detail paperboreR10 and clipR12 remain distinct. Actual SVG12927B/b9f4964b… independently readsA3mm/currenttitle/date/SRC/geometry within existing5.0001e-5 SVG coordinate envelope; selected cap max3.74315355e-5. File association is exact source/current Worker/controlled-native class, not embedded BRep or API byte parity. Post-export Doc/body/history/dirty and original H10signature cache remain exact.

Root finalsyntax2/Modeltypes02 follow final helper edits; five source-only browser blockers were repaired before any scenario. Current native/independent controls firstPASS, actual firstPASS with3snapshots/791unchanged pins, offline font handling, allowned close callbacks and Node28892/Chrome28910 absent. Root views3originalPNGs; High numerical author independently reviews Medium browser and saved evidence, no scenario replay. An unsupported optional V8 reserialize byte-canonicality assumption was rejected as audit-only, not runtime/raw failure. DEBUGstderr12CVDisplayLink+1allocator differs from page/console errors0. D548 original failures and04unknown/orderly-cleanup gap remain immutable; its broad zero-evaluation label receives only an additive inspector-scope clarification.

Next MAIN **D550 / P2** is supported Auto-dimension completeness intake for this exact Section/Detail profile's retained HOLE_SIZE_MISSING/HOLE_NOT_LOCATED/OVERALL_MISSING warnings. Inspect current action/native reference/value/placement policy first, freeze actual annotation/history/output/persistence scope and geometry/source reuse eligibility before executing. Do not declare an implemented command missing, recreate geometry or auto-adopt tolerance data. Existing native/SVG/hatch approximations and owner PDF HOLD remain.

Owner[#2287](https://github.com/barocss/barocss/issues/2287) stays later P4 contextual Inspector/command/focus research in tracks03/06; no immediate UI framework/redesign/download. B01/B02/B04 retain12/12,11/11,26/26 scope, D548two-sheet10/10/D549output3/3 are supplements, wholeB06 NOT_ADJUDICATED, B03positive tapped data-blocked, whole CAD/core NOT_MEASURED/noaggregatepercentage. Broader#540 remains open; no comments/closure.

D537 remains the public driven-sketch v1 single named LINE contract; it does not add general/multiple/radius bindings or bound topology editing. B01 uses a separate fully-defined ordinary rectangle, not that mixed2DOF profile. All34 stable rows remain unchanged. Whole CAD/core NOT_MEASURED; B01 v1 accepted12/12 scoped groups, B02 v1 accepted11/11, B04 v1 accepted26/26, B03 and B05–B10 NOT_ADJUDICATED, no aggregate baseline percentage. Legacy43% is historical.

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
