# CAD Viewer app

The screen uses React and local shadcn/ui components, with the same component
source and dependency versions as CAD Studio. `src/components/ui/` contains
Button, Input, NativeSelect and the Radix-based Dialog. `src/lib/utils.ts` holds
the shared class pattern. These files belong to the Viewer app. The app does not
import Studio at runtime.

File actions, camera controls, visibility, measurement and saved-view actions
use icon buttons. Each icon has an accessible name and a tooltip. Standard
view cubes highlight their corresponding face. The screen keeps input ranges,
evaluated parameters, coordinates, units and errors. Repeated help bars,
viewport captions and long Inspector instructions are removed.

On narrow or short screens, panel icons open the document tree or Properties
over the viewport. Only one panel is open at a time. Escape closes an open panel
and returns keyboard focus to its icon. The canvas and accepted review stay mounted
while the screen size or panel changes.

Tailwind CSS compiles the actual screen and component classes. Preflight is off,
as in Studio. Workspace CSS is in the lower `legacy` layer. `tailwind.css` maps
the shadcn color tokens to the Viewer palette. `components.json` records the
local shadcn configuration.

The workspace groups bodies by their original asset. ISO, Front, Top and Right
change the camera direction while preserving geometry, visibility, selection
and materials. Front looks from +Z, Top from +Y, and Right from +X in the display
basis. Fit all restores the SDK's complete scene view.
Fit selected frames one selected, visible body or assembly occurrence in ISO.

A separate document review app. It consumes the public `@barocss/viewer`,
`@barocss/cad-interop/document`, `@barocss/cad-interop/assembly`, `@barocss/cad`
and `@barocss/gpu` APIs. It keeps the original CAD
source and bindings. It does not edit the document.

## Run

From the repository root, use the existing Node and workspace dependencies:

```sh
node apps/cad-viewer/server.mjs
```

Open `http://127.0.0.1:53032`. Set `CAD_VIEWER_PORT` to use a different port.
The local server reuses esbuild and the installed Tailwind Node compiler. It
bundles `src/main.tsx` with the automatic React JSX runtime. It compiles the CSS
from `tailwind.css` and scans the actual local TSX, JavaScript and HTML inputs
with the Tailwind scanner. No install or package publication is needed.

This is a source development app. Its resolver reads public package exports
from this clone. `/input-audit.json` records JavaScript input SHA-256 hashes,
all CSS imports and scanned content hashes, the generated CSS hash, the HTML
hash, and source/dist input counts. The resolver refuses foreign BaroCSS source
and BaroCSS dist inputs. Studio files are not build inputs.

For a build check without opening a server port, run:

```sh
node apps/cad-viewer/server.mjs --check
```

## Viewer availability

While the Viewer starts, the viewport shows **Starting Viewer**. If WebGPU or
an adapter is unavailable, it shows **WebGPU unavailable**. Other startup errors
show **Viewer could not start**. File actions are unavailable until startup succeeds.

After startup, the status bar reports WebGPU device loss and device recreation.
Device recreation reports that a device was created; it does not confirm that
the canvas or its contents were restored. The app does not offer device recovery.

## Open a document

1. Choose **Open document** and select a local `.cad-document.json`, `.igs`,
   or `.iges` file. You can also use **Open sample**.
2. Choose 1 to 4 supported bodies in the admission dialog.
3. Choose **Load bodies**. The app uses SDK admission to replace the scene.

Use **Close CAD file** to clear the current scene and session views. An in-flight
file read, review or image export cannot be applied after close. The Viewer keeps
its lighting override when the scene is cleared.

The reader uses the actual source-backed CAD document codec. It accepts the
direct geometry profile, with millimetres, radians and the authored XYZ frame.
Bodies reference native Surfaces or Curves. The native display profile also
limits each selected source asset to 16 native objects in total, including
objects that are not displayed. The app displays at most 4 bodies at once.
Unsupported body rows
remain visible with their refusal reason.

The file read boundary is 2 MiB. The current CAD codec also applies source
budgets. Detailed sampling can still refuse a chosen body. Invalid document
data and unsupported body selections are rejected before acceptance.

