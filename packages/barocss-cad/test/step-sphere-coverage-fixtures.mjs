import { sphereStep } from './step-fixtures.mjs';
/** Existing whole-sphere pole/seam profile. Decimal fix is local to this factory, never enumeration tokens. */
export function sphereCoverageStep({ radius = 0.001, center = [0,0,0], tilted = false, reversed = false } = {}) {
  let text = sphereStep(radius).replace(/(\d+\.\d+)\.(?=[,)])/g, '$1');
  text = text.replace(/(CARTESIAN_POINT|DIRECTION)\('([^']*)',\(([^)]*)\)\)/g, (_all, type, name, raw) => {
    const p = raw.split(',').map(Number), v = tilted ? [0.6*p[0]+0.8*p[2],p[1],-0.8*p[0]+0.6*p[2]] : p;
    if (type === 'CARTESIAN_POINT') for (let k=0;k<3;k++) v[k] += center[k];
    return `${type}('${name}',(${v.join(',')}))`;
  });
  if (reversed) text = text.replace(/(EDGE_CURVE\('',#\d+,#\d+,#\d+,)\.T\.\)/, '$1.F.)');
  return text;
}
