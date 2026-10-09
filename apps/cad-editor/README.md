# CAD Editor application

Private React/shadcn host for `@barocss/cad-editor`. Menus, project/document routes,
body tree, file picker, genuine download and canonical fixtures live here.
Reusable editing state, inspector and Viewer bridge live in the package.

Use the installed Node 22 runtime. No new dependency or browser download is
required by the focused flow.

```sh
pnpm --filter @barocss/cad-editor build:library
pnpm --filter @barocss/cad-editor-app build
pnpm --filter @barocss/cad-editor-app dev
```

The independent host uses `http://127.0.0.1:52010/`. File → Open reads a real UTF-8
native file. File → New sample loads the weighted Surface and visible reference
Line. Select **Weighted surface**, choose U/V, enter pending values, and Apply.
Download contains accepted native bytes; pending fields remain pending.
The status says “Download started”. Open those bytes in a fresh app to re-edit.

The fixture is `canonical-surface-and-curve.cad-document.json`: Surface degrees
2/2, weighted 3×3 original control net, plus an untouched separate two-pole Line.
The first edit is U1/V1, Z18→24 mm and weight1.5→2. The native midpoint changes
from `[30,20,70/9]` to `[30,20,56/5]`. After fresh Open, Z24→28 gives
`[30,20,64/5]`. The Line midpoint remains `[-15,20,-5]` throughout.

```sh
node apps/cad-editor/flows/canonical-surface-flow.mjs --source --headed --port 52010 --evidence /Users/user/.barocss-ai/v3/evidence-cad-editor-foundation
node apps/cad-editor/flows/canonical-surface-flow.mjs --compiled --headed --port 52010 --evidence /Users/user/.barocss-ai/v3/evidence-cad-editor-foundation
```

The single bounded source flow drives the real file input, native Apply,
Undo/Redo, camera changes, genuine download, a fresh browser context and re-edit.
It checks complete Curve source/coefficients/binding preservation, independent
native vectors, actual RGBA changes, native weight0/parser/profile/Viewer
refusals, stale candidates and one component unmount/remount. The compiled
checkpoint uses explicit transitive published JS/types/CSS maps and a shorter
real file flow. Attempt logs, first failures, downloads and screenshots remain
in the evidence directory. The flow closes its own browser and Vite server.

`--browser` and `--playwright` select already installed runtimes. Defaults point
to the installed local Chromium1223 and bundled Playwright. The `?flow` route
enables a bounded test seam with copied snapshots/diagnostics and declared host
actions. It provides no renderer handle.

The app preserves authored XYZ and uses the existing Viewer basis assertion,
native sampling units1 and one mm-to-scene scale0.01. Camera and display data are
absent from downloaded native files. General documents, native feature graphs,
sketches, assemblies and exchange remain separate roadmap stages.

For #1044 draft/selection evidence, add `--draft` to either focused flow command.
The additional real browser flow records native composition events, guards Enter
during composition, checks selection Apply/Discard/Cancel and focus, refuses an
invalid native weight without changing the accepted frame, highlights the read-only
Curve, refuses stale targets, exercises actual text/document keyboard undo and
performs a genuine Download → fresh Open → Enter re-edit. Its extra midpoint
checks are `[30,20,68/5]`, `[30,20,72/5]` and `[30,20,76/5]`.

For #1045 complete-inventory evidence, add `--inventory` (and `--draft` for the
previous draft flow). `complete-native-inventory.cad-document.json` has four
assets and sixteen bodies. Open asks for one to four visible objects before
adoption. Checkboxes hide/reveal bodies without modifying native data. Fit selected
uses actual native bounds, and actual canvas picking resolves a full qualified
body reference. A foreign asset has the same Surface ID and remains unchanged.
Multi-object Surface assets are explicitly read-only until a public native asset
replacement writer exists. A hidden degree5Curve remains valid native content;
showing its asset reaches the actual unsupported-preview refusal and retains
the prior frame. Over-display-budget requests are refused without truncation.
The genuine full-document download retains all hidden sources/models/body IDs
and revisions. Fresh Open chooses a new display set and re-edits the original
Surface; foreign same-ID geometry stays exact. Native file budget is2MiB.

## Boolean extrusion workspace

File → New Boolean extrusion opens the separate feature workspace. The tree shows actual native Face/Boolean/extrusion dependencies. Length controls edit literal values or offsets from existing parameters. Select Combine faces to change union/intersection/difference, then Apply. Discard removes unapplied values. Surface and feature modes retain their host sessions when navigating between them.

The workspace uses the public native Boolean graph evaluator/updater/serializer and the existing qualified native mesh/GPU Shell renderer. The native profile is two coplanar Faces →Boolean →normal extrusion, not two solids. Suppression is unavailable. Parameter/feature lifecycle creation/removal, full parametric constraints, assembly, Viewer Shell selection and certified solid modeling are later contracts. Original inclined authored XYZ/mm stays intact; display scale is0.01.

Download saves the accepted authored graph. Open reads that same graph format and requires the configured extrusion/output slot. Pending fields and display state are excluded from files. Invalid length/dependency/contact/file/native mesh/GPU changes retain accepted graph/history/draft/frame. Help contains technical profile details.

Run the focused actual gate with installed Node22 and Chromium, without downloading dependencies:

```sh
node apps/cad-editor/flows/feature-graph-flow.mjs --source --headed --port 52012 --evidence /Users/user/.barocss-ai/v3/evidence-cad-editor-feature-graph
node apps/cad-editor/flows/feature-graph-flow.mjs --compiled --headed --port 52012 --evidence /Users/user/.barocss-ai/v3/evidence-cad-editor-feature-graph
```

The server guard requires its own child to listen before browser access. Source and built public entries use the same bounded native edit/refusal/file flow. Integration registration and release remain separate.

File → New shared extrusions creates the native four-leaf sample. Select outputs with checkboxes, Show all, or Show only selected. Fit selected frames a displayed nonempty extrusion. Height/Boolean edits rebuild all four native outputs even when some are hidden. Download retains the complete authored graph; visibility is excluded from native files.

`node apps/cad-editor/flows/feature-fanout-flow.mjs --source --headed --port 52012` runs the existing single-output gate and one four-output extension. Replace `--source` with `--compiled` for built public entries. Evidence defaults to `/Users/user/.barocss-ai/v3/evidence-cad-editor-feature-fanout`. The flow verifies true native fanout vectors, full-scene pixels/refusals, view-only draft/history/download preservation, different fresh-app display choices and genuine full-graph re-edit.
