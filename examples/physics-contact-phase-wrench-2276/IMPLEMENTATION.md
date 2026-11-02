# Source-private instrumentation handoff

Authored only. The protected CONTRACT.md, design.md and source-audit.json are unchanged. No build, candidate import, geometry call or World step has run during authoring. The stage is not a production promotion.

Root review/freeze commands through the existing heavy gate and 180-second wrapper:

```sh
node examples/physics-contact-phase-wrench-2276/build.mjs build-01
node examples/physics-contact-phase-wrench-2276/run.mjs build-01 phase-01
```

The build verifies the nine protected source audit pins and qualified B dependencies before copying the complete actual Physics src closure. All instrumentation is confined to the new evidence build directory. The private bundle must resolve entirely inside that stage. A new hash-derived provider manifest distinguishes the staged geometry/dispatcher/observer graph from public Physics. Replay and recorder ownership use the same staged graph. Root-owned production files, B prototypes and older receipts are never edited.

The runner uses the original changing-plane input and saves complete raw traces before independent gates. It calls the separate observer with the saved packet only. Python imports no candidate or physics code. Set PHASE_PYTHON to an already installed interpreter if required; no tool installation occurs.

See IMPLEMENTATION-MAPPING.md for explicit depth/dispatcher deltas, phase event semantics, sidecar commit, trace normalization and proof limits. The hard caps remain 4 Worlds, 8 total attempts including failed/hidden restore calls, 8192 records, 4352 applications, 72 B calls, 288 query points, 7776 anchor checks and 16 MiB including terminal reserve. If a cap fails, preserve NO_GO; do not raise it.
