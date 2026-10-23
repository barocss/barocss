import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const args = process.argv.slice(2); assert.equal(args.length, 2, 'Usage: node qualified-strip-binary-stl-demo.mjs --source <output-directory>'); assert.equal(args[0], '--source');
const repo = resolve(fileURLToPath(new URL('../../', import.meta.url))), output = resolve(args[1]); assert.ok(!existsSync(output), 'Use a fresh output directory; preserve earlier attempts'); mkdirSync(output, {recursive: true});
process.on('uncaughtException',error=>{const failure={name:error.name,message:error.message,stack:error.stack,code:error.code??null,context:error.context??null,cause:error.cause?{name:error.cause.name,message:error.cause.message,code:error.cause.code??null}:null};writeFileSync(resolve(output,'first-failure.json'),JSON.stringify(failure,null,2)+'\n',{flag:'wx'});console.error(error);process.exitCode=1;});
const candidate=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:repo,encoding:'utf8'}).trim(),'','The first flow requires a clean immutable candidate');
writeFileSync(resolve(output,'candidate.json'),JSON.stringify({candidate,nodeVersion:process.version,depsRoot:process.env.REPO_DEPS_ROOT??repo})+'\n',{flag:'wx'});
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? repo, 'package.json')), esbuild = require('esbuild'), entry = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundle = await esbuild.build({absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true}); assert.equal(bundle.outputFiles.length, 1);
const sourceInputs = Object.keys(bundle.metafile.inputs).map(path => resolve(repo, path)), cadInputs = sourceInputs.filter(path => path.includes('/packages/barocss-cad/'));
for (const leaf of ['translated-strip/qualified-strip-binary-stl.ts','qualified-strip-binary-stl-encoding-internal.ts','translated-strip/qualified-translated-strip-body-mesh.ts','translated-strip/qualified-translated-strip-body-mesh-domain-internal.ts','translated-strip/qualified-translated-strip-body.ts', 'translated-strip/qualified-translated-strip-material-internal.ts', 'translated-strip/translated-surface-base-face.ts', 'translated-strip/translated-surface-strip-volume.ts', 'index.ts', 'translated-strip/translated-surface-end-faces.ts', 'exact-proof/exact-surface-lower-trim.ts', 'features/section-exact-surface-binding.ts', 'paired/paired-section-plane-cap.ts', 'core/boundary.ts', 'intersect/multispan-vlinear-plane-section.ts', 'section-rational-internal.ts', 'nurbs/source-wide/source-surface-control-net.ts']) assert.ok(cadInputs.includes(resolve(repo, 'packages/barocss-cad/src', leaf)), leaf);
assert.ok(cadInputs.every(path => path.startsWith(resolve(repo, 'packages/barocss-cad/src') + '/'))); assert.ok(!sourceInputs.some(path => path.includes('/packages/barocss-cad/dist/')));
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const {tessellateQualifiedTranslatedStripBody:mesh,validateQualifiedTranslatedStripBodyMesh:validateMesh,QualifiedTranslatedStripBodyMeshDiagnosticCode:codes,
 buildQualifiedTranslatedStripBody:buildBody,buildTranslatedSurfaceBaseFace:buildBase,buildTranslatedSurfaceEndFaces:buildEnds,measureTranslatedSurfaceStripVolume:measureVolume,
 buildExactSurfaceLowerTrim:buildWall,buildSectionExactSurfaceBinding:buildBinding,buildMultiSpanVLinearSurfacePlaneSection:buildSection,buildPairedSectionPlaneCap:buildCap,
 compileCadModel}=api;
