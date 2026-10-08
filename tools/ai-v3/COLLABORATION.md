# Latest owner decision: autonomous Integration order (2026-10-08)

Under [#674](https://github.com/barocss/barocss/issues/674), Planner monitors
Issue evidence, adds useful candidates and checks the direction of [#660](https://github.com/barocss/barocss/issues/660).
Planner is not an assignment or adoption gate. Execute Integration chooses its
next serial integration work and order from actual ready native receipts and
dependencies. Module authors choose scoped work in their owned packages/examples,
freeze contracts in Issues and report clean native results. Candidate Issues
#678–#688 do not impose a fixed sequence. Agree cross-module interfaces in
Issues; do not infer a missing backend or dependency is ready.

Execute Integration remains the sole writer to the local integration branch and
shared root, lock, static and current policy paths. Reconcile each immutable
parent-to-child delta once, run one affected build and short actual flow, and
record exact first failures, limits and receipts in the responsible Issue.
The existing 10-minute monitor refills candidates and checks direction; it is
not an approval gate. No broader validation, publication, product push/PR,
release, new Work, model, supervisor or schedule change follows from this
order decision. This section supersedes older Planner-priority and fixed-queue
statements below; the older text remains historical evidence.

---

# Current serial Integration ownership (activated 2026-10-08)

The owner approved [#674](https://github.com/barocss/barocss/issues/674). GPU explicitly
released integration checkpoint `ccf13a0ba7665ec465aa60dc9610619c975e9d3f`.
Planner activated Execute Integration `01a119e4-00d7-7f93-92cd-40abb228e372`
at `2026-10-08T05:22:25.668636Z`. Execute Integration alone writes the local
integration branch and shared root, lock, static and current policy paths.
GPU owns GPU feature and backend implementation in its isolated checkout.
CAD, Loader, Motion, Canvas2D and Viewer retain their claimed module paths.
Planner sets priorities, dependencies, module contracts and release scope; it
does not merge product code. Integrate each immutable parent-to-child delta once,
serially, with an affected build and one short actual consumer flow. Record exact
SHAs, first failures, support limits and receipts in the responsible Issue.
Semantic API or scope changes return to the author and Planner.

This current owner decision supersedes older sole-GPU integration statements below.
The older text remains historical evidence. No product push, PR, npm publication,
deployment, release, broad deferred validation, scheduler or model change follows
from this writer transfer. Preserve inherited user files, hosts and Release 0.12.2.

---

# Current owner lanes and specifications (2026-10-08)

The owner explicitly created separate Canvas2D and Viewer Execute Works under
[family #660](https://github.com/barocss/barocss/issues/660), in addition to Motion.
This supersedes the Motion-only new-Work exception below; no further Work,
scheduler or model change is authorized.

- [Canvas2D #664](https://github.com/barocss/barocss/issues/664) owns only new
  `packages/barocss-canvas2d/` and `examples/canvas2d-scene/`: logical pixels,
  X-right/Y-down, own specialized WebGL2 2D passes. No fake CAD packets/Pixi kernel.
- [Viewer #665](https://github.com/barocss/barocss/issues/665) owns only new
  `packages/barocss-viewer/` and `examples/viewer-scene/`: a reusable facade over
  our GPU/native Loader with real model metadata, fit, display picking and disposal.
  Default rendering uses our GPU, one canvas; no fake native identity workaround.
- GPU still owns sole serial product/root/lock/static/policy integration and any
  common/public GPU backend. Viewer proposes the needed multi-packet render API
  before using it; other lanes never copy/edit GPU internals. Existing CAD/Loader/
  Motion ownership and exact native parent/child handoffs remain distinct.

The [Product Vision](https://github.com/barocss/barocss/wiki/3D-Library-Product-Vision),
[Living Specification](https://github.com/barocss/barocss/wiki/3D-Library-Specification)
and [Execution Backlog](https://github.com/barocss/barocss/wiki/3D-Library-Backlog)
organize the human-readable contracts/manuals. ALL concrete tasks, bugs and
validation debt remain in GitHub Issues. Report meaningful exact SHA/build/run and
changed API/version/unit/frame/identity/ownership/support/lifecycle facts once;
keep native implementation, local integration and registry publication distinct.
The existing six-lane monitor cadence/notification preferences remain unchanged.
Current prototype gates, own engines, user-state preservation and separate release
permission below continue to apply. Professional parity and unrun targets stay unclaimed.

---

# Current owner goal — public 3D library family (2026-10-08)

The active goal is our own reusable public GPU, CAD, native Loader and Motion
libraries: [#660](https://github.com/barocss/barocss/issues/660). Editor/gallery/demos
are reference consumers. The owner activated the replacement Codex goal; the
previous failed replacement is historical evidence. Commercial CAD remains the
full geometry/topology/features/constraints/documents/assemblies/exchange pillar
under [#503](https://github.com/barocss/barocss/issues/503), not a fixture-only goal.

GPU owns its package and sole serial local product/root/shared/policy/lock
integration. CAD owns its package/native examples; Loader owns interop/adapters.
The explicitly owner-created Motion Work owns only new `packages/barocss-motion/`
and `examples/motion-scene/` under [#659](https://github.com/barocss/barocss/issues/659).
Planner owns scopes/Issues/manuals/coordination. No other permanent Work, scheduler
or model change is authorized. Spatial/Interaction/Physics remain planned.

Libraries use own algorithms and documented version/unit/frame/identity/ownership/
resource/lifecycle/error contracts. External projects are references or explicitly
requested renderer consumers, not replacement kernels. Public configuration means
`private:false`, public access and real compiled JS/declarations; repository `src`
development stays explicit. Native source/topology stays authoritative; display
buffers/GLB/animated poses are separate. Motion must not mutate native CAD models.

Source0 Surface PreviewPacket preserves authored XYZ and declares Y-up; native
Loader658 scales that convention once. Z-up needs an explicit host adapter.
Only separate native-face-mesh `part-xyz` uses `(x,z,-y)` in its display adapter.
Motion's own `part-xyz`/seconds/mm contract needs explicit consumer frame mapping;
never silently retag old packets or assume one universal CAD up axis.

ALL work/bugs/followups/deferred validation are tracked in GitHub Issues. Claim
bounded scopes, preserve other lanes and immutable parents, reconcile each child
once, and record exact task/merge SHAs/actual receipts. Native CAD completion and
integrated availability reach both GPU and Loader once. GPU merges serially.

Current prototype gate: implement → affected build → ONE short actual API/source/
demo/browser flow → continue. Preserve first failures. Broad units/readers/packed/
archive/parity/full guards/gallery/workspace/performance/certification and Review
campaigns are deferred to a separately scheduled phase. Never `verify-local.py`
or a standing Review gate. Docs-only reversible edits need exact path/diff checks,
not product builds. Do not claim unrun targets or professional/CAD completion.

Preserve user scenes/drafts/tabs/hosts, paused629, render/kiosk and approved
Release0.12.2. Local public configuration is not npm publication. Actual publication,
product push/PR/deploy/release needs separate authority. Keep monitor cadence,
notifications, models and paused supervisor state. This section and newer Issue
contracts supersede conflicting old goal/private/no-Motion/broad-gate text below,
which is retained as historical policy/evidence.

---

# BaroCSS Work collaboration

## Current owner decision: parallel GPU and CAD (2026-10-06)

Current continuation: GPU #501 and CAD #502 use the identical preview packet v0 contract.
#499 and #500 are completed baselines. The fixed GPU/CAD owners and sole GPU integrator
continue for #501/#502; both branches run independently, with one serial merge/postcheck
at a time. CAD records any shared registration proposal in #502. Existing primitive APIs,
private status, inherited changes and Release authority remain preserved.

This section supersedes conflicting single-Execute selection rules below for this pair.
Planner owns GitHub scope, priorities and interpretation. Execute GPU
`01a0cc08-dfb5-7142-90d9-77574034103d` has the fixed #501 implementation claim (completed baseline #499).
Execute CAD `01a10cee-3bbd-7012-abb7-bc09b2d6048c` has the fixed #502 claim (completed baseline #500).
Both implement concurrently in separate local branches/worktrees with disjoint package files.
GPU owns `packages/barocss-gpu/`; CAD owns `packages/barocss-cad/`.
Examples belong under `examples/`; packages belong under `packages/`.

GPU Execute alone edits root manifests, workspace lockfile and current policy headers.
CAD records any required shared registration as a proposed patch in #502.
GPU Execute is the sole local develop integrator for both tasks. It may integrate a verified
CAD branch while GPU implementation continues, but performs one no-ff merge and its mandatory
post-merge verification at a time. Each task requires its own prechecks, independent consumer
evidence and exact merged-head postchecks before closure with SHAs. No standing Review gate.
Scoped transient helpers remain authorized inside each assigned Issue; no duplicate claims.

Routine evidence and integration readiness belong in the assigned Issue. Contact Planner only
for material scope, ownership or unresolved verification blockers. Development stays local:
no product push, task PR, deployment, publication or live-model run. Preserve inherited dirty
files, kiosk recordings, inactive Review history and active Release 0.12.2 authority/work.
Do not restart the Claude supervisor. Historical text below remains reference material.

---

Current development has two active roles: Planner and Execute. Existing Review is inactive;
its history and worktrees remain preserved. No automatic call or approval/wait dependency on Review.

Planner owns GitHub Issues, Wiki, Discussions, priorities and prepared scope/acceptance/tests.
Execute independently claims the highest-priority ready Issue, implements, verifies, commits,
merges locally as sole serial integrator, records completion and takes the next Issue.
Normal progress requires no role-to-role question, assignment or approval wait. Durable Issue bodies
and results carry routine coordination. Message only when a real scope/product decision, ownership
conflict, missing permission or unresolved safety failure blocks work; include Issue, evidence,
impact and the smallest decision needed. Continue safe independent work where possible.

## Transient helpers (owner authorization, 2026-10-01)

Both Planner and Execute may use multiple transient helper agents when useful, without asking again.
Start with at most TWO helpers, only for concrete independent work within the authorized scope.
Planner may delegate independent research, Issue preparation and analysis with reproducible evidence;
Planner retains prioritization and final Issue/Wiki/Discussion decisions, and does not delegate product
implementation. Execute may split independent implementation, tests and verification inside its ONE
selected Issue. Execute alone performs final product integration; helpers never merge shared develop.

Every assignment names the bounded scope, dependencies, file/branch/worktree owner, completion
conditions and required result evidence (exact SHAs, commands/results or sources, plus limitations).
Use isolated branches/worktrees for edits and never edit the same file concurrently. Do not duplicate
claims, create extra permanent Works, expand product scope or restore a standing Review/approval loop.
The primary role directly continues the core task while helpers work. Consume useful results as they
arrive; wait only at a genuine dependency, never for every helper as one batch. If a helper is slow,
continue safe independent work or narrow its task instead of moving the entire role into waiting.

Before parallelizing a wait, identify evidence: CI, tool/process, connection, another role or a task
dependency (IDLE/paused is a separate operating state). Cite the specific run/command/message and what
result is needed. Do not infer thinking time from wall-clock gaps. Parallelize only independent work
that shortens a real dependency; do not invent tasks to occupy agents. Existing local git, mandatory
validation, private-evidence and release boundaries remain intact.

Public API/CSS semantics and other consequential changes retain compatibility rationale and exact
commit/test evidence; they do not restore Review as an always-on role. Existing deterministic tests,
package guards and runtime fuzz remain mandatory according to affected scope.

Development/checkpoints stay in local git with commits and branch merges until final release.
Planner consolidates one release Issue with scope, completion conditions and candidate validation;
when ready, it records one handoff to existing Release Work 01a0f29f-0a94-751c-b710-7ec88d91c00a.
Release owns existing protected PRs/Actions; no bypass of branch protections. Its approved 0.12.2
work is already active and must not be interrupted, edited or dispatched again.

Keep GitHub/code/inter-Work records in English and user communication in Korean. Preserve automatic
approval rejections; never route a denied action through another Work. Private security repros and
unapproved launch material remain private. Paid experiments/new downloads still follow owner
authorization. Never kill another session's processes or restart the paused Claude supervisor.
