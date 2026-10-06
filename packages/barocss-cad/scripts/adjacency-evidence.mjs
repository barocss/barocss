import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'../../..'),json=v=>JSON.stringify(v,null,2)+'\n',hash=v=>createHash('sha256').update(v).digest('hex');
export const adjacencyEvidenceRoot=()=>resolve(process.env.BAROCSS_CAD_ADJACENCY_EVIDENCE??'/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-515/adjacency');
const side=(origin,a,b,id)=>({kind:'surface',id,degreeU:1,degreeV:1,knotsU:[0,0,1,1],knotsV:[0,0,1,1],controlPoints:[[origin.map(x=>x),origin.map((x,k)=>x+b[k])],[origin.map((x,k)=>x+a[k]),origin.map((x,k)=>x+a[k]+b[k])]],weights:[[1,1],[1,1]]});
const localIds=p=>({faceId:p+'_face',loopId:p+'_loop',vertexIds:[0,1,2,3].map(i=>p+'_v'+i),edgeIds:[0,1,2,3].map(i=>p+'_e'+i),curveIds:[0,1,2,3].map(i=>p+'_c'+i)});
const globalIds=p=>({adjacencyId:p+'_adjacency',faceIds:[p+'_left',p+'_right'],vertexIds:[0,1,2,3,4,5].map(i=>p+'_global_v'+i),edgeIds:[0,1,2,3,4,5,6].map(i=>p+'_global_e'+i)});
const close=(a,b,derivative=false)=>assert.ok(Math.hypot(...a.map((x,k)=>x-b[k]))<=(derivative?1e-9*Math.max(1,Math.hypot(...b)):1e-9));
const fractions=[0,.03,.07,.11,.17,.23,.29,.37,.43,.5,.57,.63,.71,.77,.83,.89,.93,.97,1];
const definitions=[
  ['xy-positive',[0,0,0],[4,0,0],[2,0,0],[0,3,0],[0,0,1]],['xy-negative',[1,2,3],[-4,0,0],[-2,0,0],[0,3,0],[0,0,-1]],
  ['yz-positive',[0,0,0],[0,5,0],[0,2,0],[0,0,4],[1,0,0]],['yz-negative',[0,0,0],[0,-5,0],[0,-2,0],[0,0,4],[-1,0,0]],
  ['zx-positive',[0,0,0],[0,0,6],[0,0,3],[2,0,0],[0,1,0]],['zx-negative',[0,0,0],[0,0,-6],[0,0,-3],[2,0,0],[0,-1,0]],
  ['translated-pair',[103,-207,11],[13,0,0],[7,0,0],[0,9,0],[0,0,1]],
];
const sourceFor=surface=>'@model adjacency_source {version:0;length-unit:mm;@surface #'+surface.id+' {type:nurbs;degree-u:'+surface.degreeU+';degree-v:'+surface.degreeV+';knots-u:'+JSON.stringify(surface.knotsU)+';knots-v:'+JSON.stringify(surface.knotsV)+';control-points:'+JSON.stringify(surface.controlPoints)+';weights:'+JSON.stringify(surface.weights)+';}}\n';

