import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const codeRoot=resolve(import.meta.dirname,'../../..');
const hash=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
export const orthogonalEvidenceRoot=()=>resolve(process.env.BAROCSS_CAD_ORTHOGONAL_EVIDENCE??'/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-519/orthogonal');
/** The host supplies actual freshly extracted product ESM APIs, never research graphs. */
export function writeOrthogonalEvidence(api) {
const root=orthogonalEvidenceRoot();mkdirSync(root,{recursive:true});
const vector=(axis,magnitude)=>[0,1,2].map(i=>i===axis?magnitude:0),rectangle=(origin,A,B,id='local_patch')=>({kind:'surface',id,degreeU:1,degreeV:1,knotsU:[0,0,1,1],knotsV:[0,0,1,1],controlPoints:[[origin.slice(),origin.map((x,k)=>x+B[k])],[origin.map((x,k)=>x+A[k]),origin.map((x,k)=>x+A[k]+B[k])]],weights:[[1,1],[1,1]]});
const ids={faceId:'local_face',loopId:'local_loop',vertexIds:['local_v0','local_v1','local_v2','local_v3'],edgeIds:['local_e0','local_e1','local_e2','local_e3'],curveIds:['local_c0','local_c1','local_c2','local_c3']};
const globalIds=p=>({adjacencyId:p+'_adjacency',faceIds:[p+'_left',p+'_right'],vertexIds:[0,1,2,3,4,5].map(i=>p+'_v'+i),edgeIds:[0,1,2,3,4,5,6].map(i=>p+'_e'+i)});
const order=[[0,1,2,[0,-1,0],[1,0,0]],[0,2,1,[0,0,1],[-1,0,0]],[1,0,2,[1,0,0],[0,-1,0]],[1,2,0,[0,0,-1],[0,1,0]],[2,0,1,[-1,0,0],[0,0,1]],[2,1,0,[0,1,0],[0,0,-1]]];
const definitions=[];
for(let i=0;i<6;i++) {
  const [aa,cc,bb,ln,rn]=order[i];definitions.push({name:'ordered-'+aa+'-'+cc,origin:[0,0,0],A:vector(aa,4),C:vector(cc,2),B:vector(bb,3),leftNormal:ln,rightNormal:rn});
  const sa=i%3===0?-1:1,sc=i%3===1?-1:1,sb=i%3===2?-1:1;
  definitions.push({name:'signed-'+aa+'-'+cc,origin:[101+7*i,-203+11*i,19-5*i],A:vector(aa,sa*(5+i)),C:vector(cc,sc*(2+i)),B:vector(bb,sb*(4+i)),leftNormal:ln.map(x=>x===0?0:x*sa*sb),rightNormal:rn.map(x=>x===0?0:x*sc*sb)});
}
const fractions=[0,.03,.07,.11,.17,.23,.29,.37,.43,.5,.57,.63,.71,.77,.83,.89,.93,.97,1];
const near=(a,b,derivative=false)=>assert.ok(Math.hypot(...a.map((x,k)=>x-b[k]))<=(derivative?1e-9*Math.max(1,Math.hypot(...b)):1e-9));
const ntext=n=>Math.abs(n)>0&&Math.abs(n)<1e-6?n.toFixed(15):String(n),array=a=>'['+a.map(x=>Array.isArray(x)?array(x):ntext(x)).join(',')+']';
const sourceFor=s=>'@model orthogonal_source {version:0;length-unit:mm;@surface #'+s.id+' {type:nurbs;degree-u:'+s.degreeU+';degree-v:'+s.degreeV+';knots-u:'+array(s.knotsU)+';knots-v:'+array(s.knotsV)+';control-points:'+array(s.controlPoints)+';weights:'+array(s.weights)+';}}\n';
const fixtures=[];
for(const d of definitions) {
  const prefix=d.name.replaceAll('-','_'),originR=d.origin.map((x,k)=>x+d.A[k]),surfaces=[rectangle(d.origin,d.A,d.B),rectangle(originR,d.C,d.B)],bundles=surfaces.map(s=>api.buildParametricFace(s,ids)),before=json(bundles),classification={status:'supported',descriptor:{origin:d.origin,A:d.A,B:d.B,C:d.C,leftNormal:d.leftNormal,rightNormal:d.rightNormal,normalDot:0}};
  assert.equal(classification.status,'supported');assert.deepEqual(classification.descriptor.leftNormal,d.leftNormal);assert.deepEqual(classification.descriptor.rightNormal,d.rightNormal);assert.equal(classification.descriptor.normalDot,0);
  const descriptor=api.buildOrthogonalRectangleAdjacency(...bundles,globalIds(prefix)),validation=api.validateOrthogonalRectangleAdjacency(descriptor);assert.equal(json(bundles),before);
  let productError;try{api.buildRectangleAdjacency(...bundles,globalIds(prefix));}catch(error){productError=error.message;}assert.match(productError,/family gate/);
  const faces=[];
  for(let owner=0;owner<2;owner++) {
    const bundle=descriptor.faces[owner].bundle,surface=surfaces[owner],origin=owner===0?d.origin:originR,A=owner===0?d.A:d.C,source=sourceFor(surface),queries=[];
    const sourceResult=api.compileCadModel(source,{sourceVersion:0});assert.equal(sourceResult.ok,true,JSON.stringify(sourceResult.diagnostics));assert.deepEqual(sourceResult.model.objects[0],surface);assert.deepEqual(api.validateFaceBundle(bundle),{incidenceValid:true,geometricValidity:'not-certified',solid:false});
    for(let edge=0;edge<4;edge++) {
      const map=bundle.topology.loop.uses[edge].pcurve,curve=bundle.geometry.objects[edge+1],rows=[];
      for(const parameter of fractions) {
        const uv=map.uv0.map((x,k)=>x===map.uv1[k]?x:(1-parameter)*x+parameter*map.uv1[k]),cd=api.evaluateCurveD1(curve,parameter),sd=api.evaluateSurfaceD1(surface,...uv),analyticPoint=origin.map((x,k)=>x+uv[0]*A[k]+uv[1]*d.B[k]),analyticDerivative=(edge%2===0?A:d.B).map(x=>edge>=2?-x:x);
        near(cd.point,analyticPoint);near(cd.derivative,analyticDerivative,true);near(sd.point,analyticPoint);near(sd.du,A,true);near(sd.dv,d.B,true);rows.push({parameter,uv,...cd,analyticPoint,analyticDerivative});
      }
      queries.push(rows);
    }
    const exported=api.exportIGES(bundle.geometry,bundle.geometry.objects.map(o=>o.id)),folder='fixtures/'+d.name+(owner===0?'/left':'/right');mkdirSync(resolve(root,folder),{recursive:true});
    const contents={'source.css':source,'native.json':json(surface),'bundle.json':json(bundle),'iges.igs':exported.iges,'export-report.json':json(exported.report),'queries.json':json(queries),'ids.json':json(ids)};for(const [name,bytes]of Object.entries(contents))writeFileSync(resolve(root,folder,name),bytes);
    const files={source:folder+'/source.css',bundle:folder+'/bundle.json',iges:folder+'/iges.igs',exportReport:folder+'/export-report.json'},hashes={};for(const [key,file]of Object.entries(files))hashes[key]=hash(readFileSync(resolve(root,file)));
    faces.push({wrapperId:descriptor.faces[owner].id,bundle,files,hashes,exportReport:exported.report,queries,authoredOrigin:origin,authoredA:A,authoredB:d.B,expectedAreaMM2:Math.hypot(...A)*Math.hypot(...d.B),expectedUnitNormal:owner===0?d.leftNormal:d.rightNormal});
  }
  const sharedSamples=fractions.map(leftParameter=>{const rightParameter=1-leftParameter,l=api.evaluateCurveD1(descriptor.faces[0].bundle.geometry.objects[2],leftParameter),r=api.evaluateCurveD1(descriptor.faces[1].bundle.geometry.objects[4],rightParameter);near(l.point,r.point);near(l.derivative,r.derivative.map(x=>-x),true);return {leftParameter,rightParameter,leftPoint:l.point,rightPoint:r.point,leftDerivative:l.derivative,rightDerivative:r.derivative};});
  fixtures.push({name:d.name,productCompatibility:{orthogonalAccepted:true,coplanarRejected:true},oldProductRejection:{status:'rejected',message:productError},left:{origin:d.origin,A:d.A,B:d.B},right:{origin:originR,A:d.C,B:d.B},classification,descriptor,validation,productRejection:{status:'rejected',message:productError},faces,sharedSamples});
  writeFileSync(resolve(root,'fixtures',d.name,'descriptor.json'),json(descriptor));writeFileSync(resolve(root,'fixtures',d.name,'shared-samples.json'),json(sharedSamples));
}
const base=fixtures[0],left=base.faces[0].bundle.geometry.objects[0],right=base.faces[1].bundle.geometry.objects[0],sourceControls={};
function classifySourcePair(name,l,r,expected='unsupported') {
  let actualStatus,reason;
  try{api.validateSurface(l);api.validateSurface(r);}catch(error){actualStatus='invalid';reason=error.message;}
  if(!actualStatus)try{api.buildOrthogonalRectangleAdjacency(api.buildParametricFace(l,ids),api.buildParametricFace(r,ids),globalIds('unsupported'));actualStatus='supported';}catch(error){actualStatus='unsupported';reason=error.message;}
  assert.equal(actualStatus,expected,name);sourceControls[name]={expectedStatus:expected,actualStatus,reason,left:l,right:r};
}
const copy=v=>structuredClone(v),nearSource=copy(right);nearSource.controlPoints=nearSource.controlPoints.map(row=>row.map(p=>p.map((x,k)=>x+(k===0?1e-10:0))));classifySourcePair('near-coincident-source',left,nearSource);
const partial=rectangle(base.right.origin,base.right.A,base.right.B.map(x=>x/3));classifySourcePair('partial-edge',left,partial);
const reversedB=rectangle(base.right.origin.map((x,k)=>x+base.right.B[k]),base.right.A,base.right.B.map(x=>-x));classifySourcePair('reversed-B',left,reversedB);
const coplanarRight=rectangle(base.right.origin,[2,0,0],base.right.B);classifySourcePair('coplanar',left,coplanarRight);
const weighted=copy(left);weighted.weights=[[1,2],[3,4]];classifySourcePair('weighted',weighted,right);
const rotated=rectangle([0,0,0],[3,4,0],[0,0,3]);classifySourcePair('rotated',rotated,right);
const noncanonical=copy(left);noncanonical.knotsU=[-2,-2,3,3];classifySourcePair('noncanonical-domain',noncanonical,right);
const wrongOrigin=rectangle([7,0,0],[0,2,0],[0,0,3]);classifySourcePair('disjoint-source',left,wrongOrigin);
const malformed=copy(left);malformed.controlPoints[0][0][0]=null;classifySourcePair('invalid-native',malformed,right,'invalid');
const fold={kind:'surface',id:'folded',degreeU:2,degreeV:1,knotsU:[0,0,0,1,1,1],knotsV:[0,0,1,1],controlPoints:[[[0,0,0],[0,1,0]],[[3,0,0],[3,1,0]],[[1,0,0],[1,1,0]]],weights:[[1,1],[1,1],[1,1]]},collapse=rectangle([0,0,0],[0,0,0],[0,3,0],'collapsed');classifySourcePair('folded',fold,right);classifySourcePair('collapsed',collapse,right);
const unsupportedControls={};for(const [name,surface]of [['folded',fold],['collapsed',collapse]]) {
  api.validateSurface(surface);let bundle=null,reason;try{bundle=api.buildParametricFace(surface,ids);try{api.buildOrthogonalRectangleAdjacency(bundle,base.faces[1].bundle,globalIds('unsupported'));}catch(error){reason=error.message;}}catch(error){reason=error.message;}
  const curves=bundle?bundle.geometry.objects.slice(1):['v-min','u-max','v-max','u-min'].map((boundary,i)=>api.extractSurfaceBoundary(surface,{boundary,id:'control_c'+i})),geometry=bundle?.geometry??{name:'control_geometry',version:0,lengthUnit:'mm',objects:[surface,...curves]},exported=api.exportIGES(geometry,geometry.objects.map(o=>o.id)),folder='controls/'+name;mkdirSync(resolve(root,folder),{recursive:true});
  const contents={'source.css':sourceFor(surface),'native.json':json(surface),'iges.igs':exported.iges,'export-report.json':json(exported.report)};for(const [name,bytes]of Object.entries(contents))writeFileSync(resolve(root,folder,name),bytes);
  const files={source:folder+'/source.css',native:folder+'/native.json',iges:folder+'/iges.igs',exportReport:folder+'/export-report.json'},hashes={};for(const [key,file]of Object.entries(files))hashes[key]=hash(readFileSync(resolve(root,file)));
  unsupportedControls[name]={surface,productStatus:'rejected',reason,bundle,localValidation:bundle?api.validateFaceBundle(bundle):null,files,hashes,exportReport:exported.report};
}
const coplanarBundle=api.buildParametricFace(coplanarRight,ids),coplanarDescriptor=api.buildRectangleAdjacency(base.faces[0].bundle,coplanarBundle,globalIds('coplanar_control')),coplanarReport=api.validateRectangleAdjacency(coplanarDescriptor);assert.deepEqual(coplanarReport,{incidenceValid:true,geometryFamily:'exact-axis-rectangles-v0',sharedEdges:1,closed:false,solid:false});

const mutations={
 'wrong-owner':d=>{d.edges[0].canonical.faceId=d.faces[1].id;},
 'wrong-sense':d=>{d.edges[1].uses[1].sense='forward';},
 'wrong-edge':d=>{d.edges[0].canonical.edgeId=d.faces[0].bundle.topology.edges[2].id;},
 'wrong-vertex':d=>{d.edges[0].vertexIds.reverse();},
 'missing-use':d=>{d.edges[1].uses.pop();},
 'duplicate-use':d=>{d.edges[1].uses.push({...d.edges[1].uses[0]});},
 'minute-point':d=>{d.vertices[0].point[0]+=1e-10;},
};
const graphControls={};for(const [name,mutate]of Object.entries(mutations)){const d=structuredClone(base.descriptor);mutate(d);let error;try{api.validateOrthogonalRectangleAdjacency(d);}catch(failure){error=failure.message;}assert.ok(error,name);graphControls[name]={status:'rejected',reason:error};}
assert.throws(()=>api.buildOrthogonalRectangleAdjacency(base.faces[0].bundle,coplanarBundle,globalIds('coplanar_new')),/family gate/);
const negativeControls={sourceControls,graphControls},compatibility={coplanar:{status:'accepted',descriptor:coplanarDescriptor,report:coplanarReport},orthogonalRejectedByOld:12};
const manifest={base:'edea773beb8b22b3c9eb36bc0858db04ad858bb5',head:execFileSync('git',['rev-parse','HEAD'],{cwd:codeRoot,encoding:'utf8'}).trim(),producer:'Actual extracted current product ESM archive; original additive orthogonal APIs',fixtures,negativeControls,compatibility,unsupportedControls,limitations:['Perpendicular normals form a crease, not smooth continuity.','Unchanged local bundles remain not-certified; no sewn/shared IsSame topology or closed solid.']};
writeFileSync(resolve(root,'manifest.json'),json(manifest));writeFileSync(resolve(root,'manifest.sha256'),hash(json(manifest))+'\n');writeFileSync(resolve(root,'negative-controls.json'),json(negativeControls));writeFileSync(resolve(root,'compatibility.json'),json(compatibility));console.log('Packed orthogonal product evidence: '+root);return manifest;
}
