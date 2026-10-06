import assert from 'node:assert/strict';
import test from 'node:test';
import { compileCadModel, parseModel, compileConstruction, exportIGES, evaluateSurface } from '../dist/index.js';
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
const native = model => ({name:model.name,version:model.version,lengthUnit:model.lengthUnit,objects:model.objects});
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

test('public v0/v1 compiler preserves native values, constructions and unchanged export bytes', () => {
  const zero = success(v0, 0);
  const legacyZero = parseModel(v0);
  assert.deepEqual(zero.model, native(legacyZero));
  assert.deepEqual(zero.constructions, []);
  assert.equal(zero.ir.schema, 'barocss-cad-ir');
  assert.equal(zero.ir.schemaVersion, 1);
  assert.equal(zero.ir.sourceVersion, 0);
  assert.equal(zero.model.version, 0);
  assert.deepEqual(shortSpan(zero.ir.nodes[0].span), legacyZero.spans.arc);
  assert.deepEqual(exportIGES(zero.model, ['arc']), exportIGES(legacyZero, ['arc']));
  const one = success(v1, 1);
  const legacyOne = compileConstruction(v1);
  assert.deepEqual(one.model, legacyOne.model);
  assert.deepEqual(one.constructions, legacyOne.constructions);
  assert.equal(one.ir.sourceVersion, 1);
  assert.equal(one.model.version, 0);
  assert.deepEqual(exportIGES(one.model, ['wall']), exportIGES(legacyOne.model, ['wall']));
  assert.deepEqual(success(wrap(0, surface), 0).model, native(parseModel(wrap(0, surface))));
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
  assert.deepEqual(shortSpan(compiled.ir.nodes[0].span), compileConstruction(source).constructions[0].span);
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
  assert.deepEqual(compiled.model, compileConstruction(reordered).model);
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
  assert.throws(() => parseModel(v1));
  assert.throws(() => compileConstruction(v0));
});

