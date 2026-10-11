import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {writeFile,readFile} from 'node:fs/promises';
const dir=new URL('.',import.meta.url),root=new URL('../../../',dir);
let assertions=0;const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;},ok=v=>{assert.ok(v);assertions++;};
const copy=v=>JSON.parse(JSON.stringify(v));
const base=id=>({id,layer:0,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0},visible:true,alpha:1,hitMode:'auto'});
const rect=id=>({kind:'rect',...base(id),width:10,height:10,fill:[1,0,0,1]});
const path=id=>({kind:'path',...base(id),commands:[{kind:'M',x:0,y:0},{kind:'L',x:10,y:0},{kind:'L',x:10,y:10},{kind:'L',x:0,y:10},{kind:'Z'}],fill:{color:[0,0,1,1],rule:'nonzero'}});
const image=id=>({kind:'image',...base(id),imageId:'Tex',width:10,height:10,opacity:1,sampling:'nearest',anchorX:0,anchorY:0,tint:[1,1,1],blendMode:'normal'});
const glyph=id=>({kind:'glyphRun',...base(id),atlasId:'Atlas',text:'A😀',baseline:2,opacity:1,sampling:'nearest',glyphs:[{sourceRect:{x:0,y:0,width:1,height:1},x:0,y:0,width:1,height:1,textStart:0,textEnd:3}]});
const scene=nodes=>({version:29,unit:'logical-px',contextId:'Ctx',nodes});
const group=(id,children)=>({kind:'group',...base(id),children});
const full=scene([rect('Back'),group('Parent',[group('Root',[{kind:'frame',...base('Frame'),width:40,height:40,fill:[0,0,0,1],clip:true,children:[rect('Rect'),{kind:'line',...base('Line'),x1:0,y1:0,x2:10,y2:10,width:1,stroke:[1,1,1,1]},path('Path'),image('Image'),glyph('Glyph')]}]),rect('Marker')])]);
const flatten=nodes=>nodes.flatMap(n=>[n,...('children'in n?flatten(n.children):[])]);
const assets=nodes=>[...new Set(flatten(nodes).flatMap(n=>n.kind==='image'?[n.imageId]:n.kind==='glyphRun'?[n.atlasId]:[]))];
function mapping(s,id,offset={x:3,y:4}){const n=flatten(s.nodes).find(n=>n.id===id);return{nodeIds:Object.fromEntries(flatten([n]).map(n=>[n.id,'New'+n.id])),assetIds:Object.fromEntries(assets([n]).map(id=>[id,'New'+id])),offset};}
function expected(s,id,o){const result=copy(s);function rewrite(n){const out=copy(n);out.id=o.nodeIds[n.id];if(n.kind==='image')out.imageId=o.assetIds[n.imageId];if(n.kind==='glyphRun')out.atlasId=o.assetIds[n.atlasId];if(n.children)out.children=n.children.map(rewrite);return out;}function insert(nodes){for(let i=0;i<nodes.length;i++){if(nodes[i].id===id){const n=rewrite(nodes[i]);n.transform.x+=o.offset.x;n.transform.y+=o.offset.y;nodes.splice(i+1,0,n);return true;}if(nodes[i].children&&insert(nodes[i].children))return true;}return false;}insert(result.nodes);return result;}
const output=await build({entryPoints:[fileURLToPath(new URL('src/index.ts',root))],bundle:true,write:false,platform:'node',format:'esm',target:'es2022'});
let reads=0;Object.defineProperty(globalThis,'document',{configurable:true,get(){reads++;throw Error('DOM read');}});globalThis.fetch=()=>{reads++;throw Error('fetch');};
const source=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const emitted=await import(new URL('dist/index.js',root));eq(reads,0);
const records=[];
for(const[label,api]of [['source',source],['emitted',emitted]]){
 let admissions=0,refusals=0,getters=0;
 const accept=(s,id,o=mapping(s,id))=>{const before=copy(s),maps=copy(o),r=api.duplicateSceneSubtree(s,id,o);eq(r.scene,expected(s,id,o));eq(r.duplicateRootId,o.nodeIds[id]);eq({...r.nodeIdMap},{...o.nodeIds});eq({...r.assetIdMap},{...o.assetIds});eq(s,before);eq(copy(o),maps);ok(r.scene!==s);ok(r.nodeIdMap!==o.nodeIds&&r.assetIdMap!==o.assetIds&&r.nodeIdMap!==r.assetIdMap);admissions++;return r;};
 const refuse=(code,s,id,o)=>{const before=JSON.stringify(s);assert.throws(()=>api.duplicateSceneSubtree(s,id,o),e=>e.code===code);assertions++;eq(JSON.stringify(s),before);refusals++;};
 const r=accept(full,'Root');r.scene.nodes[0].fill[0]=0;eq(full.nodes[0].fill[0],1);r.nodeIdMap.Root='Mutated';eq(flatten(full.nodes).find(n=>n.id==='Root').id,'Root');
 accept(full,'Path');accept(scene([rect('A')]),'A');
 const repeated=scene([group('R',[image('I'),{...image('J'),visible:false,alpha:0}])]);accept(repeated,'R');
 const alias=image('Same');alias.imageId='Same';const shared={Same:'Fresh'};accept(scene([alias]),'Same',{nodeIds:shared,assetIds:shared,offset:{x:0,y:0}});
 const safe=scene([rect('constructor')]);accept(safe,'constructor',{nodeIds:Object.assign(Object.create(null),{constructor:'toString'}),assetIds:Object.create(null),offset:{x:0,y:0}});
 const cross=scene([image('I')]);accept(cross,'I',{nodeIds:{I:'Tex'},assetIds:{Tex:'I'},offset:{x:0,y:0}});
 const pivot=copy(full);const rootNode=flatten(pivot.nodes).find(n=>n.id==='Root');rootNode.pivot={x:2,y:3};rootNode.transform={x:2,y:3,scaleX:-2,scaleY:3,rotation:0.3};rootNode.hitArea={x:0,y:0,width:40,height:40};rootNode.mask={commands:[{kind:'M',x:0,y:0},{kind:'L',x:40,y:0},{kind:'L',x:40,y:40},{kind:'L',x:0,y:40},{kind:'Z'}]};accept(pivot,'Root');
 for(const fill of[{linear:{from:{x:0,y:0},to:{x:20,y:0},startColor:[1,0,0,0],endColor:[0,0,1,1]},rule:'evenodd'},{radial:{center:{x:5,y:5},radius:10,startColor:[1,0,0,1],endColor:[0,0,0,0]},rule:'nonzero'}]){const n=path('P');n.fill=fill;n.stroke={color:[0,1,0,1],width:2,cap:'round',join:'miter',dash:{lengths:[2,2],offset:1},miterLimit:4};accept(scene([n]),'P');}
 for(const mode of['slice','tile']){const n=image('I');n.sourceRect={x:1,y:2,width:4,height:4};n.hitArea={x:1,y:2,width:5,height:6};n.rgbMatrix=[1,0,0,0,0,1,0,0,0,0,1,0];n.alphaMask=[0,0,0,1];n.blendMode='screen';if(mode==='slice')n.slice={left:1,right:1,top:1,bottom:1};else n.tile={width:2,height:2,offsetX:0,offsetY:0};accept(scene([n]),'I');}
 const edge=rect('A');edge.transform.x=999999;accept(scene([edge]),'A',{nodeIds:{A:'B'},assetIds:{},offset:{x:1,y:0}});refuse('SCENE_LIMIT',scene([edge]),'A',{nodeIds:{A:'B'},assetIds:{},offset:{x:2,y:0}});
 const max=scene(Array.from({length:256},(_,i)=>rect('R'+i)));refuse('SCENE_LIMIT',max,'R0',{nodeIds:{R0:'Fresh'},assetIds:{},offset:{x:0,y:0}});
 const paths=scene(Array.from({length:32},(_,i)=>path('P'+i)));refuse('SCENE_LIMIT',paths,'P0',mapping(paths,'P0'));
 const runs=scene(Array.from({length:32},(_,i)=>glyph('G'+i)));refuse('SCENE_LIMIT',runs,'G0',mapping(runs,'G0'));
 const masks=scene(Array.from({length:8},(_,i)=>({...group('M'+i,[rect('R'+i)]),mask:copy(rootNode.mask)})));refuse('SCENE_LIMIT',masks,'M0',mapping(masks,'M0'));
 const tile=image('T');tile.width=128;tile.height=16;tile.sourceRect={x:0,y:0,width:1,height:1};tile.tile={width:1,height:1,offsetX:0,offsetY:0};const tiled=scene([tile]);refuse('SCENE_LIMIT',tiled,'T',mapping(tiled,'T'));
 for(const bad of [null,{},[],{...mapping(full,'Root'),extra:1},{...mapping(full,'Root'),offset:{x:-0,y:0}},{...mapping(full,'Root'),offset:{x:Infinity,y:0}},{...mapping(full,'Root'),offset:{x:1000001,y:0}}])refuse('INVALID_SCENE',full,'Root',bad);
 for(const key of ['Root','Extra']){const o=mapping(full,'Root');if(key==='Root')delete o.nodeIds.Root;else o.nodeIds.Extra='NewExtra';refuse('INVALID_SCENE',full,'Root',o);}
 for(const value of ['Back','Ctx','Root','_Bad',5]){const o=mapping(full,'Root');o.nodeIds.Root=value;refuse('INVALID_SCENE',full,'Root',o);}
 let o=mapping(full,'Root');o.nodeIds.Frame=o.nodeIds.Root;refuse('INVALID_SCENE',full,'Root',o);o=mapping(full,'Root');o.assetIds.Tex='Atlas';refuse('INVALID_SCENE',full,'Root',o);o=mapping(full,'Root');o.assetIds.Atlas=o.assetIds.Tex;refuse('INVALID_SCENE',full,'Root',o);o=mapping(full,'Root');o.assetIds.Extra='Fresh';refuse('INVALID_SCENE',full,'Root',o);
 for(const target of['options','node','asset','offset']){const o=mapping(full,'Root');const object=target==='options'?o:target==='node'?o.nodeIds:target==='asset'?o.assetIds:o.offset;const field=target==='options'?'nodeIds':target==='node'?'Root':target==='asset'?'Tex':'x';Object.defineProperty(object,field,{enumerable:true,get(){getters++;throw Error('getter');}});refuse('INVALID_SCENE',full,'Root',o);}
 o=mapping(full,'Root');o.nodeIds[Symbol('extra')]='X';refuse('INVALID_SCENE',full,'Root',o);refuse('INVALID_SCENE',full,'Missing',mapping(full,'Root'));refuse('INVALID_SCENE',full,'_Bad',mapping(full,'Root'));
 const old={version:0,unit:'logical-px',contextId:'Old',nodes:[]};refuse('UNSUPPORTED_FEATURE',old,'A',null);const badScene=copy(full);Object.defineProperty(badScene,'unit',{enumerable:true,get(){getters++;throw Error('source getter');}});assert.throws(()=>api.duplicateSceneSubtree(badScene,'Missing',null),e=>e.code==='INVALID_SCENE');assertions++;refusals++;
 eq(getters,0);eq(reads,0);
 records.push({label,status:'PASS',admissions,refusals,getters,DOMAndFetchReads:reads,sourceBudget:'schema reused; output serialization cap reviewed, no fabricated overflow witness',inputCopies:true,resultMapsIndependent:true});
}
const receipt={status:'PASS',assertions,records,firstFailures:[],scope:'paired actual public helper; native pixels/device/file acceptance separate'};
try{const prior=JSON.parse(await readFile(new URL('focused.json',dir),'utf8'));receipt.firstFailures=prior.firstFailures??[];}catch{}
await writeFile(new URL('focused.json',dir),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
