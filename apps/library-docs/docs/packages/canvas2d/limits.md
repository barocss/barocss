# Canvas2D limits, errors and cleanup

## Admission budgets

Scene text is bounded to 1 MiB. A document has at most 16 referenced assets, 32 MiB of decoded RGBA8 and 48 MiB of UTF-8 file text. Asset dimensions are 1–4096 pixels. Renderer scene admission includes a 16,384-vertex budget. Device stencil capability gates applicable mask features; read `getCapabilities()` and preserve actual refusals.

Scene profiles have exact field sets. The current source exposes SceneV29. Several old README paragraphs describe earlier v17/v25 tree snapshots; use the actual exported declarations and admitted snapshot at this checkpoint. Do not assume a new field is accepted by an older version. Path sampling, curves, masks, gradients, nine-slice/tile and text each have their own bounds.

## Errors and action

| Code | Host action |
| --- | --- |
| `INVALID_SCENE`, `SCENE_LIMIT`, `UNSUPPORTED_FEATURE` | Correct shape/version or reduce supported geometry. Retain live data. |
| `INVALID_ASSET`, `ASSET_LIMIT`, `ASSET_IN_USE` | Register valid bytes/crop; clear references before removal. |
| `INVALID_SIZE`, `INVALID_VIEW` | Correct finite size, DPR or view before submission. |
| `SERIALIZATION` | Keep the old document and inspect file/encoding refusal. |
| `WEBGL_UNAVAILABLE`, `CONTEXT_LOST` | Keep CPU authority; report actual device/context state. |
| `DISPOSED` | Create a new owned renderer/application. |

`dispose()` releases owned GL resources and listeners. Stop host listeners and schedulers as part of document cleanup. A browser text raster depends on host font availability and is not cross-device text-layout certification. SVG supports a bounded subset. Orthogonal polygon Boolean operations are authored integer 2D operations, not CAD B-Rep Booleans. Scene JSON and PNG do not imply history, collaboration or full design-tool support.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/README.md)
