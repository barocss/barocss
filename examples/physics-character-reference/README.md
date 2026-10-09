# Raw capsule character reference — #830

This example measures existing public capsule dynamics and queries. It does not add a character controller.

Use Node22 from the repository root:

```sh
pnpm --filter @barocss/physics build:library
node examples/physics-character-reference/setup.mjs
node examples/physics-character-reference/probe.mjs /tmp/character-reference.json
```

Two declared local workspace links support ordinary public source imports. Standard esbuild bundles and executes the actual consumer; no alias/plugin/custom condition, install/root/lock change. CAD may be transitive through public Physics but no CAD operation is run. The probe records actual own src/dist inputs.

## Modules and intended behavior

- `fixture.mjs`: fixed REST/FLAT/STEP10/SLOPE15 configs and geometry/unit hashes.
- `scene.mjs`: public world plus X-only velocity impulse servo and actual ray/overlap probes.
- `metrics.mjs`: independent quaternion axes, segment–OBB distance search, plane gap and tilt.
- `entry.mjs`: intended movement gates, copies/refusals/query boundaries, exact repeat and serial CPU.

The capsule is1m tall: radius0.15m and centreline half length0.35m. Initial upright orientation and zero spin are not an upright lock. Physics uses a declared isotropic inertia approximation. The raw scene adds no angular correction, ground snap, step-up, slope limit, sweep or capsule CCD.

[CONTRACT.md](CONTRACT.md) and [the frozen Issue](https://github.com/barocss/barocss/issues/830#issuecomment-6083722973) define the fixtures/quality targets before code. The10degree walkable limit is an intended controller policy. A raw rigid-body scene was not previously promised to enforce it. Failed policy/tilt gates are product discovery evidence.

## Evidence limits

Residual overlap is an independent capsule-centreline-to-OBB distance lower bound. When the segment intersects the box it is a conservative penetration lower bound, not a full minimum translation depth. Published contact depth is preprojection and is not the final overlap metric. Plane gap is a mathematical fixture reference, not a complete finite-terrain ground query.

Public ray returns ID and distance; a ray from the capsule centre hits the capsule at0. Overlap returns IDs only. Filtering the known actor ID does not provide normals or a shape sweep. The kinematic/static control demonstrates the actual existing exclusion, not a character collision solution.

`ok:true` means the harness completed. `rawCharacterGO` requires all intended movement/quality and CPU gates; admitted contacts do not imply that verdict. Numeric arrays and hashes are not Viewer screenshots. Node cost is not GPU/browser playback. Actual visual capsule representation, original floor source, controls/camera/resources/pixels must be admitted and verified in a later real host.
