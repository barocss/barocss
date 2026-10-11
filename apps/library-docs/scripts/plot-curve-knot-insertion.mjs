import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const receipt=JSON.parse(await readFile(resolve(app,'evidence/cad-curve-knot-insertion-consumer.json'),'utf8'));
assert.equal(receipt.status,'passed');
assert.equal(receipt.sourceProfile.sourcePin,'705ea16d17d23492900b92b3ff1e19e07125ef01');
const data=receipt.visualization;
assert.equal(data.unit,'mm');assert.deepEqual(data.domain,[2,7]);assert.equal(data.knot,4.5);
assert.equal(data.samples.length,65);assert.equal(data.applicationD0Calls,130);
assert.equal(data.globalShapeCertificate,false);
const before=data.originalCurve,after=data.refinedCurve;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validPoint=point=>{
 assert.equal(point.length,3);assert.ok(point.every(finite));assert.equal(point[2],0);
 return point;
};
for(const [curve,count] of [[before,3],[after,4]]){
 assert.equal(curve.kind,'curve');assert.equal(curve.id,'quarter');assert.equal(curve.degree,2);
 assert.equal(curve.controlPoints.length,count);assert.equal(curve.weights.length,count);
 assert.equal(curve.knots.length,count+curve.degree+1);
 assert.equal(curve.knots[curve.degree],data.domain[0]);assert.equal(curve.knots[count],data.domain[1]);
 assert.ok(curve.weights.every(weight=>finite(weight)&&weight>=1e-6&&weight<=1e6));
 curve.controlPoints.forEach(validPoint);
}
assert.equal(before.knots.filter(knot=>knot===data.knot).length,0);
assert.equal(after.knots.filter(knot=>knot===data.knot).length,1);
let observed=0;
for(const [index,sample] of data.samples.entries()){
 assert.equal(sample.parameter,2+5*index/64);
 validPoint(sample.originalPointMM);validPoint(sample.refinedPointMM);
 observed=Math.max(observed,Math.hypot(...sample.originalPointMM.map((n,i)=>n-sample.refinedPointMM[i])));
}
assert.equal(observed,data.maximumGridPointDifferenceMM);
const marker=data.samples.find(sample=>sample.parameter===data.knot);
assert.ok(marker);assert.deepEqual(data.knotSample,marker);
// The display is an XY projection only because all actual points/poles are at Z=0.
// One scale/origin is shared by both panels; no fitting to each result separately.
const pixelsPerMM=10.8,origin=[78,294];
const allPoints=[...before.controlPoints,...after.controlPoints,...data.samples.flatMap(sample=>[sample.originalPointMM,sample.refinedPointMM])];
assert.ok(allPoints.every(point=>point[0]>=0&&point[0]<=20&&point[1]>=0&&point[1]<=20));
const project=point=>[origin[0]+point[0]*pixelsPerMM,origin[1]-point[1]*pixelsPerMM];
const coordinate=n=>Number(n.toFixed(3));
const pair=point=>project(point).map(coordinate).join(',');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const position=point=>`[${point.map(coordinate).join(',')}]`;
function axes(){
 return `<path d="M78 68V294H339" fill="none" stroke="#8194a1" stroke-width="1"/>
<text x="61" y="310" class="small">0</text>
<text x="329" y="316" class="small">X (mm)</text>
<text x="18" y="73" class="small">Y (mm)</text>
${[5,10,15,20].map(value=>{
 const x=origin[0]+value*pixelsPerMM,y=origin[1]-value*pixelsPerMM;
 return `<path d="M${coordinate(x)} 291V297M75 ${coordinate(y)}H81" stroke="#8194a1" stroke-width="1"/>
<text x="${coordinate(x)}" y="311" text-anchor="middle" class="micro">${value}</text>
<text x="68" y="${coordinate(y+3)}" text-anchor="end" class="micro">${value}</text>`;
 }).join('\n')}`;
}
function controls(curve,color,prefix,ghost=false){
 const line=`<polyline points="${curve.controlPoints.map(pair).join(' ')}" fill="none" stroke="${color}" stroke-width="${ghost?1.5:2}" ${ghost?'stroke-dasharray="5 4" opacity=".42"':''}/>`;
 if(ghost)return line;
 return line+curve.controlPoints.map((point,index)=>{
 const [x,y]=project(point);
 let labelX=x+11,labelY=y-8;
 if(index===0)labelY=y+1;
 if(point[0]===0)labelY=y-9;
 return `<circle cx="${coordinate(x)}" cy="${coordinate(y)}" r="4.2" fill="${color}" stroke="#fff" stroke-width="1" data-curve-id="${esc(curve.id)}" data-pole-index="${index}" data-native-point-mm="${esc(JSON.stringify(point))}"><title>${prefix}${index} native pole ${esc(JSON.stringify(point))}; weight ${curve.weights[index]}</title></circle>
<text x="${coordinate(labelX)}" y="${coordinate(labelY)}" class="pole" fill="${color}">${prefix}${index} ${esc(position(point).replace(',0]',']'))}</text>`;
 }).join('\n');
}
function panel(curve,index){
 const x=index===0?24:512,field=index===0?'originalPointMM':'refinedPointMM';
 const color=index===0?'#bd6b1e':'#7952a1',prefix=index===0?'P':'Q';
 const [mx,my]=project(marker[field]);
 const trace=data.samples.map(sample=>pair(sample[field])).join(' ');
 return `<g transform="translate(${x} 74)" data-source-context="${index===0?'original':'refined'}" data-curve-id="${esc(curve.id)}">
<rect width="464" height="350" rx="9" fill="#f7f9fb" stroke="#d7e0e6"/>
<text x="16" y="25" class="panel-title">${index===0?'Before insertion':'After insertion at u = 4.5'}</text>
<text x="16" y="45" class="small">Curve #${esc(curve.id)} · degree ${curve.degree} · ${curve.controlPoints.length} poles · domain [2,7]</text>
${axes()}
${index===1?controls(before,'#bd6b1e','P',true):''}
${controls(curve,color,prefix)}
<polyline points="${trace}" fill="none" stroke="#1977a7" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" data-public-evaluations="65"><title>65 actual public evaluations in the original dimensionless parameter domain</title></polyline>
<circle cx="${coordinate(mx)}" cy="${coordinate(my)}" r="5" fill="#fff" stroke="#1977a7" stroke-width="2"/>
<text x="${coordinate(mx+12)}" y="${coordinate(my-11)}" class="small" fill="#176991">u = 4.5</text>
<text x="${coordinate(mx+12)}" y="${coordinate(my+3)}" class="micro">${esc(position(marker[field]).replace(',0]',']'))} mm</text>
<text x="16" y="337" class="micro">Weights: ${esc(curve.weights.map(weight=>Number(weight.toFixed(6))).join(', '))} · knot count ${curve.knots.length}</text>
</g>`;
}
const difference=data.maximumGridPointDifferenceMM.toExponential(3);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="470" viewBox="0 0 1000 470" role="img" aria-labelledby="title description">
<title id="title">Knot refinement: actual CPU curve data</title>
<desc id="description">Native rational Curve quarter in millimetres. The 65 actual before/after public evaluations share one XY scale; blue curves coincide at this display precision while the actual control polygon changes from three to four poles. The u4.5 marker is a recorded public evaluation. This illustration and local observations do not certify global shape error, GPU pixels, editor display or topology.</desc>
<style>text{font-family:Arial,Helvetica,sans-serif;fill:#20394a}.title{font-size:24px;font-weight:700}.panel-title{font-size:17px;font-weight:700}.small{font-size:12px}.micro{font-size:10px;fill:#5c7282}.pole{font-size:11px}</style>
<rect width="1000" height="470" fill="#fff"/>
<text x="24" y="31" class="title">Knot refinement · actual CPU curve data</text>
<g transform="translate(24 53)"><path d="M0 0H24" stroke="#1977a7" stroke-width="3"/><text x="32" y="4" class="small">Evaluated curve</text>
<path d="M169 0H193" stroke="#bd6b1e" stroke-width="2"/><text x="201" y="4" class="small">Original control polygon</text>
<path d="M376 0H400" stroke="#7952a1" stroke-width="2"/><text x="408" y="4" class="small">Refined control polygon</text></g>
${panel(before,0)}
${panel(after,1)}
<text x="24" y="446" class="small">Same ${pixelsPerMM} px/mm XY scale · Z = 0 · u is dimensionless · 65-point observed max change ${difference} mm</text>
<text x="24" y="463" class="micro">130 application D0 calls, separate from provider observations. Local samples are not a global certificate or GPU/editor proof.</text>
</svg>\n`;
await writeFile(resolve(app,'docs/public/examples/cad-curve-knot-insertion.svg'),svg);
console.log(JSON.stringify({output:'docs/public/examples/cad-curve-knot-insertion.svg',bytes:Buffer.byteLength(svg),size:[1000,470],
 curveIds:[before.id,after.id],poles:[before.controlPoints.length,after.controlPoints.length],samplesPerCurve:65,
 knot:data.knot,pixelsPerMM,maximumGridPointDifferenceMM:data.maximumGridPointDifferenceMM,actualGL:false}));
