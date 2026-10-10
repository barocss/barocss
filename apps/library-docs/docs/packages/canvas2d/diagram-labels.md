# Decorate an ellipsized diagram label

Keep a diagram label's complete text while fitting its visible text into a limited advance width. Add a separate bitmap outline, then save and reopen the scene with both image assets. Try [the diagram label](/playground#diagram-label).

![An ellipsized label with a cyan bitmap outline](/examples/diagram-label.jpg)

This guide uses `@barocss/canvas2d` version `0.0.0-experimental` at local source provider `8fc5d6c46776f750d1c3a4222e255aea5d6aaaf7`. Both `rasterizeBrowserEllipsizedText` and `outlineImageAsset` are public exports there. Use that matching source package with a TypeScript-capable browser bundler. The earlier rectangle and Unicode examples keep their separate source profiles; package availability does not establish npm publication.

## Create the label and its decoration

Use this HTML as the host page and the following module as `main.ts`. The browser receives the JavaScript produced by your bundler.

```html
<div id="stage"><canvas style="width:320px;height:200px"></canvas></div>
<label>Full label
  <input id="text" value="Mounting plate dimensions and clearance" maxlength="128">
</label>
<label>Maximum advance <input id="width" type="number" value="200"></label>
<button id="apply" type="button">Apply label</button>
<button id="save" type="button">Save diagram JSON</button>
<label>Open diagram JSON <input id="open" type="file" accept=".json,application/json"></label>
<pre id="status" aria-live="polite"></pre>
<script type="module" src="./main.ts"></script>
```

