import { rasterizeBrowserText, createDisplayTree } from '../dist/index.js';
import type { BrowserTextOptions, BrowserTextRaster, ImageAssetInput, GlyphRunLayout } from '../dist/index.js';
import { admitRaster, prepareRaster } from './text-raster-host.mjs';

/** Compile-only evidence for the adopted public data and private async host. */
export async function compiledTextHelperAdoption(isCurrent: () => boolean) {
  const input: BrowserTextOptions = { text: 'H I', atlasId: 'TextAtlas', font: '24px monospace', dpr: 2 };
  const raster: BrowserTextRaster = rasterizeBrowserText(input);
  const asset: ImageAssetInput = raster.asset;
  const layout: GlyphRunLayout = raster.layout;
  admitRaster(raster);
  const tree = createDisplayTree('TypedHostText');
  const glyph = tree.createGlyphRun({ id: 'Label', layer: 0,
    transform: { x: 40, y: 50, scaleX: 1, scaleY: 1, rotation: 0 }, ...layout });
  glyph.setLayout(layout);
  const prepared = await prepareRaster('H I', 0, isCurrent);
  return { asset, layout, normalizedFont: raster.font, dpr: raster.dpr,
    logicalAdvance: raster.advance, bounds: raster.bounds, prepared, scene: tree.snapshot() };
}
