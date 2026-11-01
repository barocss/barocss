---
work_id: physics-motion-docs-2276
artifact_type: documentation-implementation-and-api-design-report
status: done
owner_role: independent-physics-algorithm-work
source_request: add five documentation bundles with tested examples and links; review Physics API design and reorganize the unreleased library roadmap; no deployment
last_updated: 2026-11-01
---

# Physics documentation and library architecture

The five requested documentation bundles are implemented on the isolated branch
`codex/physics-motion-docs-2276`, based on
`db84f1e17833fbdb140de953e1efb538da7ed865`. The actual current API is documented;
the proposed common-World design is explicitly unimplemented. The package's
canonical design and development order are now in `packages/barocss-physics/ROADMAP.md`.

The old Physics, Studio and manufacturing workers remain on HOLD. The original
two-hinge and eight-box NO_GO, numerical gates, initial failures and partial runs
are unchanged. No algorithm source, package export, runtime dependency, lockfile,
security setting, deployment workflow or existing evidence directory was changed.
No remote write, publication, deployment, paid service, hardware control or
manufacturing approval was performed.

## Changed files and responsibilities

| Files | Result |
|---|---|
| `apps/library-docs/docs/packages/physics/index.md` | Public API ownership, working rigid examples, forces/impulses, reduced pendulum, profile boundaries and a separate planned-design notice. |
| `apps/library-docs/docs/packages/physics/units-and-frames.md` | SI/MMGS, public degrees/mm versus internal radians/mm, XYZW and signs, inertia origins, independently checked off-origin CAD mapping. |
| `apps/library-docs/docs/packages/physics/profiles-and-lifecycle.md` | Actual body/step/profile limits, separate domain ownership, copied accepted state, refusals, replay and differing disposal behavior. |
| `apps/library-docs/docs/guide/robot-motion.md` | Mixed turn/slide tutorial, timing, pose sampling, independent FK/IK checks and separate loads/contact/control boundaries. |
| `apps/library-docs/docs/reference/physics-verification.md` | Independent references, measured errors, unchanged gates, source/emitted limits, original failures and remaining NO_GO. |
| Site sidebar/config/home, CAD Model/Robots/limits/verification pages and `apps/library-docs/ROADMAP.md` | Navigation and crosslinks. CAD-authored pendulum workflow remains planned; the standalone reduced ODE does not complete it. |
| `apps/library-docs/samples/physics-docs.test.mjs`, `physics-motion.test.mjs`, `samples/run.mjs` | Eleven new source-example tests; explicit Physics source alias to this checkout. |
| `docs/public/physics-evidence/` | Fourteen byte-identical historical report/contract/receipt copies plus the explicitly proposed roadmap. No dead GitHub links to unpublished local commits. |
| `packages/barocss-physics/ROADMAP.md`, package README link | One common World owner above separate numerical solvers; recording and CAD adapters have distinct roles. Direct unreleased API transition, without a compatibility engine. |
| This directory | Reproducible site-link/snippet/evidence check, local run logs, refreshed issue bodies, lexical callsite inventory and change hashes. |

## Actual validation

Installed Node22.19.0, esbuild0.25.12 and VitePress1.6.4 were used. An ignored
local `apps/library-docs/node_modules/vitepress` symlink points to the already
installed main-checkout tool. No dependency install or external data download
was needed. The sample runner aliases Physics/CAD/CAD Model/GPU to this checkout's
sources, so passing samples are source execution, not emitted-package acceptance.

Commands below ran from `/Users/user/Documents/ChatGPT/barocss-physics-motion-2276`.
Each heavy shell acquired the existing gate and released it in an EXIT trap:

```sh
/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh acquire heavy 30 LABEL
# Within that shell; trap gate.sh release on EXIT.
task_node=/Users/user/.volta/tools/image/node/22.19.0/bin/node
$task_node apps/library-docs/samples/run.mjs physics
$task_node apps/library-docs/samples/run.mjs physics-motion
$task_node apps/library-docs/samples/run.mjs
$task_node apps/library-docs/scripts/check-docs.mjs
# VitePress command ran with cwd apps/library-docs:
$task_node node_modules/vitepress/bin/vitepress.js build docs
# Back at repository root:
$task_node examples/physics-motion-docs-2276/check-site.mjs
```

| Check | Result | Receipt |
|---|---|---|
| First new sample run | FAIL:9/10. Incorrect SCARA oracle; preserved. | `evidence/samples-physics-01.log` |
| SCARA diagnostic | FAIL with measured actual/home/expected values; preserved. | `evidence/scara-diagnostic-01.log` |
| Corrected Motion samples | PASS5/5, including separate reporting bound. | `evidence/scara-corrected-01.log`, `scara-corrected-02.log` |
| All site examples, including11 new tests | PASS173/173, zero skipped/cancelled. | `evidence/samples-all-01.log` |
| Site structure/generated-document checks | PASS:73 pages,0 placeholders,55 shots,940 checked labels. | `evidence/check-docs-01.log`, `check-docs-02.log` |
| Initial builds | PASS; later changes required another build. | `evidence/build-01.log`, `build-02.log` |
| Initial scoped link/anchor audit | FAIL: new guide used `#2-robots`; actual VitePress slug is `#_2-robots`. | `evidence/links-01.log` |
| Final build after anchor repair | PASS. Existing chunk-size warning remains; no threshold was changed. | `evidence/build-03.log` |
| Final built links/anchors/snippets/copies | PASS:5 new pages,782 checked link occurrences,201 anchor occurrences,19 snippet inclusions,14 exact historical copies and one exact roadmap copy. | `evidence/links-02.log` |