const meshRuntimeNames=['tessellateQualifiedTranslatedStripBody','validateQualifiedTranslatedStripBodyMesh','QualifiedTranslatedStripBodyMeshError','QualifiedTranslatedStripBodyMeshDiagnosticCode'];
for(const name of meshRuntimeNames)assert.equal(typeof api[name],name.endsWith('Code')?'object':'function');assert.deepEqual(Object.keys(codes).sort(),['INPUT','BUDGET','BODY','SOURCE','TOPOLOGY','UV','NATIVE','ORIENTATION','REPRESENTABILITY','FILE','OWNED'].sort());
const files = new Map(), retained = [], failures = [], parentGroups = [];
function nativeJSON(value) { if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); } if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']'; return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}'; }
function jsonFile(name, value) { const file = resolve(output, name + '.json'); const text = nativeJSON(value) + '\n', limit = /stl-result/.test(name)?8388608:/stl-request|mesh-request|mesh-result/.test(name)?4194304:/complete-body-request|owned-body/.test(name)?2097152:1048576; assert.ok(text.length <= limit && Buffer.byteLength(text, 'utf8') <= limit, name + ' file size'); writeFileSync(file, text); files.set(file, readFileSync(file)); const reopened = JSON.parse(readFileSync(file, 'utf8')); assert.deepEqual(reopened, value); return {file, reopened}; }
function sourceFile(name, source, model) { const file = resolve(output, name + '.source0.css'); assert.ok(source.length <= 262144 && Buffer.byteLength(source, 'utf8') <= 262144, name + ' source size'); writeFileSync(file, source); files.set(file, readFileSync(file)); const cold = compileCadModel(readFileSync(file, 'utf8'), {sourceVersion: 0}); assert.equal(cold.ok, true, JSON.stringify(cold.diagnostics)); assert.deepEqual(cold.model, model); return file; }
function ownership(inputs, result) { const caller = new WeakSet(), seen = new WeakSet(); const collect = value => { if (value && typeof value === 'object' && !caller.has(value)) { caller.add(value); Object.values(value).forEach(collect); }}; inputs.forEach(collect); const visit = value => { if (value && typeof value === 'object') { assert.ok(!caller.has(value), 'Caller alias'); assert.ok(!seen.has(value), 'Repeated result occurrence'); seen.add(value); Object.values(value).forEach(visit); }}; visit(result); }
function decimal(value) { if (Object.is(value, -0)) return '-0'; const text = String(value); if (!text.includes('e')) return text; const [mantissa, exponentText] = text.split('e'), negative = mantissa.startsWith('-'), raw = negative ? mantissa.slice(1) : mantissa, [whole, fraction = ''] = raw.split('.'), digits = whole + fraction, place = whole.length + Number(exponentText), expanded = place <= 0 ? '0.' + '0'.repeat(-place) + digits : place >= digits.length ? digits + '0'.repeat(place - digits.length) : digits.slice(0, place) + '.' + digits.slice(place); return (negative ? '-' : '') + expanded; }
function modelSource(model) { const list = values => '[' + values.map(decimal).join(',') + ']', poles = points => '[' + points.map(list).join(',') + ']'; const object = item => item.kind === 'curve' ? '@curve #' + item.id + ' {type:nurbs;degree:' + item.degree + ';knots:' + list(item.knots) + ';control-points:' + poles(item.controlPoints) + ';weights:' + list(item.weights) + ';}' : '@surface #' + item.id + ' {type:nurbs;degree-u:' + item.degreeU + ';degree-v:' + item.degreeV + ';knots-u:' + list(item.knotsU) + ';knots-v:' + list(item.knotsV) + ';control-points:[' + item.controlPoints.map(poles).join(',') + '];weights:[' + item.weights.map(list).join(',') + '];}'; return '@model ' + model.name + ' {version:0;length-unit:mm;' + model.objects.map(object).join('') + '}\n'; }
function asset(sourceId, model, surface, name = sourceId) { const source = modelSource(model); sourceFile(name + '.original-whole', source, model); const result = {sourceId, source, surface}; retained.push({value: result, before: structuredClone(result)}); return result; }
const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; }, fraction = (n, d = 1n) => { assert.ok(d > 0n); const g = gcd(n, d); return [n / g, d / g]; };
const add = (a, b) => fraction(a[0] * b[1] + b[0] * a[1], a[1] * b[1]), sub = (a, b) => add(a, [-b[0], b[1]]), mul = (a, b) => fraction(a[0] * b[0], a[1] * b[1]);
const compare = (a, b) => a[0] * b[1] < b[0] * a[1] ? -1 : a[0] * b[1] > b[0] * a[1] ? 1 : 0, published = value => { assert.deepEqual(Object.keys(value).sort(), ['numerator', 'denominator'].sort()); const result = fraction(BigInt(value.numerator), BigInt(value.denominator)); assert.equal(result[0].toString(), value.numerator); assert.equal(result[1].toString(), value.denominator); return result; };
function represented(value) { if (value === 0) return [0n, 1n]; const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false); const raw = view.getBigUint64(0, false), negative = raw >> 63n, exponent = Number((raw >> 52n) & 2047n), mantissa = (raw & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n), power = exponent ? exponent - 1075 : -1074; return fraction((negative ? -mantissa : mantissa) * (power >= 0 ? 1n << BigInt(power) : 1n), power < 0 ? 1n << BigInt(-power) : 1n); }
const asDTO = value => ({numerator: value[0].toString(), denominator: value[1].toString()}), maximum = values => values.reduce((a, b) => compare(a, b) >= 0 ? a : b, [0n, 1n]);
function warpedSurface(id, breaks = [0, 1, 2, 3, 4], offsetY = 0, offsetX = 0, vDomain = [0, 1]) {
  const rows = [[[0, 0, 0], [0, 1, 8]]];
  for (let a = 0; a < breaks.length - 1; a++) rows.push([[10 * a + 5, 2 * a * a + 2 * a, 0], [10 * a + 5, 1 + 3 * a * a + 3 * a, 8]], [[10 * (a + 1), 2 * (a + 1) ** 2, 0], [10 * (a + 1), 1 + 3 * (a + 1) ** 2, 8]]);
  return {kind: 'surface', id, degreeU: 2, degreeV: 1, knotsU: [...Array(3).fill(breaks[0]), ...breaks.slice(1, -1).flatMap(value => [value, value]), ...Array(3).fill(breaks.at(-1))], knotsV: [vDomain[0], vDomain[0], vDomain[1], vDomain[1]], controlPoints: rows.map(row => row.map(point => [point[0] + offsetX, point[1] + offsetY, point[2]])), weights: rows.map(() => [1, 1])};
}
const planeSurface = (id, ySize = 64, u = [0, 1], v = [0, 1]) => ({kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [u[0], u[0], u[1], u[1]], knotsV: [v[0], v[0], v[1], v[1]], controlPoints: [[[0, 0, 2], [0, ySize, 2]], [[64, 0, 6], [64, ySize, 6]]], weights: [[1, 1], [1, 1]]});
const siblingCurve = id => ({kind: 'curve', id, degree: 1, knots: [-0, -0, 1, 1], controlPoints: [[-0, 0, 0], [1, 1, 0]], weights: [1, 1]});
const sectionOptions = name => ({evaluationId: name + '_section', curveId: name + '_cut', surfacePcurveId: name + '_surface_uv', planePcurveId: name + '_plane_uv', maximumObservations: 17});

