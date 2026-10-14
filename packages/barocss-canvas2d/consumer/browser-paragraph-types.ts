import {rasterizeBrowserParagraphText as source} from '../src/index.js';
import {rasterizeBrowserParagraphText as compiled} from '../dist/index.js';
import type {BrowserParagraphTextOptions,BrowserParagraphTextRaster} from '../src/index.js';
import type {BrowserParagraphTextRaster as CompiledRaster} from '../dist/index.js';
export function paragraphPublicTypes(){const options:BrowserParagraphTextOptions={text:'한글 é',font:'24px system-ui',atlasId:'Text',maxWidth:120,lineAdvance:30,direction:'ltr',breakPolicy:'grapheme'};
 const a:BrowserParagraphTextRaster=source(options),b:CompiledRaster=compiled(options);
 // @ts-expect-error Direction is required.
 source({text:'A',font:'24px system-ui',atlasId:'Text',maxWidth:120,lineAdvance:30,breakPolicy:'grapheme'});
 // @ts-expect-error Only native base ltr/rtl directions are allowed.
 compiled({...options,direction:'auto'});
 // @ts-expect-error The explicit policy is grapheme.
 source({...options,breakPolicy:'word'});
 // @ts-expect-error Preparation is synchronous.
 const pending:Promise<BrowserParagraphTextRaster>=source(options);
 return{a,b,pending};}
