import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, cylinderPart, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, brepsFor } from '../src/engine/evaluate';
import { drawingInputs, runDrawingTool } from '../src/chat/drawing';
import { dispatchTool } from '../src/chat/tools';
import { changeDrawingScope, drawingDocument, drawingScopeOf } from '../src/drawing/scope';
import { readDrawing, type DrawingSettings } from '../src/drawing/types';
import { issueContext } from '../src/drawing/issues';
import { sheetSvg } from '../src/drawing/svg';
import { sheetPdf } from '../src/drawing/pdf';
import { sheetDxf } from '../src/drawing/dxf';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { bomPanelDataOf } from '../src/bom/bom';
const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);
const base = () => withNode(emptyDoc(), { kind:'frame',points:[[0,0,0],[400,0,0],[400,300,0]],segments:[[0,1],[1,2]],section:{kind:'rect-tube',width:40,height:40,wall:3,outerRadius:0} });
const assembly = (): StudioDoc => ({...base(), instances:[
  {id:'plate',name:'Plate',doc:rectanglePart(100,80,8),position:[1000,0,0],rotation:[0,0,0]},
  {id:'cover',name:'Cover',doc:cylinderPart(30,5),position:[2000,0,0],rotation:[0,0,0]},
  {id:'shaft',name:'Shaft',doc:cylinderPart(10,200),position:[3000,0,0],rotation:[0,0,0]},
]});
const inputs=(d:StudioDoc)=>{const i=drawingInputs(d);assert.ok(typeof i!=='string',String(i));return i;};
const auto=(d:StudioDoc)=>{const r=runDrawingTool(d,'auto_dimension',{});assert.ok(!('error'in r),JSON.stringify(r));return r.doc;};

