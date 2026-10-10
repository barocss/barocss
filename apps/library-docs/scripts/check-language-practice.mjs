import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { app, bundleExample, pin } from './example-runtime.mjs';
import { readGallery } from './gallery-input.mjs';

// A separate six-input consumer. It does not replay or redefine the old gallery.
const keys = ['cad-weighted-parameters', 'cad-curved-extrude', 'cad-nonunit-curve', 'gpu-rounded-stack', 'gpu-crossed-capsules', 'material-transition-window'];
const kinds = ['surface', 'surface', 'curve', 'scene', 'scene', 'material'];
const catalog = await readGallery();
const gallery = Object.fromEntries(keys.map((key, index) => {
  const preset = catalog[key];
  if (!preset || preset.kind !== kinds[index]) throw Error(`Missing selected practice input: ${key}`);
  // Expected metadata is deliberately excluded from the executable consumer.
  return [key, { kind: preset.kind, source: preset.source, sourceVersion: preset.sourceVersion }];
}));
const directory = resolve(app, 'docs/.vitepress/cache');
await mkdir(directory, { recursive: true });
const entry = resolve(directory, 'language-practice-consumer.mjs');
await writeFile(entry, `
import assert from 'node:assert/strict';
import { compileCadModel, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface, sampleCurve, tessellateSurface } from '@barocss/cad';
import { compileGpu, parseScene, compileMeshMaterial, lowerMeshMaterial, prepareMesh } from '@barocss/gpu';
const gallery = ${JSON.stringify(gallery)};
const results = [];
const close = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((value, index) => assert.ok(Number.isFinite(value) && Math.abs(value - expected[index]) <= 1e-10, label + ': ' + index));
};
const edit = (source, from, to) => {
  assert.equal(source.split(from).length, 2, 'Edit must target exactly one source occurrence');
  return source.replace(from, to);
};
const cad = (source, sourceVersion) => {
  const result = compileCadModel(source, { sourceVersion });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.ir.sourceVersion, sourceVersion);
  assert.equal(result.ir.schemaVersion, sourceVersion === 2 ? 2 : 1);
  assert.equal(result.model.version, 0);
  assert.equal(result.model.lengthUnit, 'mm');
  return result;
};
const parameters = result => Object.fromEntries(result.ir.parameters.map(p => [p.id, { value: p.value, unit: p.unit }]));
const preview = surface => {
  assert.deepEqual(surfaceDomain(surface), { u: [0,1], v: [0,1] });
  const mesh = tessellateSurface(surface, { countU: 17, countV: 17, revision: 0 });
  assert.equal(mesh.report.vertexCount, 289);
  assert.equal(mesh.report.triangleCount, 512);
  assert.equal(mesh.report.certified, false);
  assert.deepEqual(mesh.report.domain, { u: [0,1], v: [0,1] });
  const buffers = prepareMesh(mesh.packet, { mmToSceneUnit: .01, translate: [0,0,0], color: [.2,.6,.9], background: [0,0,0] });
  assert.ok(buffers.positions instanceof Float32Array);
  assert.ok(buffers.normals instanceof Float32Array);
  assert.ok(buffers.indices instanceof Uint16Array);
  assert.equal(buffers.positions.length, 867);
  assert.equal(buffers.normals.length, 867);
  assert.equal(buffers.indices.length, 1536);
  close([...buffers.positions.slice(432,435)], mesh.packet.positions.slice(432,435).map(n => Math.fround(n * .01)), 'Display center conversion');
  return { domain: mesh.report.domain, vertices: mesh.report.vertexCount, triangles: mesh.report.triangleCount, certified: mesh.report.certified, positionComponents: buffers.positions.length, indexComponents: buffers.indices.length, mmToSceneUnit: .01, displayCenter: [...buffers.positions.slice(432,435)] };
};
{
  const key = 'cad-weighted-parameters', preset = gallery[key];
  assert.equal(preset.sourceVersion, 2);
  const accepted = cad(preset.source, 2), snapshot = structuredClone(accepted);
  assert.deepEqual(accepted.model.objects.map(o => o.id), ['patch']);
  assert.deepEqual(parameters(accepted), { width: { value: 40, unit: 'mm' }, height: { value: 20, unit: 'mm' }, lift: { value: 10, unit: 'mm' }, cornerWeight: { value: 3, unit: '1' } });
  const surface = accepted.model.objects[0], center = evaluateSurface(surface,.5,.5);
  close(center, [80/3,40/3,5], key);
  const initialPreview = preview(surface);
  const changed = cad(edit(preset.source,'value: 3;','value: 1;'),2);
  assert.equal(parameters(changed).cornerWeight.value, 1);
  const editedCenter = evaluateSurface(changed.model.objects[0],.5,.5);
  close(editedCenter,[20,10,2.5], key + ' edited');
  const editedPreview = preview(changed.model.objects[0]);
  const refused = compileCadModel(edit(preset.source,'value: 3;','value: 0;'),{sourceVersion:2});
  assert.equal(refused.ok,false);
  assert.equal(refused.diagnostics[0].code,'WEIGHTS');
  assert.deepEqual(accepted,snapshot,'Refused candidate must not mutate accepted CPU value');
  results.push({ key, sourceVersion:2, parameters:parameters(accepted), centerMM:center, editedCenterMM:editedCenter, initialPreview, editedPreview, refused:refused.diagnostics[0].code, acceptedCPUValueRetained:true });
}
{
  const key = 'cad-curved-extrude', preset = gallery[key];
  assert.equal(preset.sourceVersion,2);
  const accepted = cad(preset.source,2);
  assert.deepEqual(accepted.model.objects.map(o => o.id),['profile','wall']);
  assert.deepEqual(parameters(accepted),{ span:{value:40,unit:'mm'}, bow:{value:20,unit:'mm'}, height:{value:30,unit:'mm'} });
  assert.equal(accepted.constructions.length,1);
  const wall = accepted.model.objects.find(o => o.id === 'wall'), center = evaluateSurface(wall,.5,.5);
  close(center,[20,10,15],key);
  const initialPreview = preview(wall);
  const changed = cad(edit(preset.source,'value: 2 cm;','value: 4 cm;'),2);
  assert.equal(parameters(changed).bow.value,40);
  const editedWall = changed.model.objects.find(o => o.id === 'wall'), editedCenter = evaluateSurface(editedWall,.5,.5);
  close(editedCenter,[20,20,15],key + ' edited');
  results.push({ key, sourceVersion:2, parameters:parameters(accepted), centerMM:center, editedCenterMM:editedCenter, initialPreview, editedPreview:preview(editedWall) });
}
{
  const key = 'cad-nonunit-curve', preset = gallery[key];
  assert.equal(preset.sourceVersion,0);
  const accepted = cad(preset.source,0), curve = accepted.model.objects[0];
  assert.deepEqual(accepted.model.objects.map(o => o.id),['quarter']);
  assert.deepEqual(curveDomain(curve),[2,7]);
  const midpoint = evaluateCurve(curve,4.5);
  close(midpoint,[14.14213562373095,14.14213562373095,0],key);
  const samples = sampleCurve(curve,101);
  assert.equal(samples.length,101);
  assert.equal(samples[0].parameter,2); assert.equal(samples[100].parameter,7);
  close(samples[0].point,[20,0,0],key + ' start'); close(samples[100].point,[0,20,0],key + ' end');
  const changed = cad(edit(preset.source,'weights: [1,0.7071067811865476,1];','weights: [1,1,1];'),0);
  assert.deepEqual(curveDomain(changed.model.objects[0]),[2,7]);
  const editedMidpoint = evaluateCurve(changed.model.objects[0],4.5);
  close(editedMidpoint,[15,15,0],key + ' edited');
  results.push({ key, sourceVersion:0, domain:curveDomain(curve), midpointParameter:4.5, midpointMM:midpoint, editedMidpointMM:editedMidpoint, sampleCount:samples.length, endpointParameters:[samples[0].parameter,samples[100].parameter] });
}
const scene = source => {
  const compiled = compileGpu({ kind:'scene', source, sourceVersion:1 });
  assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
  assert.equal(compiled.ir.schemaVersion,2); assert.equal(compiled.ir.pipeline,'sdf');
  assert.equal(compiled.ir.angleUnit,'deg'); assert.equal(compiled.ir.rotationOrder,'X-Y-Z');
  assert.equal(compiled.execution.kind,'sdf');
  const parsed = parseScene(source,{sourceVersion:1});
  assert.equal(parsed.version,1);
  assert.deepEqual(compiled.execution.scene,parsed);
  assert.deepEqual(compiled.ir.draws.map(o => [o.id,o.kind]),parsed.objects.map(o => [o.id,o.type]));
  return { compiled, parsed };
};
const byId = (value,id) => { const object = value.objects.find(o => o.id === id); assert.ok(object,id); return object; };
{
  const key = 'gpu-rounded-stack', preset = gallery[key]; assert.equal(preset.sourceVersion,1);
  const accepted = scene(preset.source), snapshot = structuredClone(accepted);
  const objects = accepted.parsed.objects;
  assert.deepEqual(objects.map(o => [o.id,o.type]),[['base','box'],['left','rounded-box'],['center','rounded-box'],['right','rounded-box']]);
  close(byId(accepted.parsed,'base').size,[3.8,.2,1.5],key + ' base size');
  for(const [id,radius,rotation,translation] of [['left',.2,[0,-20,0],[-1.2,-.6,0]],['center',.06,[0,20,0],[0,0,0]],['right',.2,[0,-20,15],[1.2,.6,0]]]){
    const object=byId(accepted.parsed,id); assert.equal(object.radius,radius); close(object.size,[.9,.8,.7],id+' size'); close(object.rotateDegrees,rotation,id+' rotation'); close(object.translate,translation,id+' translation');
  }
  const changed=scene(edit(preset.source,'rounded-box { radius: .2; }','rounded-box { radius: .3; }'));
  assert.deepEqual(['left','center','right'].map(id => byId(changed.parsed,id).radius),[.3,.06,.3]);
  const refused=compileGpu({kind:'scene',source:edit(preset.source,'rounded-box { radius: .2; }','rounded-box { radius: .4; }'),sourceVersion:1});
  assert.equal(refused.ok,false); assert.equal(refused.diagnostics[0].code,'VALIDATION');
  assert.deepEqual(accepted,snapshot,'Refused scene must not mutate accepted CPU value');
  results.push({ key, sourceVersion:1, objects, editedRadii:['left','center','right'].map(id => ({id,radius:byId(changed.parsed,id).radius})), refused:refused.diagnostics[0].code, acceptedCPUValueRetained:true });
}
{
  const key='gpu-crossed-capsules',preset=gallery[key]; assert.equal(preset.sourceVersion,1);
  const accepted=scene(preset.source),objects=accepted.parsed.objects;
  assert.deepEqual(objects.map(o => [o.id,o.type]),[['frame','torus'],['left','capsule'],['right','capsule'],['center','sphere']]);
  const frame=byId(accepted.parsed,'frame'); assert.equal(frame.majorRadius,1.05); assert.equal(frame.minorRadius,.12); close(frame.rotateDegrees,[90,0,0],'torus rotation'); close(frame.translate,[0,.2,-.2],'torus translation');
  const capsuleDimensions=[];
  for(const [id,angle] of [['left',40],['right',-40]]){
    const object=byId(accepted.parsed,id); assert.equal(object.radius,.12); close(object.start,[0,-.65,0],id+' local start'); close(object.end,[0,.65,0],id+' local end'); close(object.rotateDegrees,[0,0,angle],id+' rotation'); close(object.translate,[0,.2,0],id+' translation');
    const centerSegmentLength=Math.hypot(...object.end.map((n,i)=>n-object.start[i]));
    const localOverallYExtent=Math.abs(object.end[1]-object.start[1])+2*object.radius;
    assert.ok(Math.abs(centerSegmentLength-1.3)<1e-10); assert.ok(Math.abs(localOverallYExtent-1.54)<1e-10);
    capsuleDimensions.push({id,centerSegmentLength,localOverallYExtent});
  }
  const center=byId(accepted.parsed,'center'); assert.equal(center.radius,.22); close(center.translate,[0,.2,.15],'sphere translation');
  const changed=scene(edit(preset.source,'rotate-x: 90deg;','rotate-x: 0deg;'));
  close(byId(changed.parsed,'frame').rotateDegrees,[0,0,0],'edited torus rotation');
  results.push({ key, sourceVersion:1, objects, capsuleDimensions, editedFrameRotationDegrees:byId(changed.parsed,'frame').rotateDegrees });
}
{
  const key='material-transition-window',source=gallery[key].source;
  assert.ok(source.includes('smoothstep(.25,.75,clamp(amount*1.5-.25,0,1))'));
  const compiled=compileMeshMaterial(source); assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
  const material=compiled.material,lowered=lowerMeshMaterial(material);
  assert.equal(material.version,0); assert.equal(material.profile,'mesh-opaque-fragment-v0'); assert.equal(material.shaderId,'transition_window');
  assert.deepEqual(material.uniforms,[{name:'amount',type:'float',min:0,max:1,default:0}]);
  assert.deepEqual(lowered.uniformLayout,[{name:'amount',type:'float',min:0,max:1,default:0,glslName:'mat_u_0'}]);
  assert.equal(lowered.uniformDeclarations,'uniform float mat_u_0;');
  assert.equal(material.expression.kind,'call'); assert.equal(material.expression.name,'mix');
  const [cold,warm,ratio]=material.expression.args; assert.equal(cold.hex,'#1860B4'); assert.equal(warm.hex,'#F0D060');
  assert.equal(ratio.kind,'call'); assert.equal(ratio.name,'clamp'); assert.equal(ratio.args[1].value,0); assert.equal(ratio.args[2].value,1);
  const nodes=[]; const visit=node => { nodes.push(node); if(node.args)node.args.forEach(visit); if(node.left)visit(node.left); if(node.right)visit(node.right); if(node.value && typeof node.value==='object')visit(node.value); }; visit(ratio);
  assert.equal(nodes.filter(n=>n.kind==='uniform' && n.name==='amount').length,3);
  assert.equal(nodes.filter(n=>n.kind==='call' && n.name==='clamp').length,7);
  assert.ok(nodes.some(n=>n.kind==='float' && n.value===1.5)); assert.ok(nodes.some(n=>n.kind==='float' && n.value===.25)); assert.ok(nodes.some(n=>n.kind==='float' && n.value===2));
  assert.ok(lowered.expression.includes('mix(') && lowered.expression.includes('mat_u_0'));
  assert.ok(!lowered.expression.includes('smoothstep') && !lowered.expression.includes('ratio') && !lowered.expression.includes('rgb('));
  results.push({key,profile:material.profile,shaderId:material.shaderId,uniformLayout:lowered.uniformLayout,paletteHex:[cold.hex,warm.hex],expandedRatioClampNodes:7,expandedAmountReferences:3,loweredExpression:lowered.expression,numericShaderEvaluation:'not executed; only source shape, public compile and lowering checked'});
}
assert.equal(results.length,6);
export const receipt={results,scope:'Selected six-input CPU public consumer only',drawing:'not executed',rendererRetention:'not checked; retention refers to accepted CPU values only',sourceProfile:'Original source5f; no newer CPU material evaluator'};
`);

