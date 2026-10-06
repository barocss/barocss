import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {compileCadModel,evaluateCurveD1,evaluateSurfaceD1,exportIGES,tessellateSurface} from '../dist/index.js';

const lineSource=readFileSync(new URL('../../../examples/cad-nurbs/parameter-line-v2.css',import.meta.url),'utf8');
const curvedSource=readFileSync(new URL('../../../examples/cad-nurbs/parameter-curved-v2.css',import.meta.url),'utf8');
const ok=source=>{const result=compileCadModel(source,{sourceVersion:2});assert.equal(result.ok,true,JSON.stringify(result.diagnostics));assert.equal(result.ir.schemaVersion,2);assert.equal(result.ir.sourceVersion,2);assert.equal(result.model.version,0);return result;};
const bad=source=>{const result=compileCadModel(source,{sourceVersion:2});assert.equal(result.ok,false);assert.deepEqual(Object.keys(result).sort(),['diagnostics','ok']);assert.ok(result.diagnostics.length);assert.equal(result.diagnostics[0].severity,'error');assert.deepEqual(compileCadModel(source,{sourceVersion:2}),result);return result.diagnostics[0];};
const curve='@curve #profile {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[10,0,0]];weights:[1,1];}';
const model=declarations=>'@model test {version:2;length-unit:mm;'+declarations+curve+'}';
const parameter=(id,type,value)=>`@parameter #${id} {type:${type};value:${value};}`;
const close=(actual,expected,derivative=false)=>assert.ok(Math.hypot(...actual.map((x,i)=>x-expected[i]))<=1e-9*(derivative?Math.max(1,Math.hypot(...expected)):1),`${actual} != ${expected}`);
const literal=(definition)=>{const curved=definition.radius!==undefined,r=definition.radius;return `@model oracle {version:1;length-unit:mm;@curve #profile {type:nurbs;degree:${curved?2:1};knots:${curved?'[0,0,0,1,1,1]':'[0,0,1,1]'};control-points:${JSON.stringify(curved?[[r,0,0],[r,r,0],[0,r,0]]:[[0,0,0],[definition.width,0,0]])};weights:${curved?'[1,0.7071067811865476,1]':'[1,1]'};}@extrude #wall {curve:#profile;vector:[0,0,${definition.height}];}}`;};
function oracle(def,u,v){if(def.radius===undefined)return{point:[def.width*u,0,def.height*v],du:[def.width,0,0],dv:[0,0,def.height]};const w=Math.SQRT1_2,a=1-u,d=a*a+2*w*a*u+u*u,dd=-2*a+2*w*(1-2*u)+2*u,nx=def.radius*(a*a+2*w*a*u),ny=def.radius*(2*w*a*u+u*u),dx=def.radius*(-2*a+2*w*(1-2*u)),dy=def.radius*(2*w*(1-2*u)+2*u);return{point:[nx/d,ny/d,def.height*v],du:[(dx*d-nx*dd)/(d*d),(dy*d-ny*dd)/(d*d),0],dv:[0,0,def.height]};}

test('source2 parameter edits rebuild the same stable original line and wall identities',()=>{
  const first=ok(lineSource),edited=ok(lineSource.replace('10 cm','12cm'));
  assert.deepEqual(first.ir.parameters.map(p=>[p.id,p.quantityKind,p.value,p.unit]),[['width','length',100,'mm'],['height','length',50,'mm'],['scale','scalar',2,'1']]);
  assert.equal(first.model.objects[0].controlPoints[1][0],100);assert.equal(first.model.objects[1].controlPoints[1][1][2],100);
  assert.equal(edited.model.objects[0].controlPoints[1][0],120);assert.equal(edited.model.objects[1].controlPoints[1][1][2],120);
  assert.deepEqual(edited.model.objects.map(o=>o.id),['profile','wall']);
  const dependencies=first.ir.dependencies;
  assert.deepEqual(dependencies.map(d=>[d.fromId,d.toId,d.kind]),[['height','width','parameter-input'],['profile','width','parameter-input'],['wall','profile','curve-input'],['wall','height','parameter-input'],['wall','scale','parameter-input']]);
  for(const d of dependencies.filter(d=>d.kind==='parameter-input'))assert.equal(lineSource.slice(d.span.start,d.span.end),'$'+d.toId);
  const pointBinding=first.ir.bindings.find(b=>b.objectId==='profile'&&b.field==='control-points'&&JSON.stringify(b.indices)==='[1,0]');
  assert.equal(pointBinding.value,100);assert.equal(pointBinding.quantityKind,'length');assert.deepEqual(pointBinding.references,['width']);
  const numericFields=first.ir.bindings.filter(b=>b.objectId==='profile');
  assert.deepEqual(numericFields.map(b=>[b.field,b.indices]),[['degree',[]],...Array.from({length:4},(_,i)=>['knots',[i]]),...Array.from({length:2},(_,i)=>Array.from({length:3},(_,j)=>['control-points',[i,j]])).flat(),['weights',[0]],['weights',[1]]]);
});

