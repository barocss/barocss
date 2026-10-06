import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildXYPolygonRegion,buildXYPolygonPrismPreview } from '../../packages/barocss-cad/dist/index.js';
const output=resolve(process.argv[2]??'/tmp/barocss-polygon-prism-prototype');mkdirSync(output,{recursive:true});
const definitions=[{id:'concave_L',points:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]],volume:42,area:110},{id:'triangle',points:[[0,0],[3,0],[0,3]],volume:27}];
const summaries=[];
for(const definition of definitions){
 const native=buildXYPolygonRegion({id:definition.id,points:definition.points});const result=buildXYPolygonPrismPreview({bodyId:definition.id+'_body',profile:native.curve,distanceMM:6,revision:1});assert.equal(result.report.volumeMM3,definition.volume);if(definition.area)assert.equal(result.report.areaMM2,definition.area);assert.deepEqual(result.report.boundsMM,{min:[0,0,0],max:definition.id==='concave_L'?[4,4,6]:[3,3,6]});assert.deepEqual(result.profile,native.curve);assert.equal(result.report.sideRanges.length,definition.points.length);assert.equal(result.report.capRanges.length,2);
 const clockwise=buildXYPolygonRegion({id:definition.id+'_cw',points:[...definition.points].reverse()});const cw=buildXYPolygonPrismPreview({bodyId:definition.id+'_cw_body',profile:clockwise.curve,distanceMM:6,revision:2});assert.deepEqual(cw.profile,clockwise.curve);assert.equal(cw.region.orientation,'cw');assert.equal(cw.report.volumeMM3,definition.volume);if(definition.area)assert.equal(cw.report.areaMM2,definition.area);
 for(const [name,data]of Object.entries({profile:result.profile,region:result.region,packet:result.packet,construction:result.construction,report:result.report,clockwise:cw}))writeFileSync(resolve(output,definition.id+'.'+name+'.json'),JSON.stringify(data,null,2)+'\n');writeFileSync(resolve(output,definition.id+'.source.css'),native.source);summaries.push({id:definition.id,vertexCount:result.report.vertexCount,triangleCount:result.report.triangleCount,volumeMM3:result.report.volumeMM3,areaMM2:result.report.areaMM2});
}
const profile=buildXYPolygonRegion({id:'reject_profile',points:[[0,0],[3,0],[0,3]]}).curve;let rejection;
try{buildXYPolygonPrismPreview({bodyId:'reject_body',profile,distanceMM:0,revision:1});assert.fail('zero distance accepted');}catch(error){rejection=error.message;assert.match(rejection,/distance|positive/);}
writeFileSync(resolve(output,'summary.json'),JSON.stringify({summaries,rejection,scope:'Actual capped native preview only; B-Rep/solid and broader validation deferred.'},null,2)+'\n');console.log(JSON.stringify({summaries,rejection}));
