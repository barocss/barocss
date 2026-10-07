# Own CAD Part editor example

Run `pnpm dev:cad`, then open `/workspace.html` on its printed loopback URL.
The default development port is52002. `/` retains the existing canvas/Example
viewer. Existing native example pages/evidence remain separate legacy inputs.

The private React/TypeScript/Vite editor uses genuine shadcn/ui Radix
new-york-v4 source components and exact declared package versions. Component
imports are mapped from registry `cn` and registry-relative UI paths into this
example's `src/lib/utils` and `src/components/ui`. Original registry URLs are
recorded in component headers. CAD/GPU packages retain their original `src`
entries and remain framework-independent. No external CAD engine is used.

## First supported workflow

New empty part -> Add Box -> Add Cylinder -> select by tree or viewport ->
selected-only dimensions/native XYZ placement -> Apply -> Move XY -> one
Undo/Redo -> accepted-only scene download/Open. Both original independent
native documents remain in one scene. Box dimensions are integer millimetres;
Circle prism limits and diagnostics come from the original own CAD evaluator.
The authoring frame is native Z-up, with one derived `[x,y,z] -> [x,z,-y]`
preview rotation. Sampled native edges remain qualified to their original IDs.

Select is the default tool. MMB or Alt+LMB orbits; Shift+MMB, Alt+Shift+LMB or
Space+LMB pans; wheel zooms. Activate Move XY for planar native placement drag.
Numeric XYZ fields remain separate from geometry dimensions. Escape cancels a
current gesture. Camera changes do not create modeling history. Pending raw
inputs are resolved by Apply/Discard/Cancel before another modeling action.

The host-private scenev0 file is a supporting prototype envelope, not the future
public commercial Part/Assembly/Drawing grammar. Limits are four objects,
512KiB file, existing native family limits,4096 display vertices/7938 triangles,
64 edge paths/4096 edge points and20 accepted history states/8MiB. Native
serializers and the signed-zero JSON writer preserve authored numeric signs.
Files exclude drafts, mesh/helper caches, GL resources and history. Unsupported
files are rejected explicitly. A failed native/display/file command keeps the
accepted scene, selection, frame and history; its draft remains repairable.

`node editor-scene-smoke.mjs` with a unique `BAROCSS_EDITOR_SCENE_EVIDENCE`
starts the actual source Vite screen with an ephemeral evidence collector.
Use the controlled browser for the documented UI flow and capture named steps.
The collector records actual native intent, scene ranges, buffers/pixels, file
and history witnesses. It is not another product editor route or CAD evaluator.
Broader validation and commercial geometry/topology/solid certification remain
separate work. First build errors and source/compact corrections are preserved
in task evidence; screenshots alone are not capability evidence.