test('A9-13 base frame projection and automatic dimensions exclude cover60/shaft20; common exports retain one scoped sheet',()=>{
  const doc=assembly(), plain=base();assert.deepEqual(inputs(doc).views,inputs(plain).views);
  const a=auto(doc), b=auto(plain);assert.deepEqual(readDrawing(a.drawing).dimensions,readDrawing(b.drawing).dimensions);
  const i=inputs(a), ctx=issueContext(i), svg=sheetSvg(ctx.sheet,'Base frame');
  assert.doesNotMatch(svg,/Ø60|Ø20/); assert.ok(sheetPdf(ctx.sheet,'Base frame').length>100);
  const dxf=sheetDxf(ctx.sheet,ctx.layout);assert.ok(dxf.text.length>100);
  const all=brepsFor(doc), own=brepsFor(drawingDocument(doc,readDrawing(doc.drawing)));assert.ok(!('error'in all)&&!('error'in own));assert.equal(all.breps.length,5);assert.equal(own.breps.length,2);
});
test('A9-13 selected part local projection and auto dimensions ignore placement and unrelated components',()=>{
  const doc=assembly(), s={...readDrawing(undefined),scope:{kind:'part' as const,part:'cover'}}, selected={...doc,drawing:s};
  assert.deepEqual(inputs(selected).views,inputs(doc.instances![1].doc).views);
  const edited={...selected,instances:doc.instances!.map(i=>({...i,position:[9000,400,200] as [number,number,number],rotation:[0,0,75] as [number,number,number],...(i.id==='shaft'?{doc:cylinderPart(100,800)}:{})}))};
  assert.deepEqual(inputs(edited).views,inputs(selected).views);assert.deepEqual(readDrawing(auto(edited).drawing).dimensions,readDrawing(auto(selected).drawing).dimensions);
  assert.match(sheetSvg(issueContext(inputs(auto(selected))).sheet,'Cover'),/Ø60/);
});
test('A9-13 legacy assembly BOM and balloon identity are preserved; assembly Auto and fixes do not generate component dimensions',()=>{
  const doc={...assembly(),drawing:{...readDrawing(undefined),balloons:true,tables:[{id:'bom',from:'bom'}]}};
  assert.deepEqual(drawingScopeOf(readDrawing(doc.drawing)),{kind:'assembly'});
  const i=inputs(doc), expected=bomPanelDataOf(doc,d=>evaluateDoc(d,1),'part').bom;
  assert.deepEqual(i.meta!.bom,expected);assert.match(JSON.stringify(i.views),/cover\//);assert.match(JSON.stringify(i.views),/shaft\//);
  const automatic=runDrawingTool(doc,'auto_dimension',{});assert.ok('error'in automatic);assert.match(automatic.error,/DRAWING_SCOPE_AUTO/);
  const fixed=runDrawingTool(doc,'fix_drawing',{});assert.ok(!('error'in fixed));assert.deepEqual(readDrawing(fixed.doc.drawing).dimensions,[]);
  assert.deepEqual(doc.drawing.dimensions,[]);
});
test('A9-13 v2 scope selection survives real file Save/Open; missing/invalid scopes refuse without fallback',async()=>{
  const doc=assembly(), e=await evaluate(doc);assert.ok(e.ok);const state={doc,bodies:e.bodies};
  const r=await dispatchTool(state,'drawing',{action:'set',scope:{kind:'part',part:'shaft'}},evaluate);
  assert.equal(r.isError,false,r.content);assert.equal(r.changed,true);
  const generated=await dispatchTool(r.state,'drawing',{action:'auto'},evaluate);assert.equal(generated.isError,false,generated.content);
  const file=await readStudioFile(encodeStudioFile(r.state.doc));assert.ok('doc'in file);assert.deepEqual(readDrawing(file.doc.drawing).scope,{kind:'part',part:'shaft'});
  assert.deepEqual(inputs(file.doc).views,inputs(doc.instances![2].doc).views);
  const changed=auto(file.doc);assert.ok(readDrawing(changed.drawing).dimensions.length>0);
  for(const scope of [{kind:'part',part:'gone'},{kind:'all'},{kind:'assembly',part:'cover'},{kind:'part',extra:1}]){const x=await dispatchTool(state,'drawing',{action:'set',scope},evaluate);assert.equal(x.isError,true,JSON.stringify(scope));assert.equal(x.state,state);}
});
test('A9-13 scope changes never delete or retarget manual dimensions; automatic-only sheets may regenerate',()=>{
  const d=auto(base()), s=readDrawing(d.drawing);assert.ok(s.dimensions.length);
  const manual:DrawingSettings={...s,dimensions:[{...s.dimensions[0],auto:undefined}]};
  assert.throws(()=>changeDrawingScope(manual,{kind:'assembly'}),/DRAWING_SCOPE_REFERENCES/);
  const stayed=changeDrawingScope(manual,{kind:'part'});assert.deepEqual(stayed.dimensions,manual.dimensions);
  const changed=changeDrawingScope(s,{kind:'assembly'});assert.deepEqual(changed.dimensions,[]);assert.equal(s.dimensions.length>0,true);
});
test('A9-13 base frame following a part sketch still reads its authored source before projection excludes instances',()=>{
  const plate=rectanglePart(300,200,10), doc={...emptyDoc(),nodes:[{kind:'frame',id:'n0',follows:{part:'plate',sketch:'n0'},points:[],segments:[],section:{kind:'rect-tube',width:40,height:40,wall:3,outerRadius:0}}],instances:[{id:'plate',name:'Plate',doc:plate,position:[0,0,100],rotation:[0,0,0]}]} as StudioDoc;
  const local=drawingDocument(doc,readDrawing(undefined)), e=evaluateDoc(local,1);assert.ok(e.ok,JSON.stringify(e));assert.equal(e.bodies.length,4);
  assert.ok(doc.nodes[0].kind==='frame'&&doc.nodes[0].follows);assert.equal(local.instances,undefined);assert.ok(typeof drawingInputs(doc)!=='string');
});

test('A9-13 sections and manual references remain local across Save/Open and Auto re-edit',async()=>{
  const doc={...assembly(),drawing:{...readDrawing(undefined),scope:{kind:'part' as const,part:'cover'},section:{y:0}}};
  const i=inputs(doc), local={...doc.instances![1].doc,drawing:{...doc.drawing,scope:{kind:'part' as const}}};
  assert.deepEqual(i.sections,inputs(local).sections);
  const d=auto(doc), s=readDrawing(d.drawing), manual={...s.dimensions[0],auto:undefined};
  const file=await readStudioFile(encodeStudioFile({...d,drawing:{...s,dimensions:[manual]}}));assert.ok('doc'in file);
  const edited=auto(file.doc);assert.deepEqual(readDrawing(edited.drawing).dimensions.find(x=>x.id===manual.id),JSON.parse(JSON.stringify(manual)));
  assert.match(sheetSvg(issueContext(inputs(edited)).sheet,'Cover'),/Ø60/);
  const malformed={...doc,drawing:{...doc.drawing,scope:{kind:'unknown'}}} as unknown as StudioDoc;
  assert.match(String(drawingInputs(malformed)),/DRAWING_SCOPE/);
});

test('A9-13 assembly fix-all retains non-auto scale correction while skipping component dimension generation',()=>{
  const doc={...assembly(),drawing:{...readDrawing(undefined),scope:{kind:'assembly' as const},scale:10}};
  const result=runDrawingTool(doc,'fix_drawing',{});assert.ok(!('error'in result),JSON.stringify(result));
  assert.ok((result.content.applied as string[]).includes('scale'));assert.ok(!(result.content.applied as string[]).includes('auto-dimension'));
  assert.notEqual(readDrawing(result.doc.drawing).scale,10);assert.deepEqual(readDrawing(result.doc.drawing).dimensions,[]);
  const onlyDimensions=runDrawingTool(doc,'fix_drawing',{codes:['OVERALL_MISSING']});assert.ok(!('error'in onlyDimensions));
  assert.deepEqual(onlyDimensions.content.applied,[]);assert.deepEqual(readDrawing(onlyDimensions.doc.drawing).dimensions,[]);
});
