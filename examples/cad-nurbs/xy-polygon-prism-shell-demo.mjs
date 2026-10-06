import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildXYPolygonRegion,buildXYPolygonPrismShell as build,validateXYPolygonPrismShell as validate,classifyXYPolygonPlanarFacePoint as classify,evaluateSurfaceD1} from '../../packages/barocss-cad/dist/index.js';

const output=resolve(process.argv[2]??'/tmp/barocss-polygon-prism-shell-prototype');mkdirSync(output,{recursive:true});
const L=[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]],definitions=[{id:'triangle',points:[[0,0],[3,0],[0,3]]},{id:'L',points:L},{id:'L_cw',points:[...L].reverse()}],summaries=[],failures=[];
const write=(name,value)=>writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+'\n');
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const midpointD1=surface=>evaluateSurfaceD1(surface,(surface.knotsU[surface.degreeU]+surface.knotsU[surface.controlPoints.length])/2,(surface.knotsV[surface.degreeV]+surface.knotsV[surface.controlPoints[0].length])/2);
const modelPoints=model=>model.objects.flatMap(object=>object.kind==='curve'?object.controlPoints:object.controlPoints.flat());
for(const definition of definitions){
 const profile=buildXYPolygonRegion(definition),result=build(profile.curve,{bodyId:definition.id+'_body',distanceMM:6}),{shell,report}=result,n=definition.points.length;
 assert.deepEqual(validate(shell),report);assert.deepEqual(shell.profile,profile.curve);assert.equal(shell.distanceMM,6);
 assert.equal(report.faceCount,n+2);assert.equal(report.vertexCount,2*n);assert.equal(report.edgeCount,3*n);assert.equal(report.edgeUseCount,6*n);assert.equal(report.incidenceValid,true);assert.equal(report.closed,true);assert.equal(report.geometricValidity,'not-certified');assert.equal(report.topologyCertified,false);assert.equal(report.solid,false);
 assert.equal(shell.faces.length,n+2);assert.equal(shell.vertices.length,2*n);assert.equal(shell.edges.length,3*n);assert.equal(shell.edges.reduce((count,edge)=>count+edge.uses.length,0),6*n);assert.ok(shell.edges.every(edge=>edge.uses.length===2&&edge.uses[0].sense!==edge.uses[1].sense));
 const caps=shell.faces.filter(face=>face.kind==='placed-polygon-cap'),sides=shell.faces.filter(face=>face.kind==='lateral-face');assert.equal(caps.length,2);assert.equal(sides.length,n);
 const capNormals=[];
 for(const cap of caps){const z=cap.placement.translation[2];assert.ok(z===0||z===6);assert.ok(modelPoints(cap.world.geometry).every(point=>point[2]===z));assert.ok(cap.world.topology.vertices.every(vertex=>vertex.point[2]===z));assert.equal(cap.placement.orientation,z===0?'reverse':'forward');const surface=cap.world.geometry.objects.find(object=>object.kind==='surface');assert.ok(surface);const {du,dv}=midpointD1(surface),normal=cross(du,dv),direction=cap.placement.orientation==='reverse'?-1:1;assert.ok(direction*normal[2]*(z===0?-1:1)>0);capNormals.push({id:cap.id,z,placementOrientation:cap.placement.orientation,orientedNormal:normal.map(value=>direction*value)});assert.ok(cap.world.geometry.objects.length<=16);write(definition.id+'.'+cap.id+'.world-model.json',cap.world.geometry);write(definition.id+'.'+cap.id+'.placement.json',cap.placement);}
 assert.deepEqual(caps.map(cap=>cap.placement.translation[2]).sort((a,b)=>a-b),[0,6]);
 const local=caps[0].local;
 if(definition.id.startsWith('L'))assert.equal(classify(local,[2,2,0]).classification,'outside');
 const lateralNormals=[];
 for(const side of sides){const surface=side.bundle.geometry.objects.find(object=>object.kind==='surface');assert.ok(surface);const {point,du,dv}=midpointD1(surface),normal=cross(du,dv),length=Math.hypot(...normal);assert.ok(length>0);assert.ok(normal[2]===0);const outside=[point[0]+.125*normal[0]/length,point[1]+.125*normal[1]/length,0];assert.equal(classify(local,outside).classification,'outside');assert.equal(side.bundle.geometry.objects.length,5);lateralNormals.push({id:side.id,midpoint:point,normal});write(definition.id+'.'+side.id+'.model.json',side.bundle.geometry);}
 writeFileSync(resolve(output,definition.id+'.profile.css'),profile.source);write(definition.id+'.profile.json',profile.curve);write(definition.id+'.shell.json',shell);write(definition.id+'.report.json',report);
 summaries.push({id:definition.id,profileId:profile.curve.id,bodyId:shell.id,faceIds:shell.faces.map(face=>face.id),counts:{faces:report.faceCount,vertices:report.vertexCount,edges:report.edgeCount,uses:report.edgeUseCount},capNormals,lateralNormals,sourceEdges:shell.edges.map(edge=>({id:edge.id,source:edge.source,canonical:edge.canonical})),notch:definition.id.startsWith('L')?'outside':null});
 if(definition.id==='L')for(const kind of ['qualified-curve-reference','missing-use','opposed-use']){const bad=structuredClone(shell);if(kind==='qualified-curve-reference')bad.edges[0].uses[0].curveId='nonexistent_curve';else if(kind==='missing-use')bad.edges[0].uses.pop();else bad.edges[0].uses[1].sense=bad.edges[0].uses[0].sense;assert.throws(()=>validate(bad),error=>{assert.ok(error instanceof Error);failures.push({kind,message:error.message});return true;});assert.deepEqual(validate(shell),report);write('rejected-'+kind+'.shell.json',bad);}
}
const summary={summaries,failures,scope:'Original placed trim caps/lateral faces and oriented closed incidence only; geometric/topology/solid certification and broad validation deferred.'};write('summary.json',summary);console.log(JSON.stringify(summary));
