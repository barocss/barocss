import assert from 'node:assert/strict';
import { extrudedSideStep, revolvedProfileStep } from './step-fixtures.mjs';

function splineRecord(kind, args, explicitArgs, form, weights) {
  if (form === 'polynomial') return `B_SPLINE_${kind}_WITH_KNOTS('',${args},${explicitArgs})`;
  if (form.startsWith('simple:')) return `${form.slice(7)}('',${args})`;
  const explicit = `B_SPLINE_${kind}_WITH_KNOTS(${explicitArgs})`;
  const knotForms = form === 'explicit' || form === 'no-base' ? [explicit] : form === 'missing' ? []
    : form === 'duplicate' ? [explicit, explicit] : form === 'contradictory' ? [explicit, `BEZIER_${kind}()`]
      : form === 'bad-implicit' ? [`QUASI_UNIFORM_${kind}(1)`] : [`${form}()`];
  const parts = [`BOUNDED_${kind}()`, ...knotForms, `${kind}()`,
    'GEOMETRIC_REPRESENTATION_ITEM()', "REPRESENTATION_ITEM('')"];
  if (form !== 'no-base') parts.push(`B_SPLINE_${kind}(${args})`);
  if (weights) {
    const list = kind === 'CURVE' ? weights.join(',') : weights.map(row => `(${row.join(',')})`).join(',');
    parts.push(`RATIONAL_B_SPLINE_${kind}((${list}))`);
  }
  return `(${parts.sort().join(' ')})`;
}

const simpleCurve = /^#(\d+)=B_SPLINE_CURVE_WITH_KNOTS\('',(\d+),(\(#[\d,#]+\)),\.UNSPECIFIED\.,\.F\.,\.F\.,(\([\d,]+\)),(\([\d.,]+\)),\.UNSPECIFIED\.\);$/gm;

/** Replace only the referenced curve entity. The original fixture supplies all topology and shared references. */
export function knotCurveStep(consumer, form, { weights } = {}) {
  assert.ok(['edge', 'extrusion', 'revolution'].includes(consumer), consumer);
  let original = consumer === 'revolution' ? revolvedProfileStep() : extrudedSideStep();
  if (consumer === 'extrusion') {
    // The sweep is read before its loops. Visit this face before the edge that shares its basis.
    const curved = original.match(/^#(\d+)=ADVANCED_FACE\('curved',/m)?.[1];
    assert.ok(curved);
    original = original.replace(/CLOSED_SHELL\('',\(([^)]+)\)\)/, (_, list) =>
      `CLOSED_SHELL('',(#${curved},${list.split(',').filter(ref => ref !== '#' + curved).join(',')}))`);
  }
  const records = [...original.matchAll(simpleCurve)];
  const match = consumer === 'edge' ? records.at(-1) : records[0];
  assert.ok(match);
  const [line, id, degree, points, multiplicities, knots] = match;
  const args = `${degree},${points},.UNSPECIFIED.,.F.,.F.`;
  const replacement = splineRecord('CURVE', args, `${multiplicities},${knots},.UNSPECIFIED.`, form, weights);
  return { text: original.replace(line, `#${id}=${replacement};`), target: Number(id), original };
}

/** Replace one named box edge or its top plane with a degree-one spline with known geometry. */
export function knotBoxStep(original, kind, form, { weights } = {}) {
  assert.ok(kind === 'CURVE' || kind === 'SURFACE', kind);
  const at = (x, y, z) => {
    for (const [, id, tuple] of original.matchAll(/^#(\d+)=CARTESIAN_POINT\('',\(([^)]*)\)\);$/gm)) {
      const p = tuple.split(',').map(Number);
      if (p[0] === x && p[1] === y && p[2] === z) return '#' + id;
    }
    assert.fail(`missing box point ${x},${y},${z}`);
  };
  const target = kind === 'CURVE'
    ? original.match(/^#\d+=EDGE_CURVE\('e\.bottom\|e\.side0',#\d+,#\d+,#(\d+),\.T\.\);$/m)?.[1]
    : original.match(/^#\d+=ADVANCED_FACE\('e\.top',\([^)]*\),#(\d+),\.T\.\);$/m)?.[1];
  assert.ok(target, `the named box ${kind} is present`);
  const args = kind === 'CURVE'
    ? `1,(${at(0, 0, 0)},${at(10, 0, 0)}),.UNSPECIFIED.,.F.,.F.`
    : `1,1,((${at(0, 0, 5)},${at(0, 8, 5)}),(${at(10, 0, 5)},${at(10, 8, 5)})),.UNSPECIFIED.,.F.,.F.,.F.`;
  const explicit = kind === 'CURVE' ? '(2,2),(-2.,6.),.UNSPECIFIED.' : '(2,2),(2,2),(2.,6.),(-3.,1.),.UNSPECIFIED.';
  const line = new RegExp(`^#${target}=.*;$`, 'm');
  assert.match(original, line);
  return { text: original.replace(line, `#${target}=${splineRecord(kind, args, explicit, form, weights)};`),
    target: Number(target), original };
}

/** Walk Part 21 references from the solid, independent of the reader's reachability and spline handling. */
export function stepSolidGraph(source) {
  const rows = new Map([...source.matchAll(/^#(\d+)=(.*);$/gm)].map(([, id, entity]) => [Number(id), entity]));
  const root = [...rows].find(([, entity]) => entity.startsWith('MANIFOLD_SOLID_BREP('));
  assert.ok(root, 'fixture has a manifold solid root');
  const references = entity => [...entity.replace(/'(?:[^']|'')*'/g, '').matchAll(/#(\d+)/g)].map(([, id]) => Number(id));
  const reached = new Set(), pending = [root[0]];
  while (pending.length) {
    const id = pending.pop();
    if (reached.has(id)) continue;
    const entity = rows.get(id);
    assert.ok(entity, `fixture reference #${id} exists`);
    reached.add(id);
    pending.push(...references(entity));
  }
  const incoming = id => [...reached].map(key => rows.get(key)).filter(entity => references(entity).includes(id));
  return { reached, incoming };
}
