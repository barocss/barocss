import assert from 'node:assert/strict';
import test from 'node:test';
import * as cad from '../dist/index.js';
import { compileCadModel, exportIGES, evaluateSurface } from '../dist/index.js';
import { parseCadAst } from '../dist/source-ast.js';
import { analyzeCadAst } from '../dist/semantic-model.js';
import { lowerCadIR } from '../dist/lower-model.js';

const curve = `@curve #arc {
    type: nurbs;
    degree: 2;
    knots: [0,0,0,1,1,1];
    control-points: [[10,0,0],[10,10,0],[0,10,0]];
    weights: [1,0.7071067811865476,1];
  }`;
const feature = '@extrude #wall { curve: #arc; vector: [0,0,30]; }';
const surface = '@surface #plane { type: nurbs; degree-u: 1; degree-v: 1; knots-u: [0,0,1,1]; knots-v: [0,0,1,1]; control-points: [[[0,0,0],[0,2,0]],[[3,0,0],[3,2,0]]]; weights: [[1,1],[1,1]]; }';
const wrap = (version, declarations) => `@model model {\n  version: ${version};\n  length-unit: mm;\n  ${declarations}\n}`;
const v0 = wrap(0, curve);
const v1 = wrap(1, curve + '\n  ' + feature);
const shortSpan = range => ({start:range.start,end:range.end,line:range.line,column:range.column});
const success = (source, version) => {
  const value = compileCadModel(source, {sourceVersion:version});
  assert.equal(value.ok, true, JSON.stringify(value.diagnostics));
  assert.deepEqual(Object.keys(value).sort(), ['ast','constructions','diagnostics','ir','model','ok']);
  assert.deepEqual(value.diagnostics, []);
  return value;
};
const failure = (source, version) => {
  const value = compileCadModel(source, {sourceVersion:version});
  assert.equal(value.ok, false);
  assert.deepEqual(Object.keys(value).sort(), ['diagnostics','ok']);
  assert.ok(value.diagnostics.length >= 1);
  for (const item of value.diagnostics) {
    assert.equal(item.severity, 'error');
    assert.equal(typeof item.code, 'string');
    assert.ok(item.message.length > 0);
    assert.ok(item.range.start >= 0 && item.range.end >= item.range.start);
  }
  assert.deepEqual(compileCadModel(source, {sourceVersion:version}), value);
  return value;
};
function checkRange(source, range, expected) {
  assert.deepEqual(Object.keys(range).sort(), ['column','end','endColumn','endLine','line','start']);
  assert.equal(source.slice(range.start, range.end), expected);
  const first = source.slice(0, range.start).split('\n');
  const last = source.slice(0, range.end).split('\n');
  assert.equal(range.line, first.length);
  assert.equal(range.column, first.at(-1).length + 1);
  assert.equal(range.endLine, last.length);
  assert.equal(range.endColumn, last.at(-1).length + 1);
}

test('one public compiler replaces old entry names and produces original native geometry and adapters', () => {
  for(const name of ['parseModel','compileConstruction','CadSyntaxError','ConstructionSyntaxError']) assert.equal(Object.hasOwn(cad,name),false);
  const curveGeometry={kind:'curve',id:'arc',degree:2,knots:[0,0,0,1,1,1],controlPoints:[[10,0,0],[10,10,0],[0,10,0]],weights:[1,0.7071067811865476,1]};
  const surfaceGeometry={kind:'surface',id:'wall',degreeU:2,degreeV:1,knotsU:[0,0,0,1,1,1],knotsV:[0,0,1,1],
    controlPoints:curveGeometry.controlPoints.map(([x,y,z])=>[[x,y,z],[x,y,z+30]]),weights:curveGeometry.weights.map(w=>[w,w])};
  const zero=success(v0,0),one=success(v1,1);
  assert.deepEqual(zero.model,{name:'model',version:0,lengthUnit:'mm',objects:[curveGeometry]});
  assert.deepEqual(one.model,{name:'model',version:0,lengthUnit:'mm',objects:[curveGeometry,surfaceGeometry]});
  assert.deepEqual(zero.constructions,[]);assert.equal(one.constructions.length,1);
  assert.deepEqual(one.constructions[0],{outputId:'wall',inputId:'arc',operation:'extrude',vector:[0,0,30],
    span:shortSpan(one.ir.nodes[1].span),referenceSpan:shortSpan(one.ir.nodes[1].referenceSpan)});
  assert.equal(zero.ir.schema,'barocss-cad-ir');assert.equal(zero.ir.schemaVersion,1);assert.equal(zero.ir.sourceVersion,0);
  assert.equal(one.ir.sourceVersion,1);assert.equal(one.model.version,0);
  assert.deepEqual(exportIGES(one.model,['wall']),exportIGES({name:'model',version:0,lengthUnit:'mm',objects:[curveGeometry,surfaceGeometry]},['wall']));
  const plane=success(wrap(0,surface),0).model.objects[0];
  assert.deepEqual(plane.controlPoints,[[[0,0,0],[0,2,0]],[[3,0,0],[3,2,0]]]);
});