IGES input is limited to the CAD writer-compatible ASCII 5.3 profile: open
type 126 Curves and type 128 Surfaces, in millimetres with scale 1 and no
transform. It accepts up to 16 entities and 1 MiB. The app generates a new CAD
document from the imported geometry; original author IDs, assembly structure
and feature history are not recovered. The review binds both the original IGES
bytes and the generated CAD source. This is not general IGES support.

The sample comes from
`packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json`.
It contains 6 bodies across 2 assets. The dialog selects the first 2 supported
bodies by default and shows the remaining bodies for explicit choice.

## Open an assembly

**Open CAD file** accepts an existing `.cad-assembly.json` file as well as a
document file. **Assembly sample** opens the existing original fixture at
`examples/gpu-scene/fixtures/assembly-revision0.json`. Choose 1 to 4 existing
instances, then choose **Load instances**. The complete source and hierarchy
are retained. Unloaded parents remain metadata rows with expandable children.
The parser does not create parts or placements. Each selected source asset can
contain at most 16 native objects. At most 4 instances can be displayed at once.

The Assembly list follows the authored parent hierarchy. Search keeps the
ancestors of matching instances. Each occurrence has its own SDK display ref,
even when two occurrences refer to the same asset and geometry. Select a row
or click visible geometry to select that occurrence. Show, hide, isolate,
standard views and Fit keep the authored world placement. Choosing another
instance subset requires a new admission. Reviews require the same ordered
admitted subset.

The inspector shows assembly and part revision pins, parent path, original
geometry and separate local/assembly placement origins in millimetres. Native
point inspection starts at the original parameter domain midpoint. Enter a
Curve t or Surface u/v to evaluate the original native point. The SDK returns
separate **Part local XYZ mm** and **Assembly XYZ mm**, including all authored
parent placements. This query does not change the view or CAD source. A bad
parameter retains the last accepted result and shows its reason. Use the A/B
icons to keep points from visible instances. The Points panel shows their
part-local and assembly coordinates and the straight-line distance in mm.
The SDK evaluates each point again against the current assembly. The result is
not a certified dimension. Hiding or removing an instance clears its point
and the distance. A review file stores a completed pair and its distance;
opening it re-evaluates both points against the current assembly before
applying the review. A single unfinished point is not saved. Named views do
not store assembly points or distance.

Assembly mode disables the document distance tool and material changes. It
does not reinterpret document native measurements as assembly distances.
Lighting remains available when a Surface is loaded. A successful source
replacement clears the earlier host measurement and inspection.

Assembly review files bind the complete original assembly, including nested
part sources, full references, parent IDs and placements, with the existing
canonical JSON SHA-256. The SDK also checks assembly revision and exact
ordered occurrence pins. A changed source, missing instance, stale pin or
unsupported measurement refuses before acceptance. Legacy raw SDK reviews
retain revision-only protection. JSON numeric -0/+0 are equivalent under the
canonical hash; signed zeros inside original source strings remain distinct.

## Saved views

The Inspector's **Saved views** list stores up to 8 named snapshots for the
current source and ordered loaded body/instance subset. Enter a name and
choose **Save view**. Each snapshot keeps its camera, visibility, selection,
completed native document distance and supported lighting. It does not store
CAD geometry, material overrides or assembly point inspection parameters.
Finish or cancel point selection before saving a snapshot.

Use **Restore** to apply a snapshot explicitly. Rename and Delete only change
the list. Names are trimmed by the screen, contain 1–64 UTF-16 code units and
have no control characters. Names are unique with case-sensitive comparison.
A failed rename, capture or restore keeps the accepted list and scene.

**Save review** includes the complete list in the existing source-bound app
review file. **Open review** validates the main view and every listed snapshot
with the SDK before applying the main view once and accepting the list. A bad
camera, native parameter/distance, lighting value or scene pin in any entry
refuses the complete file. The list also shares the existing source hash.
The compact 32 KiB file bound includes all entries. A list edit that would
exceed this export bound is refused before replacing the current list.

Older review files without `namedViews` retain the current list. An explicit
empty array clears it. Successful source admission, including a new loaded
subset, clears the list; candidate parsing and cancellation preserve it.
Document and assembly contexts do not mix. Changes to the scene or list during
an asynchronous file/list snapshot cancel that operation.