test('four fresh source2 outputs equal literal1 native/IGES/packet controls and612 independent point/D1 queries',()=>{
  const definitions=[{width:100,height:100,source:lineSource},{width:120,height:120,source:lineSource.replace('10 cm','12cm')},{radius:10,height:30,source:curvedSource},{radius:12,height:40,source:curvedSource.replace('1 cm','12 mm').replace('30 mm','40mm')}];let count=0;
  for(const def of definitions){const parameterized=ok(def.source),equivalent=compileCadModel(literal(def),{sourceVersion:1});assert.equal(equivalent.ok,true);assert.deepEqual(parameterized.model,equivalent.model);
    assert.deepEqual(exportIGES(parameterized.model,['wall']),exportIGES(equivalent.model,['wall']));
    assert.deepEqual(tessellateSurface(parameterized.model.objects[1],{countU:17,countV:9,revision:545}),tessellateSurface(equivalent.model.objects[1],{countU:17,countV:9,revision:545}));
    for(let i=0;i<17;i++)for(let j=0;j<9;j++){const u=i/16,v=j/8,actual=evaluateSurfaceD1(parameterized.model.objects[1],u,v),expected=oracle(def,u,v);close(actual.point,expected.point);close(actual.du,expected.du,true);close(actual.dv,expected.dv,true);count++;}
  }assert.equal(count,612);
});

test('typed arithmetic has exact units, precedence, associativity, ratios and authored unit ranges',()=>{
  const cases=[['10cm','length',100],['.1 m','length',100],['2+3*4','scalar',14],['(2+3)*4','scalar',20],['100mm/20mm','scalar',5],['10cm*2','length',200],['2*10cm','length',200],['20/2/2','scalar',5],['-2cm+3cm','length',10],['+(-3mm)','length',-3]];
  for(const [expression,type,value]of cases){const c=ok(model(parameter('p',type,expression))),p=c.ir.parameters[0];assert.equal(p.value,value);assert.equal(p.unit,type==='length'?'mm':'1');assert.equal(p.quantityKind,type);assert.equal(c.ast.declarations[0].fields.find(f=>f.name==='value').value.kind,p.expression.kind);}
  const c=ok(model(parameter('p','length','10 cm'))),e=c.ir.parameters[0].expression;assert.equal(e.kind,'number');assert.equal(e.unit,'cm');assert.equal(e.value,10);assert.equal(model(parameter('p','length','10 cm')).slice(e.unitRange.start,e.unitRange.end),'cm');
});

test('forward parameter/curve dependencies preserve occurrences and do not insert parameter Model objects',()=>{
  const source='@model f {version:2;length-unit:mm;@extrude #wall {curve:#profile;vector:[0,0,$twice];}'+parameter('twice','length','$width+$width')+parameter('width','length','5cm')+'@curve #profile {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[$width,0,0]];weights:[1,1];}}';
  const c=ok(source);assert.deepEqual(c.ir.parameters.map(p=>p.id),['twice','width']);assert.deepEqual(c.model.objects.map(o=>o.id),['wall','profile']);
  const refs=c.ir.dependencies.filter(d=>d.fromId==='twice');assert.equal(refs.length,2);assert.deepEqual(refs.map(d=>d.toId),['width','width']);assert.notEqual(refs[0].span.start,refs[1].span.start);
  assert.equal(c.ir.bindings.find(b=>b.objectId==='wall'&&b.indices[0]===2).value,100);
});