test('AST preserves ordered fields and exact exclusive ranges including references and numeric arrays', () => {
  const source = '/*😀 source */\n' + wrap(1, feature + '\n  ' + curve);
  const compiled = success(source, 1);
  assert.equal(compiled.ast.kind, 'model');
  assert.equal(compiled.ast.name, 'model');
  checkRange(source, compiled.ast.nameRange, 'model');
  assert.deepEqual(compiled.ast.declarations.map(d => [d.kind,d.id]), [['extrude','wall'],['curve','arc']]);
  const declaration = compiled.ast.declarations[0];
  checkRange(source, declaration.range, feature);
  checkRange(source, declaration.idRange, '#wall');
  const input = declaration.fields.find(f => f.name === 'curve');
  const vector = declaration.fields.find(f => f.name === 'vector');
  checkRange(source, input.nameRange, 'curve');
  checkRange(source, input.range, 'curve: #arc;');
  assert.equal(input.value.kind, 'reference');
  assert.equal(input.value.id, 'arc');
  checkRange(source, input.value.range, '#arc');
  assert.equal(vector.value.kind, 'array');
  checkRange(source, vector.value.range, '[0,0,30]');
  vector.value.items.forEach((value,i) => {
    assert.equal(value.kind, 'number');
    checkRange(source, value.range, ['0','0','30'][i]);
  });
  assert.deepEqual(compiled.model.objects.map(item => item.id), ['wall','arc']);
  assert.deepEqual(compiled.ir.dependencies, [{fromId:'wall',toId:'arc',kind:'curve-input',span:input.value.range}]);
  assert.deepEqual(compiled.ir.nodes[0].referenceSpan, input.value.range);
  assert.deepEqual(shortSpan(compiled.ir.nodes[0].span),compiled.constructions[0].span);
});

test('resolved IR carries primitive field units and no executable/export-specific state', () => {
  const compiled = success(v1, 1);
  const literal = compiled.ir.nodes[0];
  const extrude = compiled.ir.nodes[1];
  assert.equal(literal.kind, 'curve');
  assert.deepEqual(literal.geometry, compiled.model.objects[0]);
  assert.equal(literal.fieldTypes.degree, 'integer');
  assert.equal(literal.fieldTypes.knots, 'dimensionless[]');
  assert.equal(literal.fieldTypes['control-points'], 'mm-point3[]');
  assert.equal(literal.fieldTypes.weights, 'dimensionless[]');
  assert.equal(extrude.kind, 'extrude');
  assert.equal(extrude.inputId, 'arc');
  assert.deepEqual(extrude.vector, [0,0,30]);
  assert.equal(extrude.fieldTypes.vector, 'mm-vector3');
  assert.equal(extrude.fieldTypes.curve, 'curve-reference');
  const s = success(wrap(0, surface), 0).ir.nodes[0];
  assert.equal(s.fieldTypes['degree-u'], 'integer');
  assert.equal(s.fieldTypes['degree-v'], 'integer');
  assert.equal(s.fieldTypes['knots-u'], 'dimensionless[]');
  assert.equal(s.fieldTypes['knots-v'], 'dimensionless[]');
  assert.equal(s.fieldTypes['control-points'], 'mm-point3[][]');
  assert.equal(s.fieldTypes.weights, 'dimensionless[][]');
  function plain(value) {
    assert.notEqual(typeof value, 'function');
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value)) assert.ok([Object.prototype,null].includes(Object.getPrototypeOf(value)));
    for (const [key,item] of Object.entries(value)) {
      assert.ok(!['target','profile','igesPointer','directoryPointer','stepEntityId'].includes(key));
      plain(item);
    }
  }
  plain(compiled.ast); plain(compiled.ir);
});