```ts
import {
  createCanvas2D, createDisplayTree, createDisplayTreeFromScene,
  rasterizeBrowserEllipsizedText, outlineImageAsset, Canvas2DError
} from '@barocss/canvas2d';
import type {
  Canvas2DRenderer, DisplayTree, Scene, ImageAssetInput
} from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const stage = document.querySelector<HTMLDivElement>('#stage')!;
const textInput = document.querySelector<HTMLInputElement>('#text')!;
const widthInput = document.querySelector<HTMLInputElement>('#width')!;
const applyButton = document.querySelector<HTMLButtonElement>('#apply')!;
const saveButton = document.querySelector<HTMLButtonElement>('#save')!;
const openInput = document.querySelector<HTMLInputElement>('#open')!;
const status = document.querySelector<HTMLPreElement>('#status')!;
const controls = [textInput, widthInput, applyButton, saveButton, openInput];
const font = '24px monospace', dpr = 2, radius = 3;
const outlineColor: [number, number, number, number] = [.1, .75, 1, 1];
const options = {
  logicalSize: { width: 320, height: 200 }, dpr,
  backgroundColor: [.063, .094, .125, 1] as [number, number, number, number]
};
const identity = () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
type Preparation = {
  font: string | null; maxWidth: number | null; displayText: string | null;
  visibleTextEnd: number | null; truncated: boolean | null; rasterDPR: number | null;
  outlineRadius: number | null; outlineColor: number[] | null;
};
type Session = {
  canvas: HTMLCanvasElement; renderer: Canvas2DRenderer;
  tree: DisplayTree; preparation: Preparation;
};
let current: Session | null = null;
let closed = false, busy = false;
let downloadURL: string | null = null;

function freshCanvas() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:320px;height:200px';
  return canvas;
}
function requireLive() {
  if (closed) throw new Error('The diagram host is closed');
}

async function prepareLabel(text: string, maxWidth: number): Promise<Session> {
  // Readiness includes the three ASCII dots used by a truncated candidate.
  await document.fonts.load(font, text + '...');
  await document.fonts.ready;
  requireLive();
  const raster = rasterizeBrowserEllipsizedText({
    text, font, atlasId: 'LabelAtlasA', maxWidth, dpr
  });
  const outline = outlineImageAsset(raster.asset, radius, outlineColor);
  const tree = createDisplayTree('DiagramLabelScene');
  const parent = tree.createContainer({
    id: 'LabelGroup', layer: 0,
    transform: { x: 40, y: 104, scaleX: 1, scaleY: 1, rotation: .08 }
  });
  const quad = raster.layout.glyphs[0];
  parent.addChild(tree.createSprite({
    id: 'OutlineSprite', layer: 0, imageId: 'OutlineAtlasA',
    transform: { ...identity(), x: quad.x, y: raster.layout.baseline + quad.y },
    width: quad.width, height: quad.height,
    sourceRect: { ...quad.sourceRect }, anchorX: 0, anchorY: 0,
    opacity: 1, sampling: 'nearest', hitMode: 'none'
  }));
  parent.addChild(tree.createGlyphRun({
    id: 'OriginalGlyph', layer: 1, transform: identity(), ...raster.layout
  }));
  tree.stage.addChild(parent);
  const canvas = freshCanvas();
  const renderer = createCanvas2D(canvas, options);
  try {
    renderer.setImageAsset(raster.layout.atlasId, raster.asset);
    renderer.setImageAsset('OutlineAtlasA', outline);
    renderer.updateScene(tree.snapshot());
    renderer.render();
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  return { canvas, renderer, tree, preparation: {
    font: raster.font, maxWidth: raster.maxWidth, displayText: raster.displayText,
    visibleTextEnd: raster.visibleTextEnd, truncated: raster.truncated,
    rasterDPR: raster.dpr, outlineRadius: radius, outlineColor: [...outlineColor]
  } };
}

function inspectLabel(session: Session) {
  const glyph = session.tree.get('OriginalGlyph');
  if (!glyph || glyph.kind !== 'glyphRun') throw new Error('Expected the diagram glyphRun');
  const data = glyph.data, quad = data.glyphs[0];
  const asset = session.renderer.getImageAsset(data.atlasId);
  if (!asset) throw new Error('Missing label atlas');
  // Find actual original-label ink. Never use decoration alpha as label ink.
  let pixel = -1, strongestAlpha = 0;
  for (let index = 0; index < asset.width * asset.height; index++) {
    const alpha = asset.pixels[index * 4 + 3];
    if (alpha > strongestAlpha) { strongestAlpha = alpha; pixel = index; }
  }
  if (pixel < 0) throw new Error('No label ink');
  const px = pixel % asset.width, py = Math.floor(pixel / asset.width);
  const local = {
    x: quad.x + (px + .5 - quad.sourceRect.x) / quad.sourceRect.width * quad.width,
    y: data.baseline + quad.y + (py + .5 - quad.sourceRect.y) / quad.sourceRect.height * quad.height
  };
  const point = session.renderer.worldToViewport(glyph.toWorld(local));
  const hit = session.renderer.hitTest(point);
  if (hit?.id !== glyph.id || hit.kind !== 'glyphRun') throw new Error('Expected original label hit');
  const target = session.tree.get(hit.id);
  const semanticText = target?.kind === 'glyphRun' ? target.data.text : null;
  return { hit, point, semanticText, textRange: [quad.textStart, quad.textEnd],
    preparation: session.preparation };
}

function adopt(next: Session) {
  try {
    requireLive();
    const observation = inspectLabel(next);
    const prior = current;
    stage.replaceChildren(next.canvas);
    current = next;
    status.textContent = JSON.stringify(observation, null, 2);
    prior?.renderer.dispose();
  } catch (error) {
    next.renderer.dispose();
    throw error;
  }
}

async function exclusively(operation: () => Promise<void>) {
  if (busy || closed) return;
  busy = true;
  controls.forEach(control => { control.disabled = true; });
  try { await operation(); }
  catch (error) {
    if (!closed) status.textContent = error instanceof Canvas2DError ? error.code : String(error);
  } finally {
    busy = false;
    if (!closed) controls.forEach(control => { control.disabled = false; });
  }
}
function apply() {
  const text = textInput.value, maxWidth = Number(widthInput.value);
  void exclusively(async () => adopt(await prepareLabel(text, maxWidth)));
}

function save() {
  void exclusively(async () => {
    if (!current) throw new Error('Create a diagram first');
    const snapshot = current.tree.snapshot();
    const assets = new Map<string, ImageAssetInput>();
    function capture(nodes: Scene['nodes']) {
      for (const node of nodes) {
        const id = node.kind === 'glyphRun' ? node.atlasId :
          node.kind === 'image' ? node.imageId : null;
        if (id !== null && !assets.has(id)) {
          const asset = current!.renderer.getImageAsset(id);
          if (!asset) throw new Error('Missing document asset ' + id);
          assets.set(id, asset);
        }
        if (node.kind === 'group' || node.kind === 'frame') capture(node.children);
      }
    }
    capture(snapshot.nodes); // Both copied assets exist before any await.
    const text = await serializeCanvasDocument(snapshot, id => assets.get(id) ?? null);
    requireLive();
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = downloadURL; link.download = 'diagram-label.canvas.json';
    document.body.append(link); link.click(); link.remove();
  });
}

function open() {
  const file = openInput.files?.[0];
  if (!file) return;
  void exclusively(async () => {
    try {
      if (file.size > 48 * 1024 * 1024) throw new Error('Diagram document exceeds 48 MiB');
      const text = await file.text();
      requireLive();
      const canvas = freshCanvas();
      const staged = await stageCanvasDocument(text, canvas, options);
      let next: Session;
      try {
        requireLive();
        next = { canvas, renderer: staged.renderer,
          tree: createDisplayTreeFromScene(staged.scene), preparation: {
            font: null, maxWidth: null, displayText: null, visibleTextEnd: null,
            truncated: null, rasterDPR: null, outlineRadius: null, outlineColor: null
          } };
      } catch (error) { staged.renderer.dispose(); throw error; }
      adopt(next);
    } finally { openInput.value = ''; }
  });
}

applyButton.addEventListener('click', apply);
saveButton.addEventListener('click', save);
openInput.addEventListener('change', open);
window.addEventListener('pagehide', () => {
  closed = true;
  applyButton.removeEventListener('click', apply);
  saveButton.removeEventListener('click', save);
  openInput.removeEventListener('change', open);
  current?.renderer.dispose();
  if (downloadURL) URL.revokeObjectURL(downloadURL);
}, { once: true });
apply();
```