The SDK's `validateMeasuredReviewState()` uses the same preparation path as
apply, with no presentation or accepted cache changes. It does not add named
view storage to the SDK. Native distance and lighting restrictions remain the
same for each scene mode. Material overrides may make an existing snapshot
temporarily unrestorable; Rename and Delete remain available.

## Document controls

Use the body list to select, show, hide, isolate and fit displayed geometry.
The inspector shows its original document, body, asset, revision and geometry
bindings. Drag to orbit, Shift-drag to pan and scroll to zoom. Press
**F** to fit all visible geometry and **Escape** to clear selection.

With the viewport focused, use arrow keys to orbit, Shift+arrow keys to pan,
and +/− to zoom. F fits all visible geometry; Shift+F fits the selected body.
Escape cancels active distance selection before it clears a selection.
These keys do not intercept typing in the Inspector or search field.

Use the plus icon on an unloaded supported body or instance to open the chooser
at that item. If four items are already loaded, select the item to replace and
choose Load. Cancel keeps the accepted scene and returns focus to the icon.
Loading a new selection applies the existing admission reset rules. If display
recovery after a failed load also fails, the app reports that failure.
Unsupported items show their reason in the tree and to keyboard users.

Choose **Fit selected**, or press **Shift+F** with the viewport focused, to fit
the selected visible body or assembly occurrence in ISO. The app uses the
SDK's `fitGeometry()` with the selected display reference and its authored
placement. Other bodies stay visible. This command changes the camera and
keeps the selection, visibility, lighting, completed measurement and source.
It requires a visible selection. The existing **F** shortcut still fits all
visible geometry.

The viewport's **Pick** control has **All**, **Surface** and **Curve** choices.
It limits which geometry a viewport click can select. The same filter applies
to both A/B clicks in the distance tool. Changing the filter keeps the current
selection and completed measurement. Tree selection, body visibility and the
CAD source are unchanged. An opaque Surface still covers a Curve behind it;
choosing **Curve** does not make that Curve visible or selectable.

The pick filter belongs to the current session. Review files and saved views
do not store or restore it. Successful source admission, including a changed
loaded body or instance subset, resets the filter to **All**.

Select a document body to open **Geometry** in the Inspector. Enter Curve
**t** or Surface **u/v**, then choose **Inspect point**. The displayed ranges
come from the original parameter domains. The first result uses their midpoint.
**Original XYZ** is in authored millimetres. It does not use sampled screen
coordinates, display scale or a camera transform. The query stays available
when the selected body's point is outside the camera view.

The app binds the public CAD reference and point query to the currently loaded
document, body and asset revisions. A rejected parameter retains the last
accepted result and its **Evaluated** parameters. The draft inputs stay visible
with the error. Changing or clearing selection, hiding that body or accepting a
new source clears this inspection. Camera, lighting and Pick changes retain it.
Native point inspection changes no geometry, camera, selection, framebuffer
or distance query cache. It is a point evaluation, not a distance measurement
or a certified dimension. Review files and saved views do not store its draft
or result. Assembly mode keeps its separate part/assembly point inspector.

The Geometry panel also estimates the selected Curve's length or the selected
Surface's area. Choose the calculation icon to run the existing public native
CAD query over the complete original t or u/v domain. Absolute tolerance uses
mm for length or mm² for area; relative tolerance is unitless. The app uses fixed
bounded evaluation budgets. A rejected query keeps the previous result and its
accepted tolerance targets. During the pending calculation, changing selection
or accepting another source cancels the old inspection context.

Results use an approximate sign and show the heuristic error estimate, source
domain and accepted tolerance targets. The error is not a certified upper bound.
Surface area counts the parameterized domain with multiplicity; it is not a
trimmed, union or BRep area. These estimates are not certified dimensions.
Calculation changes no Viewer state, display pixels, source or distance cache.
The options and result are session inspection data and do not enter review files.
Assembly mode retains its existing point inspection without these new metrics.

The appearance controls apply or clear a temporary Surface material. Clear
Surface selection before applying a material. Clear a bound material before
selecting or hiding that Surface. These controls use the existing GPU material
compiler and Viewer binding API.

