import { rasterizeBrowserEllipsizedText as emitted } from '../dist/index.js';
import type { BrowserEllipsizedTextOptions, BrowserEllipsizedTextRaster } from '../dist/index.js';
import { rasterizeBrowserEllipsizedText as source } from '../src/index.js';
import type { BrowserEllipsizedTextRaster as SourceRaster } from '../src/index.js';
export function ellipsisPublicTypes(options: BrowserEllipsizedTextOptions) {
 const compiled: BrowserEllipsizedTextRaster = emitted(options);
 const original: SourceRaster = source(options);
 const compatible: BrowserEllipsizedTextRaster = original;
 const values: [string, boolean, number, number] = [compiled.displayText, compiled.truncated, compiled.visibleTextEnd, compiled.maxWidth];
 // @ts-expect-error Required maxWidth has no default.
 emitted({text:'ABC',font:'24px monospace',atlasId:'Text'});
 // @ts-expect-error This entry is fixed printable ASCII, not a policy selector.
 source({text:'ABC',font:'24px monospace',atlasId:'Text',maxWidth:90,textPolicy:'unicode-single-line'});
 // @ts-expect-error The API is synchronous.
 const asynchronous: Promise<BrowserEllipsizedTextRaster> = source(options);
 return {compiled,original,compatible,values,asynchronous};
}