export function writeAdjacencyEvidence(api) {
  const output=adjacencyEvidenceRoot();mkdirSync(output,{recursive:true});const fixtures=[];
  for(const [name,origin,a,ar,b,normal]of definitions) {
    const prefix=name.replaceAll('-','_'),repeat=name==='xy-positive';
    const origins=[origin,origin.map((x,k)=>x+a[k])],vectors=[a,ar],bundles=[],faceRecords=[],authored=[];
    for(let owner=0;owner<2;owner++) {
      const p=repeat?'same_local':prefix+(owner===0?'_L':'_R'),surface=side(origins[owner],vectors[owner],b,p+'_surface'),source=sourceFor(surface);
      assert.deepEqual(api.parseModel(source).objects[0],surface);const ids=localIds(p),bundle=api.buildParametricFace(surface,ids);
      assert.deepEqual(api.validateFaceBundle(bundle),{incidenceValid:true,geometricValidity:'not-certified',solid:false});bundles.push(bundle);authored.push({surface,source,ids});
    }
    const before=json(bundles),ids=globalIds(prefix),descriptor=api.buildRectangleAdjacency(...bundles,ids),validation=api.validateRectangleAdjacency(descriptor);
    assert.deepEqual(validation,{incidenceValid:true,geometryFamily:'exact-axis-rectangles-v0',sharedEdges:1,closed:false,solid:false});assert.equal(json(bundles),before);
    for(let owner=0;owner<2;owner++) {
      const {surface,source}=authored[owner],bundle=descriptor.faces[owner].bundle,exported=api.exportIGES(bundle.geometry,bundle.geometry.objects.map(o=>o.id)),queries=[];
      for(let i=0;i<4;i++) {
        const pcurve=bundle.topology.loop.uses[i].pcurve,curve=bundle.geometry.objects[i+1],rows=[];
        for(const f of fractions) {
          const parameter=f,uv=pcurve.uv0.map((x,k)=>x===pcurve.uv1[k]?x:(1-f)*x+f*pcurve.uv1[k]),d=api.evaluateCurveD1(curve,parameter),s=api.evaluateSurfaceD1(surface,...uv);
          const analyticPoint=origins[owner].map((x,k)=>x+uv[0]*vectors[owner][k]+uv[1]*b[k]),analyticDerivative=(i%2===0?vectors[owner]:b).map(x=>i>=2?-x:x);
          close(d.point,analyticPoint);close(d.derivative,analyticDerivative,true);close(s.point,analyticPoint);close(s.du,vectors[owner],true);close(s.dv,b,true);rows.push({parameter,uv,...d,analyticPoint,analyticDerivative});
        }
        queries.push(rows);
      }
      const label=name+(owner===0?'-left':'-right'),contents={'css':source,'bundle.json':json(bundle),'native.json':json(surface),'ids.json':json(authored[owner].ids),'iges':exported.iges,'export-report.json':json(exported.report),'queries.json':json(queries)};
      for(const [suffix,bytes]of Object.entries(contents))writeFileSync(resolve(output,label+'.'+suffix),bytes);
      faceRecords.push({wrapperId:descriptor.faces[owner].id,bundle,files:{source:label+'.css',bundle:label+'.bundle.json',iges:label+'.iges',exportReport:label+'.export-report.json'},hashes:{source:hash(source),bundle:hash(contents['bundle.json']),iges:hash(exported.iges),exportReport:hash(contents['export-report.json'])},exportReport:exported.report,queries,expectedAreaMM2:Math.hypot(...vectors[owner])*Math.hypot(...b),expectedUnitNormal:normal,authoredOrigin:origins[owner],authoredA:vectors[owner],authoredB:b});
    }
    const sharedSamples=fractions.map(leftParameter=>{
      const rightParameter=1-leftParameter,l=api.evaluateCurveD1(descriptor.faces[0].bundle.geometry.objects[2],leftParameter),r=api.evaluateCurveD1(descriptor.faces[1].bundle.geometry.objects[4],rightParameter);
      close(l.point,r.point);close(l.derivative,r.derivative.map(x=>-x),true);
      return {leftParameter,rightParameter,leftPoint:l.point,rightPoint:r.point,leftDerivative:l.derivative,rightDerivative:r.derivative};
    });
    const contents={'descriptor.json':json(descriptor),'validation.json':json(validation),'global-ids.json':json(ids),'shared-samples.json':json(sharedSamples)};const artifactHashes={};for(const [suffix,bytes]of Object.entries(contents)){writeFileSync(resolve(output,name+'.'+suffix),bytes);artifactHashes[suffix]=hash(bytes);}
    fixtures.push({name,descriptor,validation,faces:faceRecords,sharedSamples,repeatedLocalIds:repeat,artifactHashes});
  }
  const folded={kind:'surface',id:'folded',degreeU:2,degreeV:1,knotsU:[0,0,0,1,1,1],knotsV:[0,0,1,1],controlPoints:[[[0,0,0],[0,1,0]],[[3,0,0],[3,1,0]],[[1,0,0],[1,1,0]]],weights:[[1,1],[1,1],[1,1]]};
  const collapsed=side([0,0,0],[0,0,0],[0,3,0],'collapsed'),unsupportedControls={};
  for(const [name,surface]of [['folded',folded],['collapsed',collapsed]]) {
    api.validateSurface(surface);let bundle=null,error;
    try {bundle=api.buildParametricFace(surface,localIds(name));api.buildRectangleAdjacency(bundle,fixtures[0].descriptor.faces[1].bundle,globalIds('unsupported'));}catch(failure){error=failure.message;}
    assert.ok(error,'Unsupported family obtained adjacency');
    const curves=bundle?bundle.geometry.objects.slice(1):['v-min','u-max','v-max','u-min'].map((boundary,i)=>api.extractSurfaceBoundary(surface,{boundary,id:name+'_c'+i}));
    const geometry=bundle?.geometry??{name:'unsupported_geometry',version:0,lengthUnit:'mm',objects:[surface,...curves]},exported=api.exportIGES(geometry,geometry.objects.map(o=>o.id)),source=sourceFor(surface);
    const contents={'css':source,'native.json':json(surface),'iges':exported.iges,'export-report.json':json(exported.report)};for(const [suffix,bytes]of Object.entries(contents))writeFileSync(resolve(output,name+'.'+suffix),bytes);
    unsupportedControls[name]={surface,productStatus:'rejected',reason:error,bundle,localValidation:bundle?api.validateFaceBundle(bundle):null,files:{source:name+'.css',native:name+'.native.json',iges:name+'.iges',exportReport:name+'.export-report.json'},hashes:{source:hash(source),native:hash(contents['native.json']),iges:hash(exported.iges),exportReport:hash(contents['export-report.json'])},exportReport:exported.report};
  }
  const manifest={base:'a26e5533a812e30b0b49f1bd4a1087da22c79bbe',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),producer:'Actual extracted CAD ESM archive; exact qualified two-rectangle incidence',fixtures,unsupportedControls,limitations:['Per-face geometry IGES does not serialize global/shared topology.','Existing local face status remains not-certified; not closed or solid.']};
  writeFileSync(resolve(output,'manifest.json'),json(manifest));writeFileSync(resolve(output,'manifest.sha256'),hash(json(manifest))+'\n');console.log('Packed adjacency evidence: '+output);return manifest;
}
