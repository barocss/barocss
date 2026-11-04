---
work_id: D533
artifact_type: current-cad-handoff
status: ready-for-next-bounded-task
last_updated: 2026-11-05
---

# CAD continuation — current entry point

Read this document completely, then the [current roadmap](../../roadmap.md), [D519 package and Studio audit](../cad-package-studio-audit-2026-11-04/README.md), [D520 replan](../cad-roadmap-replan-2026-11-04/README.md) and [P0 acceptance queue](../../roadmap-tracks/01-reliability.md). The roadmap is the only current status index. This D520 entry point supersedes the old chronological handoff and D445 execution order; preserve D445/D446 and later canonical proofs at their recorded scopes.

Read the [129-ID requirement registry](../../roadmap-tracks/07-requirement-registry.md) and [live issue destinations](../../roadmap-tracks/06-github-issues.md). They preserve15 CAD epics and map85 CAD-title plus16 related open issues; coverage is not yet adjudicated. Recent #2284/#2285/#2286 are research/interaction proposals, not ready implementation or lifted gates.

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

Latest delivery [D533](../hole-chamfer-lifecycle-2026-11-05/README.md) qualifies one composed Through Hole+Chamfer lifecycle, no product change:8 selected groups through10 successful physical/Worker bindings,3 unique native A/B/C classes,5 focused tests, syntax/diff/final Model types. Root actual create/upstream-edit/FIRSTUndoRedo/refused-new-preview/projectSave and a pinned continuation fresh project Open/post-Open Hole4→6 pass at unchanged1e-9 limits. Sol High approves saved physical/source evidence; root views original images. Original Studio01 Open readiness-harness FAIL remains, SHA-256 d69676a2b6a4b4f9ecf62af26b57a993c6aefe8d61380cdc5de1137fb69eb327. The expected Doc now precedes freshness waits; no expected-numeric polling or weak oracle. Studio02 supplies separate PASS, not a corrected full-from-scratch replay. All757/758 source closures stay unchanged during their own runs; only browser guard/continuation source changes across runs. Both own OPFS namespaces/resources are removed/closed.

R01–R12 bounded records remain in the [P0 queue](../../roadmap-tracks/01-reliability.md). Retain all D524–D532 per-record limits, native-collision UNKNOWN, public ownership/provenance policies and D531 exact-input historical native-reader reuse. CAD-native loss-report production remains unsupported; no fresh OCP setup/read/download occurred. B01–B10 remains NOT_ADJUDICATED; whole CAD/core NOT_MEASURED.

**D534 / P1: existing Linear cut-pattern source/spacing/suppression lifecycle, rows08/12/16.** Match D373's versioned accepted input: apps/cad-studio/handover/notes/linear-cut-pattern-closeout-2026-10-31/run-01/accepted.bcad, SHA-256020a7942b1fb4cc177b13c43bf0561c2002094ea5afc82ca3841cbccd900944c. Existing source60×30×10, tool rectanglex8..12/y8..12 Through Cut, XSpacing16/Count3. D373 creation/refusal/Count2↔3/file proof is retained historical scope, not a new source edit result. Current command only accepts an active single-solid difference; do not substitute a Hole result or body pattern. Read existing versioned linear-cut-pattern-browser.mjs and D373 oracle, which fixes spacing16.

First have Sol High freeze one safe integer-prism native/independent profile; proposed missing path is tool Width4→6, Spacing16→12, Count3→4, invalid Spacing0 accepted-state retention, FIRSTUndoRedo, Suppress/Unsuppress, own project Save/Close/reload/Open and post-Open Spacing12→10. Inventory actual edit/suppression semantics before implementation; no runtime/native admission is yet qualified. Extend reusable verification sources only as needed. Do not replay passed prefixes, broaden geometry, replace a failed input or relax budgets.

Root runs its own actual desktop flow under the serial gate, every worktree writer frozen through cleanup. No new CI/WebGPU job, dependency, download or whole campaign. Existing reader cleanup, broad geometry, UI, Physics/Motion and release HOLDs persist.

Use the selected SMALL/FEATURE/FULL tier, required checks and root's own actual desktop Studio flow. One bounded category milestone gets one decision and normal push. Reuse eligible passing antecedents; preserve first failures and rerun only failed/changed steps with necessary setup. Every announcement names P priority, row IDs, concrete acceptance and measured coverage. Whole CAD/core readiness remains NOT_MEASURED; frozen legacy43% is not current progress.

## Parallel tracks and gates

P2 in the new order means drawings/exchange. The historical manufacturing gate named P2 remains a separate held gate.

- CAD React: existing injected Model/Worker and Viewer architecture; D509 current runtime/docs functional PASS remains bounded. Readability and stable active-color screenshots remain partial. P0-R08/R09 precede dependent breadth. New component work needs actual props-change rendering and returned-document Studio proof; it does not block unrelated MAIN work.
- Physics library: D518 investigation completed, uncommitted local EXACT04 not adopted. Preserve represented/physical rank10/9 and tilted4908/7, published512/866 NO_GO boundaries and missing final checkpoint/archive qualification. Assess/carry the declared library candidate only; do not resume stopped chats/workers or infer Studio Physics authority. [D518](../physics-exact04-takeover-audit-2026-11-04/README.md).
- Hold Studio Physics/Motion, manufacturing/equipment/P2/PG11, broad fitter/NURBS/public-thicken/#2266 widening, nonzero-cone expansion, owner UI redesign, ASME PDF mismatch, schema5/migration, new WebGPU CI, release/npm/deploy under existing gates. Downloads and paid live executions need prior permission every time. Do not test mobile.

## Operating rules and proof boundaries

Read and retain the [previous handoff §5](../codex-handoff-2026-11-01/README.md#5-지킬-규칙-오너-결정). Latest owner instructions override old operating text. Use Sol Medium for ordinary implementation/testing and Sol High for difficult Boolean/B-rep/tolerance/geometry judgment; record the actual model used. Replies are short Korean; code, decisions, commits and issues are English. Keep UI explanation layers limited under the owner's later instruction.

Run one heavy job under gate.sh at a time. Do not write anything in the worktree while an actual Studio flow runs. Terminate only owned PIDs. The last test edit requires final Model tsc; whole kernel runs remain B-rep-core-only. Public API/geometry/tolerance changes need FULL review/mutations; new behavior needs FEATURE review/actual; private bounded repair needs SMALL checks/actual. Numerical claims require independent physical/native evidence, not display geometry or hashes alone. Raw logs/screenshots/archives stay outside Git; record commands/counts in small decision notes/qualification JSON.

D519/D520 do not claim new Studio/runtime/physical PASS; D521–D533 add only their recorded bounded controlled and actual Studio proofs. D482's later historical full-kernel result supersedes the old D433-latest wording but is not a current-head suite pass. D501/D505 custody failures and the owner-deferred PDF mismatch remain recorded. Close a related issue only after all its acceptance is supported; no issue is closed by this plan.

The exact previous handoff remains in [history-through-D518.md](history-through-D518.md). Its old next-item/WIP/latest statements are historical; use current roadmap for state. Earlier [D445](../core-cad-priority-2026-11-02/README.md) and [D446](../develop-integration-2026-11-02/README.md) remain scope/integration records, not current execution order.
