---
work_id: D530
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

Latest delivery [D530](../public-mass-provenance-2026-11-05/README.md) exposes actual native mass method and existing tessellated volume estimate through both facades, including deferred/wire/placement.126 controlled checks,185 docs samples,11 killed mutants/two FULL source approvals, types/lint and root exact-input-bound native Worker plus Studio material/BOM/UndoRedo/Save/freshOpen pass. No numerical formula or tolerance changes. Forced fallback is controlled; packed/declaration/version-crossing compatibility and general accuracy remain separate.

Earlier R01–R09 bounded records are linked from the [P0 queue](../../roadmap-tracks/01-reliability.md). Retain D524's native-collision UNKNOWN and unchanged cross-copy tolerances, D525's controlled-only startup/disposal/Undo-action boundaries, D527's16-per-evaluator capacity boundary, D528's explicit caller-only restart, and D529's selective-copy/shared-Owner/unknown-extension contract. The current index owns status; the handoff does not repeat the decision ledger.

**D531 / P0-R11: public STEP loss channel.** First qualify eligibility of the retained independent readback: current exchange-profile-producer.mjs can recreate /tmp/barocss-d406-forward-fixed/{box,assembly}.bcad/.step using exportStudioStep(doc,{name:'D404 '+name,timestamp:'2026-11-01T00:00:00'}). Compare current generated Docs and complete STEP bytes to preserved inputs and pinned D406 reader hashes; fail closed on any mismatch, no header stripping. Native OCP/source/build were removed as requested. Stdlib /tmp/barocss-d437-independent/part21-components.py exists and matches D442 pin but is a token/reference/reachability reader, not geometry proof. Prior native readback can be reused only for identical inputs, never described as a fresh read.

Model api/core.stepOf currently discards the existing exportStudioStep report except band-sheet refusal. Prefer an additive stepReport capability while keeping legacy step(name):string compatible. CAD native exporter currently returns only text: a backend with no report must refuse via existing UNAVAILABLE, never synthesize omitted:[] or imply loss-free geometry. Full both-facade loss support is a separate producer contract. Reuse the current Model report and existing Studio STEP Preview/Cancel flow; do not add a second loss scanner. Public fixed-timestamp options or a disclosed test clock are needed for exact facade-byte replay. FULL two audits/mutations and actual Studio; writer/geometry/HOLDs unchanged. If exact reader reuse cannot be established without a new download, preserve the gap and advance R12 or other unheld work.

Use the selected SMALL/FEATURE/FULL tier, required checks and root's own actual desktop Studio flow. One bounded category milestone gets one decision and normal push. Reuse eligible passing antecedents; preserve first failures and rerun only failed/changed steps with necessary setup. Every announcement names P priority, row IDs, concrete acceptance and measured coverage. Whole CAD/core readiness remains NOT_MEASURED; frozen legacy43% is not current progress.

## Parallel tracks and gates

P2 in the new order means drawings/exchange. The historical manufacturing gate named P2 remains a separate held gate.

- CAD React: existing injected Model/Worker and Viewer architecture; D509 current runtime/docs functional PASS remains bounded. Readability and stable active-color screenshots remain partial. P0-R08/R09 precede dependent breadth. New component work needs actual props-change rendering and returned-document Studio proof; it does not block unrelated MAIN work.
- Physics library: D518 investigation completed, uncommitted local EXACT04 not adopted. Preserve represented/physical rank10/9 and tilted4908/7, published512/866 NO_GO boundaries and missing final checkpoint/archive qualification. Assess/carry the declared library candidate only; do not resume stopped chats/workers or infer Studio Physics authority. [D518](../physics-exact04-takeover-audit-2026-11-04/README.md).
- Hold Studio Physics/Motion, manufacturing/equipment/P2/PG11, broad fitter/NURBS/public-thicken/#2266 widening, nonzero-cone expansion, owner UI redesign, ASME PDF mismatch, schema5/migration, new WebGPU CI, release/npm/deploy under existing gates. Downloads and paid live executions need prior permission every time. Do not test mobile.

## Operating rules and proof boundaries

Read and retain the [previous handoff §5](../codex-handoff-2026-11-01/README.md#5-지킬-규칙-오너-결정). Latest owner instructions override old operating text. Use Sol Medium for ordinary implementation/testing and Sol High for difficult Boolean/B-rep/tolerance/geometry judgment; record the actual model used. Replies are short Korean; code, decisions, commits and issues are English. Keep UI explanation layers limited under the owner's later instruction.

Run one heavy job under gate.sh at a time. Do not write anything in the worktree while an actual Studio flow runs. Terminate only owned PIDs. The last test edit requires final Model tsc; whole kernel runs remain B-rep-core-only. Public API/geometry/tolerance changes need FULL review/mutations; new behavior needs FEATURE review/actual; private bounded repair needs SMALL checks/actual. Numerical claims require independent physical/native evidence, not display geometry or hashes alone. Raw logs/screenshots/archives stay outside Git; record commands/counts in small decision notes/qualification JSON.

D519/D520 do not claim new Studio/runtime/physical PASS; D521–D530 add only their recorded bounded controlled and actual Studio proofs. D482's later historical full-kernel result supersedes the old D433-latest wording but is not a current-head suite pass. D501/D505 custody failures and the owner-deferred PDF mismatch remain recorded. Close a related issue only after all its acceptance is supported; no issue is closed by this plan.

The exact previous handoff remains in [history-through-D518.md](history-through-D518.md). Its old next-item/WIP/latest statements are historical; use current roadmap for state. Earlier [D445](../core-cad-priority-2026-11-02/README.md) and [D446](../develop-integration-2026-11-02/README.md) remain scope/integration records, not current execution order.
