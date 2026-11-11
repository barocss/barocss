import assert from 'node:assert/strict';
import { knotCurveStep, stepSolidGraph } from './step-spline-knot-fixtures.mjs';

const consumers = {
  edge: 'EDGE_CURVE',
  extrusion: 'SURFACE_OF_LINEAR_EXTRUSION',
  revolution: 'SURFACE_OF_REVOLUTION',
};
const wrappers = ['SURFACE_CURVE', 'SEAM_CURVE', 'TRIMMED_CURVE'];
function record(type, basis) {
  return type === 'TRIMMED_CURVE'
    ? `TRIMMED_CURVE('',#${basis},(PARAMETER_VALUE(0.)),(PARAMETER_VALUE(1.)),.T.,.PARAMETER.)`
    : `${type}('',#${basis},(),.PCURVE_S1.)`;
}

/** Insert a chain at one reached curve reference while preserving the original geometry. */
export function curveWrapperStep(path, { length = 3, end = 'basis', offset = false, shared = false } = {}) {
  const type = consumers[path];
  const { original, target: basis } = knotCurveStep(path, 'polynomial');
  const target = 1000;
  const lastBasis = end === 'cycle' ? target : end === 'missing' ? 90000 : basis;
  const wrapperRows = Array.from({ length }, (_, i) => {
    const id = target + i;
    return `#${id}=${record(wrappers[i % wrappers.length], i === length - 1 ? lastBasis : id + 1)};`;
  });
  const incoming = new RegExp(`^#\\d+=(?:${type}${shared ? '|EDGE_CURVE' : ''})\\(.*,#${basis},.*;$`, 'gm');
  const matches = original.match(incoming);
  assert.equal(matches?.length, shared ? 2 : 1, path);
  let text = original.replace(incoming, line => line.replace(`#${basis},`, `#${target},`));
  if (offset) {
    const plane = original.match(/^#(\d+)=PLANE\(/m)?.[1];
    assert.ok(plane);
    wrapperRows.push(`#${target + length}=OFFSET_SURFACE('',#${plane},0.,.F.);`);
  }
  text = text.replace('DATA;\n', 'DATA;\n' + wrapperRows.join('\n') + '\n');
  return { text, target, basis, type };
}

/** Check the controlled fixture's graph independently of the production reader. */
export function verifyWrapperGraph({ text, target, basis, type }, end, length, shared = false) {
  const graph = stepSolidGraph(text);
  assert.ok(graph.reached.has(target));
  const incoming = graph.incoming(target);
  assert.equal(incoming.filter(row => row.startsWith(type + '(')).length, 1);
  if (shared) assert.ok(incoming.some(row => row.startsWith('EDGE_CURVE(')));
  const rows = new Map([...text.matchAll(/^#(\d+)=(?:SURFACE_CURVE|SEAM_CURVE|TRIMMED_CURVE)\('',#(\d+),/gm)]
    .map(([, id, next]) => [Number(id), Number(next)]));
  let current = target;
  for (let i = 0; i < length; i++) {
    assert.equal(current, target + i);
    assert.ok(graph.reached.has(current));
    current = rows.get(current);
  }
  assert.equal(current, end === 'cycle' ? target : basis);
}
