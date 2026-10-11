import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const receipt = JSON.parse(await readFile(resolve(app, 'evidence/cad-line-width-extrusion-graph-consumer.json'), 'utf8'));
assert.equal(receipt.status, 'passed', 'Only a passed public CPU receipt can supply this illustration');
assert.equal(receipt.sourceProfile.sourcePin, '705ea16d17d23492900b92b3ff1e19e07125ef01');
const panels = receipt.visualization.panels;
assert.deepEqual(panels.map(panel => panel.id), ['initial', 'updated', 'suppressed', 'reopened-edit']);
assert.equal(panels.length, 4);
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const subtract = (a,b) => a.map((n,i) => n-b[i]);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a.reduce((sum,n,i) => sum+n*b[i],0);
const norm = a => Math.hypot(...a);

// Every contour comes from the complete returned tensor-product Surface.
// Degree1/unit weights give actual straight boundary segments between these poles.
function faceCorners(record) {
  const surface = record.surface;
  assert.equal(surface.kind, 'surface');
  assert.equal(surface.id, record.sourceQualification.surfaceId);
  assert.equal(surface.degreeU, 1); assert.equal(surface.degreeV, 1);
  assert.deepEqual(surface.knotsU, [0,0,1,1]); assert.deepEqual(surface.knotsV, [0,0,1,1]);
  assert.equal(surface.controlPoints.length, 2);
  assert.equal(surface.weights.length, 2);
  for (let u=0;u<2;u++) {
    assert.equal(surface.controlPoints[u].length, 2); assert.equal(surface.weights[u].length, 2);
    for (let v=0;v<2;v++) {
      const point = surface.controlPoints[u][v];
      assert.equal(point.length, 3);
      assert.ok(point.every(n => finite(n) && Math.abs(n)<=10000));
      assert.equal(surface.weights[u][v], 1);
    }
  }
  for (const field of ['context','sourceField','modelName','surfaceId'])
    assert.ok(typeof record.sourceQualification[field] === 'string' && record.sourceQualification[field].length);
  assert.ok(typeof record.faceId === 'string' && record.faceId.length);
  const corners = [surface.controlPoints[0][0],surface.controlPoints[1][0],
    surface.controlPoints[1][1],surface.controlPoints[0][1]].map(point => [...point]);
  const a=subtract(corners[1],corners[0]),b=subtract(corners[3],corners[0]),normal=cross(a,b);
  assert.ok(norm(normal)>0, 'Degenerate Face corners are not illustrated');
  const residual=Math.abs(dot(normal,subtract(corners[2],corners[0])));
  assert.ok(residual<=1e-10*norm(normal)*Math.max(norm(a),norm(b),1), 'Returned Face poles must be coplanar');
  return corners;
}
for (const panel of panels) {
  assert.ok(Number.isInteger(panel.revision) && panel.revision>=0);
  assert.ok(finite(panel.widthMM) && panel.widthMM>0 && finite(panel.heightMM) && panel.heightMM>0);
  assert.equal(typeof panel.suppressed, 'boolean');
  assert.equal(panel.surfaces.length, panel.suppressed ? 1 : 6);
  assert.equal(panel.quality.solid, false);
  if (!panel.suppressed) {
    assert.equal(panel.surfaces.filter(record=>record.role==='bottom').length,1);
    assert.equal(panel.surfaces.filter(record=>record.role==='top').length,1);
    assert.deepEqual(panel.surfaces.filter(record=>/^wall-[0-3]$/.test(record.role)).map(record=>record.role).sort(),['wall-0','wall-1','wall-2','wall-3']);
    assert.ok(panel.surfaces.every(record=>typeof record.sourceId==='string' && record.sourceId.length));
  }
  panel.faces = panel.surfaces.map(record => ({record,corners:faceCorners(record)}));
}

