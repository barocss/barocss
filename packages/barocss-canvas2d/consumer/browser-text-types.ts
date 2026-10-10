import { rasterizeBrowserText, createDisplayTree } from '../dist/index.js';
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