These functions are browser host glue around the public package APIs. They allow one asynchronous operation at a time and refuse late adoption after the host closes. A fresh candidate renderer is disposed on failure; the accepted session is replaced only after rendering and inspection. Setting maximum advance to 0 should report `INVALID_SCENE` while keeping the previous canvas. Device or context loss can still prevent rendering; retained CPU data does not guarantee recoverable pixels on every device.

## Keep semantic text separate from visible text

The original label is `Mounting plate dimensions and clearance`: 39 printable ASCII code units. The initial maximum advance is 200 logical pixels. Read the actual `displayText` returned by the browser; font metrics determine which prefix fits. Do not replace `layout.text` with that shortened string.

`rasterizeBrowserEllipsizedText(options: BrowserEllipsizedTextOptions): BrowserEllipsizedTextRaster` requires `text`, `font`, `atlasId` and `maxWidth`; `dpr` is optional with default 1. It has no `textPolicy` option. Text must contain 1..128 printable ASCII units with a nonspace character. Unicode text and the Unicode character `…` are outside this entry's contract; the suffix is three ASCII dots, `...`.

If the complete text's measured advance fits, `displayText` equals the original, `truncated` is false and `visibleTextEnd` is 39. Otherwise the browser measures every original prefix of length 0..38 plus `...` and chooses the greatest fitting prefix length. Kerning can make widths nonmonotonic. If no candidate fits, the helper throws `ASSET_LIMIT`.

`visibleTextEnd` excludes the three dots. `displayText` can contain up to 130 units, but `layout.text` remains the complete original. The layout still has one whole-label quad with range `0..39`. It provides no per-character caret geometry or mapping from a dot to an omitted character.

The width constraint is measured **advance**, not ink bounds. Ink overhang and the rasterizer's padding can extend beyond 200 logical pixels. Font measurement and readiness come from browser APIs; the helper does not identify the matched typeface or guarantee font coverage or pixel parity.

## Align the outline and preserve the glyph hit

`outlineImageAsset(asset: ImageAssetInput, radius: number, color: Color): ImageAssetInput` returns only the outline bitmap. The original label remains a separate asset and glyphRun. Both outputs are mutable owned data; renderer asset registration copies their pixels.

The outline uses a square neighborhood of physical bitmap pixels. Its alpha is `Math.round((maximumNeighborhoodAlpha - centreAlpha) * color[3])`. Nonzero output pixels use constant RGB `Math.round(255 * color[channel])`; zero-alpha output pixels have zero RGB. The input pixels remain unchanged. It is a bitmap operation, not a vector text stroke.