// One orthographic camera and one physical display scale for all panels.
// No panel is resized to its own bounds, and no geometry is generated from bounds.
const azimuth=Math.PI/6,elevation=Math.PI/6,scale=2.8;
const horizontal=[Math.cos(azimuth),-Math.sin(azimuth),0];
const downward=[Math.sin(azimuth)*Math.sin(elevation),Math.cos(azimuth)*Math.sin(elevation),-Math.cos(elevation)];
const towardViewer=cross(horizontal,downward);
const projected=panels.flatMap(panel=>panel.faces.flatMap(face=>face.corners.map(point=>[dot(point,horizontal),dot(point,downward)])));
const minX=Math.min(...projected.map(p=>p[0])),maxX=Math.max(...projected.map(p=>p[0]));
const minY=Math.min(...projected.map(p=>p[1])),maxY=Math.max(...projected.map(p=>p[1]));
const center=[(minX+maxX)/2,(minY+maxY)/2];
assert.ok((maxX-minX)*scale<=412 && (maxY-minY)*scale<=116, 'This fixed layout must fit without per-panel rescaling');
const point = p => [232+(dot(p,horizontal)-center[0])*scale,105+(dot(p,downward)-center[1])*scale];
const fmt = value => Number(value.toFixed(3));
function workLine(panel) {
  if (!panel.newWork) return '';
  const newWork=panel.newWork,prior=panel.priorValidation;
  for (const value of Object.values(newWork)) assert.ok(Number.isInteger(value)&&value>=0);
  const text=`New work W${newWork.widthBuildCallCount}/E${newWork.extrusionBuildCallCount}`;
  if (!prior) return text;
  return `${text} · prior validation W${prior.widthBuildCallCount}/E${prior.extrusionBuildCallCount}`;
}
function drawPanel(panel,index) {
  const x=index%2===0?24:512,y=index<2?84:286;
  const counts=panel.counts;
  const detail=panel.suppressed
    ? `width ${panel.widthMM} mm · extrusion suppressed`
    : `width ${panel.widthMM} mm · height ${panel.heightMM} mm`;
  const sourceCounts=panel.suppressed ? 'Width Face only; no Shell'
    : `${counts.faceAssets ?? panel.surfaces.length} Face assets · ${counts.pairedEdges} qualified pairs`;
  if (!panel.suppressed) {
    assert.equal(counts.faceAssets,6); assert.equal(counts.pairedEdges,12);
    assert.equal(counts.vertexClasses,8); assert.equal(counts.edges,12); assert.equal(counts.faces,6);
  }
  const faces=[...panel.faces].sort((a,b)=>dot(a.corners.reduce((sum,p)=>sum.map((n,i)=>n+p[i]/4),[0,0,0]),towardViewer)
    -dot(b.corners.reduce((sum,p)=>sum.map((n,i)=>n+p[i]/4),[0,0,0]),towardViewer));
  const shapes=faces.map(({record,corners},faceIndex)=>{
    const points=corners.map(p=>point(p).map(fmt).join(',')).join(' ');
    const fill=record.role==='top'?'#cbdfea':record.role==='bottom'?'#e7e1d5':panel.suppressed?'#d7e5df':'#d7e5df';
    return `<polygon id="${esc(panel.id)}-face-${faceIndex}" points="${points}" fill="${fill}" fill-opacity=".48" stroke="#29465b" stroke-width="1.35" stroke-linejoin="round" data-source-id="${esc(record.sourceId ?? '')}" data-face-id="${esc(record.faceId)}" data-surface-id="${esc(record.surface.id)}"><title>${esc(record.sourceQualification.context)} · ${esc(record.sourceQualification.sourceField)} · ${esc(record.sourceQualification.modelName)} · Surface ${esc(record.surface.id)}</title></polygon>`;
  }).join('\n');
  return `<g transform="translate(${x} ${y})" data-panel="${esc(panel.id)}">
<rect width="464" height="190" rx="9" fill="#f6f8fa" stroke="#d4dde4"/>
<text x="16" y="23" class="panel-title">${index+1} · ${esc(panel.label)}</text>
<text x="16" y="42" class="small">Revision ${panel.revision} · ${esc(detail)}</text>
${shapes}
<text x="16" y="170" class="small">${esc(sourceCounts)}</text>
<text x="16" y="184" class="micro">${esc(workLine(panel))}</text>
</g>`;
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="524" viewBox="0 0 1000 524" role="img" aria-labelledby="title description">
<title id="title">CPU Face-corner illustration</title>
<desc id="description">Four actual CAD graph states projected from complete returned planar degree1 Surface poles. The same orthographic camera and millimetre scale are used in every panel. This is a static explanatory illustration, not a GPU render, editor result or Solid proof.</desc>
<style>text{font-family:Arial,Helvetica,sans-serif;fill:#193347}.title{font-size:25px;font-weight:700}.subtitle{font-size:13px}.panel-title{font-size:16px;font-weight:700}.small{font-size:12px}.micro{font-size:10px;fill:#526a7b}</style>
<rect width="1000" height="524" fill="#ffffff"/>
<text x="24" y="33" class="title">CPU Face-corner illustration</text>
<text x="24" y="57" class="subtitle">Original Line → width Face → dependent extrusion · actual returned Surface coefficients</text>
${panels.map(drawPanel).join('\n')}
<text x="24" y="498" class="subtitle">Shared orthographic camera · 2.8 px/mm · Surface IDs are retained in each polygon's title and metadata.</text>
<text x="24" y="517" class="micro">Illustration colors only. Closed abstract Shell data is not a geometric, volume, GPU, editor or Solid certificate.</text>
</svg>\n`;
const output=resolve(app,'docs/public/examples/cad-line-width-extrusion-graph.svg');
await writeFile(output,svg);
console.log(JSON.stringify({output:'docs/public/examples/cad-line-width-extrusion-graph.svg',bytes:Buffer.byteLength(svg),panels:panels.length,
 surfaces:panels.map(panel=>({id:panel.id,surfaces:panel.surfaces.length,revision:panel.revision,widthMM:panel.widthMM,heightMM:panel.heightMM})),
 projection:'Orthographic30deg azimuth/30deg elevation',pixelsPerMM:scale,authority:'Complete returned2x2unitweightplanarSurface poles',actualGL:false}));
