---
work_id: physics-world-p1a-2276
artifact_type: transaction-preparation-implementation-report
status: done
owner_role: independent-physics-algorithm-work
source_request: continue the independent roadmap after P0; preserve HOLD, NO_GO, tolerances and first failures without compatibility engines
last_updated: 2026-11-02
---

# P1a: output and replay log preparation

The canonical rigid World now prepares its copied successful reply before committing accepted state. Replay prepares
its next frame array and command count before advancing its privately owned World. These are the only two runtime
files changed. Public signatures, exports, numerical arithmetic/phase order, caps and admission are unchanged.
There is no second factory, engine selector, compatibility overload or fallback. The P0 common model/options API is
still unexported and NOT_IMPLEMENTED; P1a is not P1b public integration.

Branch: `codex/physics-world-p1a-2276`. Parent P0:
`a81748a54c7e1ecf0915015575256e81d989f43a`. Frozen numerical/transaction baseline:
`66df02f8e7d5a3a7ab7b8ff7a0184bf34d978713` (the two runtime providers did not change in P0).
Existing Physics, Studio and manufacturing HOLDs remain. Public two-hinge activation and original eight-box
1200-step settling remain NO_GO/NOT_RUN. No old fixture, numerical gate, reference provider or failed receipt changed.

## Change and first diagnostic

| File | Change |
|---|---|
| `packages/barocss-physics/src/world.ts` | Build `publicState(next,...,stepIndex+1,dt)` after all existing validation, before accepted pointer/counter replacement; return that prepared copy. |
| `packages/barocss-physics/src/replay-session.ts` | Prepare `nextFrames` and `nextCommandCount` before `world.step`; assign both after successful return. |
| This example directory | Bounded baseline/injection, uninstrumented source/emitted consumers, unchanged independent numerical fixtures and recorded provider graphs. |
| Package roadmap and linked docs | Report the P0/P1a checkpoint and keep the public model cutover and remaining numerical gates separate. |

`evidence/baseline-01` reproduces the original weakness using original providers and one-shot deterministic test-only
preparation exceptions. It observes three Worlds advancing one extra step despite the exception, with all20 subsequent
valid steps differing from an untouched control. The replay case observes a physical step without its log frame;
saved snapshot restore then refuses. These are preserved failed retention/alignment results.

The diagnostic observer's four tests exit0 because it checks that the bug is reproduced. Its result fields explicitly
say `snapshotRetained:false`, `continuationMatchesControl:false` and `physicalAndLogAligned:false`. This is not a
successful old transaction or a physical-accuracy pass. Baseline source/transformed bytes, hashes and raw output are
preserved. Each unchanged baseline numerical dependency is checked against the frozen commit.

## Executed checks

Installed Node22.19.0, TypeScript5.9.3 and esbuild0.25.12 were reused under the existing heavy-lane gate. No install,
download, dependency/lock change, security setting, remote write, deployment, hardware control or release ran.
Run IDs are fresh; every subprocess has180s timeout, command/exit/signal/UTC timestamps and raw-output hashes.

```sh
task_node=/Users/user/.volta/tools/image/node/22.19.0/bin/node
$task_node examples/physics-world-p1a-2276/run.mjs baseline baseline-01
# After the two runtime edits:
$task_node examples/physics-world-p1a-2276/run.mjs source source-01
$task_node examples/physics-world-p1a-2276/run.mjs emitted emitted-01
$task_node examples/physics-world-p1a-2276/run.mjs ordinary-source ordinary-source-01
$task_node examples/physics-world-p1a-2276/run.mjs ordinary-emitted ordinary-emitted-01
$task_node examples/physics-world-p1a-2276/reference-run.mjs source reference-source-01
$task_node examples/physics-world-p1a-2276/reference-run.mjs emitted reference-emitted-01
$task_node apps/library-docs/samples/run.mjs physics
```

