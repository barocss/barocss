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

## Relational workflow gallery (#498)

The improved example starts with Orders, then Projects and the original specimens.
Run it separately from the original gallery:

```sh
pnpm build:library
node examples/render-gallery/workflows/serve.mjs /absolute/local/original-gallery-data
```

Open the printed loopback URL (`http://127.0.0.1:5176`). Port 5175 and its immutable
original dataset stay unchanged. An occupied port fails; the host never stops
another process. Omitting the data path uses the retained #496 local baseline.
Use the existing installed React, esbuild, Playwright and Chromium; no downloads.

The versioned authored fixture has 48 orders, 12 customers, 16 products, three
projects, 24 tasks and six assignees. It freezes the date, uses integer cents,
validates references and bounds serialized data at 1 MiB. Long bilingual text,
missing notes/assignees/dates, overdue tasks and empty subtasks are explicit cases.

Orders searches customer/product/order data, combines status/customer filters,
sorts date/total with ID ties, paginates four rows, retains hidden selection and
provides real overview, product-line and local-status-history tabs. Pack advances
queued→packed, then Dispatch advances packed→dispatched. Bulk Pack accepts only
1–4 checked queued records on the current page; mixed, hidden, unknown or stale
sets reject atomically. Clear selected rows removes retained hidden checks.

Projects searches linked task/subtask/project/assignee text, filters project/status/
assignee and sorts due dates with nulls last in both directions. The current page
is grouped by status. Finish/Reopen subtask buttons update selected task state.
Complete task rejects incomplete subtasks; completing the last subtask then the
task updates board counts and detail. Reopen a completed task before editing it.
Queries, filters, page, selection, Orders checked set/tab and accepted changes
survive workspace and original-specimen switches within one browser session.
A reload starts a fresh session; no server persistence is claimed.

### Host versus renderer

The semantic Orders table, mobile labelled rows, navigation, filters, checkboxes,
tabs and pagination are native **authored host UI**. They are not render Spec
components. A separate `workflow-host-v1` preset supplies typography/density.
Data-derived Orders summary/detail and four project column/detail panels use the
built-root `Renderer`, unchanged `validateSpec` and `classesFor`. Each projected
panel has 2–32 nodes and at most 32 declarations; no public contract expansion.
The disclosure shows current projected Specs/contracts/state and their fixture/
build digests. Original specimens retain their original Specs and gallery-v1
preset, separately from workflow projections. No Table/Chart/Image/Modal/free
style support is added to the public renderer. All data is fictional authored
content; no model generation, payments or external services.

### Operations and actual captures

```sh
node --test examples/render-gallery/workflows/data.test.mjs examples/render-gallery/workflows/state.test.mjs examples/render-gallery/workflows/browser.test.mjs
node examples/render-gallery/workflows/milestone.mjs /absolute/fresh/orders-evidence
```

The second command captures only the running Orders host and exercises its
operations. The browser test starts its own ephemeral host, exercises both
workspaces and captures 18 actual PNG/JSON pairs at 1200×900 and 390×900: Orders
normal/empty/error/mutated/mixed-bulk-error, Projects normal/empty/error/mutated.
It verifies relations, counts, totals, selected detail, atomic rejection, state
preservation, content/runtime styles, no viewport overflow, page/CSP/external
errors, and owned cleanup that preserves another runtime. Original 13 samples/
26 images are hashed before/after and the baseline server remains reachable.

Set `WORKFLOW_RESULT_ROOT` to retain each verified test dataset in a fresh private
subdirectory. Normal milestone output is durable. `evidence.mjs` writes a separate
`workflow-index.json` with immutable PNG/JSON files, complete current state and
projected panels, bounded operation history/trace, candidate/build/fixture/preset/
browser/viewport/image digests and native table observations. `verifyArtifacts`
detects duplicate names, missing/corrupt images, metadata mismatch and unsafe
paths; it does not silently repair them. Failed writes can leave unindexed partial
files: preserve them and use a new root. The original specimen storage contract
and its initial-state capture invariant are unchanged. Working-tree milestone
captures are preliminary; final clean merged-head captures are the committed
verification evidence. No public deployment, model call or private corpus import
is part of this example.
