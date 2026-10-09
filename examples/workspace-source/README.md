---
work_id: 1010
artifact_type: source_consumer
status: done
owner_role: Execute Integration helper
source_request: Issue1010 common source development contract
last_updated: 2026-10-09
---

# Workspace source consumer

Use Node22 and the existing repository dependencies. The example declares six
workspace dependencies. `setup.mjs` creates their normal local `node_modules`
links. It does not install packages or change the root or lock file. The existing
workspace lists only `examples/cad-preview` among examples. This bounded consumer
uses its own setup command; the generated links are ignored by Git.

```sh
export PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:$PATH
node examples/workspace-source/setup.mjs
node examples/workspace-source/source-probe.mjs --output /tmp/barocss-source-1010
node examples/workspace-source/compiled-probe.mjs --output /tmp/barocss-source-1010
node examples/workspace-source/serve.mjs --output /tmp/barocss-source-1010
```

Open `http://127.0.0.1:52935/`. The initial flow compiles a native Surface, displays
it with the own GPU renderer, measures native points, clears it, and restores it.
The page keeps the Surface visible. Clear, Restore and Dispose use the Viewer
public APIs. Run source flow creates a new Viewer after disposal. Proof is in
`window.sourceProof` and `host.json`. The CPU flow also changes a Canvas display
tree, compiles a GPU material, and runs exactly one Physics cloth API step.
It also checks that the public GPU `/source` compatibility path keeps the root
compiler function identity. Cloth disposal uses the public `/cloth` error class.

The source probe and host use ordinary public root and subpath imports with
standard esbuild TypeScript transformation. They use no aliases, custom
conditions or source resolver plugins. Their metafiles must show all six own
families in `src` and zero own `dist` inputs. Raw Node execution of source entries
with internal `.js` imports is unsupported. The probe bundles the CPU entry in
memory, then evaluates that bundle in an actual Node subprocess.

The compiled probe uses a test resolver for every transitive own package import.
It reads each package's actual `publishConfig.exports` map. The resulting inputs
must show all six families in `dist` and zero own `src` inputs. Run the six package
builds before this checkpoint. This check does not verify registry publication,
tarball contents or execution of all supported export keys.

## Cache measurement

One esbuild context serves `/bundle.js`. On each bundle request, the host hashes
all previous metafile inputs, six manifests, and six package TypeScript settings
files. It reuses the bundle when
their contents are unchanged. It rebuilds after an input edit or deletion. New
imports become tracked inputs after that rebuild. Edits must finish before the
next request. The host does not watch files or reload the browser automatically.
Changes to setup or server tooling require setup or a server restart.

Request `/bundle.js` twice. Edit only `sourceLabel` in `browser.mjs`, reload the
page, then restore the exact original label and reload again. Each request records
`cold`, `unchanged` or `edit`, `scanMs`, `transformMs`, and `elapsedMs` in
`host.json`. Unchanged requests have `transformMs: 0`. Times use the monotonic
process clock. They are local observations and do not prove a speedup. The scan
and evidence file writes still have cost. `/evidence` returns the current record.

Send SIGINT or SIGTERM to close HTTP, wait for pending work, and dispose the sole
esbuild context. `host.json` then records `closed` and `contextDisposed`.

These commands require the six source defaults and complete published maps.
At the #1010 local checkpoint, source CPU and actual browser flows used 231 own
src inputs and zero own dist inputs. The explicit compiled flow used 160 dist
inputs and zero src inputs, including transitive published entries. Six affected
builds passed with their original configurations. Actual native pixels, measurement,
Clear/Restore/disposal, unchanged-request reuse and edited-label invalidation passed.
The Issue receipt retains first helper/consumer failures and exact run limits.
This checkpoint does not establish a published tarball or a general speedup.
