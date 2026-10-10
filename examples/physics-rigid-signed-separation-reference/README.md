# Retrospective detached signed rows — #1344

This private example adds the fixed pairs found by #1308 to the three archived first-failure pre-correction frames. Original rows stay in their old order. Added rows use fresh signed SAT on PRE poses. It is a retrospective experiment, not live pair prediction or an accepted PhysicsWorld step.

Cases are ALIGNED5 (6+2 rows), OFFSET3 (6+2) and YAW4 (7+1). Each has exactly eight rows and nine bodies. The copied bounded kernel keeps the original arithmetic, thresholds, mask order and first-winner rule. Only strict signed input and depthM→boundM differ. The old nonnegative API remains unchanged.

One solved result is applied once to copied positions. Orientation, velocity, spin, static state and metadata stay exact. Before/hypothetical-post raw Float64LE streams preserve body-field zero signs. Historical JSON row coefficients have no raw sign receipt; their rehydrated values are kept, while fresh-query sign differences are recorded.

Root owns execution after full source/input/error/reference freeze and a measured commit. The harness verifies the existing published actual emitted ledger before bundles or controls. It never writes that ledger. Use Node v22.22.0 and the unchanged original CAD/Physics build helper with own ignored dependencies/dist.

Root-only commands after the freezes:

```sh
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration node examples/physics-rigid-engine-reference/build-local.mjs
node node_modules/typescript/bin/tsc -p examples/physics-rigid-signed-separation-reference/tsconfig.json
node examples/physics-rigid-signed-separation-reference/runner.mjs /tmp/physics-1344-canonical
```

The TypeScript check is strict for TS sources. MJS interop uses allowJs with checkJs false; it is not a strict typed-MJS proof.

Source, distinct repeat and genuine compiled original helpers must match. The one flow checks every PRE and hypothetical POST pair, fresh selected rows, exact Fraction reference, finite native certificates and copies. Every raw and normalized POST depth must be <=1e-12 m. First physical failure is retained, and later graphs repeat only that prefix.

No result is measured yet. Any GO is only retrospectiveDetachedSignedRowsGO. World, live row closure, general36-row solving, public API, angular/friction laws, calibrated forces, long runs, Viewer, cost and release remain unqualified. The original #1264 physical NO-GO remains.
