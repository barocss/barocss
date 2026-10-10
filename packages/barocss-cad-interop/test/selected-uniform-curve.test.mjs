import { compileCadModel, curveDomain, sampleCurve } from '@barocss/cad';
import { parseBaroCadSelectedUniformCurveSource, validateBaroCadSelectedUniformCurveSourceOptions, BaroCadUniformCurveSourceError } from '@barocss/cad-interop/native-selected-uniform-curve';
import { parseBaroCadUniformCurveSource } from '@barocss/cad-interop/native-uniform-curve';
import { BaroCADSelectedUniformCurveLoader } from '@barocss/cad-interop/three-selected-uniform-curve';
import { BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Scene } from 'three';

const fact = (value, message) => { if (!value) throw new Error(message); };
function same(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) return ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && a.constructor === b.constructor && a.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));
  const keys = Reflect.ownKeys(a); return keys.length === Reflect.ownKeys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
const bits = (a, b) => a?.length === b.length && Array.from(a).every((value, index) => Object.is(value, b[index]));

/** Public CPU/Three object checkpoint shared by ordinary Node and genuine browser verifiers. */
export async function runSelectedUniformCurveRuntimeCheckpoint(asset) {
  const source = asset.originalSource, options = (count = 129, curveId = 'target_curve') => ({ sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count }, curveId });
  const compiled = compileCadModel(source, { sourceVersion: 0 }); fact(compiled.ok, 'Authentic whole source must compile');
  fact(compiled.model.objects.length === 3 && compiled.model.objects[1].kind === 'curve' && compiled.model.objects[1].id === 'target_curve', 'Authentic Model3 selected ordinal differs');
  fact(same(compiled.model, asset.owned.originalModel), 'Authentic whole original Model differs from owned native authority');
  const selected = compiled.model.objects[1], domain = curveDomain(selected), unrendered = compiled.model.objects.filter((_, index) => index !== 1).map(object => object.id);
  let getterCalls = 0; const refusals = [], accepted = [], resources = [];
  const scene = new Scene(), callerGeometry = new BufferGeometry(), callerMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
  callerGeometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const caller = new Mesh(callerGeometry, callerMaterial), children = [new Mesh(callerGeometry, callerMaterial), new Mesh(callerGeometry, callerMaterial)]; scene.add(caller);
  const callerDisposals = { geometry: 0, material: 0 }; callerGeometry.addEventListener('dispose', () => callerDisposals.geometry++); callerMaterial.addEventListener('dispose', () => callerDisposals.material++);
  function observe(result, scenario) {
    const row = { result, scenario, geometry: result.line.geometry, material: result.line.material, geometryDisposals: 0, materialDisposals: 0 };
    row.geometry.addEventListener('dispose', () => row.geometryDisposals++); row.material.addEventListener('dispose', () => row.materialDisposals++); resources.push(row); return row;
  }
  function once(row) { fact(row.geometryDisposals === 1 && row.materialDisposals === 1 && row.result.group.parent === null && row.result.line.parent === null && row.result.group.children.length === 0, 'Original owned resources/group/line cleanup differs'); }
  function callerLive() { fact(caller.parent === scene && caller.geometry === callerGeometry && caller.material === callerMaterial && callerDisposals.geometry === 0 && callerDisposals.material === 0, 'Caller resources were disposed or replaced'); }
  function dispose(row) { row.result.dispose(); row.result.dispose(); once(row); callerLive(); }
  function refuse(name, action, code) {
    let error; try { action(); } catch (cause) { error = cause; }
    fact(error instanceof BaroCadUniformCurveSourceError && error.code === code, `Actual refusal differs: ${name}`); refusals.push({ name, errorName: error.name, code: error.code });
  }
  try {
    const raw = options(), snapshot = validateBaroCadSelectedUniformCurveSourceOptions(raw);
    fact(same(raw, snapshot) && raw !== snapshot && raw.uniformCurveDisplay !== snapshot.uniformCurveDisplay, 'Options snapshot must be independent');
    for (const count of [2, 129]) {
      const input = options(count), loader = new BaroCADSelectedUniformCurveLoader(input);
      if (count === 129) { input.curveId = 'context_curve'; input.sourceVersion = 1; input.unitsPerMillimeter = 1; input.uniformCurveDisplay.count = 2; input.uniformCurveDisplay.version = 2; }
      const result = loader.parse(source), native = parseBaroCadSelectedUniformCurveSource(source, options(count)), row = observe(result, 'count-' + count), direct = sampleCurve(selected, count);
      for (const key of Object.keys(native)) fact(same(result[key], native[key]), `Complete selected native field differs: ${key}`);
      fact(result.source === source && same(result.model, compiled.model) && result.selectedObjectIndex === 1 && result.curveId === selected.id && same(result.unrenderedObjectIds, unrendered), 'Whole source/model/order/unrendered sibling preservation differs');
      fact(result.curve !== result.model.objects[1] && same(result.curve, result.model.objects[1]) && result.curve.controlPoints !== result.model.objects[1].controlPoints && result.curve.knots !== result.model.objects[1].knots && result.curve.weights !== result.model.objects[1].weights, 'Selected Curve must be a distinct equal copied occurrence');
      fact(same(result.domain, domain) && bits(result.parameters, direct.map(sample => sample.parameter)) && same(result.pointsMM, direct.map(sample => sample.point)) &&
        same(result.intervals, direct.slice(1).map((sample, index) => [direct[index].parameter, sample.parameter])), 'Native original domain/uniform sampler values differ');
      fact(result.group instanceof Group && result.line instanceof Line && result.group.children.length === 1 && result.group.children[0] === result.line && result.line.geometry.index === null && Object.keys(result.line.geometry.attributes).join() === 'position', 'Actual selected Three must be one unindexed Line');
      fact(result.line.geometry.attributes.position.array === result.positions && bits(result.positions, native.positions) && result.positions.length === count * 3 && row.material instanceof LineBasicMaterial && row.material.color.getHex() === 0x28c9eb, 'Actual selected position data/style differ');
      for (let index = 0; index < count; index++) for (let axis = 0; axis < 3; axis++) fact(Object.is(result.positions[index * 3 + axis], Math.fround(result.pointsMM[index][axis] * 0.001)), 'Display coordinates were not converted once');
      const meta = result.line.userData.barocss;
      fact(meta.role === 'selected-uniform-curve-display-line' && meta.selectedObjectIndex === 1 && same(meta.unrenderedObjectIds, unrendered) && bits(meta.nativeParameters, result.parameters) && same(meta.nativeIntervals, result.intervals) && same(meta.quality, result.quality), 'Declared selected metadata differs');
      scene.add(result.group); scene.updateMatrixWorld(true); fact(bits(result.line.matrixWorld.elements, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), 'Original world identity changed');
      const retained = structuredClone(native); dispose(row);
      for (const key of Object.keys(retained)) fact(same(result[key], retained[key]), `Native CPU data lost after disposal: ${key}`);
      accepted.push({ count, selectedObjectIndex: 1, fullModelObjects: 3, unrenderedObjectIds: [...unrendered], fullNativeExact: true, directSamplerExact: true, optionSnapshotPreserved: true,
        selectedCurveCopied: true, targetPositionBitsExact: true, geometryDisposals: row.geometryDisposals, materialDisposals: row.materialDisposals });
    }
    const first = parseBaroCadSelectedUniformCurveSource(source, options()), second = parseBaroCadSelectedUniformCurveSource(source, options()), saved = structuredClone(second), modelCopy = structuredClone(first.model), samplesCopy = structuredClone(first.pointsMM);
    fact(first.model !== second.model && first.model.objects[1] !== second.model.objects[1] && first.curve.controlPoints.every((point, index) => point !== first.model.objects[1].controlPoints[index]) &&
      first.pointsMM.every((point, index) => !first.pointsMM.slice(index + 1).includes(point)) && first.intervals.every((interval, index) => !first.intervals.slice(index + 1).includes(interval)) &&
      first.domain !== first.parameters && !first.intervals.includes(first.domain), 'Return occurrence/sample arrays alias');
    first.curve.controlPoints[0][0] += 1; first.curve.weights[0] += 1; first.curve.knots[0] += 1;
    fact(same(first.model, modelCopy) && same(first.pointsMM, samplesCopy), 'Copied Curve mutation changed full Model or existing samples');
    first.model.objects[0].controlPoints[0][0] += 1; first.options.uniformCurveDisplay.count = 2; first.domain[0] += 1; first.intervals[0][0] += 1; first.pointsMM[0][0] += 1; first.positions[0] += 1;
    fact(same(second, saved) && same(parseBaroCadSelectedUniformCurveSource(source, options()), saved), 'Return mutation changed another/later parse');
    const loader = new BaroCADSelectedUniformCurveLoader(options()), materialResult = loader.parse(source), materialRow = observe(materialResult, 'caller-material-replacement');
    materialResult.line.material = callerMaterial; scene.add(materialResult.group); dispose(materialRow); fact(materialResult.line.material === callerMaterial, 'Caller material replacement changed');
    const geometryResult = loader.parse(source), geometryRow = observe(geometryResult, 'caller-geometry-and-children-replacement'), retainedPositions = Float32Array.from(geometryResult.positions);
    geometryResult.line.geometry = callerGeometry; geometryResult.group.add(children[0]); geometryResult.line.add(children[1]); scene.add(geometryResult.group); dispose(geometryRow);
    fact(geometryResult.line.geometry === callerGeometry && bits(geometryResult.positions, retainedPositions) && children[0].geometry === callerGeometry && children[1].material === callerMaterial && children[0].parent === null && children[1].parent === geometryResult.line, 'Caller replacement/children/native CPU data were destroyed');
    scene.add(...children); callerLive();
    for (const [name, input] of [['count1', options(1)], ['count130', options(130)]]) refuse(name, () => new BaroCADSelectedUniformCurveLoader(input), 'OPTIONS');
    const idGetter = options(); Object.defineProperty(idGetter, 'curveId', { enumerable: true, get() { getterCalls++; return 'target_curve'; } });
    const countGetter = options(); Object.defineProperty(countGetter.uniformCurveDisplay, 'count', { enumerable: true, get() { getterCalls++; return 129; } });
    refuse('curveIdGetter', () => validateBaroCadSelectedUniformCurveSourceOptions(idGetter), 'OPTIONS'); refuse('countGetter', () => new BaroCADSelectedUniformCurveLoader(countGetter), 'OPTIONS'); fact(getterCalls === 0, 'Unknown option accessors were read');
    refuse('legacyFullModelProfile', () => parseBaroCadUniformCurveSource(source, { sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } }), 'PROFILE');
    // Independent authored one-Curve control; never an extracted positive fixture.
    const control = '@model single_control {version:0;length-unit:mm;@curve #single_curve {type:nurbs;degree:1;knots:[-3,-3,7,7];control-points:[[0,-0,0],[2,1,0]];weights:[1,1];}}';
    const legacy = parseBaroCadUniformCurveSource(control, { sourceVersion: 0, unitsPerMillimeter: 0.001, uniformCurveDisplay: { version: 1, count: 129 } }), selectedControl = parseBaroCadSelectedUniformCurveSource(control, options(129, 'single_curve'));
    for (const key of ['source', 'model', 'curveId', 'version', 'mode', 'domain', 'parameters', 'pointsMM', 'intervals', 'positions', 'quality']) fact(same(legacy[key], selectedControl[key]), `Authored legacy single-Curve control changed: ${key}`);
    fact(selectedControl.selectedObjectIndex === 0 && selectedControl.unrenderedObjectIds.length === 0, 'One-Curve selected control ordinal differs');
    fact(new Set(resources.map(row => row.geometry.uuid)).size === 4 && new Set(resources.map(row => row.material.uuid)).size === 4, 'Focused target resource population differs'); callerLive();
    return { ok: true, accepted, refusals, getterCalls, independentCurveAndCrossParseCopies: true, legacyOneCurveControlExact: true, legacyWholeModelProfileRetained: true,
      ownedResults: resources.length, distinctGeometries: 4, distinctMaterials: 4, geometryDisposals: resources.reduce((sum, row) => sum + row.geometryDisposals, 0), materialDisposals: resources.reduce((sum, row) => sum + row.materialDisposals, 0),
      caller: { ...callerDisposals, retained: true }, callerMaterialReplacementRetained: true, callerGeometryReplacementRetained: true, callerChildrenLive: true,
      scope: 'Focused actual public selected CPU/installed Three object/sampler/copy/legacy/disposal checks. Four target pairs are separate from host14. No Renderer, pixels, HTTP, constructor-fault or late-abort execution.' };
  } finally {
    for (const row of resources) row.result.dispose();
    caller.removeFromParent(); for (const child of children) child.removeFromParent(); callerGeometry.dispose(); callerMaterial.dispose();
  }
}