test('strict options and nonstring source use structured diagnostics without executing host accessors', () => {
  let calls = 0;
  const getter = {}; Object.defineProperty(getter,'sourceVersion',{enumerable:true,get(){calls++;return 0;}});
  const hidden = {}; Object.defineProperty(hidden,'sourceVersion',{value:0,enumerable:false});
  const foreign = {sourceVersion:0}; Object.defineProperty(foreign,'target',{value:'iges',enumerable:false});
  const symbol = {sourceVersion:0,[Symbol('foreign')]:true};
  for (const options of [undefined,null,0,{},[],{sourceVersion:2},{sourceVersion:'0'},
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
  assert.throws(() => parseModel(null),TypeError);
  assert.throws(() => compileConstruction(false),TypeError);
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
  assert.deepEqual(compiled.model,native(parseModel(maximum)));
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

const legacyGolden = {"parseModel.bad-degree":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"GEOMETRY at 4:3: Degree must be in 1..5 and smaller than the control point count","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":null},"compileConstruction.bad-degree":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 4:3: Invalid curve arc: GEOMETRY at 1:35: Degree must be in 1..5 and smaller than the control point count","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":{"start":50,"end":51,"line":4,"column":3}},"parseModel.bad-weight":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"GEOMETRY at 4:3: Weights must be in [1e-6, 1e6]","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":null},"compileConstruction.bad-weight":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 4:3: Invalid curve arc: GEOMETRY at 1:35: Weights must be in [1e-6, 1e6]","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":{"start":50,"end":51,"line":4,"column":3}},"parseModel.bad-knots":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"GEOMETRY at 4:3: Knots must be nondecreasing","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":null},"compileConstruction.bad-knots":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 4:3: Invalid curve arc: GEOMETRY at 1:35: Knots must be nondecreasing","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":{"start":50,"end":51,"line":4,"column":3}},"parseModel.empty-knots":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"GEOMETRY at 4:3: Knot count must equal control point count + degree + 1","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":null},"compileConstruction.empty-knots":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 4:3: Invalid curve arc: GEOMETRY at 1:35: Knot count must equal control point count + degree + 1","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":{"start":50,"end":51,"line":4,"column":3}},"parseModel.bad-point-dimension":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"GEOMETRY at 4:3: A control point must have three coordinates","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":null},"compileConstruction.bad-point-dimension":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 4:3: Invalid curve arc: GEOMETRY at 1:35: A control point must have three coordinates","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":{"start":50,"end":51,"line":4,"column":3}},"parseModel.coordinate-bound":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"GEOMETRY at 4:3: Coordinates must be finite and within 1e6 mm","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":null},"compileConstruction.coordinate-bound":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 4:3: Invalid curve arc: GEOMETRY at 1:35: Coordinates must be finite and within 1e6 mm","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":{"start":50,"end":51,"line":4,"column":3}},"parseModel.duplicate-field":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"DUPLICATE at 6:16: Duplicate field degree","code":"DUPLICATE","offset":96,"line":6,"column":16,"span":null},"compileConstruction.duplicate-field":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"DUPLICATE at 6:16: Invalid curve arc: DUPLICATE at 3:16: Duplicate field degree","code":"DUPLICATE","offset":96,"line":6,"column":16,"span":{"start":96,"end":97,"line":6,"column":16}},"parseModel.foreign-field":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"FIELD at 6:5: Unsupported field target","code":"FIELD","offset":85,"line":6,"column":5,"span":null},"compileConstruction.foreign-field":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"FIELD at 6:5: Invalid curve arc: FIELD at 3:5: Unsupported field target","code":"FIELD","offset":85,"line":6,"column":5,"span":{"start":85,"end":86,"line":6,"column":5}},"parseModel.nonfinite":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"GEOMETRY at 4:3: Weights must be in [1e-6, 1e6]","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":null},"compileConstruction.nonfinite":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 4:3: Invalid curve arc: GEOMETRY at 1:35: Weights must be in [1e-6, 1e6]","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":{"start":50,"end":51,"line":4,"column":3}},"parseModel.bad-id":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"SYNTAX at 4:11: Expected identifier","code":"SYNTAX","offset":58,"line":4,"column":11,"span":null},"compileConstruction.bad-id":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"SYNTAX at 4:11: Expected identifier","code":"SYNTAX","offset":58,"line":4,"column":11,"span":{"start":58,"end":59,"line":4,"column":11}},"parseModel.units":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"UNIT at 1:1: length-unit: mm is required","code":"UNIT","offset":0,"line":1,"column":1,"span":null},"compileConstruction.units":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"UNIT at 3:3: length-unit: mm is required","code":"UNIT","offset":31,"line":3,"column":3,"span":{"start":31,"end":32,"line":3,"column":3}},"parseModel.missing-unit":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"UNIT at 1:1: length-unit: mm is required","code":"UNIT","offset":0,"line":1,"column":1,"span":null},"compileConstruction.missing-unit":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"UNIT at 1:1: length-unit: mm is required","code":"UNIT","offset":0,"line":1,"column":1,"span":{"start":0,"end":1,"line":1,"column":1}},"parseModel.missing-version":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"VERSION at 1:1: version: 0 is required","code":"VERSION","offset":0,"line":1,"column":1,"span":null},"compileConstruction.missing-version":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"VERSION at 1:1: compileConstruction requires version: 1","code":"VERSION","offset":0,"line":1,"column":1,"span":{"start":0,"end":1,"line":1,"column":1}},"parseModel.wrong-version":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"VERSION at 1:1: version: 0 is required","code":"VERSION","offset":0,"line":1,"column":1,"span":null},"compileConstruction.wrong-version":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"VERSION at 2:3: compileConstruction requires version: 1","code":"VERSION","offset":17,"line":2,"column":3,"span":{"start":17,"end":18,"line":2,"column":3}},"parseModel.decimal-exponent":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"SYNTAX at 6:14: Expected ;","code":"SYNTAX","offset":94,"line":6,"column":14,"span":null},"compileConstruction.decimal-exponent":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"SYNTAX at 6:14: Invalid curve arc: SYNTAX at 3:14: Expected ;","code":"SYNTAX","offset":94,"line":6,"column":14,"span":{"start":94,"end":95,"line":6,"column":14}},"parseModel.expression":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"SYNTAX at 6:17: Expected ;","code":"SYNTAX","offset":97,"line":6,"column":17,"span":null},"compileConstruction.expression":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"SYNTAX at 6:17: Invalid curve arc: SYNTAX at 3:17: Expected ;","code":"SYNTAX","offset":97,"line":6,"column":17,"span":{"start":97,"end":98,"line":6,"column":17}},"parseModel.nested-array":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"DIMENSION at 7:13: Array nesting exceeds field dimension","code":"DIMENSION","offset":108,"line":7,"column":13,"span":null},"compileConstruction.nested-array":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"DIMENSION at 7:13: Invalid curve arc: DIMENSION at 4:13: Array nesting exceeds field dimension","code":"DIMENSION","offset":108,"line":7,"column":13,"span":{"start":108,"end":109,"line":7,"column":13}},"parseModel.trailing":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"SYNTAX at 11:3: Unexpected content after model","code":"SYNTAX","offset":218,"line":11,"column":3,"span":null},"compileConstruction.trailing":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"SYNTAX at 12:3: Unexpected content after model","code":"SYNTAX","offset":270,"line":12,"column":3,"span":{"start":270,"end":271,"line":12,"column":3}},"parseModel.unterminated-comment":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"SYNTAX at 11:3: Unterminated comment","code":"SYNTAX","offset":218,"line":11,"column":3,"span":null},"compileConstruction.unterminated-comment":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"SYNTAX at 12:3: Unterminated comment","code":"SYNTAX","offset":270,"line":12,"column":3,"span":{"start":270,"end":271,"line":12,"column":3}},"parseModel.degree-before-wrong-version":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"GEOMETRY at 4:3: Degree must be in 1..5 and smaller than the control point count","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":null},"compileConstruction.degree-before-wrong-version":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 4:3: Invalid curve arc: GEOMETRY at 1:35: Degree must be in 1..5 and smaller than the control point count","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":{"start":50,"end":51,"line":4,"column":3}},"parseModel.degree-before-wrong-unit":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"GEOMETRY at 4:3: Degree must be in 1..5 and smaller than the control point count","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":null},"compileConstruction.degree-before-wrong-unit":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 4:3: Invalid curve arc: GEOMETRY at 1:35: Degree must be in 1..5 and smaller than the control point count","code":"GEOMETRY","offset":50,"line":4,"column":3,"span":{"start":50,"end":51,"line":4,"column":3}},"parseModel.unknown-field-before-duplicate-id":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"FIELD at 6:5: Unsupported field shader","code":"FIELD","offset":85,"line":6,"column":5,"span":null},"compileConstruction.unknown-field-before-duplicate-id":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"FIELD at 6:5: Invalid curve arc: FIELD at 3:5: Unsupported field shader","code":"FIELD","offset":85,"line":6,"column":5,"span":{"start":85,"end":86,"line":6,"column":5}},"parseModel.source-too-long":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"LIMIT at 1:1: Source exceeds 256 KiB","code":"LIMIT","offset":0,"line":1,"column":1,"span":null},"compileConstruction.source-too-long":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"LIMIT at 1:1: Source exceeds 256 KiB","code":"LIMIT","offset":0,"line":1,"column":1,"span":{"start":0,"end":0,"line":1,"column":1}},"parseModel.deep-array-limit":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"DIMENSION at 7:13: Array nesting exceeds field dimension","code":"DIMENSION","offset":108,"line":7,"column":13,"span":null},"compileConstruction.deep-array-limit":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"DIMENSION at 7:13: Invalid curve arc: DIMENSION at 4:13: Array nesting exceeds field dimension","code":"DIMENSION","offset":108,"line":7,"column":13,"span":{"start":108,"end":109,"line":7,"column":13}},"parseModel.version1-only":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"VERSION at 1:1: version: 0 is required","code":"VERSION","offset":0,"line":1,"column":1,"span":null},"parseModel.extrude-rejected":{"name":"CadSyntaxError","constructor":"CadSyntaxError","message":"KIND at 11:1: Unsupported object extrude","code":"KIND","offset":216,"line":11,"column":1,"span":null},"compileConstruction.v0-rejected":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"VERSION at 2:3: compileConstruction requires version: 1","code":"VERSION","offset":17,"line":2,"column":3,"span":{"start":17,"end":18,"line":2,"column":3}},"compileConstruction.missing-reference":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"REFERENCE at 11:27: Reference missing must name a declared curve","code":"REFERENCE","offset":242,"line":11,"column":27,"span":{"start":242,"end":250,"line":11,"column":27}},"compileConstruction.wrong-kind-reference":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"REFERENCE at 12:25: Reference wall must name a declared curve","code":"REFERENCE","offset":290,"line":12,"column":25,"span":{"start":290,"end":295,"line":12,"column":25}},"compileConstruction.self-reference":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"REFERENCE at 11:27: Reference wall must name a declared curve","code":"REFERENCE","offset":242,"line":11,"column":27,"span":{"start":242,"end":247,"line":11,"column":27}},"compileConstruction.duplicate-id":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"DUPLICATE at 11:1: Duplicate ID arc","code":"DUPLICATE","offset":216,"line":11,"column":1,"span":{"start":216,"end":229,"line":11,"column":1}},"compileConstruction.zero-vector":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 11:3: Extrusion vector must be nonzero","code":"GEOMETRY","offset":218,"line":11,"column":3,"span":{"start":218,"end":266,"line":11,"column":3}},"compileConstruction.vector-rank":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"SYNTAX at 11:46: Expected ,","code":"SYNTAX","offset":261,"line":11,"column":46,"span":{"start":261,"end":262,"line":11,"column":46}},"compileConstruction.vector-four":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"SYNTAX at 11:48: Expected ]","code":"SYNTAX","offset":263,"line":11,"column":48,"span":{"start":263,"end":264,"line":11,"column":48}},"compileConstruction.vector-negative-reference":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"REFERENCE at 11:27: Reference missing must name a declared curve","code":"REFERENCE","offset":242,"line":11,"column":27,"span":{"start":242,"end":250,"line":11,"column":27}},"compileConstruction.missing-fields":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"FIELD at 11:3: Extrusion requires curve and vector fields","code":"FIELD","offset":218,"line":11,"column":3,"span":{"start":218,"end":250,"line":11,"column":3}},"compileConstruction.surface-v1":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"KIND at 4:3: Unsupported declaration surface","code":"KIND","offset":50,"line":4,"column":3,"span":{"start":50,"end":58,"line":4,"column":3}},"compileConstruction.empty":{"name":"ConstructionSyntaxError","constructor":"ConstructionSyntaxError","message":"GEOMETRY at 1:1: Model must contain geometry","code":"GEOMETRY","offset":0,"line":1,"column":1,"span":{"start":0,"end":1,"line":1,"column":1}}};

