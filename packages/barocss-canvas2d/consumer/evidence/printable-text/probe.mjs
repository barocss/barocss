import assert from 'node:assert/strict';
import {rasterizeBrowserText,Canvas2DError} from '../../../dist/index.js';
const base={text:'HI',font:'24px monospace',atlasId:'Atlas'};
let refusals=0,admissions=0;
const reject=(options,code='INVALID_SCENE')=>{assert.throws(()=>rasterizeBrowserText(options),e=>e instanceof Canvas2DError&&e.code===code);if(code==='INVALID_SCENE')refusals++;else admissions++};
for(const text of ['12.5','-$20','FPS:60','!','@','A_B','A/B']){reject({...base,text});reject({...base,text,textPolicy:'alphanumeric'});reject({...base,text,textPolicy:'printable-ascii'},'UNSUPPORTED_FEATURE')}
for(let code=32;code<=126;code++)reject({...base,text:'A'+String.fromCharCode(code),textPolicy:'printable-ascii'},'UNSUPPORTED_FEATURE');
for(const text of ['', ' ', '  ', '\n','A\tB','A\rB','A\0B','A\x1f','A\x7f','한글','é','😀','\ud800','A'.repeat(129)])reject({...base,text,textPolicy:'printable-ascii'});
for(const textPolicy of [undefined,null,'unicode','PRINTABLE-ASCII','',1,{},[]])reject({...base,textPolicy});
let getterReads=0;const options={...base};Object.defineProperty(options,'textPolicy',{enumerable:true,get(){getterReads++;return 'printable-ascii'}});reject(options);assert.equal(getterReads,0);
reject({...base,text:'A'.repeat(128),textPolicy:'printable-ascii'},'UNSUPPORTED_FEATURE');reject(base,'UNSUPPORTED_FEATURE');
console.log(JSON.stringify({refusals,validationAdmissionsWithoutDOM:admissions,printableCodePoints:95,getterReads,defaultUnchanged:true,allocation:'none: Node has no document; accepted policy ends at UNSUPPORTED_FEATURE'}));