Link checking covers the five rendered pages, their shared navigation, new
crosslinks and all sidebar targets against actual output files and HTML IDs.
It also checks snippet region markers and byte identity of copied evidence.
Remote URL availability and browser interactions were NOT_RUN. The official
comparison sources were read through the web tool; all four original GitHub
issue bodies were refreshed through the GitHub connector, read-only, and saved
as `evidence/issue-{2276,1489,1490,1572}.json`. No issue state was changed.

## Numeric sample results and first-failure correction

The first SCARA oracle used the authored quill position `[210,30,-30]` mm
instead of the mate-solved home `[225,25,-30]` mm. The public pose additionally
rounds positions to six decimal places. The corrected oracle uses the solved
pivot geometry and keeps the existing1e-9mm comparison against the explicitly
rounded representation. It does not claim full-precision FK accuracy from
that reported pose. A separate0.5e-6mm/component reporting bound was fixed
before the final corrected run. No product solver or original numerical gate
was changed. Both failed logs and the earlier corrected result remain.

| Measurement | Actual result | Fixed check / meaning |
|---|---|---|
| Free flight at0.1s, dt1/120 and1/240s | Continuous position errors0.004087500000000022m and0.002043750000000122m; ratio1.9999999999998914 | Each error≤0.0041m, ratio1.99–2.01; velocity1e-12m/s. Independent continuous solution, not merely integrator agreement. |
| Mixed SCARA path,22 samples | Rounded-position oracle error0; unrounded reporting difference≤4.901169035065323e-7mm; joint error≤7.105427357601002e-15; duration error0 | Rounded comparison1e-9mm; reporting0.5e-6mm/component; duration1e-12s. No mechanical accuracy claim. |
| Three analytic RP IK targets | Maximum independent position residual2.660641766657152e-14m; angular residual0; FK point difference≤1.4210854715202004e-14mm | Existing1e-4m/1e-3rad acceptance, joint bounds retained; FK comparison1e-9mm. |
| Unreachable RP target | `reached:false`, residual0.04m, slide80mm | Residual≥0.0399m and limits respected. |
| Force/impulse and lifecycle | Analytic velocity changes; exact retained state after invalid dt; copied arrays; idempotent rigid disposal | Source example scope only. |
| Off-origin proxy |100mm→0.1m, known+90degree matrix and literal transformed points pass |1e-9m admission,1e-6mm display/inverse. No fresh emitted CAD/Viewer acceptance. |
| Reduced pendulum example | Exact zero-angle equilibrium and typed refusal pass | Equilibrium/API example only; period/convergence evidence remains attributed to the original foundation. |

Existing numerical histories were not rerun or relabelled by this documentation
work. The repaired strict192-row fixtures and16-step stack prefixes remain
their original bounded results. The1200-step original settling result remains
NO_GO/NOT_RUN; the separate308-step source run remains incomplete at the fixed
180s guard. The public persistent-box profile remains capped at four bodies.

## API design and next dependency

Review found that replay owns one rigid World, while CAD fluid wraps the same
fluid solver with a static box. Fluid and cloth have independent states and
clocks; there is no shared collision identity or two-way coupling. Lifecycle
contracts differ. A loop around the existing public factories cannot provide
atomic multi-domain stepping or opposite reactions.

The canonical roadmap therefore separates immutable model, common World,
internal solvers, coupling, recording, CAD adapters and display. It requires
candidate hidden caches and a prepared recording entry to commit together;
source freshness is checked by an adapter supplied with current identity.
The architecture review identified and corrected those two contracts plus the
root/replay migration boundary before finalization. No runtime refactor was
performed. Solver separation is retained; the API and execution ownership
must be redesigned before release.

The order is P0 capability/type/caller contract → P1 rigid common World → P2
recording/CAD boundary. P3 original hinge and P4 original contact/stack are
independent retained acceptance tracks. P5 admits cloth/fluid as explicit model
data. P6a/P6b each qualify a small two-way coupling; P7 handles connected joints
and control only with required verified profiles. P8 product/measurement work
remains outside this work and subject to existing HOLDs.

`evidence/api-callsite-inventory.json` is a lexical seed,127 matched files
(11 package files,2 app/docs files,114 examples). Matches include definitions
and comments, and computed imports may be missing. It is not a complete live
consumer inventory or a migration approval. P0 must classify live callers
versus immutable historical providers before any API change. Historical
archives must not be edited while removing old production factories.

The local docs/design task is complete. The first implementation dependency is
P0's exact supported-model/types/caller contract. Package/API integration,
physical coupling, active CAD adoption, full original stack success, machine
validation and release are not completed by these documents.


## Staging audit boundary

The full staged whitespace check reports24 trailing-whitespace lines in the
byte-identical historical `first-motion-input-failure.txt` copy. Those raw
bytes are preserved; the full diff is not labelled whitespace-clean. The
separate author-source-only check passes. The first audit shell also used
the zsh read-only variable `status`, masking the diff exit with a shell error;
no commit ran from that shell. The error and both raw audit outputs are
retained. The corrected audit uses explicit scoped commands and does not
modify raw records to make the check pass.
