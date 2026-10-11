import {exportSceneGradientSVG, type SVGExportResult, type Size} from '../src/index.js';
import {exportSceneGradientSVG as emitted, type SVGExportResult as EmittedResult} from '../dist/index.js';
const size:Size={width:320,height:220};
const source:SVGExportResult=exportSceneGradientSVG({version:29},size);
const compiled:EmittedResult=emitted({version:29},size);
if(source.ok){const text:string=source.svg;void text;}else{const code:'UNSUPPORTED_FEATURE'=source.diagnostics[0].code;void code;}
void compiled;
// @ts-expect-error required logical size
exportSceneGradientSVG({version:29});
// @ts-expect-error required input and size
exportSceneGradientSVG();
// @ts-expect-error synchronous API
const asyncResult:Promise<SVGExportResult>=source;
