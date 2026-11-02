---
work_id: physics-world-p5-2276
artifact_type: current-domain-provider-and-caller-inventory
status: read_only_source_review_no_p5_implementation_or_execution
owner_role: common-world-domain-migration-inventory
source_request: extract current cloth and fluid kernels into common World ownership and update all active callers directly
last_updated: 2026-11-02
---

# Current boundary

Inspected checkout `/Users/user/Documents/ChatGPT/barocss-physics-motion-2276`,
branch `codex/physics-world-p4-2276`, HEAD
`8cdaf2d03f3b377b2ada8686f3ec6090b5d24d8b`. P4 WIP was present and was not
changed. This document is the only P5 output. No P5 branch, implementation,
World, numerical helper, browser, build, or test was run.

P0's caller inventory was used as an index. Paths and current source below
were read again. Frozen P0 files and historical numerical evidence are not
editable migration targets. The current roadmap's P5 row is independent of
the unfinished P4 stack exit. P5 does not make a P4 NO_GO pass.

Authorities: `packages/barocss-physics/design/p0/{CONTRACT.md,MIGRATION.md,types.ts,profiles.json,validation.json}`;
`packages/barocss-physics/ROADMAP.md:215`; current runtime
`packages/barocss-physics/src/`. P0 describes target behavior, not a current
domain implementation or a fresh numerical PASS.

# Providers, state and ownership

| Current provider | Accepted inputs and clock | Mutable ownership and outputs | Extraction boundary |
|---|---|---|---|
| `src/cloth.ts` → `cloth/world.ts:createClothWorld` | Fixed `ClothSceneV1`; 1/120 s; at most240 host steps. 289 vertices,512 triangles,pins0/16; XPBD8 substeps ×2 iterations. | World owns sheet, velocities, diagnostics and step index; solver owns `before` scratch. Getter copies position/velocity/topology/pins plus collider metadata. | Remove the public runtime factory and `ClothWorld`/old scene/state lifetime DTO. Admit explicit common-model cloth data and a static sphere; invoke internal XPBD stages under common World. |
| `src/fluid.ts` → `fluid/world.ts:createFluidWorld` | 256 particles; 1/120 s; at most3600 steps. v1 ordinary PBF; v2 exact XSPH coefficient0.15. | World owns copied initial/accepted positions, velocities, rest density, diagnostics, obstacle-hit count and step index. `PbfSolver` owns scratch and optional static box. | Remove the public runtime factory and its independent step/reset/clock. Preserve kernel order and admitted initial-position domain. |
| `src/fluid-cad.ts` → `fluid/cad-world.ts:createCadFluidWorld` | v1 fluid only; one static axis-aligned CAD-derived box. Source text/revision is checked before step/reset. | Wrapper owns proxy and another public-style fluid World. Getter allocates an additional wrapper DTO after the inner World advances. | Remove this runtime subpath/factory/wrapper clock. The existing CAD adapter supplies an ordinary static body/collider and source binding to the common model. |

`package.json` currently exposes all three subpaths through workspace
`src/*.ts` and published `dist/*.js`/declarations. Each reexports the canonical
`PhysicsError`. `createFluidWorldWithObstacle` is an internal exported function
in `fluid/world.ts`, called by `fluid/cad-world.ts`; it must not survive as a
second numerical World behind the new common API.

The old numerical constants remain physical authority for the selected visual
profiles: cloth uses `cloth/profile.ts`, topology/constraints/metrics; fluid
uses `fluid/constants.ts`, PBF/kernel/boundary/static-box/visual-viscosity.
This review does not requalify them or change their tolerances.

## Cloth continuation state

`cloth/world.ts:42–53` copies positions/velocities but makes
`candidate = {...sheet, positions}`. Constraint objects remain shared with the
accepted sheet. `cloth/constraints.ts:19–21` updates `constraint.lambda`.
`cloth/solver.ts:22` zeros every lambda before each substep's projections;
`before.set(p)` precedes each substep, then velocities are reconstructed in the
original order. These source facts suggest reusable scratch boundaries; they
do not establish retention under every new shared-commit failure.

