---
work_id: physics-world-p1b-2276
artifact_type: public-api-cutover-verification-report
status: locally_verified_selected_profile
owner_role: independent-physics-algorithm-work
source_request: P1b public World and root/replay/CAD direct cutover without legacy compatibility; no deployment
last_updated: 2026-11-02
---

# P1b result

Base `0be1dffb8b7dce2be2571990d895c7e8301f9349`; branch `codex/physics-world-p1b-2276`.
The canonical rigid factory is now `createPhysicsWorld(model,options)`. Its API is `getModel`, `getState`,
`step(commands?)`, tagged `query` and `dispose`. Old config/types/signatures, separate root query methods and the
root reduced-pendulum export are removed. There is no old engine, overload, adapter constructor or fallback.
Internal primitive parsers construct numerical records directly. The example model author accepts new model data
only. The reduced pendulum equations now live in an independent reference example.

Model, state, commands, units, global body/collider/joint/binding IDs, copied data, accepted failure cursor and
canonical typed SHA-256 identities follow P0. Runtime source and final emitted graphs generate separate provider
identities. The final emitted root imports its manifest externally, and generation runs after bundling. Source
loader/build hooks refresh the manifest; identical generation leaves the file unchanged. No runtime dependency,
package installation, external download, lock change, security setting, remote write or deployment was required.

Replay uses the new root directly and owns explicit model/options/identity data. Its sole new snapshot wire is
`BCPHSNP1` plus canonical typed bytes, preserving binary64 signed zero; raw JSON/old schema migration is refused.
Limits are 128 KiB scene bytes, 1 MiB snapshot bytes, 512 frames and 4096 commands; the original 1e-12 replay
comparison remains. P2 attachment to an externally owned World is still future work. CAD emits a separate body,
collider and source binding, retaining exact source/revision checks and off-origin millimetre mapping. Fluid and
cloth keep their sole current domain APIs until P5; common World refuses those domains. No coupling is activated.

## Actual verification

All commands use installed Node22.19.0, TypeScript5.9.3/esbuild0.25.12, macOS ARM64. Heavy commands use the repository
gate. Fresh run IDs, raw streams, UTC times, command exits and named input/provider hashes are in `evidence/`.
`CONTRACT.md` fixes the gates before execution. A command exit is distinct from a physical result.

| Check | Actual result and receipt |
|---|---|
| Public model/API/error/identity/replay/CAD tests | Source8/8 (`public-source-04`), actual emitted8/8 (`public-emitted-03`). |
| Ordinary current rigid/replay/CAD probes | Source21/21 and emitted21/21 (`probes-{source,emitted}-01`). |
| Independent foundations | Five entries,21 tests per graph (`foundation-{source,emitted}-01`); original gates retained. |
| Full Physics TypeScript/declarations | PASS in emitted runs; actual CAD TypeScript build exit0 before compiled CAD consumption. |
| Native package maps and types | `native-04` runtime and strict declarations PASS; `native-05` adds four README blocks compiled and executed. Uses actual publishConfig maps and locally built JS only, no TS fallback/install/publication. |
| #1572 migrated numerical wiring |36 TS source bundles PASS. Four selected CI commands exit0 (`core-1572-runtime-01`); physical NO_GO details below. |
| Engine admission harness |9 explicit source/emitted cases, model/configuration/physical state equal for one step; provider identity compared separately (`core-admission-reference-01`). No numerical campaign. |
| Docs samples |174/174 PASS (`docs-samples-01`), actual public source imports. |
| Documentation | Site73pages check PASS; VitePress build PASS; scoped5pages/22regions/14historical byte copies and built links PASS. Initial receipts `docs-{check,build,links}-01`; final text receipts `*-03`. |
| Package mapping |5source and5emitted entries PASS (`mapping-02`). |
| Current host callsites |7bundles (`hosts-03`); actual source or compiled Physics graph recorded per host. Viewer dist absent, explicitly external; full host/Viewer/DOM NOT_RUN. |
| Basic source host | Local HTTP startup, current bundle retrieval,404,close and idempotent provider generation PASS (`server-01`). It retains its startup-only build semantics. |
| Package source lint |0errors,1build-generator console warning (`lint-02`). |

The earlier probe/foundation receipts precede removal of one unused catch binding in capsule query admission.
This is the only subsequent numerical-graph source edit. Its emitted behavior is unchanged; final public, native
and README checks run after it. Provider identity differences remain visible rather than being normalized away.

The candidate solver phase in `world.ts` is byte-identical to the base: SHA-256
`89bdece7bf2c4293f4764710fedad54ca70a21d88d2182aa17e8484b4770eaf7` (9682bytes).
This static comparison covers only the phase between command parsing and prepared public-state construction,
not constructor/state serialization/query correctness. No iterations, collision tolerances or physical laws changed.

Measured current ballistic errors at t=1s and dt=1/60,1/120,1/240s are
0.08174999999999999,0.04087500000000688,0.020437499999998554m; ratios1.9999999999996632 and2.000000000000478.
Original coarse83mm and ratio1.99–2.01 gates pass. Foundation velocity error is at most2.132e-14m/s;
elastic impact energy error2.221e-16J and momentum error0. The 3000step sphere-support cumulative balance error is
2.558e-12N·s (gate1e-8); CAD90degree off-origin translation `[160,-80,0]`mm error0 (gate1e-6mm).
The independent reduced pendulum's12tests remain separate from rigid hinge qualification.

