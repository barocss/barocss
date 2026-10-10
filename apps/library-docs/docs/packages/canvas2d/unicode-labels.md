# Display and reopen a Unicode label

Use `rasterizeBrowserText` to prepare a browser-shaped label, then display its copied bitmap through a retained `glyphRun`. Try [the Unicode label](/playground#unicode-label) with `설계 圖面 A1`, or change the text and apply it again.

![The Unicode label displayed by Canvas2D](/examples/unicode-label.jpg)

This guide uses `@barocss/canvas2d` version `0.0.0-experimental` from local source provider `028c9e509b35de56e61db3b92a034b5277fbb291`, which includes the Unicode single-line policy. It is newer than the earlier `5f5ad866` rectangle example. Use the matching source package with a TypeScript-capable browser bundler. This source availability does not establish npm publication.

## Prepare the font and display the complete label

Put this HTML in the browser host and the following code in its `main.ts` entry. The bundler resolves public imports and supplies JavaScript to the browser.

```html
<canvas id="label" style="width:320px;height:200px"></canvas>
<output id="status" aria-live="polite"></output>
<script type="module" src="./main.ts"></script>
```

```ts
import {
  createCanvas2D, createDisplayTree, rasterizeBrowserText,
  Canvas2DError
} from '@barocss/canvas2d';

let canvas = document.querySelector<HTMLCanvasElement>('#label')!;
const status = document.querySelector<HTMLOutputElement>('#status')!;
const font = '24px system-ui';
const dpr = 2;
const text = '설계 圖面 A1';
const textPolicy = 'unicode-single-line' as const;
const rendererOptions = {
  logicalSize: { width: 320, height: 200 }, dpr,
  backgroundColor: [0.063, 0.094, 0.125, 1] as [number, number, number, number]
};

// The host prepares local fonts. The rasterizer does not load a font.
await document.fonts.load(font, text);
await document.fonts.ready;
const raster = rasterizeBrowserText({
  text, font, atlasId: 'UnicodeAtlas', dpr, textPolicy
});

let tree = createDisplayTree('UnicodeLabelScene');
const label = tree.createGlyphRun({
  id: 'Label', layer: 0,
  transform: { x: 24, y: 96, scaleX: 1, scaleY: 1, rotation: 0 },
  ...raster.layout
});
tree.stage.addChild(label);
let renderer = createCanvas2D(canvas, rendererOptions);
try {
  renderer.setImageAsset(raster.layout.atlasId, raster.asset);
  renderer.updateScene(tree.snapshot());
  renderer.render();
} catch (error) {
  renderer.dispose();
  status.value = error instanceof Canvas2DError ? error.code : String(error);
  throw error;
}
status.value = `${label.data.text.length} UTF-16 units; ${raster.advance} logical-px advance`;

// This is host metadata. It is not part of Canvas document serialization.
let rasterProfile: { font: string | null; dpr: number | null; textPolicy: string | null } = {
  font: raster.font, dpr: raster.dpr, textPolicy
};
window.addEventListener('pagehide', () => renderer.dispose(), { once: true });
```

The text contains eight UTF-16 code units. Its layout has one quad with `textStart:0` and `textEnd:8`; this quad covers the whole rasterized label. It is not a glyph-by-glyph shaping result. The label's baseline is local Y=0, placed at logical Y=96 by its transform. The renderer uses 320×200 logical pixels and a 640×400 backing canvas at DPR2. CSS size remains a host choice.

`24px system-ui` is an explicit CSS font declaration. The browser chooses the actual local typeface and any fallback faces. `document.fonts.load`, readiness, valid metrics and nonzero ink do not prove that every character has a readable glyph. Inspect the displayed label on the target browser. This helper sets left alignment, an alphabetic baseline and `direction:'ltr'`; it does not provide an application bidi, caret, grapheme or IME model.

## Read the raster result

The public signature is `rasterizeBrowserText(options: BrowserTextOptions): BrowserTextRaster`.

| Input | Meaning |
| --- | --- |
| `text` | Required original string; Unicode policy permits 1..128 UTF-16 code units |
| `font` | Required CSS font declaration, at most 256 code units |
| `atlasId` | Required asset ID: ASCII letter followed by up to 63 letters, digits, `_` or `-` |
| `dpr` | Optional finite number in `[1,4]`; default 1 |
| `textPolicy` | Optional policy; default `alphanumeric`. Set `unicode-single-line` explicitly |

The result contains `asset`, `layout`, `font`, `dpr`, `advance` and `bounds`. `asset.width` and `asset.height` are backing-pixel dimensions; `asset.pixels` is a fresh RGBA8 `Uint8Array`. `advance` and `bounds` use logical pixels. Bounds include two logical pixels of padding beyond rounded ink edges; backing dimensions then round upward for the chosen DPR. `layout.glyphs[0].sourceRect` covers the entire atlas, while its position and display size use those logical bounds. The returned `font` is the browser-normalized declaration, not a matched-face identifier.

The raster and its nested data are mutable owned output. They are not deeply frozen. `renderer.setImageAsset` copies the RGBA bytes, and tree admission copies layout data. Changing the original raster afterward does not edit the accepted label. `getImageAsset` also returns copied bytes. The helper releases its scratch canvas after success or failure; its returned CPU data needs no `dispose()`. Dispose the renderer when closing the host.

## Keep an accepted label while editing

Prepare a candidate before replacing the accepted tree. Use a separate tree and an alternate atlas ID; replacing the live atlas under the old layout can change the accepted label or fail when its extent changes. For whole-label replacement, stage a fresh canvas and renderer, then swap only after asset admission, scene admission and rendering succeed. Dispose the candidate on failure and keep the old session.

For example, append this function to the module above. It explicitly selects the current font and Unicode policy, including after a restored label whose raster profile is unknown.

```ts
async function replaceLabel(candidateText: string) {
  await document.fonts.load(font, candidateText);
  await document.fonts.ready;
  const candidateRaster = rasterizeBrowserText({
    text: candidateText, font, dpr, textPolicy, atlasId: 'EditedUnicodeAtlas'
  });
  const nextTree = createDisplayTree('UnicodeLabelScene');
  nextTree.stage.addChild(nextTree.createGlyphRun({
    id: 'Label', layer: 0,
    transform: { x: 24, y: 96, scaleX: 1, scaleY: 1, rotation: 0 },
    ...candidateRaster.layout
  }));
  const nextCanvas = document.createElement('canvas');
  nextCanvas.id = 'label';
  nextCanvas.style.cssText = canvas.style.cssText;
  const nextRenderer = createCanvas2D(nextCanvas, rendererOptions);
  try {
    nextRenderer.setImageAsset(candidateRaster.layout.atlasId, candidateRaster.asset);
    nextRenderer.updateScene(nextTree.snapshot());
    nextRenderer.render();
  } catch (error) {
    nextRenderer.dispose();
    throw error;
  }
  const prior = renderer;
  canvas.replaceWith(nextCanvas);
  canvas = nextCanvas; tree = nextTree; renderer = nextRenderer;
  rasterProfile = { font: candidateRaster.font, dpr, textPolicy };
  prior.dispose();
}

// await replaceLabel('수정 圖面 B2');
// await replaceLabel('가\n나'); // INVALID_SCENE; accepted session remains
```

Callers must handle the returned promise. A host with concurrent edits or pending font work also needs cancellation or a generation check before swapping. Context loss and device errors can prevent rendering; retained CPU state does not guarantee recoverable pixels on every device.

## Save and restore text, layout and pixels

The live example's **Save label in memory** and **Restore saved label** actions store and reopen a Canvas document string in the page. They do not write a physical file. Public document APIs keep semantic text, complete layout and referenced RGBA bytes together.

Capture the scene and every referenced asset copy before awaiting serialization. Serialization hashes asset bytes asynchronously; reading live renderer assets later could mix two edit generations. Append this code to the same module:

```ts
import { createDisplayTreeFromScene } from '@barocss/canvas2d';
import type { Scene, ImageAssetInput } from '@barocss/canvas2d';
import { serializeCanvasDocument, parseCanvasDocument } from '@barocss/canvas2d/document';

let savedDocument: string | null = null;
async function saveLabelInMemory() {
  const snapshot = tree.snapshot();
  const assets = new Map<string, ImageAssetInput>();
  function capture(nodes: Scene['nodes']) {
    for (const node of nodes) {
      const id = node.kind === 'glyphRun' ? node.atlasId :
        node.kind === 'image' ? node.imageId : null;
      if (id !== null && !assets.has(id)) {
        const asset = renderer.getImageAsset(id);
        if (!asset) throw new Error(`Missing asset ${id}`);
        assets.set(id, asset);
      }
      if (node.kind === 'group' || node.kind === 'frame') capture(node.children);
    }
  }
  capture(snapshot.nodes); // All copies complete before the first await.
  savedDocument = await serializeCanvasDocument(snapshot, id => assets.get(id) ?? null);
}

async function restoreSavedLabel() {
  if (savedDocument === null) throw new Error('Save a label first');
  const parsed = await parseCanvasDocument(savedDocument);
  const nextTree = createDisplayTreeFromScene(parsed.scene);
  const nextCanvas = document.createElement('canvas');
  nextCanvas.id = 'label';
  nextCanvas.style.cssText = canvas.style.cssText;
  const nextRenderer = createCanvas2D(nextCanvas, rendererOptions);
  try {
    for (const [id, asset] of parsed.assets) nextRenderer.setImageAsset(id, asset);
    nextRenderer.updateScene(nextTree.snapshot());
    nextRenderer.render();
  } catch (error) {
    nextRenderer.dispose();
    throw error;
  }
  const prior = renderer;
  canvas.replaceWith(nextCanvas);
  canvas = nextCanvas; tree = nextTree; renderer = nextRenderer;
  rasterProfile = { font: null, dpr: null, textPolicy: null };
  prior.dispose();
}
```

Restore uses the saved pixels and layout without rerasterizing or loading a font. It creates new handles; old handles and listeners are not rebound. The document does not store the font declaration, text policy or raster DPR. Their restored values are unknown, represented by `null` in the host's `rasterProfile` fields; the renderer's display DPR remains explicitly configured. Do not infer a raster font from the bitmap or from its saved semantic text. A later edit calls the rasterizer with an explicit current profile.

The document entry requires browser byte encoding and SHA-256 support. Its separate limits are 16 referenced assets, 32 MiB of RGBA data and 48 MiB of serialized document text. Background color is renderer configuration and must be supplied again. A PNG contains derived display pixels and cannot replace the editable document.

## Limits and errors

Unicode admission preserves the original text exactly. It does not trim, normalize or change case. For example, a precomposed character and a combining sequence retain their different code-unit sequences. Supplementary characters count as two UTF-16 units. The policy refuses C0 controls `U+0000..U+001F`, DEL/C1 `U+007F..U+009F`, line separators `U+2028/U+2029`, unpaired surrogates and whitespace-only strings. It does not supply multiline or word wrapping; those existing APIs retain their printable-ASCII contracts.

Options must be an ordinary `Object.prototype` record with own enumerable data fields. Arrays, foreign or null prototypes, getters, hidden fields, symbols and unknown fields are refused. A supplied optional field with `undefined` is not an omitted default.

| Error code | Rasterizer refusal |
| --- | --- |
| `INVALID_SCENE` | Invalid options, text, policy, font declaration or DPR; ignored CSS font declaration |
| `INVALID_ASSET` | Invalid atlas ID, font not ready, unsafe metrics or bounds, invalid RGBA readback, no ink, or browser allocation/draw/read failure |
| `ASSET_LIMIT` | Atlas exceeds 1024×256 backing pixels or 1 MiB RGBA8 |
| `UNSUPPORTED_FEATURE` | Missing document, FontFaceSet or required scratch Canvas2D operations |

Catch `Canvas2DError` and read `error.code`. Raster limits apply after font measurement, so a valid 128-unit string can still exceed the atlas budget. Font metrics and pixels depend on the browser and local fonts. The policy admits Unicode syntax; it does not certify glyph coverage, cross-device pixel parity, font persistence or editing semantics.

Measured advance must be nonnegative. Metrics and padded ink edges must be finite within ±1,000,000 logical pixels; derived backing dimensions must be positive safe integers. The font input must contain non-whitespace content and cannot contain CR, LF or NUL. Rendering the admitted layout separately requires WebGL2 and the renderer's scene, asset and device limits.

[Canvas guides](./guides) · [Canvas examples](./examples) · [Public API](./api)
