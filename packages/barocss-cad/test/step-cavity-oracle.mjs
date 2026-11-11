// Independent Part 21 read of the planar box fixtures and Studio's planar output.
import assert from 'node:assert/strict';

const negate = vector => vector.map(value => -value);
const add = (a, b) => a.map((value, i) => value + b[i]);
const sub = (a, b) => a.map((value, i) => value - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

function argumentsOf(text) {
  const tokens = text.match(/'(?:[^']|'')*'|#\d+|\.[A-Z_]+\.|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?|[()*$,]/g) ?? [];
  let i = 0;
  const list = () => {
    const args = [];
    while (i < tokens.length && tokens[i] !== ')') {
      const token = tokens[i++];
      if (token === ',') continue;
      if (token === '(') {
        args.push(list());
        assert.equal(tokens[i++], ')');
      } else if (token.startsWith("'")) args.push(token.slice(1, -1).replace(/''/g, "'"));
      else if (/^[+-]?\d|^[+-]?\.\d/.test(token)) args.push(Number(token));
      else args.push(token);
    }
    return args;
  };
  const args = list();
  assert.equal(i, tokens.length);
  return args;
}

export function inspectPlanarCavity(text) {
  const entries = new Map([...text.matchAll(/^(#\d+)=([A-Z_][A-Z_0-9]*)\((.*)\);$/gm)].map(match => [match[1], { type: match[2], source: match[3] }]));
  const record = (id, type) => {
    const found = entries.get(id);
    assert.equal(found?.type, type, id);
    return argumentsOf(found.source);
  };
  const flag = value => {
    assert.ok(value === '.T.' || value === '.F.', 'expected a Boolean, got ' + value);
    return value === '.T.';
  };
  const point = id => record(record(id, 'VERTEX_POINT')[1], 'CARTESIAN_POINT')[1];
  const originOf = id => record(id, 'CARTESIAN_POINT')[1];
  const measure = (id, reverse = false) => {
    const [, faceRefs] = record(id, 'CLOSED_SHELL');
    let volume = 0, moment = [0, 0, 0];
    const faces = [], uses = new Map();
    for (const face of faceRefs) {
      const [name, bounds, plane, same] = record(face, 'ADVANCED_FACE');
      const [, placement] = record(plane, 'PLANE');
      const [, origin, axis] = record(placement, 'AXIS2_PLACEMENT_3D');
      const [, axisDirection] = record(axis, 'DIRECTION');
      const normal = flag(same) === reverse ? negate(axisDirection) : axisDirection;
      assert.equal(bounds.length, 1, 'planar box face has exactly one outer loop');
      const [, loop, orientation] = record(bounds[0], 'FACE_OUTER_BOUND');
      const [, edgeUses] = record(loop, 'EDGE_LOOP');
      let polygon = edgeUses.map(use => {
        const [, start, end, edge, forward] = record(use, 'ORIENTED_EDGE');
        assert.deepEqual([start, end], ['*', '*']);
        const [, a, b] = record(edge, 'EDGE_CURVE');
        return flag(forward) ? { a, b, edge, direction: 1 } : { a: b, b: a, edge, direction: -1 };
      });
      if (flag(orientation) === reverse) polygon = polygon.toReversed().map(({ a, b, edge, direction }) => ({ a: b, b: a, edge, direction: -direction }));
      assert.ok(polygon.every((use, i) => use.b === polygon[(i + 1) % polygon.length].a), 'discontinuous loop on ' + name);
      const points = polygon.map(({ a, edge, direction }) => {
        uses.set(edge, [...(uses.get(edge) ?? []), direction]);
        const p = point(a);
        assert.ok(Math.abs(dot(sub(p, originOf(origin)), normal)) < 1e-10, 'loop vertex off plane');
        return p;
      });
      const areaVector = points.reduce((sum, p, i) => add(sum, cross(sub(p, points[0]), sub(points[(i + 1) % points.length], points[0]))), [0, 0, 0]);
      assert.ok(dot(areaVector, normal) > 0, 'face/loop orientation disagrees on ' + name);
      faces.push({ name, normal, areaVector });
      for (let i = 1; i + 1 < points.length; i++) {
        const [a, b, c] = [points[0], points[i], points[i + 1]];
        const v = dot(a, cross(b, c)) / 6;
        volume += v;
        moment = add(moment, add(add(a, b), c).map(coord => coord * v / 4));
      }
    }
    for (const [edge, directions] of uses) {
      assert.equal(directions.length, 2, edge);
      assert.equal(directions[0], -directions[1], 'coedges do not oppose on ' + edge);
    }
    return { id, volume, moment, faces };
  };
  const solids = [];
  for (const [id, entry] of entries) {
    if (entry.type !== 'BREP_WITH_VOIDS' && entry.type !== 'MANIFOLD_SOLID_BREP') continue;
    const [name, exterior, cavities = []] = record(id, entry.type);
    const outer = measure(exterior);
    const voids = cavities.map(w => {
      const [, derived, base, orientation] = record(w, 'ORIENTED_CLOSED_SHELL');
      assert.equal(derived, '*');
      const forward = flag(orientation);
      return { id: w, forward, base: measure(base), effective: measure(base, !forward) };
    });
    const volume = outer.volume + voids.reduce((sum, v) => sum + v.effective.volume, 0);
    const moment = voids.reduce((sum, v) => add(sum, v.effective.moment), outer.moment);
    solids.push({ id, name, outer, voids, volume, centroid: moment.map(value => value / volume) });
  }
  assert.ok(solids.length > 0);
  return solids;
}