The Lighting panel changes ambient strength, directional strength and light
direction for a primitive scene with a loaded Surface. Strengths range from
0 to 1 and their sum cannot exceed 1. Direction components range from -1000
to 1000 and cannot all be zero. The direction is unitless, points toward the
light and uses the Y-up display frame. The app keeps the entered direction
scale. Reset restores the Viewer's creation lighting: ambient 0.35,
directional 0.65, direction [-0.6, 0.8, 1]. Lighting changes keep the camera,
geometry, selection, native measurement and original document intact.
Environment maps, shadows and post-processing are unavailable in this Viewer
control path. The panel is disabled for curve-only scenes.

**Measure** starts a two-point distance tool. Click A and then B in the same
asset. Screen picking uses sampled geometry. The public SDK evaluates those
parameters on the original Surface or Curve and returns straight-line distance
in native millimetres. This is not Curve arc length or a certified dimension.
Surfaces with temporary materials can also be measured. Existing selection,
geometry, camera and framebuffer pixels stay unchanged by the measurement.

The inspector shows A/B source names, parameters, native XYZ coordinates and
distance. Overlay markers follow the camera and viewport size. Projection does
not test occlusion. Escape cancels an active tool. Clear removes the app's
measurement display; the SDK keeps its last successful query cache. Hiding a
measured body or successfully loading a document removes the app's measurement.
Different-asset and ambiguous picks keep A for another attempt. A missed pick
also keeps the active tool. Finish or cancel point selection before saving a
review. PNG images do not include the DOM measurement annotations.

The **A** and **B** icons beside an inspected point use its last **Evaluated**
parameters. Editing a draft does not change that accepted point. A starts a new
pair and keeps the SDK's last successful distance cache. B completes the pair
or replaces its second point. Select another visible loaded body in the same
asset to use its original Curve or Surface point. A point outside the camera
view can still be used; its overlay is omitted. A can also be followed by a
viewport pick for B. A rejected endpoint keeps the current pair and distance.
The completed result uses the existing review and saved-view formats.

**Save review** writes compact app review JSON. It records the camera,
visibility, selection, source revision pins and the completed A/B measurement.
For supported Surface scenes it also records the accepted lighting override,
or null for creation lighting. Curve-only reviews omit this field.
Each endpoint keeps its native model/object reference and original parameter.
The file stores straight-line millimetres with the native-authored and
not-certified boundaries. A SHA-256 of the canonical accepted document binds
the review to its original source content, including asset source text.
CAD geometry and temporary material overrides do not enter the file.

**Open review** requires the same source document, revisions and loaded body
inventory. The SDK evaluates the original endpoints before applying the view
and latest measurement together. A bad camera, reference, domain, unit, claimed
distance, lighting value or source hash leaves accepted state unchanged. View,
lighting and measurement restore together. A changed session
also cancels an unfinished read or save. Restore recreates the A/B labels and
reprojects them in the restored camera.

If the source differs, the status bar asks for the original CAD file. If the
loaded bodies or instances differ, it asks for the same selection used when the
review was saved. The status message has a tooltip and can receive keyboard focus
when it reports an error. A refused review keeps the current scene and saved views.

Older raw SDK review files still open as view-only reviews. They have source
revision pins but no content hash or saved measurement. Opening one clears the
app measurement and latest native measurement cache. The SDK's original raw
review API and its file format remain unchanged.
Earlier app review files and raw SDK reviews without lighting retain the
current lighting when opened.

**Export PNG** writes the current Viewer framebuffer as a PNG image. It exports
the viewport pixels, without the app toolbar or inspector. It is a display
snapshot, not a CAD geometry export.

**Export PNG with distance** adds the current completed measurement's projected
A/B markers, connecting line and value in millimetres to a copy of the viewport.
Points outside the camera view have no marker. Projection does not test occlusion.
The value stays visible even when neither point is in view. The original PNG
action remains available without annotations. A change to the view or measurement
while capturing cancels the export.

The app imports only the limited IGES profile described above. It does not
import STEP, STL or feature-based BRep files.
It does not add modelling or document authoring tools.
