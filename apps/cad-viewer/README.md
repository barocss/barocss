# CAD Viewer app

The workspace groups bodies by their original asset. ISO, Front, Top and Right
change the camera direction while preserving geometry, visibility, selection
and materials. Front looks from +Z, Top from +Y, and Right from +X in the display
basis. Fit all restores the SDK's complete scene view.

A separate document review app. It consumes the public `@barocss/viewer`,
`@barocss/cad-interop/document` and `@barocss/gpu` APIs. It keeps the original CAD
source and bindings. It does not edit the document.

## Run

From the repository root, use the existing Node and esbuild installation:

```sh
node apps/cad-viewer/server.mjs
```

Open `http://127.0.0.1:53032`. Set `CAD_VIEWER_PORT` to use a different port.
The local server reuses the root esbuild tool. No install or package publication
is needed. This is a source development app. Its resolver reads public package
exports from this clone. `/input-audit.json` records bundle and input SHA-256
hashes, HTML and CSS hashes, and source/dist input counts.

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