The output has the same width and height as the input. Radius 3 at raster DPR2 corresponds to about 1.5 local logical pixels before the parent transform. It does not enlarge the canvas or add padding; the outline can clip at image edges. Radius 8 can exceed the existing text padding.

The sprite uses the actual glyph quad's position, logical extent and full source rectangle. Both children share `LabelGroup`, whose translation is `(40,104)` and whose rotation is `.08` radians. Applying a transform to only one child would break alignment. `OriginalGlyph` is above the outline at layer 1; the outline is layer 0 with `hitMode:'none'`.

The inspection finds a nonzero-alpha pixel in the **original** atlas, maps its centre through the quad, calls `glyph.toWorld`, then `renderer.worldToViewport`, and asks `hitTest`. The hit identifies `OriginalGlyph` as a `glyphRun`; reading that handle's `data.text` recovers the complete semantic label. Decoration never supplies a text identity or takes its own hit. The public renderer applies its existing alpha-based GlyphRun hit rules. Sampling an ink pixel only chooses a probe point; it supplies no character selection or text editing.

## Save a real document and reopen it

Click **Save diagram JSON** to download `diagram-label.canvas.json`. Then use **Open diagram JSON** to choose that downloaded file. This file workflow is separate from the [Unicode example's](./unicode-labels) memory-only Save/Restore actions.

Save captures the complete scene and both referenced asset copies before the first `await`. This prevents asynchronous digest work from reading label bytes from one edit and outline bytes from another. `serializeCanvasDocument` stores semantic text, layout and the label/outline RGBA bytes together.

Open stages the file on a fresh canvas through `stageCanvasDocument`, reconstructs new handles with `createDisplayTreeFromScene`, and swaps the visible canvas only after success. It does not call font loading, text rasterization or outline preparation. The file's scene and copied assets are authoritative; old handles and listeners are not rebound.

The document does not store font, maximum advance, derived display text, visible-prefix end, truncation, raster DPR, outline radius or outline color settings. The host marks all these preparation fields `null` after Open. It does not infer them from saved pixels. The renderer's display DPR remains explicitly configured at 2. A later **Apply label** prepares a new candidate from the input controls and the explicit current font/DPR/outline profile.

Document serialization requires browser byte encoding and SHA-256 support. Its separate limits are 16 referenced assets, 32 MiB RGBA8 payload and 48 MiB serialized document text. Background color is host renderer configuration and is supplied again. A screenshot or PNG cannot reconstruct this editable scene and asset table.

## Bounds and errors

| Operation | Bounds | Errors |
| --- | --- | --- |
| Ellipsis input | Ordinary own data options; printable ASCII 1..128; finite `maxWidth` in `(0,1e6]`; DPR `[1,4]`; font at most 256 units, no CR/LF/NUL | `INVALID_SCENE`; invalid atlas ID is `INVALID_ASSET` |
| Ellipsis browser work | Ready font; finite metrics/ink edges within ±1e6; atlas at most 1024×256 backing pixels and 1 MiB RGBA8 | `UNSUPPORTED_FEATURE`, `INVALID_ASSET`, `ASSET_LIMIT`; no fitting prefix is `ASSET_LIMIT` |
| Outline input | Exact own `width/height/pixels`; integer dimensions 1..4096; ordinary nonshared `Uint8Array` with exactly `width*height*4` bytes | `INVALID_ASSET` |
| Outline settings | Required integer radius 1..8; dense ordinary Color4 with finite channels `[0,1]`; negative zero refused for dimensions/radius/color | `INVALID_ASSET` |
| Outline budget | Input and same-size output each at most 1 MiB | `ASSET_LIMIT` |

Ellipsis options refuse getters, hidden fields, symbols, unknown fields and foreign/null prototypes. Outline asset records permit ordinary or null prototypes, but still require exact enumerable data fields; pixel metadata overrides, shared buffers and typed-array subclasses are refused. The outline has no DOM, GPU or automatic asset-registration step. The rasterizer releases its scratch canvas on success and failure. Dispose owned renderers and remove host listeners when closing the page.

[Canvas guides](./guides) · [Canvas examples](./examples) · [Unicode labels](./unicode-labels)
