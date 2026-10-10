# Canvas2D public entries

| Entry | Workspace | Release configuration |
| --- | --- | --- |
| `@barocss/canvas2d` | `src/index.ts` | `dist/index.js` and declaration |
| `@barocss/canvas2d/document` | `src/document.ts` | `dist/document.js` and declaration |

## Renderer and editable scene

| Signature | Result and ownership | Error boundary |
| --- | --- | --- |
| `createCanvas2D(canvas, options): Canvas2DRenderer` | Own GL resources; host owns canvas. Options include `logicalSize`, `dpr`, optional `maxDeviationDevicePx` and `backgroundColor`. | Invalid size/options or unavailable WebGL2 refuse. |
| `renderer.updateScene(value: unknown): void` | Admit copied scene; no implicit paint. | Scene/assets/budget refusal retains accepted renderer data. |
| `renderer.render(): void` | Paint accepted scene using current view. | Context/lifecycle refusal reaches host. |
| `renderer.hitTest(point): Hit \| null` | Logical viewport point, top eligible semantic node. | Current accepted scene only. |
| `renderer.hitTestAll(point, limit=16): Hit[]` | Fresh topmost-first unique semantic nodes; limit 1–16. | Invalid limit refuses. |
| `createDisplayTree(contextId): DisplayTree` | Stable stage, constructors, snapshot, current handle lookup and semantic input routing. | Bad IDs, cycles, foreign handles and budgets refuse. |
| `createDisplayTreeFromScene(scene): DisplayTree` | New validated tree and new handles; assets stay host-owned. | Unsupported old profiles refuse. |
| `createPathBuilder(): PathBuilder` | Chainable path commands; `build()` copies them. | Invalid operation retains earlier commands. |
| `createCanvas2DApplication(canvas, options): Canvas2DApplication` | Renderer/tree/ticker ownership, `start`, `stop`, `render`, `onUpdate`, `dispose`. | Foreign context ID or malformed options refuse. |

Renderer also exposes asset set/get/remove, background set/get, view set, resize, viewport/world conversion, path/fill observations, capabilities and `captureImageAsset`. Asset removal refuses when referenced. Capture returns owned top-to-bottom straight RGBA8 pixels; it is derived output.

## Asset, text and animation tools

The root exports `decodeImageBlob`, `loadImageURL`, `createImageAssetCache`, `blurImageAsset`, `shadowImageAsset`, `createSpriteAtlas`, `packSpriteAtlas`, `createSpriteAnimation`, `createTicker`, `rasterizeBrowserText`, `rasterizeBrowserMultilineText`, `rasterizeBrowserWrappedText`, `importSVGElement`, `exportSceneSVG`, `booleanOrthogonalPolygons`, `parseSceneJSON`, `stringifySceneJSON` and `Canvas2DError`. Each is bounded; an image/text helper is not an unrestricted design-tool pipeline.

[Exact exported runtime symbols and public types](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/src/index.ts) · [Renderer method signatures](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/src/renderer.ts) · [DisplayTree and handle contracts](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/src/display-tree.ts)

## Document entry

`serializeCanvasDocument(acceptedScene, getAsset): Promise<string>` copies referenced assets and canonical scene data. `parseCanvasDocument(text): Promise<ParsedCanvasDocument>` verifies and returns copied scene/assets. `stageCanvasDocument(text,freshCanvas,options): Promise<StagedCanvasDocument>` adds a rendered candidate. `exportCanvasDocumentPNG(text,options,createCanvas): Promise<CanvasPNGExport>` renders an owned candidate, returns a Blob and size metadata, and disposes its renderer.

[Exact document types and functions](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/src/document.ts)

## Versioned public data

The root exports Scene/Node profile types through SceneV29, paint/transform/color/view types, image asset types, display handles/events, path observations, ticker/atlas/animation/text types and image preparation options. Scene versions are independent of package and document versions. Read the linked declarations for exact required fields; do not combine fields from different Scene versions.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-canvas2d/README.md)
