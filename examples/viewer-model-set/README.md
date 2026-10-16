# Qualified native model set in Viewer

This example reads two source0 files through Loader. Both files use native Model
`wide_model`, Curve `wide_64` and Surface `shared_panel`. The Viewer keeps
those IDs and displays all four objects in one WebGPU canvas through the
`@barocss/gpu/viewer` core; the page awaits `createViewer` and `readPixels`.
The aliases `asset_a` and `asset-b` become Viewer model IDs `asset_a` and
`asset.b`; the original aliases and source URLs stay in `getState().modelSet`.

With Node 22, build `@barocss/cad`, `@barocss/gpu`,
`@barocss/cad-interop` and `@barocss/viewer`, then run:

```sh
node examples/viewer-model-set/server.mjs
```

Open <http://127.0.0.1:52923/>. The page records pixels, four qualified
screen hits, selection, fit, same-alias native distance, cross-alias refusal,
invalid-candidate retention and old single-source compatibility.
Display poses do not change native source or measured XYZ/mm. The Viewer
does not infer CAD assembly placement or exact native picking.
