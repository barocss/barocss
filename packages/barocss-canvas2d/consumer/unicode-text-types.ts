import { rasterizeBrowserText as emitted } from '../dist/index.js';
import type { BrowserTextPolicy, BrowserTextRaster } from '../dist/index.js';
import { rasterizeBrowserText as source } from '../src/index.js';
import type { BrowserTextPolicy as SourcePolicy } from '../src/index.js';
export function unicodePublicTypes() {
 const policy: BrowserTextPolicy = 'unicode-single-line';
 const sourcePolicy: SourcePolicy = policy;
 const options = { text: '설계 圖面 A1', font: '24px system-ui', atlasId: 'Label', textPolicy: sourcePolicy };
 const a: BrowserTextRaster = emitted(options), b: BrowserTextRaster = source(options);
 // @ts-expect-error There is no Unicode multiline policy alias.
 const invalid: BrowserTextPolicy = 'unicode-multiline';
 // @ts-expect-error Raster preparation is synchronous.
 const asynchronous: Promise<BrowserTextRaster> = source(options);
 return { a, b, invalid, asynchronous };
}
