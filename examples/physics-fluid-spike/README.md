# FLUID-00: bounded 3D water-particle decision

This is a **measurement spike**, not a public `@barocss/physics` fluid API. It compares two small CPU methods on the same static basin and initial 3D particle lattice. The first product goal is visual water particles in Viewer. The fixture is not a CFD validation case.

## Reproduce

Use Node 22.22.0 on macOS arm64 for the recorded timing comparison:

```sh
node --expose-gc examples/physics-fluid-spike/benchmark.mjs /tmp/fluid-spike.json
```

The default runs 60 caller-driven steps of 1/120 s for each method at 256, 1,024 and 4,096 particles in the **wide stress basin**. Set `FLUID_SPIKE_STEPS` only for a local smoke run; the recorded decision uses 60. The two checked-in reports are [run one](evidence/benchmark-2026-10-08.json) and [run two](evidence/benchmark-repeat-2026-10-08.json). `positionSha256` checks deterministic final positions on the same runtime. Median and p95 refer to **one solver step**, without rendering. `retainedHeapDeltaBytes` is a garbage-collection-assisted signal, not total allocations or peak resident memory.

Run `node examples/physics-fluid-spike/visual-check.mjs` for the separate [256-particle compact-basin report](evidence/visual-check-2026-10-08.json), and `node examples/physics-fluid-spike/snapshot.mjs` for the state-derived side projections at [60 steps](evidence/solver-snapshot-256.svg) and [240 steps](evidence/solver-settle-256.svg). The compact basin is 0.7 × 1.3 × 0.5 m. These projections are diagnostic evidence, not the actual Viewer consumer planned for FLUID-02.

## Decision

Choose **a bounded CPU PBF-style density projection with fixed floor samples** for FLUID-01. Keep the pressure-based SPH prototype as a comparison fixture. Use 256 particles in the compact basin as the first admitted water scene. Do not promise 1,024 or 4,096 particles as interactive workloads. Both methods stayed finite and inside the clamped basin in this test. PBF had lower positive compression and a fuller diagnostic side projection near the floor, but cost about three times as much step time. The exact values vary with host load; both stress runs, the compact-basin report and its projections are part of the decision.

| Particles | SPH p95 step, runs 1–2 | PBF p95 step, runs 1–2 | SPH/PBF mean absolute density error | SPH/PBF p95 compression |
| --- | --- | --- | --- | --- |
| 256 | 2.37 / 2.21 ms | 5.76 / 5.85 ms | 0.308 / 0.208 | 0.484 / 0.003 |
| 1,024 | 7.01 / 6.63 ms | 20.16 / 20.11 ms | 0.366 / 0.242 | 0.461 / 0.007 |
| 4,096 | 26.42 / 26.69 ms | 91.23 / 93.25 ms | 0.762 / 0.130 | 1.548 / 0.028 |

The density reference is the mean normalized kernel density of the initial lattice. This is a **relative visual-solver diagnostic**. It is not kilograms per cubic metre or a measured water pressure. Two layers of fixed floor samples give the density gradient a boundary normal and prevent the initial all-particles-on-floor collapse. Both prototypes omit full viscosity, surface tension, moving obstacles and two-way rigid coupling. The basin clamp makes the zero escaped-particle count a boundary-code check, not proof that a fluid solver handles arbitrary obstacles. The SPH stiffness and PBF iteration count were fixed for this comparison, not exhaustively tuned.

In the compact basin, PBF still had 186 particles above 5 cm at step 60 and 147 at step 240. The equivalent SPH counts were 157 and 131. PBF's mean absolute density error was 0.228 at step 60 and 0.015 at step 240; its p95 compression was 0.009 at both checkpoints. The two repeated compact runs had equal final-state checksums. These are evidence for this narrow fixture, not a physical water-height guarantee.

## Frozen FLUID-01 contract

- Input: a versioned `FluidSceneV1` with a scene revision, fixed `1/120 s` step, declared right-handed XYZ metres, the **0.7 × 1.3 × 0.5 m compact basin**, and exactly 256 caller-provided particles with at least 0.025 m initial spacing. The lattice is the reference fixture, not the only admitted layout. Reject other counts, steps, frames, non-finite coordinates and out-of-bounds particles before changing a world. This first profile has no emitter or CAD obstacle.
- Solver: internal 64-bit positions/velocities; three positive-compression density iterations, initial-density reference, bounded correction and static basin response. Numerical methods can be refined behind the contract if the frozen checks still pass.
- World: `createFluidWorld(scene)`, `step(dt)`, `getState()`, `reset()` and `dispose()`. The host calls every step. Returned state is copied and includes `stepIndex`, `timeSeconds`, particle positions, bounds and diagnostics. Reject an invalid step or scene atomically and retain the last accepted state. Dispose refuses later calls. Index `0..255` is the stable particle identity within a scene.
- Local numeric gate on Apple M3 Max, macOS 15.6.1 arm64, Node 22.22.0: after 60 and 240 compact-basin steps, all values finite, no particles outside the basin, p95 positive compression ≤ 0.05, and final-position checksums equal across two runs. Mean absolute normalized density error must be ≤ 0.35 at step 60 and ≤ 0.10 at step 240. The 60-step and 240-step state-derived projections need a manual visual review for boundary collapse. Record median/p95 step time and retained heap change. A p95 step time ≤ 10 ms at 256 particles is the **local regression gate**, not a browser frame-rate or cross-machine promise.
- Lifecycle and modules: implement the public subpath `@barocss/physics/fluid` in separate type, validation, grid, kernel, boundary, solver and world modules. Do not add the solver to rigid `world.ts` or the root Physics export. The caller owns the scene, clock and display. Physics owns admitted particle state. Add a compiled consumer and a package tarball import check before calling this API supported.

The prototype PBF solver bundle alone was 2,627 bytes minified with no external runtime dependency. This size is **not** the production API size. A separate subpath keeps the existing rigid root import unchanged; it avoids a new workspace package and lock change for this first bounded solver. Revisit the package split if its production dependency, bundle or release lifecycle becomes independent.

## Render handoff to FLUID-02

Physics will return an immutable snapshot with `stepIndex`, scene revision, particle count and copied XYZ metre positions. The host makes one explicit metre-to-Viewer-scene conversion and may pack positions as `Float32Array` for GPU upload. GPU owns a bounded point/sprite draw path. Viewer owns the shared WebGL2 context, camera, depth composition and play/pause/step/reset controls. A separate renderer must not clear the native CAD scene after Viewer draws it. The current inspected GPU draw paths use triangles and lines; a particle path needs its own contract and browser proof in [FLUID-02 #814](https://github.com/barocss/barocss/issues/814).

The native CAD source stays authoritative. FLUID-04 later admits a labelled, revision-bound static obstacle proxy; FLUID-05 is the conditional two-way rigid-coupling gate. Water particles never imply exact NURBS collision or engineering CFD.

## References

- [Position Based Fluids](https://mmacklin.com/pbf_sig_preprint.pdf): iterative density constraints and free-surface limits.
- [SPlisHSPlasH features](https://splishsplash.physics-simulation.org/features/): a taxonomy of neighbor search, boundaries, viscosity, emitters and coupling; no parity claim.
