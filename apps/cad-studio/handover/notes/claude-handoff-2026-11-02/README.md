---
work_id: D536
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

Latest delivery [D536](../mixed-line-dimension-2026-11-05/README.md) qualifies the actual mixed R3 profile's numeric driving-line Edit sketch/Finish lifecycle.7 fresh Worker/native/Python bindings,3 final native packets/4 exact reuses,14 snapshots and5 identity controls pass. Separate source-prefix observations check pre-Fillet geometry; actual-corner line/arc moments and native cap integration agree. Constraint residual limits1e-7mm/1e-9rad remain distinct from native1e-9; the sketch retains2 free DOF. Hole/construction e11/IDs/tags/R3/HV/tangents/downstream Fillet references stay exact. Root views original PNGs; Sol High approves saved original byte/source/physical evidence. Source760 pins stay unchanged through cleanup, including explicit editor settle/outlineFields inputs. Own OPFS namespace/resources are removed/closed,0 errors/changes/downloads. A64 is saved/reopened; B68 is the subsequent dirty edit, not resaved.

Original oracle01 S reporting TypeError remains FAIL; A/B and its chained type check NOT_RUN. Root fixes only the count-container expression; High approves no math/tolerance/inspector change. Oracle02 passes the same preserved native reads, then syntax/final Model types and actual Studio pass. The source-capsule path addition was caught before Studio, not an actual runtime failure. D533's original Open readiness-harness FAIL and separate continuation PASS also remain unchanged.

R01–R12 bounded records and all D524–D532 limits remain in the [P0 queue](../../roadmap-tracks/01-reliability.md). D534/D535 retain their finite pattern/Shell scopes and historical-versus-current geometry authority. Keep native-collision UNKNOWN, public ownership/provenance limits and exact-input historical reader reuse. CAD-native STEP reporting stays unsupported; no fresh OCP setup/read/download. B01–B10 NOT_ADJUDICATED, whole CAD/core NOT_MEASURED.

**D537 / P1: named mixed-sketch driving-length contract, rows03/04/12/16.** Source audit establishes that this is not just a UI selector gap. SketchOutline lengths/radii and solver/profile metadata are numeric; outlineFields performs a solve only during its numeric setter. ParametersPanel dictionary updates do not solve ordinary outlines, and native lowering removes outline and uses stored solved segments. Generic binding only accepts single changed leaves. Do not substitute coordinate-leaf/Height binding or manually insert expression objects into ordinary numeric outline metadata. Reader acceptance of untyped metadata is not binding support.

Prepare a concrete compatible design before implementation. A candidate explicit driven-sketch Model kind can keep schema3's old unknown-kind refusal, store a numeric authored seed plus declared semantic driving-length references, resolve parameters and solve temporary numeric geometry before native lowering, preserve stable identities, and refuse missing parameters/failed solves/unsupported topology atomically. Do not silently widen existing ordinary sketch fields or start schema5/migration. This public Model/producer contract requires FULL review with High solver authority, two independent audits, meaningful mutations, affected types/docs/consumer checks and root actual Studio/API/persistence proof. Define bind/unbind, rename/remove and direct-edit behavior explicitly before coding; do not grow a generic expression framework. Existing single-leaf feature bindings remain unchanged.

Use D536's exact seed/actualA evidence only at its numeric-driving scope; named binding is still UNRESOLVED. First measure current reader/evaluation behavior, then select the bounded compatible implementation and reusable positive/negative examples. Root owns actual desktop execution under the serial gate, all worktree writers frozen through cleanup. Preserve every earlier driver/source capsule/first failure. No new CI/WebGPU/dependency/download/whole campaign; all geometry/UI/Physics/Motion/manufacturing/release HOLDs remain.

Use the selected SMALL/FEATURE/FULL tier, required checks and root's own actual desktop Studio flow. One bounded category milestone gets one decision and normal push. Reuse eligible passing antecedents; preserve first failures and rerun only failed/changed steps with necessary setup. Every announcement names P priority, row IDs, concrete acceptance and measured coverage. Whole CAD/core readiness remains NOT_MEASURED; frozen legacy43% is not current progress.

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