function legacyError(error) {
  return {name:error.name,constructor:error.constructor.name,message:error.message,code:error.code??null,
    offset:error.offset??null,line:error.line??null,column:error.column??null,span:error.span??null};
}
test('frozen actual legacy error corpus preserves classes, first-error precedence, messages and spans', () => {
  const mutations = {
    'bad-degree':s=>s.replace('degree: 2','degree: 0'),
    'bad-weight':s=>s.replace('[1,0.7071067811865476,1]','[1,0,1]'),
    'bad-knots':s=>s.replace('[0,0,0,1,1,1]','[0,0,0,1,0,1]'),
    'empty-knots':s=>s.replace('[0,0,0,1,1,1]','[]'),
    'bad-point-dimension':s=>s.replace('[[10,0,0]','[[10,0]'),
    'coordinate-bound':s=>s.replace('[[10,0,0]','[[1000001,0,0]'),
    'duplicate-field':s=>s.replace('degree: 2','degree: 2; degree: 2'),
    'foreign-field':s=>s.replace('degree: 2','target: iges; degree: 2'),
    'nonfinite':s=>s.replace('[1,0.7071067811865476,1]','[1,Infinity,1]'),
    'bad-id':s=>s.replace('#arc','#1arc'),
    'units':s=>s.replace('length-unit: mm','length-unit: cm'),
    'missing-unit':s=>s.replace('length-unit: mm;',''),
    'missing-version':s=>s.replace(/version: [01];/,''),
    'wrong-version':s=>s.replace(/version: [01]/,'version: 2'),
    'decimal-exponent':s=>s.replace('degree: 2','degree: 2e0'),
    'expression':s=>s.replace('degree: 2','degree: calc(1+1)'),
    'nested-array':s=>s.replace('[0,0,0,1,1,1]','[[0],0,0,1,1,1]'),
    'trailing':s=>s+' @model extra {}',
    'unterminated-comment':s=>s+' /*',
    'degree-before-wrong-version':s=>s.replace('degree: 2','degree: 0').replace(/version: [01]/,'version: 2'),
    'degree-before-wrong-unit':s=>s.replace('degree: 2','degree: 0').replace('length-unit: mm','length-unit: cm'),
    'unknown-field-before-duplicate-id':s=>s.replace('degree: 2','shader: bad; degree: 2').replace(/\n}$/,`\n${curve}\n}`),
    'source-too-long':s=>s+' '.repeat(262145),
    'deep-array-limit':s=>s.replace('[0,0,0,1,1,1]','['.repeat(40)+'0'+']'.repeat(40)),
  };
  let checked=0;
  const apis={parseModel,compileConstruction};
  function compare(api,name,source) {
    const expected=legacyGolden[api+'.'+name];assert.ok(expected,'Missing frozen oracle');
    assert.throws(()=>apis[api](source),error=>{assert.deepEqual(legacyError(error),expected,api+'.'+name);return true;});
    checked++;
  }
  for(const [name,mutate]of Object.entries(mutations)) {
    compare('parseModel',name,mutate(v0));compare('compileConstruction',name,mutate(v1));
  }
  compare('parseModel','version1-only',wrap(1,curve));
  compare('parseModel','extrude-rejected',wrap(0,curve+'\n'+feature));
  for(const [name,source]of [
    ['v0-rejected',v1.replace('version: 1','version: 0')],
    ['missing-reference',v1.replace('curve: #arc','curve: #missing')],
    ['wrong-kind-reference',wrap(1,curve+'\n'+feature+'\n@extrude #second {curve:#wall;vector:[0,0,4];}')],
    ['self-reference',v1.replace('curve: #arc','curve: #wall')],
    ['duplicate-id',wrap(1,curve+'\n'+feature.replace('#wall','#arc'))],
    ['zero-vector',v1.replace('[0,0,30]','[0,0,0]')],
    ['vector-rank',v1.replace('[0,0,30]','[0,30]')],
    ['vector-four',v1.replace('[0,0,30]','[0,0,30,40]')],
    ['vector-negative-reference',v1.replace('[0,0,30]','[0,0,0]').replace('curve: #arc','curve: #missing')],
    ['missing-fields',v1.replace('vector: [0,0,30];','')],
    ['surface-v1',wrap(1,surface)],['empty',wrap(1,'')],
  ])compare('compileConstruction',name,source);
  assert.equal(checked,62);
});