test('field/header order remains free and forward references resolve without declaration reordering', () => {
  const reorderedCurve = '@curve #arc { weights: [1,0.7071067811865476,1]; control-points: [[10,0,0],[10,10,0],[0,10,0]]; knots: [0,0,0,1,1,1]; degree: 2; type: nurbs; }';
  const reordered = `@model model { ${feature} ${reorderedCurve} length-unit: mm; version: 1; }`;
  const compiled = success(reordered, 1);
  assert.deepEqual(compiled.model.objects[0].controlPoints,success(v1,1).model.objects[1].controlPoints);
  assert.deepEqual(compiled.model.objects.map(item => item.id), ['wall','arc']);
  assert.deepEqual(compiled.ast.declarations[1].fields.map(f => f.name), ['weights','control-points','knots','degree','type']);
  const nodes = compiled.ir.nodes;
  assert.deepEqual(nodes.map(n => [n.kind,n.id]), [['extrude','wall'],['curve','arc']]);
  assert.deepEqual(compiled.constructions.map(n => [n.outputId,n.inputId]), [['wall','arc']]);
});

test('AST parsing and resolved semantics precede derived native lowering', () => {
  const invalid = v1.replace('degree: 2', 'degree: 0');
  const ast = parseCadAst(invalid, 1);
  assert.equal(ast.declarations.length, 2);
  assert.equal(ast.declarations[0].fields.find(f => f.name === 'degree').value.value, 0);
  assert.throws(() => analyzeCadAst(ast, 1, invalid));
  failure(invalid, 1);
  const unresolved = wrap(1, feature.replace('#arc', '#absent') + '\n' + curve);
  assert.throws(() => analyzeCadAst(parseCadAst(unresolved,1),1,unresolved));
  assert.ok(!Object.hasOwn(ast.declarations[0], 'geometry'));
  const validAst = parseCadAst(v1,1);
  const ir = analyzeCadAst(validAst,1,v1);
  assert.deepEqual(ir.nodes.map(n => n.kind), ['curve','extrude']);
  assert.equal(ir.nodes[1].geometry, undefined);
  assert.deepEqual(lowerCadIR(ir), {model:success(v1,1).model,constructions:success(v1,1).constructions});
  const validThenMissing = v1.replace(/\n}$/, '\n @extrude #bad {curve:#absent;vector:[0,0,1];}\n}');
  const result = failure(validThenMissing,1);
  assert.ok(!Object.hasOwn(result,'model'));
  assert.ok(!Object.hasOwn(result,'ir'));
});

test('all output occurrences independently own arrays/ranges and preserve binary64 and signed zero', () => {
  const source = v1.replace('[[10,0,0]', '[[1.2345678901234567,-0,0]');
  const first = success(source,1), original = success(source,1);
  const pointField = first.ast.declarations[0].fields.find(f => f.name === 'control-points');
  const values = pointField.value.items[0].items;
  assert.equal(values[0].value, 1.2345678901234567);
  assert.ok(Object.is(values[1].value, -0));
  assert.ok(Object.is(first.ir.nodes[0].geometry.controlPoints[0][1], -0));
  assert.ok(Object.is(first.model.objects[0].controlPoints[0][1], -0));
  assert.ok(Object.is(first.model.objects[1].controlPoints[0][0][1], -0));
  const seen = new WeakSet();
  function own(value) {
    if (!value || typeof value !== 'object') return;
    assert.ok(!seen.has(value), 'A mutable occurrence aliases another public output occurrence');
    seen.add(value); Object.values(value).forEach(own);
  }
  own(first);
  first.ast.declarations[0].range.start = 0;
  values[0].value = -20;
  first.ir.nodes[0].geometry.controlPoints[0][0] = 80;
  first.ir.nodes[1].vector[2] = 90;
  first.ir.dependencies[0].span.start = 0;
  first.model.objects[1].controlPoints[0][0][0] = 70;
  first.constructions[0].vector[2] = 55;
  assert.deepEqual(success(source,1), original);
  assert.equal(original.model.objects[0].controlPoints[0][0], 1.2345678901234567);
  assert.equal(original.ir.nodes[1].vector[2], 30);
});

test('diagnostics are deterministic source-associated syntax/type/reference/version failures without partial output', () => {
  const bad = [
    [v1.replace('curve: #arc','curve: #missing'),1], [v1.replace('[0,0,30]','[0,0]'),1],
    [v1.replace('[0,0,30]','[0,0,0]'),1], [v1.replace('#wall','#arc'),1],
    [v0.replace('degree: 2','degree: 6'),0], [v0.replace('length-unit: mm','length-unit: cm'),0],
    [v0.replace('type: nurbs','type: trimmed'),0], [v0.replace('degree: 2','degree: calc(1+1)'),0],
    [v0.replace('[1,0.7071067811865476,1]','[1,Infinity,1]'),0],
    [v0.replace('degree: 2','degree: 2; degree: 2'),0],
    [v0.replace('degree: 2','profile: step; degree: 2'),0], [v0,1], [v1,0],
    [wrap(1,curve+'\n'+feature+'\n@extrude #bad {curve:#wall;vector:[0,0,2];}'),1],
  ];
  for (const [source,version] of bad) {
    const result = failure(source,version);
    for (const d of result.diagnostics) checkRange(source,d.range,source.slice(d.range.start,d.range.end));
  }
  const reference = v1.replace('curve: #arc','curve: #missing');
  const ref = failure(reference,1).diagnostics[0];
  assert.equal(ref.code, 'REFERENCE');
  assert.equal(ref.objectId, 'wall');
  checkRange(reference,ref.range,'#missing');
  failure(v1,0);failure(v0,1);
});

