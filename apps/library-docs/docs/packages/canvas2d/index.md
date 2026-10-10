# Canvas2D: retained logical-pixel scenes

Use Canvas2D for bounded 2D display trees, paths, sprites, frame clips and atlas-backed text. It renders with WebGL2. A display handle edit changes the tree; explicit submission changes the accepted renderer scene; `render()` paints a frame.

**Checkpoint:** `5f5ad866205a`; manifest version `0.0.0-experimental`. This is local repository documentation. A public package configuration does not establish npm publication. Read [version stages](/concepts/versions) before choosing an artifact.

Use Node 22 or later and the existing workspace dependencies. Run ordinary package-name imports in a TypeScript-capable host, such as the existing Vite or esbuild consumers. Internal `.js` specifiers need that transformation. No custom source condition is required. Plain Node and browser ESM do not resolve these TypeScript source graphs by themselves.

## Keep the data roles separate

Scene JSON records geometry and asset references. A version 1 canvas document adds owned RGBA8 asset bytes. A PNG or captured image is derived pixels and cannot restore the editable tree. Coordinates use logical pixels with X right and Y down. DPR converts logical size to backing pixels.

[Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits and errors](./limits)

[Root exports](/packages/canvas2d/reference#declarations-d01fa4b173ed) · [Document entry](/packages/canvas2d/reference#declarations-197efc20a356)

`packages/barocss-canvas2d/package.json` (Manifest and version; local source) · `packages/barocss-canvas2d/README.md` (Package task notes; local source)
