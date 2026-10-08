# Independent compiled consumer

This small host uses only `@barocss/canvas2d` and `@barocss/canvas2d/document`. The local import map points those public names at the package's compiled JavaScript. The `checkJs` configuration resolves their compiled TypeScript declarations. The consumer does not import renderer source or the repository's Canvas2D scene example.

From the repository root with Node 22 and installed workspace dependencies:

```sh
pnpm --filter @barocss/canvas2d build:library
pnpm exec tsc -p packages/barocss-canvas2d/consumer/tsconfig.json
python3 -m http.server 57013 --bind 127.0.0.1
```

Open `http://127.0.0.1:57013/packages/barocss-canvas2d/consumer/index.html`. The page starts with a Scene v3 320×200 logical canvas at DPR2 and a copied 16-byte image asset. Save the actual v1 document, change the rectangle, then Open the downloaded file. The valid file stages a fresh canvas; a corrupt asset digest refuses without replacing the accepted canvas. **Dispose** ends the renderer and shows the `DISPOSED` code. The [one-device observation](evidence/observation.md) records the exact file and pixel/hit results.

This is a local compiled-consumer proof. It does not imply npm publication, broad browser support, or a new renderer API.

## Public display tree consumer

The separate [`display-tree.html`](display-tree.html) page uses the public compiled entries to create a stage, container and two sprite handles. Its `display-tree.mjs` file is included in the same `tsc -p packages/barocss-canvas2d/consumer/tsconfig.json` type check. Open `http://127.0.0.1:57013/packages/barocss-canvas2d/consumer/display-tree.html` after the build and server steps above. Move the parent, change Red's anchor, raise/equalize layers, remove/re-add Red, and try invalid edits. The page submits each valid snapshot explicitly. Save a v1 document, change the scene, then Open the actual downloaded file on a fresh canvas. The restored file is view-only in this first facade because it does not reconstruct authoring handles; reload to start a new tree. The [observed pixels, hits, file and limits](evidence/display-tree/observation.md) are recorded separately.
