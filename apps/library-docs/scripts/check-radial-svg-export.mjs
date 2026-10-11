import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { bundleRadialSvgExport } from './build-radial-svg-export.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(app, 'evidence/radial-svg-export-consumer.json');
const preset = JSON.parse(await readFile(resolve(app, 'scripts/snippets/radial-svg-export.json'), 'utf8'));
const previous = await readFile(evidence, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const failures = previous?.failedCandidates ?? [];
const consumerText = `
import assert from 'node:assert/strict';
import { parseSceneJSON, createDisplayTreeFromScene, exportSceneGradientSVG, Canvas2DError } from '@barocss/canvas2d';
import { serializeCanvasDocument, parseCanvasDocument } from '@barocss/canvas2d/document';
const source=${JSON.stringify(preset.source)},logicalSize={width:320,height:200};
const raw=JSON.parse(source),beforeRaw=structuredClone(raw);
const scene=parseSceneJSON(source);
assert.deepEqual(scene,raw);assert.notStrictEqual(scene,raw);
const original=exportSceneGradientSVG(scene,logicalSize);
assert.equal(original.ok,true,JSON.stringify(original.diagnostics));
assert.deepEqual(original.sourceIdMap.map(x=>x.sourceId),['RadialSVGExample','Background','GradientGroup','RadialPath']);
assert.deepEqual(raw,beforeRaw);assert.deepEqual(scene,raw);
const tree=createDisplayTreeFromScene(scene),path=tree.get('RadialPath');
assert.equal(path.kind,'path');assert.equal(path.data.fill.radial.radius,60);
const beforeData=structuredClone(path.data),fill=structuredClone(path.data.fill);
fill.radial.radius=90;
path.setPath({commands:structuredClone(path.data.commands),fill,stroke:structuredClone(path.data.stroke)});
const editedScene=tree.snapshot(),edited=exportSceneGradientSVG(editedScene,logicalSize);
assert.equal(edited.ok,true,JSON.stringify(edited.diagnostics));
assert.equal(path.data.fill.radial.radius,90);
assert.deepEqual(path.data.commands,beforeData.commands);assert.deepEqual(path.data.stroke,beforeData.stroke);
assert.deepEqual(path.data.fill.radial.center,beforeData.fill.radial.center);
assert.deepEqual(path.data.fill.radial.startColor,beforeData.fill.radial.startColor);
assert.deepEqual(path.data.fill.radial.endColor,beforeData.fill.radial.endColor);
assert.deepEqual(editedScene.nodes[0],scene.nodes[0]);
assert.deepEqual(editedScene.nodes[1].transform,scene.nodes[1].transform);
assert.equal(scene.nodes[1].children[0].fill.radial.radius,60);
const accepted=edited,beforeAccepted=structuredClone(accepted);
const unsupportedScene=structuredClone(scene);unsupportedScene.nodes[1].children[0].fill.radial.startColor[3]=.5;
const beforeUnsupported=structuredClone(unsupportedScene);
const unsupported=exportSceneGradientSVG(unsupportedScene,logicalSize);
assert.equal(unsupported.ok,false);assert.equal(Object.hasOwn(unsupported,'svg'),false);
assert.deepEqual(unsupported.diagnostics,[{nodeId:'RadialPath',code:'UNSUPPORTED_FEATURE',feature:'radial stop alpha must be 1'}]);
assert.deepEqual(unsupportedScene,beforeUnsupported);assert.deepEqual(accepted,beforeAccepted);
const invalidScene=structuredClone(scene);invalidScene.nodes[1].children[0].fill.radial.radius=0;
let invalid;try{exportSceneGradientSVG(invalidScene,logicalSize);}catch(error){invalid=error;}
assert.ok(invalid instanceof Canvas2DError);assert.equal(invalid.code,'INVALID_SCENE');
assert.deepEqual(accepted,beforeAccepted);
let assetLookups=0;
const documentText=await serializeCanvasDocument(editedScene,()=>{assetLookups++;throw Error('Unexpected external image');});
assert.equal(assetLookups,0);
const reopened=await parseCanvasDocument(documentText);
assert.equal(reopened.assets.size,0);assert.deepEqual(reopened.scene,editedScene);assert.notStrictEqual(reopened.scene,editedScene);
const reopenedTree=createDisplayTreeFromScene(reopened.scene);
assert.equal(reopenedTree.get('RadialPath').data.fill.radial.radius,90);
const reopenedExport=exportSceneGradientSVG(reopened.scene,logicalSize);
assert.deepEqual(reopenedExport,edited);
export const receipt={source,logicalSize,originalScene:scene,editedScene,original,edited,unsupported,invalid:{name:invalid.name,code:invalid.code,message:invalid.message},documentText,documentUTF8Bytes:new TextEncoder().encode(documentText).length,reopenedSourceIdMap:reopenedExport.sourceIdMap,assetLookups,assets:reopened.assets.size,radiusEdit:{before:60,after:90},callerInputsUnchanged:true,acceptedExportRetained:true,paintCommandsAndIdentityPreserved:true,actualStageCanvasDocument:false,actualGL:false,actualSVGImage:false,scope:'One public original parse/export, public copied tree/setPath radius edit, unsupported and malformed refusals, serialize/parse/new-tree/re-export roundtrip. Real fresh canvas staging and image decoding belong to the browser flow.'};
`;
const xmlTree = svg => JSON.parse(execFileSync('python3', ['-c',
  "import sys,json,xml.etree.ElementTree as E\ndef walk(e): return {'tag':e.tag.split('}')[-1],'attrs':e.attrib,'children':[walk(c) for c in e]}\nprint(json.dumps(walk(E.fromstring(sys.stdin.read()))))"],
{ input: svg, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
const flatten = node => [node, ...node.children.flatMap(flatten)];
let provenance;
try {
  const bundled = await bundleRadialSvgExport(app, 'node', consumerText);
  provenance = bundled.provenance;
  assert.equal(provenance.sourcePin, preset.sourceProfile);
  assert.equal(provenance.verifiedBlobs, 39); assert.equal(provenance.ownDistInputs, 0);
  const { receipt } = await import('data:text/javascript;base64,' + Buffer.from(bundled.result.outputFiles[0].text).toString('base64'));
  const inspectedXML = [receipt.original, receipt.edited].map((result, index) => {
    const tree = xmlTree(result.svg), nodes = flatten(tree);
    const gradient = nodes.find(node => node.tag === 'radialGradient');
    assert.deepEqual(gradient.attrs, { id:'C2DGradient1',gradientUnits:'userSpaceOnUse',spreadMethod:'pad',
      'color-interpolation':'sRGB',cx:'120',cy:'70',fx:'120',fy:'70',fr:'0',r:String(index ? 90 : 60) });
    assert.deepEqual(gradient.children.map(node => node.attrs), [
      {offset:'0','stop-color':'#f0b040','stop-opacity':'1'},
      {offset:'1','stop-color':'#2050b0','stop-opacity':'1'}]);
    const path = nodes.find(node => node.attrs.id === 'RadialPath');
    assert.equal(path.attrs.d, 'M 0 40 Q 120 -20 240 40 L 240 140 L 0 140 Z');
    assert.equal(path.attrs.fill, 'url(#C2DGradient1)'); assert.equal(path.attrs['fill-opacity'], '1');
    assert.equal(path.attrs['stroke-linecap'], 'butt'); assert.equal(path.attrs['stroke-linejoin'], 'bevel');
    assert.equal(tree.attrs.viewBox, '0 0 320 200');
    assert.equal(nodes.filter(node => node.tag.endsWith('Gradient')).length, 1);
    return {radius:Number(gradient.attrs.r),gradientAttributes:gradient.attrs,stopAttributes:gradient.children.map(node=>node.attrs),pathAttributes:path.attrs,svgUTF8Bytes:Buffer.byteLength(result.svg)};
  });
  const output = {status:'passed',nodeVersion:process.version,sourceSHA256:createHash('sha256').update(preset.source).digest('hex'),
    provenance,failedCandidates:failures,...receipt,inspectedXML};
  await writeFile(evidence, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({status:output.status,sourceUTF8Bytes:Buffer.byteLength(preset.source),svgUTF8Bytes:inspectedXML.map(x=>x.svgUTF8Bytes),documentUTF8Bytes:receipt.documentUTF8Bytes,radiusEdit:receipt.radiusEdit,refusals:[receipt.unsupported.diagnostics,receipt.invalid],provenance}));
} catch (error) {
  await writeFile(evidence, JSON.stringify({status:'failed',provenance,failedCandidates:[...failures,{source:preset.source,nodeVersion:process.version,name:error.name,code:error.code,message:error.message,stack:error.stack}]}, null, 2) + '\n');
  throw error;
}