## Physical failures stay visible

The selected #1572 command exits do **not** make the measured stacks pass. The three-dynamic-box reduction ran
1200steps for ALIGNED/OFFSET/YAW. Only ALIGNED met its bounded settling thresholds. OFFSET and YAW remain
`BOUNDED_SETTLING_NO_GO`: maximum top-box horizontal movement is0.10636957978992953m and0.10806531502932948m;
maximum speed is0.03687718232801913m/s and0.03637241456676495m/s. Original thresholds and producer-only collision
reference remain; `eightDynamicBoxQualified:false`. The120step public smoke also says `stableStackQualified:false`.
Impulse/work and total-energy ledgers are diagnostics, not stack or contact-geometry certification.

Original public two-hinge and eight-box NO_GO remain. The independent repaired192strict-contact rows, matched
16step source/emitted stack prefixes and separate incomplete308step ALIGNED time-guard result are historical
results at their named providers, not newly qualified by P1b. Original1200step eight-box settling and8–10s final
window remain incomplete/NO_GO. No original failure, numerical gate, timeout or archived report was changed.
Physics/Studio/manufacturing HOLDs stay in force. Hardware agreement, manufacturing safety, full Viewer/Studio
integration, general contact networks and coupled domains are NOT_RUN or unsupported.

## First failures and provenance

- `core-types-01`: CAD pose tuple typing failed; explicit four-element tuple fixed it. Original diagnostic retained.
- `public-source-02`:7/8PASS; later null source binding caused a TypeError. Admission now snapshots numerical IDs
  before processing bindings; malformed data produces typed INVALID_CONFIG. New runs pass8/8.
- `mapping-before-01`: old probe incorrectly assumed workspace default selected dist. It now checks actual source
  defaults and actual publishConfig maps independently; no source fallback is counted as emitted.
- `native-01`: setup ENOENT from wrong test fixture path, no runtime/type run. `native-02`: runtimePASS, typeFAIL
  from missing required includeSensors and unrelated auto-loaded ambient font declarations. Fixed the required
  field and set types:[] to isolate package declarations; skipLibCheck:false remains. Later native runs pass.
- `lint-01`: unused pre-existing catch variable; removed binding only. Console warning retained, no lint disable.
- `docs-gate-01`: load refusal75; dependent checks NOT_RUN in that attempt. A later admitted run executed them.
- `hosts-01`: full host build failed because Viewer dist is absent. `hosts-03` is explicitly narrower callsite
  compilation with external rendering SDK. The absent SDK/full browser result is not converted into a PASS.

Migration ledgers link parent and current hashes. The final manifest resolves the earlier basic-app handoff and
records current hashes after parent edits. Eleven frozen research original-control forwarders and P0/P1a runners
are historical at checkpoint0be; their private candidates/old API experiments are not current P1b callers. Use the
whole named checkpoint for historical reproduction. No historical engine or signature is reachable from current
package exports. Arbitrary computed imports/eval/external callers are outside the bounded AST inventory.

Provider/stage directories are archived as `provider.tar.gz` / `stage.tar.gz` after checking every file's SHA-256
against the archive. Adjacent `*-archive.json` records original paths and hashes. Extract beside the archive to
recover receipt-relative paths; command logs stay readable. No failed run ID is reused or overwritten. Source-only whitespace checking passes; the all-evidence check reports original blank/trailing whitespace in lint and first-failure TAP streams. Those raw bytes are preserved.

## Reproduce and next dependencies

Use installed dependencies and the project's heavy-lane gate; choose a fresh ID for each command:

```sh
node examples/physics-world-p1b-2276/run.mjs source fresh-source-01
node examples/physics-world-p1b-2276/run.mjs emitted fresh-emitted-01
node examples/physics-world-p1b-2276/run.mjs probes-source fresh-probes-source-01
node examples/physics-world-p1b-2276/run.mjs probes-emitted fresh-probes-emitted-01
node examples/physics-world-p1b-2276/run.mjs foundation-source fresh-foundation-source-01
node examples/physics-world-p1b-2276/run.mjs foundation-emitted fresh-foundation-emitted-01
node examples/physics-world-p1b-2276/native.mjs fresh-native-01
node apps/library-docs/samples/run.mjs
node apps/library-docs/scripts/check-docs.mjs
# From apps/library-docs: node node_modules/vitepress/bin/vitepress.js build docs
node examples/physics-motion-docs-2276/check-site.mjs
```

Next: P2 must define recorder attachment and exclusive command ownership on this World, then test refused record/
restore/continuation against actual source/emitted graphs. P1-wide allocation/cost and extended phase injection
remain separate checks; historical P1a injection evidence alone is not a rerun on this API. P3 multi-joint support,
P4 full original contact/stack exit and P5 domain-buffer ownership each need their own fixed gates. Public API
integration is verified for this bounded rigid slice; the whole engine is not complete. No deploy/push/release.
