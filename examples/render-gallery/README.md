# Local renderer design gallery

This runnable example uses the built `@barocss/render` root export. The published
package remains in `packages/barocss-render/`. It adds no renderer API.

## Run

Use the repository's existing installed dependencies and Chromium. Build from the
repository root, then choose a fresh absolute data directory:

```sh
pnpm build:library
node examples/render-gallery/append.mjs /absolute/local/gallery-data --seed
node examples/render-gallery/capture.mjs /absolute/local/gallery-data
node examples/render-gallery/serve.mjs /absolute/local/gallery-data
```

Open the printed loopback URL (default `http://127.0.0.1:5175`). The initial catalog
has 12 authored synthetic samples across information, text-only metrics, profile,
settings, review and nested/help categories. Capture produces 24 actual Chromium
images: 1200×900 and 390×900 viewports for each sample. Screenshots can be taller
than the viewport when content requires it. Each capture checks visible content,
computed container styles, overflow, page errors, CSP and external requests.

Search or filter thumbnails, select a sample and inspect its captures, exact Spec,
contract, synthetic state and source. Edit text fields and press an action button
to inspect its name and current values. Actions only record values locally; labels
such as Save or Reset do not provide persistence or application behavior.

## Append and preserve

```sh
node examples/render-gallery/append.mjs /absolute/local/gallery-data /absolute/authored-records.json
node examples/render-gallery/capture.mjs /absolute/local/gallery-data
```

The JSON file contains 1–100 complete records in the format exported by
`samples.mjs`: version, stable ID/revision, title/category/tags, Spec, explicit
contract, synthetic initial state, source kind/path/commit SHA, preset and limits.
Records are bounded and validated before storage. Source paths are metadata only;
the host never reads or serves them. Use a new revision for changed content.

Data root permissions must be private (`0700`). `index.json` pairs immutable
`samples/ID-rREVISION.json` records with `captures/BATCH/batch.json` and PNGs.
Conflicting records or reused batch IDs fail. Equivalent JSON key order is
idempotent and does not count as visual variation. Each batch stores candidate SHA,
built renderer/runtime/registry/preset hashes, browser version, exact
Spec/contract/state/sample hashes, viewport, observations and image hashes.
Missing, corrupt or mismatched evidence fails on reload. Captures require both
viewports. Failed captures can leave an unindexed partial batch; preserve it and
use a fresh batch ID. No tool overwrites a previous batch to repair it.

Restart the host after appending. It serves a validated snapshot of the index and
an explicit asset map, with GET-only loopback routes. It disposes only its own
runtime, browser and server resources. The capture CLI automatically creates a
fresh batch ID. `captureBatch` also accepts an explicit ID and selected sample IDs.

## Scope and source limits

One fixed authored preset, `gallery-v1`, supplies typography, text controls and
shell styling. Spec design choices cover only Layout/Card enum styles and
composition. The gallery uses Layout, Card, Text, Input and Button, a Layout root,
2–32 reachable nodes, declared text bindings and named actions.

Image, Icon, Chart, Table, Modal, checkbox, select, date and rich controls are
unsupported. Metrics are text summaries. Settings use text Inputs. Free HTML,
CSS, arbitrary classes, URLs or generated style fields are rejected.

Source labels distinguish authored and fake data. A caller's `model-derived` label
is shown as unverified and cannot replay or produce successful captures. A future
reviewed model source needs a separate provenance workflow. This example does not
read private corpora, invoke models, collect credentials, download dependencies,
publish a site or make model quality/performance claims.

## Verify

```sh
node --test examples/render-gallery/catalog.test.mjs examples/render-gallery/gallery.test.mjs examples/render-gallery/capture.test.mjs
```

The capture test creates the initial 12×2 dataset, appends a thirteenth sample and
a second batch, checks all original bytes and reloads 26 paired images. Set
`GALLERY_RESULT_ROOT` to retain each successful test dataset in a fresh UUID
subdirectory. Without it, test data is temporary. Normal CLI data is durable.