function makeParents(name, lowerSurface, upperSurface, plane = planeSurface('original_shared_plane'), upperAssetInput = null, lowerAssetInput = null, planeAssetInput = null) {
  const main = name === 'main', shortPrefix = name.slice(0, 8), loPrefix = main ? 'low' : shortPrefix + '_lo', hiPrefix = main ? 'high' : shortPrefix + '_hi', planePrefix = main ? 'original_plane' : name + '_plane';
  const lowerAsset = lowerAssetInput ?? asset(loPrefix + '_source', {name: loPrefix + '_model', version: 0, lengthUnit: 'mm', objects: [siblingCurve(loPrefix + '_unused'), lowerSurface]}, lowerSurface), upperAsset = upperAssetInput ?? asset(hiPrefix + '_source', {name: hiPrefix + '_model', version: 0, lengthUnit: 'mm', objects: [siblingCurve(hiPrefix + '_unused'), upperSurface]}, upperSurface), planeAsset = planeAssetInput ?? asset(planePrefix + '_source', {name: planePrefix + '_model', version: 0, lengthUnit: 'mm', objects: [siblingCurve(planePrefix + '_unused'), plane]}, plane);
  const sectionRequest = (side, original) => ({surfaceAsset: original, planeAsset, options: main ? {evaluationId: (side === 'lo' ? 'low' : 'high') + '_section', curveId: (side === 'lo' ? 'low' : 'high') + '_cut', surfacePcurveId: (side === 'lo' ? 'low' : 'high') + '_old_surface_uv', planePcurveId: (side === 'lo' ? 'low' : 'high') + '_plane_uv', maximumObservations: 17} : sectionOptions(name + '_' + side)}), lowRequest = sectionRequest('lo', lowerAsset), highRequest = sectionRequest('hi', upperAsset);
  const request = jsonFile(name + '.authored-three-parent-request', {lower: lowRequest, upper: highRequest});
  const lowSection = buildSection(lowerAsset, planeAsset, lowRequest.options), highSection = buildSection(upperAsset, planeAsset, highRequest.options);
  const lowBinding = buildBinding(lowSection, {evaluationId: main ? 'low_binding' : name + '_lo_binding', pcurveId: main ? 'low_exact_uv' : name + '_lo_bound_uv', maximumObservations: 17}), highBinding = buildBinding(highSection, {evaluationId: main ? 'high_binding' : name + '_hi_binding', pcurveId: main ? 'high_exact_uv' : name + '_hi_bound_uv', maximumObservations: 17});
  const lowerWall = buildWall(lowBinding, {evaluationId: main ? 'low_wall' : name + '_lo_wall', resultIdPrefix: main ? 'low' : shortPrefix + '_lo', orientation: 'forward', maximumObservations: 40}), upperWall = buildWall(highBinding, {evaluationId: main ? 'high_wall' : name + '_hi_wall', resultIdPrefix: main ? 'high' : shortPrefix + '_hi', orientation: 'reverse', maximumObservations: 40}), cap = buildCap(lowSection, highSection, {evaluationId: name + '_cap', resultIdPrefix: shortPrefix + '_cap', maximumSections: 2, maximumConnectors: 2, maximumObservations: 40});
  assert.deepEqual(lowSection.surfaceAsset, lowerAsset); assert.deepEqual(highSection.surfaceAsset, upperAsset); assert.deepEqual(cap.lower, lowerWall.binding.section); assert.deepEqual(cap.upper, upperWall.binding.section);
  for (const [side, section] of [['lower', lowSection], ['upper', highSection]]) { for (const [i, original] of [section.surfaceAsset, section.planeAsset].entries()) sourceFile(name + '.' + side + '.original_' + i, original.source, section.originalModels[i]); sourceFile(name + '.' + side + '.world-cut', section.world.source, section.world.model); jsonFile(name + '.' + side + '.whole-section', section); jsonFile(name + '.' + side + '.new-surface-uv', (side === 'lower' ? lowBinding : highBinding).pcurve); }
  sourceFile(name+'.lower-wall-world',lowerWall.world.source,lowerWall.world.model);sourceFile(name+'.upper-wall-world',upperWall.world.source,upperWall.world.model);sourceFile(name+'.cap-world',cap.world.source,cap.world.model);jsonFile(name + '.full-lower-wall', lowerWall); jsonFile(name + '.full-upper-wall', upperWall); jsonFile(name + '.full-cap', cap); const parents = {lowerWall, upperWall, cap}; retained.push({value: parents, before: structuredClone(parents)}); parentGroups.push({name, requestFile: request.file}); return parents;
}

