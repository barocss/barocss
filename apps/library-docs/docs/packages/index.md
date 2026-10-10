# Library catalog

Choose the package that owns your task. These 12 entries come from the fixed source manifests. A public-access manifest does not prove an npm release.

| Library | Task | Source version | Default entry |
| --- | --- | --- | --- |
| [@barocss/kit](/packages/kit/) | CSS compilation and themes | `0.12.0` | `./src/index.ts` |
| [@barocss/browser](/packages/browser/) | Browser CSS runtime and DOM observation | `0.12.0` | `./src/index.ts` |
| [@barocss/server](/packages/server/) | Server CSS compilation | `0.12.0` | `./src/index.ts` |
| [@barocss/render](/packages/render/) | Validated UI documents to React | `0.12.0` | `./dist/index.js` |
| [@barocss/gpu](/packages/gpu/) | Own GPU rendering and CPU scene preparation | `0.0.0` | `./src/index.ts` |
| [@barocss/cad](/packages/cad/) | Own native geometry, topology and features | `0.0.0-experimental` | `./src/index.ts` |
| [@barocss/cad-interop](/packages/cad-interop/) | Native input and format/display adapters (Loader) | `0.0.0-experimental` | `./src/index.ts` |
| [@barocss/canvas2d](/packages/canvas2d/) | Retained 2D scenes and WebGL2 display | `0.0.0-experimental` | `./src/index.ts` |
| [@barocss/viewer](/packages/viewer/) | Reusable native-model viewing facade | `0.0.0-experimental` | `./src/index.ts` |
| [@barocss/physics](/packages/physics/) | Bounded simulation profiles and derived output | `0.0.0-experimental` | `./src/index.ts` |
| [@barocss/cad-editor](/packages/cad-editor/) | Native CAD authoring components | `0.0.0-experimental` | `./src/index.ts` |
| [@barocss/render-editor](/packages/render-editor/) | Scene document authoring components | `0.0.0-experimental` | `./src/index.ts` |

## Start a workflow

- Native geometry → copied display packet → GPU: [CAD](/packages/cad/guides), [Interop](/packages/cad-interop/guides), [GPU](/packages/gpu/guides).
- Native geometry → interactive display: [Viewer](/packages/viewer/guides).
- Logical-pixel scene → own 2D renderer: [Canvas2D](/packages/canvas2d/guides).
- Native authoring → source save/open: [CAD Editor](/packages/cad-editor/guides).
- Scene authoring → scene save/open: [Render Editor](/packages/render-editor/guides).
- UI document → React → CSS host: [Render](/packages/render/guides).

## Verify entry points

These are actual development export keys at the fixed commit. Compiled maps and exact manifest hashes are retained in the app inventory. Read each package API page for names and support.
- **@barocss/kit**: `.`, `./theme/default`. `packages/barocss/package.json` (Manifest; local source).
- **@barocss/browser**: `.`. `packages/barocss-browser/package.json` (Manifest; local source).
- **@barocss/server**: `.`. `packages/barocss-server/package.json` (Manifest; local source).
- **@barocss/render**: `.`. `packages/barocss-render/package.json` (Manifest; local source).
- **@barocss/gpu**: `.`, `./source`. `packages/barocss-gpu/package.json` (Manifest; local source).
- **@barocss/cad**: `.`. `packages/barocss-cad/package.json` (Manifest; local source).
- **@barocss/cad-interop**: `.`, `./native`, `./native-uniform-curve`, `./three-uniform-curve`, `./document`, `./boolean-extrusion-feature-graph`, `./boolean-extrusion-feature-mesh`, `./boolean-extrusion-feature-properties`, `./assembly`, `./document-glb`, `./boolean-mesh-glb`, `./boolean-extrusion-glb`, `./three-document`, `./three-assembly`, `./three-boolean-contours`, `./three-boolean-mesh`, `./three-boolean-extrusion-mesh`, `./three`, `./babylon`, `./babylon-document`, `./babylon-assembly`, `./babylon-boolean-mesh`, `./babylon-boolean-extrusion-mesh`, `./pixi3d`, `./pixi3d-document`, `./pixi3d-assembly`, `./pixi3d-boolean-mesh`, `./pixi3d-boolean-extrusion-mesh`, `./model-set`, `./native-selected-uniform-curve`, `./three-selected-uniform-curve`, `./babylon-uniform-curve`, `./pixi3d-uniform-curve`, `./babylon-selected-uniform-curve`, `./pixi3d-selected-uniform-curve`. `packages/barocss-cad-interop/package.json` (Manifest; local source).
- **@barocss/canvas2d**: `.`, `./document`. `packages/barocss-canvas2d/package.json` (Manifest; local source).
- **@barocss/viewer**: `.`. `packages/barocss-viewer/package.json` (Manifest; local source).
- **@barocss/physics**: `.`, `./cad-proxy`, `./replay`, `./fluid`, `./cloth`, `./fluid-cad`. `packages/barocss-physics/package.json` (Manifest; local source).
- **@barocss/cad-editor**: `.`, `./react`, `./styles.css`. `packages/barocss-cad-editor/package.json` (Manifest; local source).
- **@barocss/render-editor**: `.`, `./react`, `./style.css`. `packages/barocss-render-editor/package.json` (Manifest; local source).

Motion was retired locally. Spatial and Interaction remain capability requirements; neither is a package in this inventory.

[Read version stages](/concepts/versions) before choosing a runtime. GPU/CAD/Interop/Canvas2D/Viewer/Physics/editor package publication is unverified in this manual. Render has a historical exact0.12.0 publication and consumer receipt under [#478](https://github.com/barocss/barocss/issues/478).