| Check | Actual result and boundary |
|---|---|
| Fixed injected source |4/4PASS. Prepared-output/log exceptions retain accepted state/log;20-step continuation matches control. |
| Fixed injected actual emitted root/replay |4/4PASS. Both providers actually emitted by strict tsc; test bundle contains no own Physics TypeScript. |
| Ordinary source API |2/2PASS, no instrumentation: force/gravity, copied nested results, typed refusal retention, disposal and replay restoration/continuation. |
| Ordinary emitted API |2/2PASS, no instrumentation: actual root/replay JS closure. Native published-package-map execution was NOT_RUN by this slice. |
| Existing independent references |5/5PASS per source/emitted graph. Original `world.test.ts` and `contact.test.ts` bytes and gates are unchanged; the five numerical diagnostic objects match between graphs. |
| Focused ESLint |0errors;3 diagnostic-console warnings. |
| Affected documentation samples |11/11PASS. These use sources; no new emitted docs claim. |
| Updated documentation build/links |PASS; receipts under `evidence/docs-01/`. No deployment. |

Injected cases use the existing120-step persistent-warm scene with support/stay events,120-step sleeping sphere
island and30-step dynamic hinge motor history. The wake impulse is applied only once during valid continuation.
Replay tests retain the4096-command budget through a failed64-command frame, check the full limit, and confirm an
empty frame still advances afterward. Source/emitted test-only injection graphs have separate hashes and labels;
they are not ordinary package graphs.

The measured source injected suite took about1.20s, emitted about1.18s; these are fixed test-suite observations,
not a solver performance comparison. Replay now copies at most512existing frame references per step rather than
appending in place; its fixed cap is unchanged. Peak memory, allocator exhaustion and general performance were
NOT_MEASURED. Normal output copy count is unchanged, but its lifetime now overlaps precommit accepted state.

## Numerical errors from unchanged independent tests

| Measurement | Current source/emitted result | Original gate |
|---|---|---|
| Ballistic1s at dt1/60,1/120,1/240 | Position errors0.08175000000000043,0.04087500000000688,0.020437499999997222m; ratios1.999999999999674,2.0000000000006084 | Coarsest<0.083m; ratios1.99–2.01; velocity1e-11m/s |
| Elastic unequal-mass impact | Momentum error0; energy error2.220446049250313e-16J |1e-10in each SI quantity |
| Sphere finite spin | Quaternion-component error2.220446049250313e-16 |1e-11 |
| Sphere floor support3000steps | Gap0m; maximum support error5.551115123125783e-17N·s; cumulative2.5579538487363607e-12N·s |1e-10m/per-stepN·s; cumulative1e-8N·s |
| Sliding/rolling sphere240steps | Work residual1.5265566588595902e-16J; sliding position error0.0008174999999999988m; final speed0.7142857142857146m/s | Work1e-10J; position1e-3m; final analytic quantities1e-9 |

Ballistic energy discretization error remains about-0.802,-0.401,-0.200J; it was not corrected or called conservation.
Impulse-work equality and deterministic continuation are distinct from long-time physical accuracy. The three warm
transaction fixtures exercise only their stated continuation histories; no general hidden-state or all-profile
failure proof derives from them. The injected sentinel is an execution exception, not a measured contact failure
or actual fatal allocator exhaustion. No full public package/Viewer/hardware acceptance is inferred.

## Preserved limits and next dependency

The original32-contact equilibrium, strict192-row boundary witnesses and matched16-step original-stack prefixes
remain attributed to their original checkpoints. The separate308-step ALIGNED source run remains incomplete at the
fixed180s guard. No full original8–10s settling campaign or new two-hinge campaign ran here. Public persistent-box
admission stays4bodies, default32, large64; solver passes and all residual/geometry/quality tolerances stay unchanged.
Cloth lambda/scratch ownership and fluid scratch retention are unchanged P5 requirements.

P1b is next: construct one canonical World directly from the frozen model/options contract, update root/replay/CAD
types and actual consumers atomically, and remove the old signature in that cutover. No old World may sit behind a
new wrapper. The exact source/emitted caller graph must build before that cutover can complete. P2 then finishes
attached recording and source-adapter ownership; P3/P4 retain their original numerical exits. P1a does not clear those
dependencies, existing owner HOLDs, measured validation or release.
