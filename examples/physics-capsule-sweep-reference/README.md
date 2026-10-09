# Upright capsule sweep reference (#830)

Private geometric research. This example provides no public Physics API and does not move a body. It measures a fixed upright capsule against copied static boxes. The original raw character tilt/slope failure stays in `../physics-character-reference` unchanged.

## Modules and authority

- `admission.mjs` and `snapshot.mjs`: copied SI snapshot, strict query/revision validation, retention and disposal.
- `geometry.mjs` and `sweep.mjs`: candidate matrix/100-pass segment minimum, separating-plane advancement, bounded refusal and global-minimum tie selection.
- `reference.mjs`: independent Hamilton transforms, piecewise quadratic segment minimum and convex time/root reference. No candidate or Physics helper import.
- `fixture.mjs`: frozen authored developer inputs and analytical roots; `reference-controls.mjs` tests the independent reference.
- `controls.mjs`: actual copies/refusals, near-unit original quaternion bytes and tied-hit permutations.
- `campaign.mjs` and `run.mjs`: full numeric repeats, exact bits and identity/error repeat, serial Node CPU costs and raw outputs.
- `binary.mjs` and `decode.mjs`: explicit little-endian original F64 data and independent raw verification.
- `browser.html` and `browser-driver.mjs`: the same actual Chromium numerical and cost flow. This is not a Viewer/GPU display or a controller.

Only the query reference may become a bounded native GO after both Node and Chromium gates. #1062 still needs exact code adoption and a frozen public contract. Controller #1064 and actual Viewer #1065 remain later gates.

## Reproduce

Use Node 22.22.0. No product package build or dependency install is needed for the plain ESM numerical reference:

```sh
node examples/physics-capsule-sweep-reference/reference-controls.mjs
node examples/physics-capsule-sweep-reference/run.mjs /tmp/capsule-sweep
node examples/physics-capsule-sweep-reference/decode.mjs /tmp/capsule-sweep/manifest.json
```

The browser driver takes an optional installed Playwright `index.mjs` path as its second argument after output directory. It uses a separately launched Chrome process, serves only this example on an ephemeral loopback port, captures console/numeric/raw data and a labelled numerical table, then closes its own server/browser. The recorded run uses the Codex bundled Playwright tool; it is a verification dependency, not an example runtime or replacement kernel.

```sh
node examples/physics-capsule-sweep-reference/browser-driver.mjs /tmp/capsule-sweep-browser /path/to/playwright/index.mjs
```

One complete warmup precedes three serial trials, each100queries per accepted named case. Query validation, geometry and returned copies are timed; construction, independent references, hashes and output writes are excluded. Each per-case p95 must be≤2ms. Browser clock quantization is reported and must not be called GPU/FPS.

All scene/query/output numbers are stored as raw F64 little-endian bytes; JSON sidecars may lose the sign of zero. IDs, revision, exclusion and errors remain explicit sidecar metadata. The decoder reads original bytes and independently recomputes all fixed outputs. Initial overlap refuses; initial touching returns hit0 even for separating movement. A later controller must choose its own grounded/separating-motion policy.

No arbitrary terrain, dynamic pushing, step-up/controller, CCD extension to the existing rigid world, exact CAD collision, engineering calibration, code integration or package publication follows from this private reference.