test('strict options and nonstring source use structured diagnostics without executing host accessors', () => {
  let calls = 0;
  const getter = {}; Object.defineProperty(getter,'sourceVersion',{enumerable:true,get(){calls++;return 0;}});
  const hidden = {}; Object.defineProperty(hidden,'sourceVersion',{value:0,enumerable:false});
  const foreign = {sourceVersion:0}; Object.defineProperty(foreign,'target',{value:'iges',enumerable:false});
  const symbol = {sourceVersion:0,[Symbol('foreign')]:true};
  for (const options of [undefined,null,0,{},[],{sourceVersion:3},{sourceVersion:'0'},
    {sourceVersion:0,target:'iges'},{sourceVersion:0,profile:'AP214'},getter,hidden,foreign,symbol]) {
    const result = compileCadModel(v0,options);
    assert.deepEqual(Object.keys(result).sort(), ['diagnostics','ok']);
    assert.equal(result.ok,false); assert.equal(result.diagnostics[0].code,'OPTIONS');
  }
  assert.equal(calls,0);
  for (const input of [null,undefined,1,{},[]]) {
    const result = compileCadModel(input,{sourceVersion:0});
    assert.equal(result.ok,false); assert.equal(result.diagnostics[0].code,'TYPE');
  }
  assert.equal(compileCadModel(false,{sourceVersion:1}).diagnostics[0].code,'TYPE');
  assert.equal(success(v0,0).ok,true);
});

test('complete native source bounds remain accepted and excessive source/nesting/objects reject', () => {
  const n = 16, p = 5;
  const knots = [...Array(p+1).fill(0),...Array.from({length:n-p-1},(_,i)=>i+1),...Array(p+1).fill(n-p)];
  const points = Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>[i,j,0]));
  const weights = Array.from({length:n},()=>Array(n).fill(1));
  const declaration = i => `@surface #s${i} { type:nurbs;degree-u:5;degree-v:5;knots-u:${JSON.stringify(knots)};knots-v:${JSON.stringify(knots)};control-points:${JSON.stringify(points)};weights:${JSON.stringify(weights)};}`;
  const maximum = wrap(0,Array.from({length:16},(_,i)=>declaration(i)).join('\n'));
  const compiled = success(maximum,0);
  assert.equal(compiled.model.objects.length,16);
  assert.equal(compiled.model.objects[0].controlPoints.flat().length,256);
  assert.deepEqual(evaluateSurface(compiled.model.objects[0],0,0),[0,0,0]);
  assert.equal(compiled.ast.declarations.length,16);assert.equal(compiled.ir.nodes.length,16);
  assert.deepEqual(compiled.model.objects[0].knotsU,knots);assert.deepEqual(compiled.model.objects[0].weights,weights);
  assert.equal(success(v0+' '.repeat(262144-Buffer.byteLength(v0)),0).model.objects.length,1);
  assert.equal(failure(v0+' '.repeat(262145-Buffer.byteLength(v0)),0).diagnostics[0].code,'LIMIT');
  failure(v0+'/*'+'😀'.repeat(65536)+'*/',0);
  failure(wrap(0,Array.from({length:17},(_,i)=>declaration(i)).join('\n')),0);
  failure(v0.replace('[0,0,0,1,1,1]','['.repeat(40)+'0'+']'.repeat(40)),0);
  failure(v0.replace('[0,0,0,1,1,1]',JSON.stringify(Array(71).fill(0))),0);
  const sixtyFour = {kind:'curve',id:'limit',degree:5,knots:[...Array(6).fill(0),...Array.from({length:58},(_,i)=>i+1),...Array(6).fill(59)],controlPoints:Array.from({length:64},(_,i)=>[i,0,0]),weights:Array(64).fill(1)};
  const c = `@curve #limit {type:nurbs;degree:5;knots:${JSON.stringify(sixtyFour.knots)};control-points:${JSON.stringify(sixtyFour.controlPoints)};weights:${JSON.stringify(sixtyFour.weights)};}`;
  assert.equal(success(wrap(0,c),0).model.objects[0].controlPoints.length,64);
});
