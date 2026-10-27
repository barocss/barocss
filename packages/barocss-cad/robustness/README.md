# Robustness runs (RB)

`node scripts/rb/run.mjs [folders…]` (`pnpm rb`) runs every case file through the kernel. The default folders
are `conformance/` and `robustness/corpus/`. Each case gets its own worker process with a SIGKILL timeout.
- A part document (`.json`, raw or a conformance case) is evaluated; a STEP file is imported.
- Each resulting body is validated, measured and tessellated (watertight by position). A conformance case is
  also compared with its expectations.

Every stage is classified as one of:

| Status | Meaning |
|---|---|
| OK | — |
| REFUSED | A typed kernel error; acceptable, except where outputs were expected (then WRONG). |
| INVALID | Fails L0: strict `checkBrep` (an output's `validate()`), or open tessellation edges. |
| WRONG | Valid, but off an expectation. |
| CRASH | An untyped exception, a non-finite number, or a worker that died. |
| TIMEOUT | Killed after `--timeout` seconds; the row names the stage that ran. |
| TOL_BLOWUP | A vertex or pcurve gap above 1e-6 of the model's size. |

The report gives the pass rate (OK + REFUSED) and p50/p95 times per stage × category × input class.

Known failures are listed in `todo.json` (`case`, `stage`, `status`, `note`). Such a failure is marked TODO;
once it passes it is marked IMPROVEMENT, and its entry should be removed. Any other failure is NEW and the run
exits 1. `--record` appends one summary row to `trend.jsonl`, keyed by the commit and a hash of the dataset
(case ids and file hashes), so trends compare like with like.

`corpus/` is the seed corpus written by `node scripts/rb/seed.mjs`:
- part documents across the feature families;
- the broken-mesh set (expected REFUSED);
- STEP exports of this kernel's own models, including the helical thread.

External corpora (RB6) and the ABC sweep (RB8) are fetched at run time and never committed.

## Properties (RB4)

`node scripts/rb/props.mjs` (`pnpm rb:props`) runs the metamorphic properties of `scripts/rb/property.mjs` with a
fixed seed (20261018; `RB_PROPERTY_SEED=random` for nightly runs), `RB_PROPERTY_RUNS` cases each (default 200).
A failure is shrunk to its smallest counterexample. Known failures in `properties-todo.json` show as TODO; any
other failure exits 1. `--record` appends a row to `properties.jsonl`.

## Exact oracles (D25)

`corpus/oracle/` holds cases checked against independent exact integrations (`scripts/rb/oracle-*.mjs`). The
cases are built by `scripts/rb/oracle-cases.mjs`:
- an upright cylinder against a box turned about X, Y or Z, from 0.01° to 90°;
- the box's outermost edge grazing the cylinder's wall, from 10 µm in to 1 µm clear;
- two cylinders whose axes cross obliquely.

The property "exact oracles" draws random members, and `test/property.test.mjs` checks a fixed slice. Volumes
must match to 1e-6 relative, with a floor of 1e-12 mm³; centroids to max(1e-6, 1e-11 / V) mm.

## L4 fuzz (RB5, K10, D188)

`node scripts/rb/fuzz.mjs` (`pnpm rb:fuzz`) generates seeded random CSG trees (`scripts/rb/fuzz-gen.mjs`) and runs
each through the kernel in worker processes, under a SIGKILL timeout.
- **The trees:** boxes, cylinders, spheres, cones and frusta, rounded boxes (four edges filleted) and shelled boxes,
  joined by union, difference, intersect and linear and circular patterns. Half of them are agent-like: whole
  millimetres, quarter turns, flush faces.
- **The oracle** (`scripts/rb/fuzz-oracle.mjs`) uses no kernel code.
  - It casts z rays through a lattice turned 0.4 rad off the axes. Each leaf's exact intervals along a ray are
    combined by the tree.
  - It runs at 6 shifts. The mean is the value; three standard errors are its bound e.
  - A WRONG verdict is confirmed at 4n and 8 shifts before it counts; one cleared there was the oracle's limit.
- **The outcome of each case:**
  - OK: valid under the strict check, watertight, and its volume and centroid within 2e (or 1e-4 of V);
  - REFUSED: a typed error, counted by its code;
  - a finding: WRONG, INVALID, CRASH or TIMEOUT.
- **Findings:** each is shrunk to its smallest tree. With `--save` it is written to `corpus/fuzz/` as a replayable case
  holding the oracle's values, so RB runs it from then on. Known findings are in `fuzz-todo.json`. `--record`
  appends a row to `fuzz.jsonl`.
- **Options:** `RB_FUZZ_RUNS` (default 200) and `RB_FUZZ_SEED` (20261023, or `random`).
