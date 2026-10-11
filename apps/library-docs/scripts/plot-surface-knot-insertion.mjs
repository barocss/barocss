import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const receipt=JSON.parse(await readFile(resolve(app,'evidence/cad-surface-knot-insertion-consumer.json'),'utf8'));
const pin='705ea16d17d23492900b92b3ff1e19e07125ef01';
assert.equal(receipt.status,'passed');assert.equal(receipt.sourceProfile.sourcePin,pin);
const data=receipt.visualization;
assert.equal(data.unit,'mm');assert.equal(data.axis,'u');assert.equal(data.knot,4.5);
assert.deepEqual(data.domains,{u:[2,7],v:[-1,3]});
assert.deepEqual(data.grid,{countU:17,countV:9,ordering:'u-major-v-minor'});
assert.equal(data.samples.length,153);assert.equal(data.applicationD0Calls,306);
assert.equal(data.globalShapeCertificate,false);
assert.deepEqual(data.originalSurface,receipt.result.originalSurface);
assert.deepEqual(data.refinedSurface,receipt.result.surface);
assert.equal(receipt.result.report.selectedObjectIndex,1);
assert.equal(receipt.result.originalModel.name,'sheet_refinement');assert.equal(receipt.result.model.name,'sheet_refinement');
assert.deepEqual(receipt.result.model.objects.map(object=>object.id),['keep_line','quarter_sheet','keep_plane']);
const before=data.originalSurface,after=data.refinedSurface;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
function point(value){assert.ok(Array.isArray(value));assert.equal(value.length,3);assert.ok(value.every(finite));assert.ok(value.every(n=>Math.abs(n)<=10000));return value;}
for(const [surface,countU] of [[before,3],[after,4]]){
  assert.equal(surface.kind,'surface');assert.equal(surface.id,'quarter_sheet');
  assert.equal(surface.degreeU,2);assert.equal(surface.degreeV,1);
  assert.equal(surface.controlPoints.length,countU);assert.equal(surface.weights.length,countU);
  for(const [u,row] of surface.controlPoints.entries()){
    assert.equal(row.length,2);assert.equal(surface.weights[u].length,2);row.forEach(point);
    assert.ok(surface.weights[u].every(w=>finite(w)&&w>=1e-6&&w<=1e6));
  }
  assert.equal(surface.knotsU.length,countU+surface.degreeU+1);
  assert.equal(surface.knotsV.length,4);assert.ok(surface.knotsU.every(finite));assert.ok(surface.knotsV.every(finite));
  assert.deepEqual([surface.knotsU[2],surface.knotsU[countU]],[2,7]);
  assert.deepEqual(surface.knotsV,[-1,-1,3,3]);
}
assert.deepEqual(before.knotsU,[2,2,2,7,7,7]);assert.deepEqual(after.knotsU,[2,2,2,4.5,7,7,7]);
let observed=0;
for(const [index,sample] of data.samples.entries()){
  assert.equal(sample.u,2+5*Math.floor(index/9)/16);assert.equal(sample.v,-1+4*(index%9)/8);
  point(sample.originalPointMM);point(sample.refinedPointMM);
  observed=Math.max(observed,Math.hypot(...sample.originalPointMM.map((n,i)=>n-sample.refinedPointMM[i])));
}
assert.equal(observed,data.maximumGridPointDifferenceMM);
const center=data.samples[8*9+4];assert.deepEqual(data.centerSample,center);assert.equal(center.u,4.5);assert.equal(center.v,1);
assert.deepEqual(data.knotStations,data.samples.filter(sample=>sample.u===4.5));

// Shared orthographic XYZ projection; these SVG units are not CSS pixels/mm.
const azimuth=35*Math.PI/180,elevation=25*Math.PI/180,scale=7.2,origin=[202,354];
const project=([x,y,z])=>[
  origin[0]+scale*(Math.cos(azimuth)*x-Math.sin(azimuth)*y),
  origin[1]-scale*(Math.sin(elevation)*(Math.sin(azimuth)*x+Math.cos(azimuth)*y)+Math.cos(elevation)*z),
];
const all=[...before.controlPoints.flat(),...after.controlPoints.flat(),...data.samples.flatMap(s=>[s.originalPointMM,s.refinedPointMM])];
for(const p of all){const [x,y]=project(p);assert.ok(x>35&&x<420&&y>59&&y<365,'Projection must stay inside both panels');}
const n=value=>Number(value.toFixed(3));
const pair=p=>project(p).map(n).join(',');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const line=(points,color,width=1,extra='')=>`<polyline points="${points.map(pair).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
function axes(){
  const o=project([0,0,0]);
  return [[28,0,0,'X'],[0,28,0,'Y'],[0,0,36,'Z']].map(([x,y,z,label])=>{
    const e=project([x,y,z]);const labelX=label==='Z'?32:e[0]+4;
    return `<path d="M${n(o[0])} ${n(o[1])}L${n(e[0])} ${n(e[1])}" stroke="#92a4b0" stroke-width="1"/><text x="${n(labelX)}" y="${n(e[1]+4)}" class="small">${label} (mm)</text>`;
  }).join('');
}
function controls(surface,color,prefix,ghost=false){
  let svg='';const extra=ghost?'stroke-dasharray="4 4" opacity=".24"':'';
  for(const row of surface.controlPoints)svg+=line(row,color,ghost?1:2,extra);
  for(let v=0;v<2;v++)svg+=line(surface.controlPoints.map(row=>row[v]),color,ghost?1:2,extra);
  if(ghost)return svg;
  surface.controlPoints.forEach((row,u)=>row.forEach((p,v)=>{
    const [x,y]=project(p),label=`${prefix}${u},${v}`;
    svg+=`<circle cx="${n(x)}" cy="${n(y)}" r="3.9" fill="${color}" stroke="#fff" stroke-width="1"><title>${label}: native pole ${esc(JSON.stringify(p))} mm; weight ${surface.weights[u][v]}</title></circle><text x="${n(x+7)}" y="${n(y+(v===0?13:-8))}" class="pole" fill="${color}">${label}</text>`;
  }));
  return svg;
}
function panel(surface,index){
  const field=index===0?'originalPointMM':'refinedPointMM',color=index===0?'#bf6b20':'#7b50a2',prefix=index===0?'P':'Q';
  let grid='';
  for(let v=0;v<9;v++)grid+=line(Array.from({length:17},(_,u)=>data.samples[u*9+v][field]),'#1977a7',1.6,`data-fixed-v="${data.samples[v].v}"`);
  for(let u=0;u<17;u++)grid+=line(data.samples.slice(u*9,u*9+9).map(s=>s[field]),'#74adc5',.8,`data-fixed-u="${data.samples[u*9].u}"`);
  grid+=line(data.knotStations.map(s=>s[field]),'#07566f',2.7,'data-knot-u="4.5"');
  const [cx,cy]=project(center[field]);
  const vmin=project(data.samples[0][field]),vmax=project(data.samples[8][field]);
  const uend=project(data.samples[16*9][field]);
  return `<g transform="translate(${index===0?24:512} 80)" data-source-context="${index===0?'original':'refined'}" data-surface-id="quarter_sheet">