The existing `cloth-world-probe.mjs:115–146` already injects nine damaged
post-solver candidates, compares the retained public state, and compares the
next valid step with a control. Reuse that evidence boundary. It does not test
failure during shared return/log preparation or arbitrary mid-projection
continuation state. P5 must add those affected boundaries instead of claiming
that no prior retention test exists.

Preferred extraction: immutable topology/rest/masses/pins/constraint definitions
come from admitted copied model data; candidate positions, velocities and
mutable lambdas are candidate-owned. Keep XPBD arithmetic and order unchanged.
`before` may remain reusable private scratch only with a proven complete
write-before-read path. Do not invoke an old World to generate candidate state.

## Fluid continuation state

`fluid/pbf.ts:9–17` owns `NeighborGrid`, predicted positions, combined
particle/floor positions, density, lambda, correction and optional smoothing
arrays, plus obstacle hits. `step()` resets obstacle hits and writes each
predicted component; each density pass writes every lambda/correction.
`kernel.ts:densities` rebuilds the grid before neighbor visits. XSPH rebuilds it
against the completed candidate positions and writes all smoothing components
before `velocities.set(output)`.

`NeighborGrid.rebuild()` retains its positions argument, resets head/tail and
writes particle links. Thus it can retain the combined scratch or, after XSPH,
a candidate position buffer. After a refusal/reset, that reference must not
become a later read of a discarded candidate or retain a mutable accepted alias.
Grid's out-of-basin case throws an ordinary `Error`, not a `PhysicsError`;
preserve unknown-execution classification rather than relabeling all failures
as a physical numeric refusal.

Audit each scratch read before allowing reuse. Otherwise candidate-own or
recreate that scratch. Preserve neighbor traversal order, three density passes,
velocity damping0.998, boundary order, XSPH placement and static-box projection
order. `initialRestDensity` remains the existing derivation from admitted
initial positions; do not substitute a saved density or a new calibrated mass.

## Current failure and lifetime gaps

All old domain Worlds replace accepted arrays/counters before `getState()`
allocates the returned copy. CAD-fluid advances its inner World before its
outer return allocation. A preparation allocation error therefore cannot
inherit the common World's precommit guarantee from documentation alone.

Cloth disposal is idempotent. Fluid and CAD-fluid disposal call `active()` and
throw on a second disposal. Fluid keeps readonly initial/scene/solver references;
P5 disposal must release reachable owned model/state/scratch references under
the common lifetime contract. Shared immutable module constants are not a
promise of GC or OS memory return.

Cloth admission uses own data descriptors and rejects getters. Fluid validation
reads fields/array elements directly; do not reuse it ahead of the common inert
data copy and thereby reintroduce user getter/reentrancy behavior. CAD-fluid's
`cad-errors.ts` has a legacy code/message-based error bridge; reassess its need
at the adapter boundary while keeping unknown thrown values intact.

# Common contract deltas

The current public `types.ts` already declares `Cloth`, `Fluid`, planned visual
profile IDs, domain outputs and `box-interior`. Runtime admission still accepts
only the three rigid profiles, requires at least one dynamic rigid body and
rejects nonempty cloth/fluid arrays (`model-admission.ts:47–55,103`). Public
state currently emits `cloths:[],fluids:[]` (`world.ts:47`). Therefore type
presence is not domain admission.

