# CAD Viewer app

The screen uses React and local shadcn/ui components, with the same component
source and dependency versions as CAD Studio. `src/components/ui/` contains
Button, Input, NativeSelect and the Radix-based Dialog. `src/lib/utils.ts` holds
the shared class pattern. These files belong to the Viewer app. The app does not
import Studio at runtime.

Tailwind CSS compiles the actual screen and component classes. Preflight is off,
as in Studio. Workspace CSS is in the lower `legacy` layer. `tailwind.css` maps
the shadcn color tokens to the Viewer palette. `components.json` records the
local shadcn configuration.

The workspace groups bodies by their original asset. ISO, Front, Top and Right
change the camera direction while preserving geometry, visibility, selection
and materials. Front looks from +Z, Top from +Y, and Right from +X in the display
basis. Fit all restores the SDK's complete scene view.

A separate document review app. It consumes the public `@barocss/viewer`,
`@barocss/cad-interop/document` and `@barocss/gpu` APIs. It keeps the original CAD
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

## Open a document

1. Choose **Open document** and select a local `.cad-document.json` file. You can
   also use **Open sample**.
2. Choose 1 to 4 supported bodies in the admission dialog.
3. Choose **Load bodies**. The app uses SDK admission to replace the scene.

The reader uses the actual source-backed CAD document codec. It accepts the
direct geometry profile, with millimetres, radians and the authored XYZ frame.
Bodies reference native Surfaces or Curves. The native display profile also
limits each selected source asset to 4 native objects. Unsupported body rows
remain visible with their refusal reason.

The file read boundary is 2 MiB. The current CAD codec also applies source
budgets. Detailed sampling can still refuse a chosen body. Invalid document
data and unsupported body selections are rejected before acceptance.

The sample comes from
`packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json`.
It contains 6 bodies across 2 assets. The dialog selects the first 2 supported
bodies by default and shows the remaining bodies for explicit choice.

## Review

Use the body list to select, show, hide, isolate and fit displayed geometry.
The inspector shows its original document, body, asset, revision and geometry
bindings. Drag to orbit. Use the viewport control hints to pan and zoom. Press
**F** to fit and **Escape** to clear selection.

The appearance controls apply or clear a temporary Surface material. Clear
Surface selection before applying a material. Clear a bound material before
selecting or hiding that Surface. These controls use the existing GPU material
compiler and Viewer binding API.

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
also keeps the active tool. Review files and PNG images do not save these DOM
measurement annotations.

**Save review** writes the existing compact review JSON. It records the camera,
visibility, selection and source revision pins. It does not contain CAD geometry
or temporary material overrides. **Open review** requires the same accepted
document and body inventory. A stale, invalid or incompatible file preserves
the current scene. A changed session also cancels an unfinished file read.

**Export PNG** writes the current Viewer framebuffer as a PNG image. It exports
the viewport pixels, without the app toolbar or inspector. It is a display
snapshot, not a CAD geometry export.

The app does not import STEP, IGES, STL, assembly or feature-based BRep files.
It does not add modelling or document authoring tools.
