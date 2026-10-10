import {rasterizeBrowserText, type BrowserTextRaster, type GlyphRunLayout} from '../src/index.js';
import {rasterizeBrowserText as emitted, type BrowserTextRaster as EmittedRaster} from '../dist/index.js';
const source:BrowserTextRaster=rasterizeBrowserText({text:'설계 A1',font:'16px system-ui',atlasId:'DiagramLabelAAtlas',dpr:2,textPolicy:'unicode-single-line'});
const compiled:EmittedRaster=emitted({text:'圖面 B2',font:'16px system-ui',atlasId:'DiagramLabelBAtlas',dpr:2,textPolicy:'unicode-single-line'});
const layout:GlyphRunLayout=source.layout; void layout;void compiled;
// @ts-expect-error preparation is synchronous
const asyncResult:Promise<BrowserTextRaster>=source;
// @ts-expect-error unsupported policy
rasterizeBrowserText({text:'A',font:'16px system-ui',atlasId:'A',textPolicy:'unicode-paragraph'});
