// Maintainer-only selected Node DOM import/scene/document consumer.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleSvgArcImport } from './build-svg-arc-import.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePin = '94a2a776254a73b496431ab6cbb49ea07900bef7';
const evidencePath = resolve(app, 'evidence/svg-arc-import-consumer.json');
const preset = JSON.parse(await readFile(resolve(app, 'scripts/snippets/svg-arc-import.json'), 'utf8'));
const previous = await readFile(evidencePath, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const failures = previous?.failedCandidates ?? [];
const documentPath = resolve(app, 'docs/.vitepress/cache/svg-arc-import', sourcePin, 'consumers/node-document.json');
const consumerText = `
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as API from '@barocss/canvas2d';
import { serializeCanvasDocument, parseCanvasDocument } from '@barocss/canvas2d/document';
import { createArcDisplayTree, validateArcScene29, editFirstArcCubic } from './svg-arc-import-adapter.mjs';
function flatten(scene){const result=[];function walk(nodes){for(const node of nodes){result.push(node);if(node.children)walk(node.children);}}walk(scene.nodes);return result;}
function firstC(scene){for(const path of flatten(scene)){if(path.kind!=='path')continue;const index=path.commands.findIndex(command=>command.kind==='C');if(index>=0)return{pathId:path.id,index,command:path.commands[index]};}throw Error('Fixture must produce a cubic Arc command');}
function expectedEdit(scene,delta){const value=structuredClone(scene),edit=firstC(value);const path=flatten(value).find(node=>node.id===edit.pathId);path.commands[edit.index].c1x+=delta;return value;}
function importedFields(node){const base={kind:node.kind,id:node.id,layer:node.layer,transform:node.transform};for(const field of ['width','height','clip','commands','fill'])if(Object.hasOwn(node,field))base[field]=node[field];if(node.stroke)base.stroke={color:node.stroke.color,width:node.stroke.width};if(node.children)base.children=node.children.map(importedFields);return base;}
export async function runArcConsumer(root,invalidFlagRoot,negativeRadiusRoot,source,physicalPath){
 const beforeDOM=root.outerHTML;
 const imported=API.importSVGArcElement(root);
 assert.equal(imported.scene.version,5);assert.equal(root.outerHTML,beforeDOM);
 const importedBefore=structuredClone(imported);
 const tree=createArcDisplayTree(API,imported.scene),derivedScene29=tree.snapshot();
 assert.equal(derivedScene29.version,29);assert.deepEqual(imported,importedBefore);
 assert.deepEqual(derivedScene29.nodes.map(importedFields),imported.scene.nodes.map(importedFields));
 const checked=validateArcScene29(API,derivedScene29);
 assert.deepEqual(checked,derivedScene29);assert.notStrictEqual(checked,derivedScene29);
 flatten(derivedScene29).forEach(node=>{
  assert.equal(node.visible,true);assert.equal(node.alpha,1);assert.equal(node.hitMode,'auto');
  if(node.stroke){assert.equal(node.stroke.cap,'butt');assert.equal(node.stroke.join,'bevel');assert.deepEqual(node.stroke.dash,{lengths:[],offset:0});assert.equal(node.stroke.miterLimit,4);}
 });
 const editTarget=firstC(derivedScene29),beforeEdit=structuredClone(derivedScene29);
 const edited=editFirstArcCubic(API,derivedScene29,12);
 assert.deepEqual(edited.scene,expectedEdit(beforeEdit,12));assert.deepEqual(derivedScene29,beforeEdit);
 const editedHandle=edited.tree.get(editTarget.pathId),paint=editedHandle.data;
 assert.deepEqual(paint.commands,flatten(edited.scene).find(n=>n.id===editTarget.pathId).commands);
 const originalPath=flatten(beforeEdit).find(n=>n.id===editTarget.pathId);
 assert.deepEqual(paint.fill,originalPath.fill);assert.deepEqual(paint.stroke,originalPath.stroke);
 let accepted=edited.scene;const acceptedReference=accepted,beforeAccepted=structuredClone(accepted),refusals=[];
 for(const [name,candidateRoot] of [['invalid Arc flag',invalidFlagRoot],['negative Arc radius',negativeRadiusRoot]]){
  let refusal;try{const candidate=API.importSVGArcElement(candidateRoot);accepted=createArcDisplayTree(API,candidate.scene).snapshot();}catch(error){refusal=error;}
  assert.ok(refusal instanceof API.Canvas2DError);assert.equal(refusal.code,'INVALID_SCENE');
  assert.strictEqual(accepted,acceptedReference);assert.deepEqual(accepted,beforeAccepted);
  refusals.push({name,code:refusal.code,message:refusal.message});
 }
 let assetLookups=0;
 const savedSnapshot=structuredClone(accepted);
 const documentText=await serializeCanvasDocument(savedSnapshot,()=>{assetLookups++;throw Error('Unexpected image asset reference');});
 assert.equal(assetLookups,0);assert.deepEqual(savedSnapshot,accepted);
 await writeFile(physicalPath,documentText);
 const diskBytes=await readFile(physicalPath),diskText=diskBytes.toString('utf8');assert.equal(diskText,documentText);
 const parsed=await parseCanvasDocument(diskText);assert.equal(parsed.assets.size,0);assert.deepEqual(parsed.scene,accepted);
 assert.notStrictEqual(parsed.scene,accepted);
 const reopenedTree=API.createDisplayTreeFromScene(validateArcScene29(API,parsed.scene));
 const reopenedScene29=reopenedTree.snapshot();assert.deepEqual(reopenedScene29,accepted);
 const reopenedHandle=reopenedTree.get(editTarget.pathId);assert.notStrictEqual(reopenedHandle,editedHandle);
 const reedited=editFirstArcCubic(API,reopenedScene29,12);
 assert.deepEqual(reedited.scene,expectedEdit(reopenedScene29,12));assert.deepEqual(edited.scene,beforeAccepted);
 assert.equal(firstC(reedited.scene).command.c1x,editTarget.command.c1x+24);
 const stableReedited=structuredClone(reedited.scene);
 flatten(parsed.scene).find(n=>n.id===editTarget.pathId).commands[editTarget.index].c1x+=999;
 assert.deepEqual(reopenedTree.snapshot(),reopenedScene29);
 assert.deepEqual(reedited.scene,stableReedited);
 assert.equal(root.outerHTML,beforeDOM);
 const normalizedCommands=flatten(derivedScene29).filter(n=>n.kind==='path').map(n=>({id:n.id,commands:n.commands}));
 assert.ok(normalizedCommands.every(p=>p.commands.every(c=>['M','L','Q','C','Z'].includes(c.kind))));
 return{source,importedScene5:imported.scene,importDiagnostics:imported.diagnostics,derivedScene29,editedScene29:edited.scene,
  reopenedScene29,reeditedScene29:reedited.scene,normalizedCommands,
  edit:{pathId:editTarget.pathId,commandIndex:editTarget.index,field:'c1x',coordinateSpace:'path-local logical coordinates',
    initial:editTarget.command.c1x,firstEdit:firstC(edited.scene).command.c1x,reedit:firstC(reedited.scene).command.c1x,deltaPerEdit:12},
  documentText,physicalDocument:{bytes:diskBytes.length,sha256:createHash('sha256').update(diskBytes).digest('hex'),version:JSON.parse(documentText).version,assets:parsed.assets.size},
  refusals,assetLookups,wholeHierarchyAndPaintRetained:true,onlySelectedC1XChanged:true,sourceAndDOMUnchanged:true,
  freshIndependentScenesAndHandles:true,acceptedReferenceAndValuesRetained:true,
  counts:{importedNodes:flatten(imported.scene).length,normalizedNodes:flatten(derivedScene29).length,
    paths:normalizedCommands.length,cubicCommands:normalizedCommands.reduce((n,p)=>n+p.commands.filter(c=>c.kind==='C').length,0)},
  limits:{arcDOMNodes:1024,arcDOMDepth:16,arcDOMElements:255,paths:32,attributesPerElement:16,attributeUTF8Bytes:1048576,
    explicitCommandsPerPath:256,normalizedCommandsPerPath:256,tokensPerPath:2048,arcSegments:8,maximumSegmentDegrees:45,
    minimumPositiveRadius:.001,numericMagnitude:1000000,maximumRotationDegrees:360,minimumScale:.01,maximumScale:100,
    maximumViewportEdge:8192,sceneNodes:256,sceneDepth:16,sceneUTF8Bytes:1048576},
  actualBrowser:false,actualGL:false,actualStageCanvasDocument:false,
  qualification:'Actual jsdom DOMParser import, shared application Scene5-to-29 adaptation, public CPU tree edits and physical Canvas document serialization/parse. No mock DOM, native browser parsing/rendering, GL staging, SVG A retention in saved C commands or global Arc approximation certificate.'};
}
`;
let provenance, window;
try {
  const requireFromApp=createRequire(resolve(app,'package.json'));
  const jsdomManifest=JSON.parse(await readFile(requireFromApp.resolve('jsdom/package.json'),'utf8'));
  assert.equal(jsdomManifest.version,'26.1.0');
  const {JSDOM}=requireFromApp('jsdom');
  window=new JSDOM('').window;
  const parser=new window.DOMParser();
  const parse=text=>{
    const doc=parser.parseFromString(text,'image/svg+xml');
    if(doc.getElementsByTagName('parsererror').length)throw Error('SVG XML parsing failed: '+doc.documentElement.textContent);
    return doc.documentElement;
  };
  const root=parse(preset.source);
  function malformedArc(index,value){
    const candidate=parse(preset.source);
    const path=Array.from(candidate.getElementsByTagName('path')).find(node=>/A/.test(node.getAttribute('d')||''));
    assert.ok(path,'Preset must contain an explicit uppercase A command');
    const d=path.getAttribute('d'),at=d.indexOf('A');
    const number=/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g;
    number.lastIndex=at+1;const tokens=[];
    for(let i=0;i<7;i++){const token=number.exec(d);assert.ok(token,'Arc must have seven numeric arguments');tokens.push(token);}
    const token=tokens[index];
    path.setAttribute('d',d.slice(0,token.index)+value+d.slice(token.index+token[0].length));
    return{root:candidate,source:new window.XMLSerializer().serializeToString(candidate)};
  }
  const badFlag=malformedArc(3,'2'),badRadius=malformedArc(0,'-10');
  const bundled=await bundleSvgArcImport(app,'node',consumerText,'svg-arc-import');
  provenance=bundled.provenance;assert.equal(provenance.sourcePin,sourcePin);assert.equal(provenance.sourcePin,preset.sourceProfile);
  assert.equal(provenance.verifiedBlobs,41);assert.equal(provenance.ownDistInputs,0);
  await mkdir(dirname(documentPath),{recursive:true});
  const consumer=await import('data:text/javascript;base64,'+Buffer.from(bundled.result.outputFiles[0].text).toString('base64'));
  const receipt=await consumer.runArcConsumer(root,badFlag.root,badRadius.root,preset.source,documentPath);
  const output={status:'passed',nodeVersion:process.version,provenance,failedCandidates:failures,
    domRuntime:{name:'jsdom',version:jsdomManifest.version,entry:requireFromApp.resolve('jsdom'),parser:'window.DOMParser',mock:false,bundledIntoProvider:false},
    invalidSources:{flag:badFlag.source,negativeRadius:badRadius.source},...receipt};
  await writeFile(evidencePath,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({status:output.status,provenance,domRuntime:output.domRuntime,counts:receipt.counts,
    edit:receipt.edit,document:receipt.physicalDocument,refusals:receipt.refusals.map(e=>e.code),actualGL:false}));
}catch(error){
  await writeFile(evidencePath,JSON.stringify({status:'failed',nodeVersion:process.version,source:preset.source,provenance,
    failedCandidates:[...failures,{name:error.name,code:error.code,message:error.message,stack:error.stack}]},null,2)+'\n');
  throw error;
}finally{window?.close();}
