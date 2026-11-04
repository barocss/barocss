// D422: actual STEP Open with native and independent sampled hemisphere coverage; no outbound actions.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';

assert.ok(process.argv[2] && process.argv[3], 'Output and frozen STEP fixture folders are required');
const input = resolve(process.argv[3]);
const manifest = JSON.parse(await readFile(join(input, 'cases.json'), 'utf8'));
assert.deepEqual(manifest.meridianNormal, [0, 1, 0]);
assert.deepEqual(manifest.cases.map(c => c.name), ['tiny-far', 'centered-control']);
const cases = await Promise.all(manifest.cases.map(async c => ({ ...c, step: await readFile(join(input, c.file), 'utf8') })));
for (const c of cases) assert.equal(sha256(c.step), c.sha256);

const inspectorSource = `
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {partBreps} from '@barocss/cad-model/engine/evaluate';
import {checkBrep,evaluateSurface,surfaceDomain,brepMassProperties,brepSurfaceArea} from '@barocss/cad';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),c=JSON.parse(process.argv[3]);
assert.equal(doc.nodes.length,1);assert.equal(doc.nodes[0].kind,'import');assert.equal(doc.nodes[0].step,c.step);
const bodies=partBreps(doc);assert.equal(bodies.length,1);const brep=bodies[0].brep;
const check=checkBrep(brep,{strict:true});assert.equal(check.valid,true);
assert.deepEqual([brep.bodies.length,brep.shells.length,brep.faces.length,brep.edges.length,brep.vertices.length],[1,1,2,2,2]);
const faces=[];
for(const face of brep.faces){
 const surface=face.surface;assert.equal(surface.kind,'surface');const domain=surfaceDomain(surface),samples=[];
 for(const a of [.125,.25,.5,.75,.875])for(const b of [.25,.5,.75]){
  const u=domain.u[0]+a*(domain.u[1]-domain.u[0]),v=domain.v[0]+b*(domain.v[1]-domain.v[0]);
  const point=evaluateSurface(surface,u,v),relative=point.map((value,i)=>value-c.center[i]);
  samples.push({a,b,u,v,point,relative});
 }
 const midpoint=samples.find(sample=>sample.a===.5&&sample.b===.5);assert.ok(Math.abs(midpoint.relative[1])>=.9*c.radius);
 const sign=Math.sign(midpoint.relative[1]);assert.ok(samples.every(sample=>sign*sample.relative[1]>=.1*c.radius));
 const geometry={degreeU:surface.degreeU,degreeV:surface.degreeV,knotsU:surface.knotsU,knotsV:surface.knotsV,controlPoints:surface.controlPoints,weights:surface.weights};
 faces.push({name:face.name,geometryHash:createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),surface,domain,samples,midpoint});
}
assert.notEqual(faces[0].geometryHash,faces[1].geometryHash,'Native surfaces must differ beyond IDs');
assert.ok(faces[0].midpoint.relative[1]*faces[1].midpoint.relative[1]<0,'Opposite meridian hemispheres');
let massObservation;try{const mass=brepMassProperties(brep,1);massObservation={volume:mass.volume,area:brepSurfaceArea(brep),method:mass.method};}catch(error){massObservation={error:String(error)};}
console.log(JSON.stringify({name:c.name,radius:c.radius,center:c.center,units:{length:'mm',area:'mm^2',volume:'mm^3',parameter:'dimensionless'},counts:check.counts,strictValid:check.valid,faces,massObservation,
 analyticReference:{volume:4/3*Math.PI*c.radius**3,area:4*Math.PI*c.radius**2},massAcceptance:'NOT_CLAIMED'}));
`;
const oracleSource = String.raw`
"""Independent centered-control-point Cox samples; not a global hemisphere/solid certificate."""
import copy
import json
import math
import sys

TOLERANCE = 1e-7

def basis(p, knots, count, x):
    if x == knots[count]:
        return [0.] * (count - 1) + [1.]
    values = [1. if knots[i] <= x < knots[i+1] else 0. for i in range(len(knots)-1)]
    for degree in range(1, p+1):
        result = []
        for i in range(len(values)-1):
            left, right = knots[i+degree]-knots[i], knots[i+degree+1]-knots[i+1]
            result.append((0 if not left else (x-knots[i])*values[i]/left) +
                          (0 if not right else (knots[i+degree+1]-x)*values[i+1]/right))
        values = result
    return values[:count]

def relative_point(surface, u, v, center):
    cp, weights = surface['controlPoints'], surface['weights']
    bu = basis(surface['degreeU'], surface['knotsU'], len(cp), u)
    bv = basis(surface['degreeV'], surface['knotsV'], len(cp[0]), v)
    total, point = 0., [0., 0., 0.]
    for i in range(len(cp)):
        for j in range(len(cp[0])):
            coefficient = bu[i]*bv[j]*weights[i][j]
            total += coefficient
            for axis in range(3):
                point[axis] += coefficient*(cp[i][j][axis]-center[axis])
    assert total > 0 and math.isfinite(total), 'positive rational denominator'
    return [value/total for value in point]

def check(case):
    assert len(case['faces']) == 2
    radius, center = case['radius'], case['center']
    mids, face_results = [], []
    for face in case['faces']:
        surface = face['surface']
        expected_u = [surface['knotsU'][surface['degreeU']], surface['knotsU'][len(surface['controlPoints'])]]
        expected_v = [surface['knotsV'][surface['degreeV']], surface['knotsV'][len(surface['controlPoints'][0])]]
        assert face['domain'] == {'u': expected_u, 'v': expected_v}, 'native domain observation'
        sign, minimum, residual, agreement, count = None, float('inf'), 0., 0., 0
        expected_grid = [(a,b) for a in [.125,.25,.5,.75,.875] for b in [.25,.5,.75]]
        assert [(sample['a'],sample['b']) for sample in face['samples']] == expected_grid, 'complete selected interior grid'
        independent_points = []
        for sample in face['samples']:
            u = expected_u[0] + sample['a']*(expected_u[1]-expected_u[0])
            v = expected_v[0] + sample['b']*(expected_v[1]-expected_v[0])
            point = relative_point(surface,u,v,center)
            independent_points.append(point)
            radius_error = abs(math.hypot(*point)-radius)
            assert radius_error <= TOLERANCE, 'sphere support radius residual'
            delta = math.dist(point,sample['relative'])
            assert delta <= TOLERANCE, 'independent/product D0 disagreement'
            if sample['a'] == .5 and sample['b'] == .5:
                assert abs(point[1]) >= .9*radius, 'equator midpoint coverage'
                sign = 1 if point[1] > 0 else -1
                mids.append(point)
            residual, agreement, count = max(residual,radius_error),max(agreement,delta),count+1
        assert sign is not None
        for point in independent_points:
            minimum = min(minimum,sign*point[1]/radius)
        assert minimum >= .1, 'interior hemisphere side margin'
        face_results.append({'name':face['name'],'samples':count,'sign':sign,'minimumInteriorFraction':minimum,
                             'maximumRadiusResidual':residual,'maximumProductD0Difference':agreement})
    assert mids[0][1]*mids[1][1] < 0, 'two patches occupy the same hemisphere'
    assert math.dist(mids[0],mids[1]) >= 1.8*radius, 'native geometry separation'
    return {'name':case['name'],'faces':face_results,'midpointSeparation':math.dist(mids[0],mids[1])}

try:
    payload=json.load(sys.stdin)
    results=[check(case) for case in payload['cases']]
    negative=[]
    for case in payload['cases']:
        changed=copy.deepcopy(case)
        changed['faces'][1]=copy.deepcopy(changed['faces'][0])
        try:
            check(changed)
        except AssertionError as error:
            negative.append({'name':case['name'],'detected':str(error)})
        else:
            raise AssertionError('duplicate hemisphere negative control survived')
    print(json.dumps({'status':'PASS','units':{'length':'mm','area':'mm^2','volume':'mm^3','parameter':'dimensionless'},'sampleTolerance':TOLERANCE,'cases':results,
                      'duplicateHemisphereControls':negative,'productImports':0,
                      'scope':'Finite interior D0 samples, not global coverage or mass acceptance'},indent=2))
except (AssertionError,KeyError,ValueError) as error:
    print(json.dumps({'status':'FAIL','error':str(error)}))
    sys.exit(1)
`;
const f = await createFlow({
  name: 'step-sphere-hemisphere', envFrozen: 'STEP_SPHERE_HEMISPHERE_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'D422_ORDINARY_SPHERE_HEMISPHERE_COVERAGE', inspectorSource, oracleSource,
  initialFiles: ['apps/cad-studio/test/step-sphere-hemisphere-browser.mjs', 'packages/barocss-cad/test/step-sphere-coverage-fixtures.mjs', join(input,'cases.json'), ...cases.map(c=>join(input,c.file))],
  requiredFrozen: ['apps/cad-studio/src/files/importedFile.ts', 'packages/barocss-cad/src/io/step-import.ts', 'packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits: [
    'Original ordinary tiny-far sphere and existing centered control; new sphere OFFSET support remains deferred.',
    'Native geometry and independent centered-CP Cox interior samples establish this bounded opposite-hemisphere witness; finite sampling is not a universal coverage certificate.',
    'Full support patches have seam padding. Only the selected interior samples carry a strict hemisphere sign assertion.',
    'Volume/area are observations only; tiny/far mass bias is separate and not accepted by this flow. The far screenshot alone is not a coverage oracle.',
    'No Save, export preparation, outbound downloads, OCP, paid calls, new public API or dependency.',
  ],
});
const observations = [];
await f.run(async () => {
  const fonts = { stylesheets: 0, assets: 0 }, newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await context.route('https://fonts.googleapis.com/**', route => { fonts.stylesheets++; return route.fulfill({status:200,contentType:'text/css',body:''}); });
    await context.route('https://fonts.gstatic.com/**', route => { fonts.assets++; return route.fulfill({status:204,body:''}); });
    return context;
  };
  try { await f.newPage(); } finally { f.browser.newContext = newContext; }
  for (const [index,c] of cases.entries()) {
    const label = `${String(index+1).padStart(2,'0')}-${c.name}`;
    f.phase = `Open ${c.name} ordinary sphere and inspect both native hemispheres`;
    await f.page.setInputFiles('input[aria-label="Model file"]',join(input,c.file));
    await f.page.waitForFunction(expected => window.__studioDoc?.nodes?.length === 1 && window.__studioDoc.nodes[0].kind === 'import' && window.__studioDoc.nodes[0].step === expected && window.__studioBodies?.()?.bodies.length === 1,c.step,{timeout:60000});
    await f.ready();
    const toast = await f.waitToast(/STEP opened.*1 solid/,60000),doc = await f.doc();
    assert.equal(doc.nodes[0].step,c.step);assert.equal(doc.units,'mm');
    const native = await f.inspect(label,doc,c);
    observations.push(native);
    await f.same(doc);
    await f.page.getByRole('button',{name:'Iso',exact:true}).click();
    await f.page.getByTitle('Frame all (F)',{exact:true}).click();
    f.report.observations.push({label,inputSha256:c.sha256,exactStoredImportText:true,toast,native,massAcceptance:'NOT_CLAIMED'});
    await writeFile(join(f.output,`${label}-native.json`),JSON.stringify(native,null,2));
    await f.snapshot(label);
  }
  await f.runOracle({cases:observations},'03-independent-hemisphere-coverage');
  f.report.fontNetwork=fonts;
  assert.equal(fonts.assets,0);assert.equal(f.report.downloads.length,0);
});
