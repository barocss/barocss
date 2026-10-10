# Detached coupled-position reference (#1263)

This private example reads validated original #1234 and #1252 archives. It does not create or step a PhysicsWorld. The candidate and independent exact rational reference compute hypothetical translations for the first failed accepted stack states only. Public API/capability, forces, historical solver phases and world quality are not established by this example.

Modules: input.mjs validates both immutable archives and restores raw LE fields; entry.ts reuses the qualified original read-only detector/selector; linear-solver.mjs constructs a mass-weighted bounded active-set reference; linear-reference.py independently computes exact rational certificates; compare.mjs preserves agreement/failure flags; controls.mjs owns literal and reused controls; bundle.mjs proves actual source/repeat/genuine-emitted graphs; runner.mjs owns the single bounded root flow. CONTRACT.md and frozen JSON pins specify the pre-trial scope.

Use Node22.22.0 and genuine original dependencies:

```sh
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration node examples/physics-rigid-engine-reference/build-local.mjs
node_modules/.bin/tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck examples/physics-rigid-coupled-position-reference/entry.ts
node examples/physics-rigid-coupled-position-reference/runner.mjs
```

The runner defaults to `/tmp/physics-1263-canonical`. Read whole reports: a candidate/reference or post-geometry failure is a NO-GO result, while unexpected harness failures propagate. Candidate numeric mask diagnostics are not an independent infeasibility theorem. Degenerate multiplier masks need not be unique. Multipliers are kg*m, not Ns or N. Position comparison is in metres; objective/complementarity in kg*m²; stationarity in kg*m.

Diagnostic JSON retains numeric values but loses signed zero. Both original input and hypothetical copied-pose raw13Float64LE artifacts preserve their actual bits. Fresh original detector/selector bits and graph parity are checked separately. A hypothetical pose is not a historical phase state or an accepted new world state.

Status: source drafts and pre-trial scope only; build/controls/canonical trial not yet executed. Parent#1234 remains physicalNO-GO. Exact adoption and later#674/#1254 integrated acceptance are separate from reference qualification.