| Concern | Concrete P5 work |
|---|---|
| Immutable model | Author exact cloth positions/rest positions/velocities, vertex masses, triangle and constraint order, pins and static collider IDs. Fluid carries initial positions/velocities, visual-unit weights, radii, static collider IDs and explicit smoothing. Admit only the selected current values/limits; do not silently ignore submitted fields in favor of hidden topology constants. |
| Profile routing | Add the selected `domain-fixed` profile branch before rigid-only dynamic-body/pair requirements. A static sphere or interior basin has an explicit owner/collider; it does not require an artificial dynamic rigid body. Route domain obstacles to domain kernels, not the rigid CCD/contact loop. |
| State | Common World owns one integer cursor/time. Store accepted domain arrays/diagnostics under entity IDs. Public arrays are copied. Static topology/pins/collider data comes from `getModel()` when forming Viewer frames, not an obsolete domain World DTO. |
| Clock | One `step(commands=[])` advances one configured1/120 s host step. Cloth's8 fixed substeps are private divisions of that host step. No domain stepIndex, domain `step(dt)`, wall clock or reset method remains. Host display accumulators may schedule steps but cannot commit domain time separately. |
| Commands/queries | Keep the existing common command union. Initially admit empty commands for these fixed visual profiles and refuse unsupported body/domain actions after complete generic validation. Do not create emitters, cloth forces or moving obstacles by schema accident. Unsupported cloth/fluid/interior query combinations must refuse explicitly. |
| Shared transaction | Prepare candidate domain arrays, diagnostics, public return and optional recording before nonthrowing pointer/counter commit. A failed domain or log preparation retains accepted arrays, clock, diagnostics, hidden continuation state and recording. Test recovery against a never-failed control. |
| Recorder | `replay.ts:12–14` and `replay-validation.ts:87` currently refuse domains. P5 must either retain an explicit tested refusal for the selected initial slice or support that exact domain with record/restore/continue proof. To support it, convert typed domain arrays to the existing recording's plain-array representation, validate bounded shapes/entities and reconstruct from model+empty-command history through the same root. Do not serialize scratch/lambda aliases, add a second clock, or call wire serialize/deserialize in counts without their hidden reconstruction calls. |
| CAD/static box | Use existing `admitCadSurfaceProxy` and `assertCadProxyCurrent` from `./cad-proxy`. The numeric model contains the admitted static box plus binding. Keep current source text/revision outside numerical World; the caller explicitly checks the adapter before advancing and tests stale-source retention. No parser/native CAD object enters the numerical root. |
| Input freedom | Cloth remains the measured17×17 profile. Fluid's existing validator admits bounded256-position configurations, including the shifted fixtures exercised by current probes; do not accidentally claim arbitrary particle count/new initial velocity support or silently narrow already tested initial-position cases. Freeze the exact P5 selected input/refusal population first. |
| Coupling | One static sphere/basin/optional box only. Reject dynamic obstacles, mixed cloth/fluid domains, cloth self-contact and v2+CAD-box combination until a separate profile permits them. Static obstacle hit counts remain projection diagnostics, not reaction force/pressure. P6 impulse exchange is not enabled. |

# Verified active direct caller inventory

The current code search found21 non-provider, non-historical active files.
This includes import-only/error-identity and generated-source-string probes,
not21 runtime factory invocations. All paths below were read at the inspected
HEAD; line numbers are current anchors.

