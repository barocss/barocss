---
work_id: D546
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

Latest delivery [D546](../b04-sheet-bracket-2026-11-05/README.md), P1 rows07/08/12/13/16, qualifies the existing scripted D121 sheet L bracket T1.5/2, R1.5, brief K0.44 and two bores. All10 selected groups pass: exact current source, thickness dependency, independent folded/flat truth, UI refusal/FIRST Undo/Redo, folded/flat display, own Save/Open, one actual AC1015 export/installed ezdxf1.4.5 read and post-Open edit. Root's first actual run has10 fresh Worker/new-Python joins,19snapshots/980unchanged pins; owned cleanup passes. Root views8 original PNGs. High numerical author/saved reviewer is independent of Medium browser author, not an additional numerical-source reviewer. Final Model types after final helper edit and syntax2 pass.

B04 v1 is accepted26/26 action groups: D544 Pipe8/Loft8 plus D546 Sheet10, across three independent finite Docs. Their28 actual bindings (18+10) are a different count. The original pre-run28-group prose was an arithmetic typo, explicitly corrected without changing selected groups/budgets. Sheet source is current CONTROLLED_SCRIPTED dispatchTool materialization, not historical person-authored/manual Studio creation. Independent first moments replace old kernel-derived centroid authority; all72 original pcurves are null/NOT_EXERCISED. One actual local generated DXF reads mm/4outerlines/2circles/bend/note/audit0errors0fixes, not shop calibration/fabrication or new output options. Exact hashes/commands/limits remain in the decision.

Next MAIN **D547 / P1 rows03/07/08/12/16** is existing Boolean/transform-pattern missing-consumer intake. Read D452/D453/exact retained source evidence, choose one distinct uncovered lifecycle and first reproducible defect, and avoid replaying accepted scopes merely for counts. B03 positive tapped is data-blocked. B01 v1 accepted12/12/B02 v1 accepted11/11 remain scoped. Whole CAD/core NOT_MEASURED; no aggregate baseline percentage. D545's settled-fit equality and palette visibility limitation remain separate; all original failure/custody/HOLD boundaries survive.

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
