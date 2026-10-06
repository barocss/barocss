import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const codeRoot=resolve(import.meta.dirname,'../../..'),hash=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
export const boxShellEvidenceRoot=()=>resolve(process.env.BAROCSS_CAD_BOX_SHELL_EVIDENCE??'/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-523/box-shell');
function runProductControls(descriptor,api) {
 const changedFace=(d,kind)=>{const b=d.faces[0].bundle,s=structuredClone(b.geometry.objects[0]);if(kind==='inward'){s.controlPoints.reverse();s.weights.reverse();}if(kind==='near')s.controlPoints=s.controlPoints.map(row=>row.map(p=>p.map((x,k)=>x+(k===0?1e-10:0))));if(kind==='partial')for(let u=0;u<2;u++)s.controlPoints[u][1]=s.controlPoints[u][0].map((x,k)=>(x+s.controlPoints[u][1][k])/2);const ids={faceId:b.topology.face.id,loopId:b.topology.loop.id,vertexIds:b.topology.vertices.map(v=>v.id),edgeIds:b.topology.edges.map(e=>e.id),curveIds:b.geometry.objects.slice(1).map(c=>c.id)};d.faces[0].bundle=api.buildParametricFace(s,ids);assert.equal(api.validateFaceBundle(d.faces[0].bundle).incidenceValid,true);};
 const mutations={'missing-face':d=>d.faces.pop(),'duplicate-face':d=>d.faces[1].bundle=structuredClone(d.faces[0].bundle),'inward-face':d=>changedFace(d,'inward'),'reversed-edge-use':d=>d.edges[0].uses[1].sense='forward','missing-use':d=>d.edges[0].uses.pop(),'duplicate-use':d=>d.edges[0].uses.push({...d.edges[0].uses[0]}),'wrong-owner':d=>d.edges[0].canonical.faceId=d.faces[0].id,'wrong-vertex':d=>d.edges[0].vertexIds.reverse(),'minute-point':d=>d.vertices[0].point[0]+=1e-10,'near-face':d=>changedFace(d,'near'),'partial-face':d=>changedFace(d,'partial'),'zero-side':d=>d.sides[0]=0};
 const result={};for(const [name,mutate]of Object.entries(mutations)){const d=structuredClone(descriptor);mutate(d);let reason;try{api.validateAxisBoxShell(d);}catch(error){reason=error.message;}assert.ok(reason,name);result[name]={status:'rejected',reason};}return result;
}
/** All shell records come from actual extracted committed product APIs. */
export function writeBoxShellEvidence(api) {
const root=boxShellEvidenceRoot();mkdirSync(root,{recursive:true});
const faceNames=['x-min','x-max','y-min','y-max','z-min','z-max'],faceCorners=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]],segments=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]],normals=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
const localIds={faceId:'local_face',loopId:'local_loop',vertexIds:['local_v0','local_v1','local_v2','local_v3'],edgeIds:['local_e0','local_e1','local_e2','local_e3'],curveIds:['local_c0','local_c1','local_c2','local_c3']};
const globalIds=p=>({shellId:p+'_shell',faceIds:faceNames.map(n=>p+'_'+n.replace('-','_')),vertexIds:[0,1,2,3,4,5,6,7].map(i=>p+'_v'+i),edgeIds:segments.map((_,i)=>p+'_e'+i)});
const pairIds=(p,owners)=>({adjacencyId:p+'_pair',faceIds:owners,vertexIds:[0,1,2,3,4,5].map(i=>p+'_v'+i),edgeIds:[0,1,2,3,4,5,6].map(i=>p+'_e'+i)});
const definitions=[['minimum-box',[0,0,0],[1,1,1]],['noncubic-box',[0,0,0],[2,3,5]],['translated-box',[-7,11,-13],[4,6,9]],['boundary-box',[9998,-10000,0],[2,3,1]]];
const fractions=[0,.03,.07,.11,.17,.23,.29,.37,.43,.5,.57,.63,.71,.77,.83,.89,.93,.97,1];
const near=(a,b,derivative=false)=>assert.ok(Math.hypot(...a.map((x,k)=>x-b[k]))<=(derivative?1e-9*Math.max(1,Math.hypot(...b)):1e-9));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
const sourceFor=s=>'@model box_source {version:0;length-unit:mm;@surface #'+s.id+' {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[0,0,1,1];control-points:'+JSON.stringify(s.controlPoints)+';weights:[[1,1],[1,1]];}}\n';
const lookupCurve=(descriptor,ref)=>{const face=descriptor.faces.find(f=>f.id===ref.faceId);return face.bundle.geometry.objects.find(c=>c.id===ref.curveId);};
const fixtures=[];
for(const [name,origin,sides]of definitions) {
  const prefix=name.replaceAll('-','_'),vertices=Array.from({length:8},(_,i)=>origin.map((x,k)=>x+((i>>k)&1)*sides[k])),bundles=[],authored=[];
  for(let fi=0;fi<6;fi++) {
    const [i0,i1,i2,i3]=faceCorners[fi],corners=[vertices[i0],vertices[i1],vertices[i2],vertices[i3]],A=corners[1].map((x,k)=>x-corners[0][k]),B=corners[3].map((x,k)=>x-corners[0][k]);
    const surface={kind:'surface',id:'local_patch',degreeU:1,degreeV:1,knotsU:[0,0,1,1],knotsV:[0,0,1,1],controlPoints:[[corners[0].slice(),corners[3].slice()],[corners[1].slice(),corners[2].slice()]],weights:[[1,1],[1,1]]},bundle=api.buildParametricFace(surface,localIds),source=sourceFor(surface);
    const sourceResult=api.compileCadModel(source,{sourceVersion:0});assert.equal(sourceResult.ok,true,JSON.stringify(sourceResult.diagnostics));assert.deepEqual(sourceResult.model.objects[0],surface);assert.deepEqual(api.validateFaceBundle(bundle),{incidenceValid:true,geometricValidity:'not-certified',solid:false});
    assert.deepEqual(cross(A,B).map(x=>x===0?0:Math.sign(x)),normals[fi]);bundles.push(bundle);authored.push({surface,source,origin:corners[0],A,B,normal:normals[fi],area:Math.hypot(...A)*Math.hypot(...B)});
  }
  const before=json(bundles),ids=globalIds(prefix),descriptor=api.buildAxisBoxShell(origin,sides,bundles,ids),validation=api.validateAxisBoxShell(descriptor);assert.equal(json(bundles),before);
  const faces=[],nativeMeasurements={area:0,fluxVolume:0,faceFluxes:[]};
  for(let fi=0;fi<6;fi++) {
    const data=authored[fi],bundle=descriptor.faces[fi].bundle,queries=[];
    for(let edge=0;edge<4;edge++) {
      const pc=bundle.topology.loop.uses[edge].pcurve,curve=bundle.geometry.objects[edge+1],rows=[];
      for(const parameter of fractions) {
        const uv=pc.uv0.map((x,k)=>x===pc.uv1[k]?x:(1-parameter)*x+parameter*pc.uv1[k]),cd=api.evaluateCurveD1(curve,parameter),sd=api.evaluateSurfaceD1(data.surface,...uv),analyticPoint=data.origin.map((x,k)=>x+uv[0]*data.A[k]+uv[1]*data.B[k]),analyticDerivative=(edge%2===0?data.A:data.B).map(x=>edge>=2?-x:x);
        near(cd.point,analyticPoint);near(cd.derivative,analyticDerivative,true);near(sd.point,analyticPoint);near(sd.du,data.A,true);near(sd.dv,data.B,true);rows.push({parameter,uv,...cd,analyticPoint,analyticDerivative});
      }
      queries.push(rows);
    }
    const center=api.evaluateSurfaceD1(data.surface,.5,.5),normalArea=cross(center.du,center.dv),area=Math.hypot(...normalArea),faceFlux=dot(center.point,normalArea)/3;
    near(normalArea,data.normal.map(x=>x*data.area),true);nativeMeasurements.area+=area;nativeMeasurements.fluxVolume+=faceFlux;nativeMeasurements.faceFluxes.push({faceId:descriptor.faces[fi].id,centroid:center.point,du:center.du,dv:center.dv,normalArea,areaMM2:area,signedFluxVolumeMM3:faceFlux});
    const exported=api.exportIGES(bundle.geometry,bundle.geometry.objects.map(o=>o.id)),folder='fixtures/'+name+'/'+faceNames[fi];mkdirSync(resolve(root,folder),{recursive:true});
    const contents={'source.css':data.source,'native.json':json(data.surface),'bundle.json':json(bundle),'actual.iges':exported.iges,'export-report.json':json(exported.report),'queries.json':json(queries),'ids.json':json(localIds)};for(const [name,bytes]of Object.entries(contents))writeFileSync(resolve(root,folder,name),bytes);
    const files={source:folder+'/source.css',bundle:folder+'/bundle.json',iges:folder+'/actual.iges',exportReport:folder+'/export-report.json'},hashes={};for(const [key,file]of Object.entries(files))hashes[key]=hash(readFileSync(resolve(root,file)));
    faces.push({wrapperId:descriptor.faces[fi].id,bundle,files,hashes,exportReport:exported.report,queries,authoredOrigin:data.origin,authoredA:data.A,authoredB:data.B,expectedAreaMM2:data.area,expectedUnitNormal:data.normal});
  }
  const analyticVolumeMM3=sides[0]*sides[1]*sides[2],analyticAreaMM2=2*(sides[0]*sides[1]+sides[1]*sides[2]+sides[2]*sides[0]);
  assert.ok(Math.abs(nativeMeasurements.fluxVolume-analyticVolumeMM3)<=1e-7*Math.max(1,analyticVolumeMM3));assert.ok(Math.abs(nativeMeasurements.area-analyticAreaMM2)<=1e-7*Math.max(1,analyticAreaMM2));nativeMeasurements.volume=analyticVolumeMM3;
  const edgeQueries=descriptor.edges.map((edge,ei)=>fractions.map(parameter=>{
    const forwardRef=edge.uses[0],reverseRef=edge.uses[1],f=api.evaluateCurveD1(lookupCurve(descriptor,forwardRef),parameter),r=api.evaluateCurveD1(lookupCurve(descriptor,reverseRef),1-parameter),[i0,i1]=segments[ei],expectedPoint=vertices[i0].map((x,k)=>x+parameter*(vertices[i1][k]-x)),expectedDerivative=vertices[i1].map((x,k)=>x-vertices[i0][k]);
    near(f.point,expectedPoint);near(r.point,expectedPoint);near(f.derivative,expectedDerivative,true);near(r.derivative,expectedDerivative.map(x=>-x),true);
    return {parameter,forward:{...forwardRef,parameter,point:f.point,derivative:f.derivative},reverse:{...reverseRef,parameter:1-parameter,point:r.point,derivative:r.derivative},expectedPoint,expectedDerivative};
  }));
  const productReuseEvidence=descriptor.edges.map((edge,ei)=>{
    const owners=edge.uses.map(use=>descriptor.faces.find(f=>f.id===use.faceId)),attempts=[];
    for(const order of [[0,1],[1,0]]) {
      let productDescriptor,error;try{productDescriptor=api.buildOrthogonalRectangleAdjacency(owners[order[0]].bundle,owners[order[1]].bundle,pairIds(prefix+'_edge'+ei+'_order'+order[0],order.map(k=>owners[k].id)));}catch(failure){error=failure.message;}
      attempts.push({faceIds:order.map(k=>owners[k].id),status:productDescriptor?'accepted':'rejected',error,actualSharedBoundary:productDescriptor?productDescriptor.edges[1].uses.map(ref=>({...ref,boundary:ref.sense==='forward'?'u-max':'u-min'})):null});
    }
    return {globalEdgeId:edge.id,segment:segments[ei],localBoundaries:edge.uses.map(use=>{const face=descriptor.faces.find(f=>f.id===use.faceId),index=face.bundle.topology.edges.findIndex(e=>e.id===use.edgeId);return {faceId:face.id,boundary:face.bundle.topology.loop.uses[index].boundary};}),accepted:attempts.some(a=>a.status==='accepted'),attempts};
  });
  const acceptedIndices=productReuseEvidence.flatMap((row,i)=>row.accepted?[i]:[]);assert.deepEqual(acceptedIndices,[4,5,9]);assert.equal(json(bundles),before);
  const fixture={name,origin,sides,authoredIds:ids,descriptor,validation,faces,edgeQueries,nativeMeasurements,analyticVolumeMM3,analyticAreaMM2,productReuseEvidence};
  writeFileSync(resolve(root,'fixtures',name,'global-ids.json'),json(ids));fixtures.push(fixture);writeFileSync(resolve(root,'fixtures',name,'descriptor.json'),json(descriptor));writeFileSync(resolve(root,'fixtures',name,'edge-queries.json'),json(edgeQueries));writeFileSync(resolve(root,'fixtures',name,'native-measurements.json'),json(nativeMeasurements));writeFileSync(resolve(root,'fixtures',name,'product-reuse.json'),json(productReuseEvidence));
}
const negativeControls=runProductControls(fixtures[0].descriptor,api),sourceControls={};
for(const [name,change]of [['non-axis',s=>{s.controlPoints[1][0][0]+=1;s.controlPoints[1][1][0]+=1;}],['weighted',s=>{s.weights=[[1,2],[3,4]];}],['invalid-native',s=>{s.controlPoints[0][0][0]=null;}]]) {
  const surface=structuredClone(fixtures[0].faces[0].bundle.geometry.objects[0]);change(surface);let nativeValid=true,reason;
  try{api.validateSurface(surface);}catch(error){nativeValid=false;reason=error.message;}
  if(nativeValid){const bundle=api.buildParametricFace(surface,localIds),d=structuredClone(fixtures[0].descriptor);d.faces[0].bundle=bundle;try{api.validateAxisBoxShell(d);}catch(error){reason=error.message;}}
  assert.ok(reason,name);sourceControls[name]={surface,nativeValid,classification:nativeValid?'valid-native-unsupported':'invalid-native',reason};
}
const fold={kind:'surface',id:'folded',degreeU:2,degreeV:1,knotsU:[0,0,0,1,1,1],knotsV:[0,0,1,1],controlPoints:[[[0,0,0],[0,1,0]],[[3,0,0],[3,1,0]],[[1,0,0],[1,1,0]]],weights:[[1,1],[1,1],[1,1]]},collapse={kind:'surface',id:'collapsed',degreeU:1,degreeV:1,knotsU:[0,0,1,1],knotsV:[0,0,1,1],controlPoints:[[[0,0,0],[0,1,0]],[[0,0,0],[0,1,0]]],weights:[[1,1],[1,1]]},unsupportedControls={};
for(const [name,surface]of [['folded',fold],['collapsed',collapse]]) {
  api.validateSurface(surface);let bundle=null,reason;try{bundle=api.buildParametricFace(surface,localIds);const d=structuredClone(fixtures[0].descriptor);d.faces[0].bundle=bundle;api.validateAxisBoxShell(d);}catch(error){reason=error.message;}assert.ok(reason);
  const curves=bundle?bundle.geometry.objects.slice(1):['v-min','u-max','v-max','u-min'].map((boundary,i)=>api.extractSurfaceBoundary(surface,{boundary,id:'control_c'+i})),geometry=bundle?.geometry??{name:'unsupported',version:0,lengthUnit:'mm',objects:[surface,...curves]},exported=api.exportIGES(geometry,geometry.objects.map(o=>o.id)),folder='controls/'+name;mkdirSync(resolve(root,folder),{recursive:true});
  const source='@model control {version:0;length-unit:mm;@surface #'+surface.id+' {type:nurbs;degree-u:'+surface.degreeU+';degree-v:'+surface.degreeV+';knots-u:'+JSON.stringify(surface.knotsU)+';knots-v:'+JSON.stringify(surface.knotsV)+';control-points:'+JSON.stringify(surface.controlPoints)+';weights:'+JSON.stringify(surface.weights)+';}}';
  const contents={'source.css':source,'native.json':json(surface),'actual.iges':exported.iges,'export-report.json':json(exported.report)};for(const [name,bytes]of Object.entries(contents))writeFileSync(resolve(root,folder,name),bytes);const files={source:folder+'/source.css',native:folder+'/native.json',iges:folder+'/actual.iges',exportReport:folder+'/export-report.json'},hashes={};for(const [key,file]of Object.entries(files))hashes[key]=hash(readFileSync(resolve(root,file)));
  unsupportedControls[name]={surface,productStatus:'rejected',reason,bundle,localValidation:bundle?api.validateFaceBundle(bundle):null,files,hashes,exportReport:exported.report};
}

const manifest={base:'b5b77bbaee14f7da2203ec67b53d2687f2ce1ac8',head:execFileSync('git',['rev-parse','HEAD'],{cwd:codeRoot,encoding:'utf8'}).trim(),producer:'Actual extracted committed product buildAxisBoxShell/validateAxisBoxShell; no private research graph',fixtures,negativeControls,sourceControls,unsupportedControls,limitations:['Restricted exact outward closed boundary only; public solidfalse/solidProductImplementedfalse.','Current pair API accepts only3of12fixed outward box pairs; no face reparameterization.','Six separate5objectModels retain Model16; no sewing/sharedIsSame/topology interchange or original solid/STEP.']};
writeFileSync(resolve(root,'manifest.json'),json(manifest));writeFileSync(resolve(root,'manifest.sha256'),hash(json(manifest))+'\n');writeFileSync(resolve(root,'negative-controls.json'),json(negativeControls));writeFileSync(resolve(root,'source-controls.json'),json(sourceControls));console.log('Packed original box-shell evidence: '+root);return manifest;
}