<rect width="464" height="432" rx="9" fill="#f7f9fb" stroke="#d7e0e6"/>
<text x="16" y="25" class="panel-title">${index===0?'Before U insertion':'After U knot 4.5'}</text>
<text x="16" y="45" class="small">U rows ${surface.controlPoints.length} × V columns 2 poles · degrees 2 × 1</text>
${axes()}
${index===1?controls(before,'#bf6b20','P',true):''}
${grid}${controls(surface,color,prefix)}
<circle cx="${n(cx)}" cy="${n(cy)}" r="4.7" fill="#fff" stroke="#07566f" stroke-width="2"/>
<text x="${n(cx+9)}" y="${n(cy-8)}" class="small">u=4.5, v=1</text>
<text x="${n(vmin[0]+8)}" y="${n(vmin[1]+25)}" class="micro">u=2, v=−1</text>
<text x="${n(vmax[0]+8)}" y="${n(vmax[1]-20)}" class="micro">v=3 · along Z</text>
<text x="${n(uend[0]-77)}" y="${n(uend[1]+26)}" class="micro">u=7 · around XY</text>
<text x="16" y="394" class="small">17 U stations × 9 V stations = 153 native evaluations</text>
<text x="16" y="412" class="micro">U [2,7] / V [−1,3] · parameters dimensionless · XYZ in mm</text>
</g>`;
}
const metadata={sourcePin:pin,modelName:receipt.result.model.name,surfaceId:before.id,originalSurface:before,refinedSurface:after,
  domains:data.domains,grid:data.grid,applicationD0Calls:306,maximumGridPointDifferenceMM:observed,
  projection:{kind:'orthographic-xyz',azimuthDegrees:35,elevationDegrees:25,svgUnitsPerMM:scale,sharedAcrossPanels:true},actualGL:false,globalShapeCertificate:false};
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="562" viewBox="0 0 1000 562" role="img" aria-labelledby="title description">
<title id="title">Surface knot insertion · CPU-evaluated native data</title>
<desc id="description">Two common-scale XYZ projections of the original and refined quarter_sheet Surface. Each blue evaluated grid contains 153 actual points. Orange and purple are the complete 3 by 2 and 4 by 2 control nets. U remains 2 to 7 and V remains minus 1 to 3. This is not GPU/editor output or a global shape certificate.</desc>
<metadata>${esc(JSON.stringify(metadata))}</metadata>
<style>text{font-family:Arial,Helvetica,sans-serif;fill:#233d4e}.title{font-size:24px;font-weight:700}.panel-title{font-size:17px;font-weight:700}.small{font-size:12px}.micro{font-size:10px;fill:#597283}.pole{font-size:10px}</style>
<rect width="1000" height="562" fill="#fff"/>
<text x="24" y="31" class="title">Surface knot insertion · actual CPU data</text>
<g transform="translate(24 54)"><path d="M0 0H22" stroke="#1977a7" stroke-width="2"/><text x="30" y="4" class="small">Evaluated U/V grid</text><path d="M194 0H216" stroke="#bf6b20" stroke-width="2"/><text x="224" y="4" class="small">Original control net</text><path d="M407 0H429" stroke="#7b50a2" stroke-width="2"/><text x="437" y="4" class="small">Refined control net</text></g>
${panel(before,0)}${panel(after,1)}
<text x="24" y="534" class="small">Shared XYZ projection/scale · 306 application D0 calls · grid observed max difference ${observed.toExponential(3)} mm</text>
<text x="24" y="552" class="micro">Separate from provider observations and whole-validator reconstruction. Local samples do not certify global shape error, topology or renderer admission.</text>
</svg>\n`;
await writeFile(resolve(app,'docs/public/examples/cad-surface-knot-insertion.svg'),svg);
console.log(JSON.stringify({output:'docs/public/examples/cad-surface-knot-insertion.svg',size:[1000,562],bytes:Buffer.byteLength(svg),samplesPerSurface:153,applicationD0Calls:306,controlGrids:[[3,2],[4,2]],maximumGridPointDifferenceMM:observed,actualGL:false}));
