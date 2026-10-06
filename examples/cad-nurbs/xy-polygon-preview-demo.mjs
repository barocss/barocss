import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildXYPolygonRegion, tessellateXYPolygonRegion } from '../../packages/barocss-cad/dist/index.js';
const output = resolve(process.argv[2] ?? '/tmp/barocss-polygon-preview-prototype'); mkdirSync(output, { recursive: true });
const cases = [
  { id: 'triangle', points: [[0,0],[3,0],[0,3]], vertices: 4, triangles: 3, area: 4.5 },
  { id: 'concave_L', points: [[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]], vertices: 6, triangles: 4, area: 7 },
];
const summaries = [];
for (const example of cases) {
  const native = buildXYPolygonRegion({ id: example.id, points: example.points });
  const preview = tessellateXYPolygonRegion(native.curve, { meshId: example.id + '_mesh', revision: 1 });
  assert.equal(preview.report.vertexCount, example.vertices); assert.equal(preview.report.triangleCount, example.triangles);
  let area = 0;
  for (let i = 0; i < preview.packet.indices.length; i += 3) {
    const [a,b,c] = preview.packet.indices.slice(i,i+3).map(index => preview.packet.positions.slice(index*3,index*3+3));
    const determinant = (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); assert.ok(determinant > 0); area += determinant / 2;
    if (example.id === 'concave_L') assert.ok(!((a[0]+b[0]+c[0])/3 > 1 && (a[1]+b[1]+c[1])/3 > 1), 'triangle intrudes into missing quadrant');
  }
  assert.equal(area, example.area);
  const clockwise = buildXYPolygonRegion({ id: example.id + '_cw', points: [...example.points].reverse() });
  const cw = tessellateXYPolygonRegion(clockwise.curve, { meshId: example.id + '_cw_mesh', revision: 2 });
  assert.deepEqual(cw.packet.positions.slice(0,example.points.length*3), clockwise.curve.controlPoints.slice(0,-1).flat());
  writeFileSync(resolve(output,example.id+'.source.css'),native.source);
  for (const [kind,value] of Object.entries({ curve:native.curve,packet:preview.packet,report:preview.report,region:preview.region,clockwise:cw })) writeFileSync(resolve(output,example.id+'.'+kind+'.json'),JSON.stringify(value,null,2)+'\n');
  summaries.push({ id:example.id,...preview.report,areaMM2:area });
}
let rejection;
try { buildXYPolygonRegion({ id:'crossed',points:[[0,0],[4,4],[0,4],[4,0]] }); assert.fail('crossed input accepted'); }
catch (error) { rejection=error.message; assert.match(rejection,/crossing|touch|overlap/); }
writeFileSync(resolve(output,'summary.json'),JSON.stringify({summaries,rejection,scope:'Actual native preview packets only; broader validation deferred.'},null,2)+'\n');
console.log(JSON.stringify({cases:summaries.map(({id,vertexCount,triangleCount,areaMM2})=>({id,vertexCount,triangleCount,areaMM2})),rejection}));