const bodyOptions = name => ({evaluationId:name+'_body_eval',resultIdPrefix:name,maximumParents:3,maximumModels:2,maximumObservations:24});
function children(name, parents, lineIds = ['closure_base_left','closure_base_right']) {
  const prefix=name.slice(0,7), [baseLeftCurveId,baseRightCurveId]=lineIds;
  const base=buildBase(parents.lowerWall,parents.upperWall,{evaluationId:name+'_base_eval',resultIdPrefix:prefix+'_b',baseLeftCurveId,baseRightCurveId,maximumParents:2,maximumObservations:40});
  const ends=buildEnds(parents.lowerWall,parents.upperWall,parents.cap,{evaluationId:name+'_ends_eval',resultIdPrefix:prefix+'_e',baseLeftCurveId,baseRightCurveId,maximumParents:3,maximumObservations:24});
  const volume=measureVolume(parents.lowerWall,parents.upperWall,parents.cap,{evaluationId:name+'_volume_eval',maximumParents:3,maximumObservations:17});
  for(const [kind,child] of [['base',base],['ends',ends],['volume',volume]])jsonFile(name+'.full-qualified-'+kind,child);sourceFile(name+'.base-world-model',base.world.source,base.world.model);sourceFile(name+'.ends-world-model',ends.world.source,ends.world.model);const value={base,ends,volume}; retained.push({value,before:structuredClone(value)}); return value;
}
const meshOptions=name=>({evaluationId:name+'_mesh_eval',meshId:name+'_mesh',subdivisionsPerOriginalUSpan:4,subdivisionsT:4,subdivisionsW:4,maximumVertices:290,maximumTriangles:576,maximumNativeSamples:1104});
const difference=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],normal=(a,b,c)=>{const n=cross(difference(b,a),difference(c,a)),length=Math.hypot(...n);assert.ok(length>0&&Number.isFinite(length));return n.map(v=>v/length);};
const fileSize=value=>{const s=nativeJSON(value)+'\n';return {utf16:s.length,utf8:Buffer.byteLength(s,'utf8')};};
function makeBody(name,parents,expected){const input=children(name,parents,[name+'_base_left',name+'_base_right']),options=bodyOptions(name),request=jsonFile(name+'.complete-body-request',{...input,options}),body=buildBody(input.base,input.ends,input.volume,options);assert.ok(existsSync(request.file));assert.equal(body.report.volumeMM3,expected);assert.deepEqual(body.report.exactVolumeMM3,asDTO(represented(expected)));assert.deepEqual(body.models.map(m=>m.model.objects.length),[16,2]);assert.equal(body.proof.material.restrictedSolidCertified,true);assert.equal(body.report.quality.wholeBodyEmbedding,true);for(const [i,model]of body.models.entries())sourceFile(name+'.body-model'+i,model.source,model.model);jsonFile(name+'.owned-body',body);retained.push({value:body,before:structuredClone(body)});return body;}

