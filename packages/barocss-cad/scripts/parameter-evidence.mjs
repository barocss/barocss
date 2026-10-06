import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../../..'),json=value=>JSON.stringify(value,null,2)+'\n';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const parameterEvidenceRoot=()=>resolve(process.env.BAROCSS_CAD_PARAMETER_EVIDENCE??'/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-545/parameters');
const literal=def=>{const curved=def.radius!==undefined,r=def.radius;return`@model oracle {version:1;length-unit:mm;@curve #profile {type:nurbs;degree:${curved?2:1};knots:${curved?'[0,0,0,1,1,1]':'[0,0,1,1]'};control-points:${JSON.stringify(curved?[[r,0,0],[r,r,0],[0,r,0]]:[[0,0,0],[def.width,0,0]])};weights:${curved?'[1,0.7071067811865476,1]':'[1,1]'};}@extrude #wall {curve:#profile;vector:[0,0,${def.height}];}}`;};
export function parameterAnalytic(def,u,v){if(def.radius===undefined)return{point:[def.width*u,0,def.height*v],du:[def.width,0,0],dv:[0,0,def.height]};const r=def.radius,w=Math.SQRT1_2,a=1-u,d=a*a+2*w*a*u+u*u,dd=-2*a+2*w*(1-2*u)+2*u,nx=r*(a*a+2*w*a*u),ny=r*(2*w*a*u+u*u),dx=r*(-2*a+2*w*(1-2*u)),dy=r*(2*w*(1-2*u)+2*u);return{point:[nx/d,ny/d,def.height*v],du:[(dx*d-nx*dd)/(d*d),(dy*d-ny*dd)/(d*d),0],dv:[0,0,def.height]};}
const close=(actual,expected,derivative=false)=>assert.ok(Math.hypot(...actual.map((x,i)=>x-expected[i]))<=1e-9*(derivative?Math.max(1,Math.hypot(...expected)):1));
export function writeParameterEvidence(api){
  const output=parameterEvidenceRoot();mkdirSync(output,{recursive:true});
  const line=readFileSync(resolve(root,'examples/cad-nurbs/parameter-line-v2.css'),'utf8'),curved=readFileSync(resolve(root,'examples/cad-nurbs/parameter-curved-v2.css'),'utf8');
  const definitions=[{name:'line-width-100',width:100,height:100,source:line},{name:'line-width-120',width:120,height:120,source:line.replace('10 cm','12cm')},{name:'curved-radius-10',radius:10,height:30,source:curved},{name:'curved-radius-12',radius:12,height:40,source:curved.replace('1 cm','12 mm').replace('30 mm','40mm')}];
  const fixtures=[];
  for(const definition of definitions){
    const {source,...def}=definition,compiled=api.compileCadModel(source,{sourceVersion:2}),literalSource=literal(def),equivalent=api.compileCadModel(literalSource,{sourceVersion:1});
    assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));assert.equal(equivalent.ok,true);assert.equal(compiled.ir.schemaVersion,2);assert.equal(equivalent.ir.schemaVersion,1);assert.deepEqual(compiled.model,equivalent.model);
    const native=compiled.model.objects.find(object=>object.id==='wall'),samples=[];
    for(let i=0;i<17;i++)for(let j=0;j<9;j++){const u=i/16,v=j/8,actual=api.evaluateSurfaceD1(native,u,v),expected=parameterAnalytic(def,u,v);close(actual.point,expected.point);close(actual.du,expected.du,true);close(actual.dv,expected.dv,true);samples.push({u,v,...actual,analyticDu:expected.du,analyticDv:expected.dv,analyticPoint:expected.point});}
    const exported=api.exportIGES(compiled.model,['wall']),literalExport=api.exportIGES(equivalent.model,['wall']);assert.deepEqual(exported,literalExport);
    const preview=api.tessellateSurface(native,{countU:17,countV:9,revision:545});assert.deepEqual(preview,api.tessellateSurface(equivalent.model.objects[1],{countU:17,countV:9,revision:545}));
    const contents={source,ast:json(compiled.ast),ir:json(compiled.ir),model:json(compiled.model),native:json(native),constructions:json(compiled.constructions),packet:json(preview.packet),previewReport:json(preview.report),iges:exported.iges,exportReport:json(exported.report),literalSource,literalModel:json(equivalent.model),samples:json(samples)};
    const files={},hashes={};for(const [key,bytes]of Object.entries(contents)){const filename=def.name+'.'+({source:'css',iges:'iges',literalSource:'literal.css'}[key]??key+'.json');files[key]=filename;hashes[key]=hash(bytes);writeFileSync(resolve(output,filename),bytes);}
    fixtures.push({name:def.name,definition:def,sourceVersion:2,geometryVersion:0,irSchemaVersion:2,parameters:compiled.ir.parameters,bindings:compiled.ir.bindings,dependencies:compiled.ir.dependencies,constructions:compiled.constructions,native,id:native.id,entity:128,domain:api.surfaceDomain(native),samples,files,hashes});
  }
  const manifest={base:'930a143107741342a519337e91038abe966e0eb9',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),producer:'Actual extracted source2 compiler API; original NURBS/IGES without a runtime consumer kernel',fixtures,limits:{nativeMM:1e-9,readerMM:1e-7,derivative:'scaled by max(1, expected norm)'},limitations:['Parameter source2/IR2/native0 are distinct versions.','Open curve extrusions only; no parameter GUI/project2 or topology/solid guarantee.']};
  writeFileSync(resolve(output,'manifest.json'),json(manifest));writeFileSync(resolve(output,'manifest.sha256'),hash(json(manifest))+'\n');console.log('Packed source2 parameter evidence: '+output);return manifest;
}
