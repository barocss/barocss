# Exact capsule geometry reuse reference (#830)

Private geometric discovery. This example reuses the unchanged scalar capsule sweep when copied box geometry has exactly identical original binary64 values. Every original box and ID remains in the accepted snapshot. It provides no public Physics API, controller or Viewer display.

The [pre-code contract](https://github.com/barocss/barocss/issues/830#issuecomment-6086709289) keeps the original 22 scenes, SI units, radius/height, tolerances, cap, output fields and quality/cost gates. The original first-trial 3.506584 ms cost failure remains immutable. Reuse changes the number of repeated scalar evaluations, not their equations.

## Modules

- `groups.mjs`: exact 80-byte little-endian original geometry key; no rounding or normalized-key substitution.
- `snapshot.mjs`: copied source storage, group query/exclusion/global-minimum ties and disposal.
- `reuse-controls.mjs`: original-output byte and identity equivalence, copies/refusals, distinct original-bit keys and actual work-count diagnostics.
- `campaign.mjs`: mechanically copied baseline observation/timing code with only imports redirected. Independent Hamilton/piecewise/analytic references are unchanged.
- `construction.mjs`: one post-campaign construction observation per fixture, outside query timing.
- `run.mjs`: serial full queries, exact immutable baseline hashes and original metadata comparison.
- `browser.html` and `browser-driver.mjs`: same actual Chromium numerical/cost verification; the driver serves only the two Physics-owned reference directories.

The diagnostic key byte count is a serialized geometry count, not measured heap. Source/group/member diagnostics are copied. The per-call research callback is absent from measured queries. The original query output shape is unchanged.

## Reproduce

Node 22.22.0, from the repository root:

```sh
node examples/physics-capsule-sweep-reference/reference-controls.mjs
node examples/physics-capsule-reuse-reference/run.mjs /tmp/capsule-reuse
node examples/physics-capsule-sweep-reference/decode.mjs /tmp/capsule-reuse/manifest.json
```

The original independent decoder reads the same raw format. Original numerical inputs and outputs must match both baseline SHA values exactly. Construction is recorded after the query campaign; it has no invented budget and is excluded from p95. One complete warmup precedes three serial trials of 100 queries per accepted named case. Each per-case trial p95 must be ≤2 ms. There is no comparison to an old session's CPU values or a claim that a specific runtime phase caused the old failure.

Only after Node gates pass:

```sh
node examples/physics-capsule-reuse-reference/browser-driver.mjs /tmp/capsule-reuse-browser /path/to/playwright/index.mjs /tmp/capsule-reuse
```

The recorded browser tool is Codex bundled Playwright. It launches its own Chrome process and ephemeral loopback server, captures numeric outputs/console/data and a labelled table screenshot, then closes its own resources. The same input/output bytes must match Node and the original baseline; browser p95/clock precision are separate from Node and GPU/FPS.

No product package changed, so these plain ESM flows require no affected product build. Existing source/compiled package acceptance and an actual public query remain #1062. The actual movement controller #1064 and Viewer #1065 are later gates. A private reference result is not code integration or publication.