| File | Anchors | Required direct migration |
|---|---|---|
| `examples/physics-capsule-query-scene/controls.mjs` |2–4 | Old domain error-constructor imports only; use the canonical root error and update removed-entry expectations. Capsule geometric API is not a migrated physical domain. |
| `examples/physics-cloth-viewer/host-controller.mjs` |1,11 | Two actual cloth Worlds for display commit/shadow recovery; use two actual common Worlds with authored model/options. Host reset recreates owned Worlds. Preserve Viewer failure separation. |
| `examples/physics-cloth-viewer/numeric-entry.mjs` |1,4 | Update both0..240 trajectories and common domain DTO selection; keep numerical criteria and raw arrays. |
| `examples/physics-error-entry/entry.mjs` |4–6,33,54,56,58 | Root error identity plus cloth malformed/disposed and fluid/CAD malformed controls; replace obsolete constructors and update export-family tests together. |
| `examples/physics-scene/cloth-source-import-probe.mjs` |13,30,31 | Source/compiled generated consumer strings and entry-closure assertions. Remove expected runtime cloth entry/factory. |
| `examples/physics-scene/cloth-world-probe.mjs` |7,67,70,77,130,141,163,191,201 | Admission, copies, invalid dt/reset adaptations, numerical-boundary injection, independent spike comparison, hashes, cost and limit checks. Keep old expected physics; author new common-lifecycle controls. |
| `examples/physics-scene/fluid-cad-shelf-probe.mjs` |5–6,42–58,98 | Direct compiled CAD-fluid and bare fluid, stale source, overlap/admission and repeat outputs; author adapter+common World inputs with retained source checks. |
| `examples/physics-scene/fluid-cad-viewer/app.js` |3,70 | Direct source CAD-fluid; wrapper at73–77 forwards step(dt,current)/reset. Remove these runtime adapters and use source check plus common step. |
| `examples/physics-scene/fluid-viewer/scene.js` |1,26 | Shared `createWaterWorld` factory calls old fluid; replace with explicit model/options creation. It is an active transitive caller of several hosts. |
| `examples/physics-scene/fluid-visual-profile-probe.mjs` |4,41,47,49,85 | Ordinary/tuned/repeat cases, exact coefficient and hashes; update DTO access without changing smoothing law. |
| `examples/physics-scene/fluid-world-probe.mjs` |4,30,55,58,90,97 | v1 admission, shifted scene, copies,240-step density/compression/bounds/repeat/heap proof and reset; new reset is explicit fresh World. |
| `examples/physics-scene/release-consumer.mjs` |6,51,68 | Published fluid consumer plus explicit export list/declaration assertions at62–64. Preserve rigid/recorder/CAD checks and update obsolete domain map expectations. |
| `examples/physics-scene/source-import-probe.mjs` |13–15 | Generated source string imports fluid/CAD-fluid; expected source/dist entry loop also changes. |
| `examples/viewer-assembly-scene/app.js` |5,307 | Lazy cloth initialization; update authored common model and frame projection. |
| `examples/viewer-cloth-scene/app.js` |3–4,34,94,184 | Precomputed cloth frames and optional water World. Both are separate admitted Worlds; do not imply coupling. Update numeric provenance labels and common DTO mapping. |
| `examples/viewer-fluid-scene/app.js` |3,34 | Direct compiled water, step/reset at131–148; new root import plus owned recreation. |
| `examples/viewer-native-scene-replacement/app.js` |9,1122 | Imported cloth factory and browser-test global aliases, including `createPhysicsClothWorld`. Remove old aliases directly. |
| `examples/viewer-qualified-face-scene/app.js` |34,1120 | Same browser-test factory exposure; direct root/model caller update, no compatibility alias. |
| `examples/viewer-shell-scene/app.js` |5,168 | Same old browser-global aliases. Update test consumers with the public root. |
| `examples/viewer-surface-material/app.js` |3,134 | Direct compiled fluid for display; retain display-only proof boundary. |
| `examples/workspace-source/flow.mjs` |10,66 | Shared source/compiled/browser cloth smoke and canonical disposed error identity. Update one-step state checks and removed import. |

`src/{cloth.ts,fluid.ts,fluid-cad.ts,cloth/world.ts,fluid/world.ts,fluid/cad-world.ts}`
are providers/internal delegation, not additional leaf consumers. Type-only
`ClothWorld`, `FluidWorld`, `CadFluidWorld` declarations must also be removed.
The frozen P0 `inventory.mjs`/`callers.json` text matches are historical records,
not active runtime callers to rewrite.

# Indirect, computed and test entry graphs

These are caller dependencies even when they have no old factory token.