test('degree, knots, weights and coordinate/vector bindings keep their distinct quantity rules',()=>{
  const source=model(parameter('one','scalar','1')).replace('degree:1','degree:$one').replace('knots:[0,0,1,1]','knots:[0,0,$one,$one]').replace('weights:[1,1]','weights:[$one,2/2]').replace('[10,0,0]','[10cm,0,0]');
  const c=ok(source);assert.equal(c.model.objects[0].degree,1);assert.deepEqual(c.model.objects[0].knots,[0,0,1,1]);assert.deepEqual(c.model.objects[0].weights,[1,1]);assert.equal(c.model.objects[0].controlPoints[1][0],100);
  const bindings=c.ir.bindings;assert.equal(bindings.find(b=>b.field==='degree').quantityKind,'scalar');
  assert.ok(bindings.filter(b=>['weights','knots'].includes(b.field)).every(b=>b.quantityKind==='scalar'));
  assert.ok(bindings.filter(b=>b.field==='control-points').every(b=>b.quantityKind==='length'));
  assert.equal(c.ir.dependencies.filter(d=>d.toId==='one').length,4);
  bad(model('').replace('weights:[1,1]','weights:[1mm,1]'));bad(model('').replace('knots:[0,0,1,1]','knots:[0mm,0,1,1]'));
});

test('all cycle detection precedes arithmetic, including unused cycles and zero division elsewhere',()=>{
  for(const declarations of [parameter('a','scalar','$a'),parameter('a','scalar','$b')+parameter('b','scalar','$a'),parameter('broken','scalar','1/0')+parameter('a','scalar','$b')+parameter('b','scalar','$a')]){
    const d=bad(model(declarations));assert.match(d.code,/CYCLE/);assert.ok(d.range.start>=0);
  }
});

test('unit/kind/ID/arithmetic/native-field negative controls yield owned source diagnostics',()=>{
  const cases=[parameter('p','length','10mm+2'),parameter('p','length','1mm*2mm'),parameter('p','scalar','1/2mm'),parameter('p','scalar','1/0'),parameter('p','scalar','1/-0'),parameter('p','length','2'),parameter('p','length','1inch'),parameter('p','length','$missing'),parameter('p','length','$profile'),parameter('profile','scalar','1'),parameter('bad-id','scalar','1'),parameter('p','scalar','1000000000000*2'),parameter('p','scalar','1000000000001')];
  for(const decl of cases)bad(model(decl));
  const scalar=parameter('p','scalar','4');bad(model(scalar).replace('[10,0,0]','[$p,0,0]'));
  bad(model('').replace('[10,0,0]','[1+2,0,0]'));
  bad(model('').replace('degree:1','degree:3/2'));bad(model('').replace('[0,0,1,1]','[0,0,1-2,1]'));bad(model('').replace('weights:[1,1]','weights:[1,1-1]'));
  bad(model(parameter('p','length','1000001mm')).replace('[10,0,0]','[$p,0,0]'));
  for(const text of ['calc(2)','Math.PI','1e2','10%','"10mm"','${width}','[1,2]'])bad(model(parameter('p','scalar',text)));
});

test('coordinate literal shorthand does not coerce scalars and preserves signedzero/numeric precision',()=>{
  const source=model(parameter('zero','length','-0mm')+parameter('p','length','1.2345678901234567mm')).replace('[10,0,0]','[$p,$zero,(+0)]');
  const c=ok(source);assert.ok(Object.is(c.ir.parameters[0].value,-0));assert.ok(Object.is(c.model.objects[0].controlPoints[1][1],-0));assert.equal(c.model.objects[0].controlPoints[1][0],1.2345678901234567);
  const snapshot=ok(source),seen=new WeakSet();function visit(value){if(!value||typeof value!=='object')return;assert.ok(!seen.has(value),'Public nested occurrence alias');seen.add(value);Object.values(value).forEach(visit);}visit(c);
  c.ir.parameters[1].expression.value=80;c.ir.bindings[0].expression.value=60;c.model.objects[0].controlPoints[1][0]=50;c.ast.declarations[0].range.start=0;assert.deepEqual(ok(source),snapshot);
});

