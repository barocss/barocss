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
