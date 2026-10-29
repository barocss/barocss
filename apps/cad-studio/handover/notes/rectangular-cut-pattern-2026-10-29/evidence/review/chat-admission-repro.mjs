// Lightweight checkNode call; no geometry evaluation.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=process.argv[2], require=createRequire(root+'/packages/barocss-cad-model/package.json'), {build}=require('esbuild');
const file='packages/barocss-cad-model/src/chat/features.ts';console.log('source_sha256',file,createHash('sha256').update(readFileSync(root+'/'+file)).digest('hex'));
const result=await build({stdin:{contents:`export { checkNode } from './packages/barocss-cad-model/src/chat/features.ts';`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {checkNode}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const nodes=[{kind:'sketch',profile:'rectangle',min:[0,0],max:[60,40]},{kind:'extrude',sketch:0,height:10},{kind:'sketch',profile:'rectangle',min:[8,8],max:[12,12]},{kind:'extrude',sketch:2,height:10},{kind:'difference',parent:{node:1,side:'solid'},tool:{node:3,side:'solid'}}];
const node={kind:'rectangular-feature-pattern',parent:{node:4,side:'solid'},axis:'x',spacing:16,count:3,axis2:'y',spacing2:16,count2:2};
console.log('valid_rectangular_checkNode_actual',JSON.stringify(checkNode(node,nodes,{})));