let provenance;
try {
  const bundle = await bundleExample(entry, 'node');
  provenance = bundle.provenance;
  if (provenance.sourcePin !== pin || provenance.ownDistInputs !== 0) throw Error('Unexpected source provenance');
  const { receipt } = await import('data:text/javascript;base64,' + Buffer.from(bundle.result.outputFiles[0].text).toString('base64'));
  await writeFile(resolve(app, 'evidence/language-practice-consumer.json'), JSON.stringify({ status:'passed', nodeVersion:process.version, selectedKeys:keys, inputs:keys.map(key => ({key,sourceSHA256:createHash('sha256').update(gallery[key].source).digest('hex')})), provenance, ...receipt }, null, 2) + '\n');
  console.log(JSON.stringify({ status:'passed', selectedInputs:receipt.results.length, ownSourceInputs:provenance.ownSourceInputs, ownDistInputs:provenance.ownDistInputs }));
} catch (error) {
  await writeFile(resolve(app, 'evidence/language-practice-consumer.json'), JSON.stringify({ status:'failed', nodeVersion:process.version, selectedKeys:keys, provenance, firstFailure:error instanceof Error ? {name:error.name,message:error.message,stack:error.stack} : String(error), drawing:'not executed' }, null, 2) + '\n');
  throw error;
}