test('source0/1 remain IR1 while source2 alone supports parameter grammar',()=>{
  const source0='@model a{version:0;length-unit:mm;'+curve+'}',source1=source0.replace('version:0','version:1');
  for(const [source,sourceVersion]of [[source0,0],[source1,1]]){const c=compileCadModel(source,{sourceVersion});assert.equal(c.ok,true);assert.equal(c.ir.schemaVersion,1);assert.equal(Object.hasOwn(c.ir,'parameters'),false);assert.equal(Object.hasOwn(c.ir,'bindings'),false);}
  assert.equal(compileCadModel(lineSource,{sourceVersion:1}).ok,false);assert.equal(compileCadModel(lineSource,{sourceVersion:3}).ok,false);assert.equal(compileCadModel(lineSource,{sourceVersion:2,target:'iges'}).ok,false);
});

function balanced(n){if(n===1)return '1';const left=Math.floor(n/2);return '('+balanced(left)+'+'+balanced(n-left)+')';}
function expressionCount(e){if(e.kind==='unary')return 1+expressionCount(e.operand);if(e.kind==='binary')return 1+expressionCount(e.left)+expressionCount(e.right);if(e.kind==='group')return 1+expressionCount(e.expression);return 1;}
test('per-expression256 node ceiling accepts a balanced arithmetic tree and rejects257',()=>{
  const accepted=ok(model(parameter('p','scalar','+ '.repeat(3)+balanced(85))));
  assert.equal(accepted.ir.parameters[0].value,85);assert.equal(expressionCount(accepted.ir.parameters[0].expression),256);
  assert.equal(bad(model(parameter('p','scalar','+ '.repeat(4)+balanced(85)))).code,'LIMIT');
});

function maxGeometry(){const knots=[...Array(6).fill(0),...Array.from({length:10},(_,i)=>i+1),...Array(6).fill(11)];const points=Array.from({length:16},(_,i)=>'['+Array.from({length:16},(_,j)=>`[+ ${i},+ ${j},+ 0]`).join(',')+']');return Array.from({length:16},(_,i)=>`@surface #s${i}{type:nurbs;degree-u:5;degree-v:5;knots-u:${JSON.stringify(knots)};knots-v:${JSON.stringify(knots)};control-points:[${points.join(',')}];weights:${JSON.stringify(Array.from({length:16},()=>Array(16).fill(1)))};}`).join('');}
test('parameter64/geometry16/source/expressiondepth and aggregate32768 ceilings stay bounded',()=>{
  const params=Array.from({length:64},(_,i)=>parameter('p'+i,'scalar','1')).join('');assert.equal(ok(model(params)).ir.parameters.length,64);bad(model(params+parameter('over','scalar','1')));
  assert.equal(ok(lineSource+' '.repeat(262144-Buffer.byteLength(lineSource))).ir.parameters.length,3);assert.equal(bad(lineSource+' '.repeat(262145-Buffer.byteLength(lineSource))).code,'LIMIT');
  const shallow=ok(model(parameter('p','scalar','+ '.repeat(30)+'1')));assert.equal(shallow.ir.parameters[0].value,1);bad(model(parameter('p','scalar','+ '.repeat(33)+'1')));
  const geom=maxGeometry(),chain=Array(26).fill('1').join('+');
  const declarations=extra=>Array.from({length:64},(_,i)=>parameter('p'+i,'scalar','+ '.repeat(i<32||(extra&&i===32)?2:1)+chain)).join('');
  const source='@model max {version:2;length-unit:mm;'+declarations(false)+geom+'}';assert.ok(Buffer.byteLength(source)<262144);const compiled=ok(source);assert.equal(compiled.model.objects.length,16);assert.equal(compiled.ir.parameters.length,64);
  const over='@model max {version:2;length-unit:mm;'+declarations(true)+geom+'}';assert.equal(bad(over).code,'LIMIT');
});
