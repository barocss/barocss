# Physics limits, errors and lifecycle

## Rigid and query limits

The ordinary rigid profile has at most 32 bodies; opt-in large profile has at most 64. A world admits at most 3600 steps and at most 64 commands per step. Joints, friction, CCD and pair combinations have narrow admission profiles. These counts do not promise every arbitrary configuration is numerically supported.

Upright capsule query has 0–32 static boxes, fixed radius 0.15 m and centreline half-length 0.35 m. Query displacement norm is at most 2 m. Initial overlap is refused instead of depenetrated. Query/controller states are separate from a rigid world.

## Visual profile limits

Cloth fixes 289 vertices, 512 triangles, two pins and a static sphere. It admits 240 steps at exactly 1/120 s. A candidate must satisfy finite position/velocity, stretch, vertex-penetration and pin gates. Vertex collision does not certify continuous triangle separation. Water fixes 256 particles and the admitted basin; optional visual viscosity is not calibrated material viscosity. CAD water admits one axis-aligned static box obstacle in the version 1 profile.

## Stable refusal codes

`PhysicsError.code` is one of `INVALID_CONFIG`, `INVALID_STEP`, `INVALID_COMMAND`, `INVALID_QUERY`, `INVALID_SNAPSHOT`, `STALE_SOURCE`, `STALE_SNAPSHOT`, `WORLD_LIMIT`, `NUMERIC_LIMIT`, `INITIAL_OVERLAP`, `ITERATION_LIMIT`, `DISPOSED`.

Correct malformed input or unsupported step before retrying. Re-admit stale source/snapshot authority. A failed candidate does not change accepted state. `dispose()` is idempotent; later world operations refuse. Source and compiled graphs can have different error constructor identities; compare within the graph you actually imported.

Replay has at most 512 recorded steps, 4096 total commands, a 128 Ki-code-unit scene and a 1 Mi-code-unit snapshot. Restored final state uses a 1e-12 numeric comparison; this is not bitwise platform parity.

No exact Surface/mesh collision, arbitrary joint network, self-colliding/tearing cloth, general CFD, engineering stress or publication is established here.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-physics/README.md)
