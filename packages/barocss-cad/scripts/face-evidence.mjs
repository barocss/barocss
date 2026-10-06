import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'../../..');
const json=value=>JSON.stringify(value,null,2)+'\n',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const faceEvidenceRoot=()=>resolve(process.env.BAROCSS_CAD_FACE_EVIDENCE??'/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-511/faces');
const definitions=[
  {name:'preview-flat',area:41,ids:{faceId:'flat_face',loopId:'flat_loop',vertexIds:['flat_v0','flat_v1','flat_v2','flat_v3'],edgeIds:['flat_e0','flat_e1','flat_e2','flat_e3'],curveIds:['flat_c0','flat_c1','flat_c2','flat_c3']}},
  {name:'extruded-straight',area:Math.sqrt(3038),ids:{faceId:'oblique_face',loopId:'oblique_loop',vertexIds:['oblique_v0','oblique_v1','oblique_v2','oblique_v3'],edgeIds:['oblique_e0','oblique_e1','oblique_e2','oblique_e3'],curveIds:['oblique_c0','oblique_c1','oblique_c2','oblique_c3']}},
  {name:'quarter-cylinder',area:150*Math.PI,ids:{faceId:'cylinder_face',loopId:'cylinder_loop',vertexIds:['cylinder_v0','cylinder_v1','cylinder_v2','cylinder_v3'],edgeIds:['cylinder_e0','cylinder_e1','cylinder_e2','cylinder_e3'],curveIds:['cylinder_c0','cylinder_c1','cylinder_c2','cylinder_c3']}},
  {name:'extruded-cylinder',area:150*Math.PI,ids:{faceId:'extrusion_face',loopId:'extrusion_loop',vertexIds:['extrusion_v0','extrusion_v1','extrusion_v2','extrusion_v3'],edgeIds:['extrusion_e0','extrusion_e1','extrusion_e2','extrusion_e3'],curveIds:['extrusion_c0','extrusion_c1','extrusion_c2','extrusion_c3']}},
];
function analytic(name,u,v) {
  if(name==='preview-flat') {const s=(u+2)/5,t=(v-4)/2;return {point:[1+6*s+t,2+s+7*t,2],du:[6/5,1/5,0],dv:[1/2,7/2,0]};}
  if(name==='extruded-straight') {const s=(u+2)/5;return {point:[1+8*s-v,2+2*s+5*v,3+3*s+4*v],du:[8/5,2/5,3/5],dv:[-1,5,4]};}
  const w=Math.SQRT1_2,a=(1-u)**2,b=2*w*u*(1-u),c=u*u,ap=-2*(1-u),bp=2*w*(1-2*u),cp=2*u,d=a+b+c,dp=ap+bp+cp;
  return {point:[10*(a+b)/d,10*(b+c)/d,30*v],du:[10*((ap+bp)*d-(a+b)*dp)/(d*d),10*((bp+cp)*d-(b+c)*dp)/(d*d),0],dv:[0,0,30]};
}
const close=(a,b,derivative=false)=>assert.ok(Math.hypot(...a.map((x,k)=>x-b[k]))<=1e-9*(derivative?Math.max(1,Math.hypot(...b)):1));
export function writeFaceEvidence(api) {
  const output=faceEvidenceRoot();mkdirSync(output,{recursive:true});const fixtures=[];
  const fractions=[0,.03,.07,.11,.17,.23,.29,.37,.43,.5,.57,.63,.71,.77,.83,.89,.93,.97,1];
  for(const {name,ids,area} of definitions) {
    const source=readFileSync(resolve(root,'examples/cad-nurbs/'+name+'.css'),'utf8');
    const construction=name.startsWith('extruded-'),compiled=api.compileCadModel(source,{sourceVersion:construction?1:0});assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));const model=compiled.model;
    const surface=construction?model.objects.find(o=>o.id===compiled.constructions[0].outputId):model.objects[0],before=json(model);
    const bundle=api.buildParametricFace(surface,ids),validation=api.validateFaceBundle(bundle),samples=[];
    assert.deepEqual(validation,{incidenceValid:true,geometricValidity:'not-certified',solid:false});assert.equal(json(model),before);
    assert.equal(bundle.geometry.objects.length,5);const edges=bundle.topology.edges,uses=bundle.topology.loop.uses;
    for(let i=0;i<4;i++) {
      const curve=bundle.geometry.objects.find(o=>o.id===edges[i].curveId),pcurve=uses[i].pcurve,queries=[];
      for(const f of fractions) {
        const parameter=(1-f)*pcurve.domain[0]+f*pcurve.domain[1],uv=pcurve.uv0.map((x,k)=>x===pcurve.uv1[k]?x:(1-f)*x+f*pcurve.uv1[k]);
        const evaluated=api.evaluateCurveD1(curve,parameter),expected=analytic(name,...uv),analyticDerivative=(i%2===0?expected.du:expected.dv).map(x=>i>=2?-x:x);
        close(evaluated.point,expected.point);close(evaluated.derivative,analyticDerivative,true);
        queries.push({parameter,uv,...evaluated,analyticPoint:expected.point,analyticDerivative});
      }
      samples.push(queries);
    }
    const exported=api.exportIGES(bundle.geometry,bundle.geometry.objects.map(o=>o.id));assert.deepEqual(exported.report.objects.map(o=>o.entity),[128,126,126,126,126]);
    const contents={'css':source,'bundle.json':json(bundle),'topology.json':json(bundle.topology),'geometry.json':json(bundle.geometry),'native-source.json':json(model),'features.json':json(compiled.constructions),'ids.json':json(ids),'validation.json':json(validation),'samples.json':json(samples),'iges':exported.iges,'export-report.json':json(exported.report)};
    const artifactHashes={};for(const [suffix,bytes]of Object.entries(contents)){writeFileSync(resolve(output,name+'.'+suffix),bytes);artifactHashes[suffix]=hash(bytes);}
    fixtures.push({name,bundle,sourceVersion:compiled.ir.sourceVersion,constructions:compiled.constructions,validation,samples,analyticAreaMM2:area,
      surfaceExport:exported.report.objects[0],edgeExports:exported.report.objects.slice(1),
      files:{source:name+'.css',bundle:name+'.bundle.json',iges:name+'.iges',exportReport:name+'.export-report.json'},hashes:{source:hash(source),bundle:hash(contents['bundle.json']),iges:hash(exported.iges),exportReport:hash(contents['export-report.json'])},artifactHashes});
  }
  const manifest={base:'5f51b5fef49ddf850c9d15b17e655eae0b1008b7',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),producer:'Actual extracted CAD ESM archive; incidence separate from geometric validity',fixtures};
  writeFileSync(resolve(output,'manifest.json'),json(manifest));writeFileSync(resolve(output,'manifest.sha256'),hash(json(manifest))+'\n');console.log('Packed face incidence evidence: '+output);return manifest;
}
