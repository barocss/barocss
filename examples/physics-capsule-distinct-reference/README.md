# Distinct static box capsule query reference

Private Physics discovery for [#830](https://github.com/barocss/barocss/issues/830), frozen before code in [6087277600](https://github.com/barocss/barocss/issues/830#issuecomment-6087277600). Public [#1062](https://github.com/barocss/barocss/issues/1062) remains planned. No public package or movement controller is provided.

This example imports the unchanged exact-bit grouped snapshot and scalar query. Nine additional fixed profiles measure actual distinct world translations. The original 22-case baseline and coincident-geometry result remain unchanged. Grazing boxes have centres X=0.5+i/1000 m; all are deliberately crowded. This is a capacity probe, not a real terrain layout or a guarantee for every 32-box orientation.

## Modules

- `fixture.mjs`: nine frozen SI scenes and queries.
- `controls.mjs`: independent expected counts, original scalar result bits, copied source/diagnostics and refusal retention.
- `campaign.mjs`: unchanged observation/reference equations and 2 ms timing gate, with new fixture import and saved individual timings.
- `construction.mjs`: separate post-query construction observations and serialized key counts; no heap estimate.
- `run.mjs`: Node provenance, two complete repeats, controls, canonical serial cost trials and original little-endian data.
- `decode.mjs`: independent raw verifier. It imports the old reference and binary codec, never the candidate or fixture. It verifies the nine named inputs against the frozen formula and every output against independent geometry.
- `browser.html` and `browser-driver.mjs`: conditional actual Chrome numerical/cost checks, Node byte and identity comparisons, clock resolution, console output and cleanup. The page has no Viewer scene.

## Reproduce

Use Node 22. Stop other numerical campaigns before measuring.

```sh
node examples/physics-capsule-sweep-reference/reference-controls.mjs
node examples/physics-capsule-distinct-reference/run.mjs /tmp/physics-distinct
node examples/physics-capsule-distinct-reference/decode.mjs /tmp/physics-distinct/manifest.json
```

Run the browser only if the Node report has `candidateGO: true`:

```sh
node examples/physics-capsule-distinct-reference/browser-driver.mjs /tmp/physics-distinct-browser /path/to/playwright/index.mjs /tmp/physics-distinct
```

The Playwright module is a verification tool. It is not a product dependency. The driver owns and closes its loopback server and browser; it does not touch user tabs.

## Acceptance boundaries

Radius 0.15 m, centreline half-length 0.35 m, upright world Y. Scalar advancement cap 64 and original tolerances remain fixed. Each query visits all eligible distinct groups. A last initial overlap refuses the complete query even after earlier hits. Normals are dimensionless; witness points and segments are metres.

Cost: one full untimed warmup per accepted case, then three serial trials of 100 full queries. All case/trial p95 values must be at most 2 ms. Admission, group loop, scalar calculation and returned copies are timed. Construction, oracle, hashes and IO are excluded. No extra warmup, profile replacement or gate change after a failure. Keep every first result.

A pass qualifies only the named profiles. It does not prove arbitrary geometry latency, certified CCD, dynamic pushing, terrain, a controller, Viewer playback, GPU time or publication. Public fields/capacity/errors still need an explicit contract and exact code adoption. See `evidence/receipt.json` for the executed result when available.