| Entry graph | Current verified path and action |
|---|---|
| Cloth host | `physics-cloth-viewer/app.mjs` → `host-controller.mjs`; `server.mjs` calls `buildConsumer(mode,'app.mjs','browser')`; `browser-driver.mjs` and `browser-checks.mjs` use that host. `frame.mjs`, `metrics.mjs`, `views.mjs`, `clock.mjs` consume old shape/topology/diagnostics/time fields and require model+domain DTO updates. |
| Cloth numerical test | `numeric-probe.mjs` calls `buildConsumer(mode,'numeric-entry.mjs','node')`, captures both trajectories and writes raw F64/sign metadata. `bundle.mjs` resolves all public names via actual `publishConfig.exports` in compiled mode; source uses ordinary workspace resolution. Preserve this source/emitted separation. |
| Water host | `fluid-viewer/app.js` → `scene.js` and `controller.js`. Controller currently calls `step(dt)` and `reset()`; replace scheduling with common empty steps and explicit recreation. Its RAF accumulator is external display scheduling, not a new domain clock. |
| CAD water host | `fluid-cad-viewer/app.js` → `fluid-viewer/{scene,controller}.js`; both shelf and no-shelf branches need one direct model API. `timings.js` measures host work, not an independent physical clock. |
| Water servers | `physics-scene/fluid-viewer/server.mjs` and `physics-scene/fluid-cad-viewer/server.mjs` build `new URL('app.js',import.meta.url)`. `physics-viewer-scene/server.mjs:33` also builds the water app and refreshes the source provider. Include these literal/computed entries in closure checks. |
| Other Viewer servers | Each corresponding `examples/viewer-*/server.mjs` builds its local `app.js`, including cloth/fluid/assembly/native-replacement/qualified-face/shell/surface-material. Cloth server's `VIEWER_CLOTH_COMPILED=1` resolver walks every public published export. Browser proof remains separate from a successful bundle. |
| Shared workspace | `workspace-source/{source-probe,compiled-probe,cpu-entry,probe,browser,serve}.mjs` lead to `flow.mjs`. `probe.mjs` scans package families and computes published subpaths; source refreshes `generate-provider.mjs`. `setup.mjs` computes links from `barocss-` plus family names. Verify mappings under their existing owner; no root-lockfile rewrite is implied. |
| Error identity | `physics-error-entry/probe.mjs` bundles `entry.mjs`, checks explicit six-entry export maps and uses `workspace-source/probe.mjs`'s transitive published resolver. Its expected domain entries are stale after a P5 removal and must change in the same slice. |
| Capsule controls | `physics-capsule-query-scene` bundles its controls through existing public query probe/server paths. Only removed error-entry imports change; preserve geometric query/controller contracts. |
| Package import/release gates | `physics-scene/source-import-probe.mjs` and `cloth-source-import-probe.mjs` contain generated TypeScript import programs. `release-consumer.mjs` asserts a literal export list and emitted declarations. `release-gate-criteria.mjs` lists the fluid probe; `fluid-release-criteria.mjs` consumes fluid/CAD/source/visual reports. |
| Broad release runner | `physics-scene/fluid-release-gate.mjs` runs offline installation, builds CAD/GPU/Interop/Viewer/Physics, repeats fluid probes and requires a clean worktree. It is an inventory dependency, not an authorized P5 command. Select its leaf checks instead of launching it here. |
| Docs tests | `apps/library-docs/samples/run.mjs` discovers `*.test.mjs` by filter and aliases the entire Physics source directory; it regenerates provider metadata first. Current `physics-docs.test.mjs` uses root rigid/recorder/CAD samples and contains no cloth/fluid factory call. Add selected domain source samples when P5 is implemented; existing tests remain regression callers. This source alias does not prove native published imports. |

Active prose includes `packages/barocss-physics/{README.md,ROADMAP.md}`,
`apps/library-docs/docs/packages/physics/index.md` and the cloth/fluid/CAD-water
example READMEs. Site `docs/public/physics-evidence/*` and old P0 text are
historical evidence copies; do not rewrite them to suggest past common-World
support. Update current navigation/text/sample regions and preserve attribution.

# Proposed bounded extraction order

1. Freeze a new P5 contract, caller list, original domain fixture/provider
   hashes, exact source/emitted gates, counts and first-failure rules. Decide
   the initial recorder scope explicitly. Preserve all previous archives.
2. Extract internal candidate stages from `cloth/world.ts` and `fluid/world.ts`.
   Keep solver arithmetic modules in place. Remove independent runtime clocks,
   reset and public World classes; do not call the old factories internally.
   Make mutable lambda/scratch ownership explicit before adding admission.
3. Implement one selected visual profile at a time in copied `PhysicsModel` /
   `WorldOptions` admission and the actual common World. Keep all current rigid
   paths unchanged. Prepare domain output and recorder data before the existing
   assignment-only shared commit.
