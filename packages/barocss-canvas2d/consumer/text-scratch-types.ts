import { rasterizeBrowserText, rasterizeBrowserMultilineText, rasterizeBrowserWrappedText } from '../dist/index.js';
import type { BrowserTextOptions, BrowserTextRaster, BrowserMultilineTextOptions, BrowserMultilineTextRaster,
  BrowserWrappedTextOptions, BrowserWrappedTextRaster } from '../dist/index.js';
import { rasterizeBrowserText as sourceSingle, rasterizeBrowserMultilineText as sourceMulti,
  rasterizeBrowserWrappedText as sourceWrapped } from '../src/index.js';
export function textScratchPublicTypes(single: BrowserTextOptions, multi: BrowserMultilineTextOptions, wrapped: BrowserWrappedTextOptions) {
  const one: BrowserTextRaster = rasterizeBrowserText(single);
  const many: BrowserMultilineTextRaster = rasterizeBrowserMultilineText(multi);
  const words: BrowserWrappedTextRaster = rasterizeBrowserWrappedText(wrapped);
  const sourceOne: BrowserTextRaster = sourceSingle(single);
  const sourceMany: BrowserMultilineTextRaster = sourceMulti(multi);
  const sourceWords: BrowserWrappedTextRaster = sourceWrapped(wrapped);
  // @ts-expect-error Single text remains synchronous.
  const asynchronous: Promise<BrowserTextRaster> = rasterizeBrowserText(single);
  // @ts-expect-error A multiline baseline advance is required.
  sourceMulti({ text: 'A\nB', font: single.font, atlasId: single.atlasId });
  // @ts-expect-error A wrapping width is required.
  rasterizeBrowserWrappedText(multi);
  void asynchronous;
  return { one, many, words, sourceOne, sourceMany, sourceWords };
}