// The oracle below deliberately does not call the encoder's rational helpers.
const {exportQualifiedTranslatedStripBodyBinaryStl:exportStl,validateQualifiedTranslatedStripBodyBinaryStl:validateStl,QualifiedTranslatedStripBodyBinaryStlError:StlError}=api;
const runtimeNames=['exportQualifiedTranslatedStripBodyBinaryStl','validateQualifiedTranslatedStripBodyBinaryStl','QualifiedTranslatedStripBodyBinaryStlError','QualifiedTranslatedStripBodyBinaryStlDiagnosticCode'];
const typeNames=['QualifiedTranslatedStripBodyBinaryStlOptions','QualifiedTranslatedStripBodyBinaryStlVertexLoss','QualifiedTranslatedStripBodyBinaryStlReport','QualifiedTranslatedStripBodyBinaryStlResult'];
for(const name of runtimeNames)assert.equal(typeof api[name],name.endsWith('Code')?'object':'function');
const options={evaluationId:'main_stl_export',maximumVertices:290,maximumTriangles:576,maximumBytes:28884};
const headerASCII='BaroCSS binary STL | mm convention | approximate facets';
function lossOracle(packet,report){
  const rows=packet.vertices.map((vertex,index)=>{
    const original=packet.positionsMM.slice(index*3,index*3+3),rounded=original.map(Math.fround),componentLossMM=original.map((v,k)=>v-rounded[k]);
    assert.deepEqual(vertex.point,original);
    const exact=original.map((v,k)=>sub(represented(v),represented(rounded[k]))),squared=exact.reduce((sum,v)=>add(sum,mul(v,v)),[0n,1n]);
    return {vertexIndex:index,sourcePointMM:original,float32PointMM:rounded,componentLossMM,exactSquaredDisplacementMM2:asDTO(squared),measuredDisplacementMM:Math.hypot(...componentLossMM)};
  });
  assert.deepEqual(report.vertexLosses,rows);
  assert.deepEqual(report.maximumSquaredDisplacementMM2,asDTO(maximum(rows.map(row=>published(row.exactSquaredDisplacementMM2)))));
  assert.equal(report.maximumMeasuredDisplacementMM,Math.max(...rows.map(row=>row.measuredDisplacementMM)));
  return {allOriginalVerticesCompared:rows.length,nonzeroLossVertices:rows.filter(row=>published(row.exactSquaredDisplacementMM2)[0]!==0n).length,maximumSquaredDisplacementMM2:report.maximumSquaredDisplacementMM2,maximumMeasuredDisplacementMM:report.maximumMeasuredDisplacementMM};
}
function binaryOracle(bytes,packet,report){
  assert.equal(bytes.length,84+50*packet.triangles.length);assert.equal(bytes.length,report.byteLength);
  const expectedHeader=Buffer.alloc(80);expectedHeader.write(headerASCII,'ascii');assert.deepEqual(bytes.subarray(0,80),expectedHeader);
  assert.equal(bytes.readUInt32LE(80),packet.triangles.length);
  assert.equal(report.facets.length,packet.triangles.length);
  let fields=0;
  for(const [i,triangle]of packet.triangles.entries()){
    const offset=84+50*i,points=triangle.vertexIndices.map(index=>packet.positionsMM.slice(3*index,3*index+3).map(Math.fround));
    assert.equal(triangle.index,i);assert.deepEqual(packet.indices.slice(3*i,3*i+3),triangle.vertexIndices);
    const expectedNormal=normal(...points).map(Math.fround),actualNormal=[0,1,2].map(k=>bytes.readFloatLE(offset+4*k));
    assert.deepEqual(actualNormal,expectedNormal);const unitResidual=Math.abs(Math.hypot(...actualNormal)-1);assert.ok(unitResidual<=1e-5);
    for(let corner=0;corner<3;corner++)for(let axis=0;axis<3;axis++){assert.ok(Object.is(bytes.readFloatLE(offset+12+12*corner+4*axis),points[corner][axis]));fields++;}
    assert.equal(bytes.readUInt16LE(offset+48),0);
    const u=points[1].map((v,k)=>sub(represented(v),represented(points[0][k]))),v=points[2].map((x,k)=>sub(represented(x),represented(points[0][k])));
    const exactCross=[sub(mul(u[1],v[2]),mul(u[2],v[1])),sub(mul(u[2],v[0]),mul(u[0],v[2])),sub(mul(u[0],v[1]),mul(u[1],v[0]))];
    assert.ok(exactCross.some(value=>value[0]!==0n));
    const exactNormalDotCross=exactCross.reduce((sum,value,k)=>add(sum,mul(value,represented(actualNormal[k]))),[0n,1n]);assert.ok(exactNormalDotCross[0]>0n);
    assert.deepEqual(report.facets[i],{triangleIndex:i,faceId:triangle.faceId,vertexIndices:triangle.vertexIndices,byteOffset:offset,normal:actualNormal,unitResidual,exactCross:exactCross.map(asDTO),exactNormalDotCross:asDTO(exactNormalDotCross),attributeByteCount:0});
    fields+=3;
  }
  return {exactByteLength:bytes.length,facetCount:packet.triangles.length,float32FieldsCompared:fields,attributeFieldsCompared:packet.triangles.length,originalFacetOrderingRetained:true,headerMatched:true};
}
const sourceHashes=cadInputs.map(path=>{const bytes=readFileSync(path);return {path,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
jsonFile('source-api.inputs',{entry,sourceInputs,cadInputs,sourceOnly:true,write:false,esbuildVersion:esbuild.version,sourceHashes});jsonFile('source-api.metafile',bundle.metafile);
const mainParents=makeParents('main',warpedSurface('original_lower_surface'),warpedSurface('original_upper_surface',[0,1,2,3,4],4));
const mainBody=makeBody('main',mainParents,520),meshSettings=meshOptions('main');
jsonFile('main.mesh-request',{body:mainBody,options:meshSettings});
const mainMesh=mesh(mainBody,meshSettings);jsonFile('main.mesh-result',mainMesh);assert.deepEqual(validateMesh(mainMesh),mainMesh.report);
retained.push({value:mainMesh,before:structuredClone(mainMesh)});
jsonFile('main.stl-request',{mesh:mainMesh,options});
const result=exportStl(mainMesh,options);ownership([mainMesh,options],result);assert.deepEqual(result.request,{mesh:mainMesh,options});
retained.push({value:result,before:structuredClone(result)},{value:options,before:structuredClone(options)});
const saved=jsonFile('main.stl-result',result),validated=validateStl(saved.reopened);assert.deepEqual(validated,result.report);ownership([saved.reopened],validated);
const vertexCount=mainMesh.packet.vertices.length,triangleCount=mainMesh.packet.triangles.length;
assert.deepEqual(result.report.directCounts,{meshValidationCount:1,vertexCount,coordinateFloat32RoundCount:3*vertexCount,triangleCount,normalFloat32RoundCount:3*triangleCount,exactCrossCount:triangleCount,normalAlignmentCount:triangleCount,encodedFloat32Count:12*triangleCount,encodedAttributeCount:triangleCount,encodedByteCount:84+50*triangleCount,curveD0Count:0,curveD1Count:0,surfaceD0Count:0,surfaceD1Count:0,sourceCompilationCount:0,rootSolveCount:0,rationalFloatConversionCount:0,fileWriteCount:0,fileReadCount:0});
assert.deepEqual(result.report.inheritedMeshReport,mainMesh.report);
assert.deepEqual(result.report.fileSizes,{request:fileSize(result.request),result:fileSize(result)});
const losses=lossOracle(mainMesh.packet,result.report);
// File creation is exclusively a demo operation after the full export succeeds.
const stlPath=resolve(output,'main.binary.stl');assert.ok(!existsSync(stlPath));writeFileSync(stlPath,Buffer.from(result.bytes),{flag:'wx'});
const reopenedBytes=readFileSync(stlPath);files.set(stlPath,Buffer.from(reopenedBytes));assert.deepEqual([...reopenedBytes],result.bytes);
const binary=binaryOracle(reopenedBytes,mainMesh.packet,result.report);
jsonFile('main.independent-file-oracle',{losses,binary,fileWriteCount:1,fileReadCount:1,path:stlPath,sha256:createHash('sha256').update(reopenedBytes).digest('hex')});
function intact(){for(const row of retained)assert.deepEqual(row.value,row.before);for(const [path,bytes]of files)assert.deepEqual(readFileSync(path),bytes,path);}
function reject(name,action,expected){let observed=false;try{action();}catch(error){observed=true;assert.ok(error instanceof StlError);if(expected)assert.ok(expected.includes(error.code),name+': '+error.code);failures.push({name,code:error.code,message:error.message,context:error.context??null,causeName:error.cause?.name??null,causeCode:error.cause?.code??null,causeMessage:error.cause?.message??null});jsonFile('refusal-'+name,failures.at(-1));intact();}assert.ok(observed,'Expected refusal: '+name);}
let previous=result;
reject('malformed-full-mesh',()=>{previous=exportStl({},options);},['INPUT','MESH']);assert.strictEqual(previous,result);
const nonfinite=structuredClone(mainMesh);nonfinite.packet.positionsMM[0]=Infinity;reject('nonfinite-full-mesh',()=>exportStl(nonfinite,options),['INPUT','MESH']);
const collapsed=structuredClone(mainMesh),collapseIndices=collapsed.packet.triangles[0].vertexIndices;
for(const index of collapseIndices){collapsed.packet.vertices[index].point=[0,0,0];collapsed.packet.positionsMM.splice(index*3,3,0,0,0);}
reject('collapsed-full-mesh',()=>exportStl(collapsed,options),['MESH']);
for(const name of ['malformed-full-mesh','nonfinite-full-mesh','collapsed-full-mesh']){const row=failures.find(r=>r.name===name);assert.ok(['input','mesh'].includes(row.context?.phase));if(row.code==='MESH')assert.ok(row.causeName,'Actual inherited validator cause retained');}
const mutations=[
 ['byte',r=>{r.bytes[84]^=1;}],['header',r=>{r.bytes[0]^=1;}],['count',r=>{r.bytes[80]^=1;}],
 ['loss',r=>{r.report.vertexLosses[0].exactSquaredDisplacementMM2.numerator='1';}],
 ['normal',r=>{r.report.facets[0].normal[0]+=.25;}],['counter',r=>{r.report.directCounts.encodedFloat32Count++;}],
 ['size',r=>{r.report.fileSizes.result.utf8++;}],['source',r=>{r.request.mesh.body.models[0].source+=' ';}],
 ['negative-zero-byte',r=>{r.bytes[79]=-0;}],['oversized-root-bytes',r=>{r.bytes.push(0);}]
];
for(const [name,mutate]of mutations){const changed=structuredClone(result),before=nativeJSON(changed);mutate(changed);assert.notEqual(nativeJSON(changed),before);reject('owned-'+name,()=>validateStl(changed),['OWNED']);}
let getterCalls=0;
for(const [name,mutate]of [
 ['getter',r=>Object.defineProperty(r.report,'headerASCII',{enumerable:true,get(){getterCalls++;return headerASCII;}})],
 ['cycle',r=>{r.report.loop=r;}],['sparse',r=>{delete r.bytes[84];}],
 ['non-root-byte-cap',r=>{r.report.vertexLosses=Array(8193).fill(0);}]
]){const changed=structuredClone(result);mutate(changed);reject('owned-'+name,()=>validateStl(changed),['OWNED']);}
assert.equal(getterCalls,0);intact();

// PRIVATE arithmetic witnesses: copied genuine packets with altered numeric data.
// These deliberately have no public Body/mesh admission and never write an STL file.
const privateBundle=await esbuild.build({absWorkingDir:repo,stdin:{contents:"export {encodeQualifiedStripBinaryStlTrusted} from './packages/barocss-cad/src/qualified-strip-binary-stl-encoding-internal.ts'; export {SectionRationalContext} from './packages/barocss-cad/src/section-rational-internal.ts';",resolveDir:repo,sourcefile:'private-stl-arithmetic-probes.ts'},bundle:true,platform:'node',format:'esm',target:'es2022',write:false,metafile:true});
const privateAPI=await import('data:text/javascript;base64,'+Buffer.from(privateBundle.outputFiles[0].text).toString('base64'));
jsonFile('private-arithmetic.metafile',privateBundle.metafile);
function privateProbe(label,packet,expectedCode=null){
  const counts=Object.fromEntries(Object.keys(result.report.directCounts).map(key=>[key,0])),before=structuredClone(packet),phases=[];
  let phase='loss',vertexIndex=null,triangleIndex=null,returned=null,refusal=null;
  const fail=(code,detail,cause)=>{const error=new Error(detail,{cause});error.code=code;throw error;};
  const q=new privateAPI.SectionRationalContext(fail);
  try{returned=privateAPI.encodeQualifiedStripBinaryStlTrusted(packet,q,counts,{
    beginVertex(index){phase='loss';vertexIndex=index;triangleIndex=null;},
    beginTriangle(index){phase='facet';triangleIndex=index;vertexIndex=null;},
    beginEncoding(){phase='encoding';vertexIndex=null;triangleIndex=null;},
    retainPhase(data){phases.push({phase,vertices:data.vertexLosses.length,facets:data.facets.length,bytes:data.bytes===null?null:data.bytes.length});},fail
  });}catch(error){refusal={code:error.code,message:error.message,phase,vertexIndex,triangleIndex};}
  assert.deepEqual(packet,before);assert.equal(counts.meshValidationCount,0);assert.equal(counts.fileWriteCount,0);assert.equal(counts.fileReadCount,0);
  if(expectedCode){assert.equal(refusal?.code,expectedCode);assert.equal(returned,null);assert.ok(phases.every(p=>p.bytes===null));assert.equal(counts.encodedByteCount,0);}else{assert.equal(refusal,null);const checked=lossOracle(packet,returned);assert.ok(checked.nonzeroLossVertices>0);}
  const evidence={label,privateArithmeticOnly:true,publicMeshAccepted:false,publicBodyAccepted:false,acceptedFileProduced:false,counts,rationalCounts:q.counts(),phases,refusal,loss:returned?{maximumSquaredDisplacementMM2:returned.maximumSquaredDisplacementMM2,maximumMeasuredDisplacementMM:returned.maximumMeasuredDisplacementMM}:null};
  jsonFile('private-'+label,evidence);intact();return evidence;
}
const lossyPacket=structuredClone(mainMesh.packet);lossyPacket.positionsMM[0]+=.1;lossyPacket.vertices[0].point[0]=lossyPacket.positionsMM[0];
const privateLoss=privateProbe('nonzero-float32-loss',lossyPacket);
const collapsePacket=structuredClone(mainMesh.packet);for(const index of collapsePacket.triangles[0].vertexIndices){collapsePacket.vertices[index].point=[0,0,0];collapsePacket.positionsMM.splice(index*3,3,0,0,0);}
const privateCollapse=privateProbe('exact-quantized-collapse',collapsePacket,'COLLAPSE');

const packageRoot=resolve(repo,'packages/barocss-cad'),manifest=JSON.parse(readFileSync(resolve(packageRoot,'package.json'),'utf8')),declared=manifest.publishConfig?.exports?.['.']??manifest.exports['.'];
const runtimePath=resolve(packageRoot,declared.import),declarationPath=resolve(packageRoot,declared.types),leafDeclarationPath=resolve(packageRoot,'dist/translated-strip/qualified-strip-binary-stl.d.ts');
const publicAPI=await import(pathToFileURL(runtimePath).href);
for(const name of runtimeNames)assert.equal(typeof publicAPI[name],name.endsWith('Code')?'object':'function');
assert.deepEqual(publicAPI.QualifiedTranslatedStripBodyBinaryStlDiagnosticCode,api.QualifiedTranslatedStripBodyBinaryStlDiagnosticCode);
assert.ok(readFileSync(declarationPath,'utf8').includes('./translated-strip/qualified-strip-binary-stl.js'));
for(const name of [...runtimeNames,...typeNames])assert.ok(readFileSync(leafDeclarationPath,'utf8').includes(name));
const freshRequest=JSON.parse(readFileSync(resolve(output,'main.stl-request.json'),'utf8')),freshResult=JSON.parse(readFileSync(saved.file,'utf8'));
assert.deepEqual(publicAPI.exportQualifiedTranslatedStripBodyBinaryStl(freshRequest.mesh,freshRequest.options),freshResult);
assert.deepEqual(publicAPI.validateQualifiedTranslatedStripBodyBinaryStl(freshResult),freshResult.report);
const coldModels=[];
function coldSource(label,source,model){const compiled=publicAPI.compileCadModel(source,{sourceVersion:0});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,model);coldModels.push({label,modelName:model.name,objectIds:model.objects.map(object=>object.id),sourceSHA256:createHash('sha256').update(source).digest('hex')});}
for(const [i,record]of freshRequest.mesh.body.models.entries())coldSource('body-model-'+i,record.source,record.model);
for(const [side,wall]of [['lower',freshRequest.mesh.body.volume.lowerWall],['upper',freshRequest.mesh.body.volume.upperWall]]){
  const section=wall.binding.section;for(const [i,asset]of [section.surfaceAsset,section.planeAsset].entries())coldSource(side+'-original-'+i,asset.source,section.originalModels[i]);coldSource(side+'-section-world',section.world.source,section.world.model);
}
const emittedArtifacts=['index.js','index.d.ts','translated-strip/qualified-strip-binary-stl.js','translated-strip/qualified-strip-binary-stl.d.ts','qualified-strip-binary-stl-encoding-internal.js','qualified-strip-binary-stl-encoding-internal.d.ts'].map(name=>{const path=resolve(packageRoot,'dist',name),bytes=readFileSync(path);return {path,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
const compiledConsumer={runtimePath,declarationPath,leafDeclarationPath,runtimeNames,typeNames,publicNameCount:8,fullEmittedReplayCount:1,fullEmittedOwnedValidationCount:1,coldModels,emittedArtifacts};jsonFile('compiled-consumer',compiledConsumer);
const childScript=`import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';import {readFileSync,writeFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';const api=await import(pathToFileURL(process.env.STL_RUNTIME).href);const result=JSON.parse(readFileSync(process.env.STL_RESULT,'utf8'));assert.deepEqual(api.validateQualifiedTranslatedStripBodyBinaryStl(result),result.report);const bytes=readFileSync(process.env.STL_FILE);assert.deepEqual([...bytes],result.bytes);let models=0;const check=(source,model)=>{const compiled=api.compileCadModel(source,{sourceVersion:0});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,model);models++;};for(const item of result.request.mesh.body.models)check(item.source,item.model);for(const wall of [result.request.mesh.body.volume.lowerWall,result.request.mesh.body.volume.upperWall]){const section=wall.binding.section;[section.surfaceAsset,section.planeAsset].forEach((asset,i)=>check(asset.source,section.originalModels[i]));check(section.world.source,section.world.model);}writeFileSync(process.env.STL_RECEIPT,JSON.stringify({freshProcess:true,ownedFullValidation:true,physicalFileCompared:true,rawSourceModelsRecompiled:models,nodeVersion:process.version})+'\\n',{flag:'wx'});`;
const child=spawnSync(process.execPath,['--input-type=module','-e',childScript],{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,STL_RUNTIME:runtimePath,STL_RESULT:saved.file,STL_FILE:stlPath,STL_RECEIPT:resolve(output,'cold-process.json')}});
writeFileSync(resolve(output,'cold-process.stdout'),child.stdout??'');writeFileSync(resolve(output,'cold-process.stderr'),child.stderr??'');
jsonFile('cold-process.status',{status:child.status,signal:child.signal,error:child.error?.message??null});assert.equal(child.status,0,child.stderr);
const coldProcess=JSON.parse(readFileSync(resolve(output,'cold-process.json'),'utf8'));assert.equal(coldProcess.rawSourceModelsRecompiled,coldModels.length);
intact();
const summary={sourceMode:true,oneFreshMainSourceBodyMeshFlow:true,vertexCount,triangleCount,losses,binary,directCounts:result.report.directCounts,inheritedMeshCounts:mainMesh.report.directCounts,fileSizes:result.report.fileSizes,failures,privateArithmetic:[privateLoss,privateCollapse],getterCalls,compiledConsumer,coldProcess,retainedOriginalObjectsAndFiles:true,scope:'Whole native mesh admission, exact Float32 numeric loss, binary serialization and physical demo write/read only. Approximate facets and normals; STL does not retain native IDs, authoritative units, UV trims or editable topology. No STL watertightness, embedded Solid, global approximation, manufacturing, renderer, Loader, UI, release or publication acceptance.'};
jsonFile('summary',summary);intact();console.log(JSON.stringify(summary));