4. For each migrated domain, update the active caller rows and generated import
   strings directly, then remove its obsolete factory/types/runtime exports in
   that same buildable slice. Prefer root-only runtime creation. A retained
   domain subpath may expose only explicitly frozen model data/types, not an
   old/new selector, dt bridge, reset facade, alias or fallback World.
5. Move CAD-fluid admission into the existing optional adapter boundary. Admit
   the same numerical static box and provenance into the fluid profile. Perform
   current-source checks explicitly before advancing; source failure must leave
   state/recording untouched without a hidden child-World attempt.
6. Update both workspace and `publishConfig` maps and generated provider graph.
   Retire only identified obsolete package-emitted domain factory/World files;
   `tsc` does not delete stale `dist/cloth.js`, `fluid.js`, `fluid-cad.js` or old
   runtime World outputs automatically. A direct relative compiled caller must
   not continue loading an old factory from a stale file. Keep historical
   evidence/provider copies byte identical.
7. Qualify each actual source/native emitted profile and affected shared owner /
   replay graph. Add failure continuation, copy, lifetime, command precedence,
   unsupported query/mixed-domain and static-source tests. Run browser product
   flows only as a separately reported proof. Do not call migration equality
   independent new cloth/CFD accuracy or dynamic coupling.

# Verification plan and dependencies

All commands below are **NOT_RUN**. Existing harnesses contain old signatures;
adapt only the affected callers and frozen test inputs before using them for
P5. Do not rerun successful historical campaigns merely for acknowledgement.

| Stage | Existing tool / selected check | Evidence boundary |
|---|---|---|
| Source/types | package `build:library`; `tsc -p packages/barocss-physics --noEmit`; strict new public consumer and negative type fixtures | No numerical PASS from compilation. Build uses source provider generation, TypeScript, root bundle with shared recording-owner/types/manifest siblings, then emitted provider generation. |
| Cloth kernel/profile | `node examples/physics-scene/cloth-world-probe.mjs`; `cloth-source-import-probe.mjs` | Preserve step0/60/240 arrays, topology, pin/mass/strain/penetration bounds and original spike comparison. Add shared-commit failures; report cost separately. |
| Fluid profiles | `node examples/physics-scene/fluid-world-probe.mjs`; `fluid-visual-profile-probe.mjs`; `fluid-cad-shelf-probe.mjs` | Preserve v1/v2/CAD fixture hashes, density/compression/basin/obstacle bounds, stale checks, shifted inputs and actual prefixes. Existing240-step checks do not certify3600-step stability. |
| Source/native consumers | updated source-import probes, `physics-error-entry/probe.mjs source|compiled`, `workspace-source/{source-probe,compiled-probe}.mjs` and fresh native ESM imports through actual published maps | One canonical error/owner registry in each graph; no own-source fallback in emitted graphs; no CAD/parser/Viewer code in numerical root. |
| Recorder | selected root+replay source bundle and actual native root/replay imports | Explicit domain refusal, or record/restore/continue/copy/stale/budget/ownership proof for the exact admitted domain. Count restore/wire helper reconstruction calls; no hidden constructors. |
| Host/browser | `physics-cloth-viewer/numeric-probe.mjs source|compiled <fresh-output>` then separately its browser-driver; selected existing Viewer hosts | Numeric arrays, browser frame acceptance and display scheduling are distinct proofs. Host reset creates fresh Worlds. Existing unrelated Viewer lifecycle work stays under its owner. |
| Docs | `cd apps/library-docs && node samples/run.mjs physics-docs`, then existing docs check/build/link tools | Source snippets and generated sites are separate from published numerical and actual browser proof. Use corrected explicit build commands. |

No shared root dependency/lock/policy change is required by this inspection.
Generic workspace source/publish resolvers should follow package maps. Any
actual shared mapping edit or unrelated Viewer/Studio implementation needs its
existing owner boundary. P5 remains unimplemented and unqualified at this
snapshot; static obstacles are the entire interaction scope, with P6 coupling
and broader P7 mechanisms still refused.
