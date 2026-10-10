import { rasterizeBrowserText, rasterizeBrowserMultilineText, createDisplayTree } from '../dist/index.js';
import type { ImageAssetInput, GlyphRunLayout, BrowserTextOptions, BrowserTextRaster, BrowserTextPolicy } from '../dist/index.js';
export function compiledRootBrowserText() {
  const options: BrowserTextOptions = { text: 'H I', font: '24px monospace', atlasId: 'BrowserTextAtlas', dpr: 1.5 };
  const result: BrowserTextRaster = rasterizeBrowserText(options);
  const asset: ImageAssetInput = result.asset;
  const layout: GlyphRunLayout = result.layout;
  const tree = createDisplayTree('TypedText');
  const glyph = tree.createGlyphRun({ id: 'Label', layer: 0,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, ...layout });
  glyph.setLayout(layout);
  const metrics: { font: string; dpr: number; advance: number; bounds: { left: number; top: number; width: number; height: number } } = result;
  return { asset, layout, metrics, scene: tree.snapshot() };
}

export function printableRootType() {
  const textPolicy: BrowserTextPolicy = 'printable-ascii';
  const options: BrowserTextOptions = {text:'-$20',font:'24px monospace',atlasId:'Label',textPolicy};
  const result: BrowserTextRaster = rasterizeBrowserText(options);
  // @ts-expect-error Unknown policy must not be accepted by the public type.
  const bad: BrowserTextPolicy = 'unicode';
  void bad; return result;
}

export function multilineRootType() {
  const options: import('../dist/index.js').BrowserMultilineTextOptions = {
    text: 'Balance\n-$20', font: '24px monospace', atlasId: 'Label', lineAdvance: 40, dpr: 1.5 };
  const result: import('../dist/index.js').BrowserMultilineTextRaster = rasterizeBrowserMultilineText(options);
  const line: import('../dist/index.js').BrowserMultilineTextLine = result.lines[0];
  // @ts-expect-error The baseline advance is required.
  rasterizeBrowserMultilineText({text:'A',font:'24px monospace',atlasId:'Label'});
  return { result, line };
}

export function alignedMultilineRootType() {
  const alignments: import('../dist/index.js').BrowserMultilineTextAlignment[] = ['left', 'center', 'right'];
  const options: import('../dist/index.js').BrowserMultilineTextOptions = {
    text: 'Balance\n-$20', font: '24px monospace', atlasId: 'AlignedLabel', lineAdvance: 40,
    lineAlign: alignments[1], dpr: 1.5 };
  const result: import('../dist/index.js').BrowserMultilineTextRaster = rasterizeBrowserMultilineText(options);
  // @ts-expect-error Only the three public alignment values are supported.
  const invalid: import('../dist/index.js').BrowserMultilineTextAlignment = 'justify';
  // @ts-expect-error Alignment is only an input; result line records keep their prior shape.
  result.lines[0].x;
  // @ts-expect-error The single-line helper does not accept multiline alignment.
  rasterizeBrowserText({ text: 'A', font: options.font, atlasId: options.atlasId, lineAlign: 'center' });
  void invalid;
  return { result, alignments };
}
