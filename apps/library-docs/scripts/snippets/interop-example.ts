import { parseBaroCadSource, BaroCadSourceError } from '@barocss/cad-interop/native';
const source = `@model panel_demo {
  version: 0; length-unit: mm;
  @surface #panel {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,0,40]],[[100,0,0],[100,0,40]]];
    weights: [[1,1],[1,1]];
  }
}`;
const options = { sourceVersion: 0 as const, countU: 3, countV: 3, unitsPerMillimeter: 0.001 };
const result = parseBaroCadSource(source, options);
let refused = '';
try { parseBaroCadSource('not a model', options); }
catch (error) { if (!(error instanceof BaroCadSourceError)) throw error; refused = error.name; }
if (result.model.name !== 'panel_demo' || result.surfaces.length !== 1 || !refused) throw new Error('Unexpected loader result');
console.log(JSON.stringify({ task: 'native-loader', sourceExact: result.source === source,
  model: result.model.name, surfaceIds: result.surfaces.map(surface => surface.surfaceId),
  nativeObjects: result.model.objects.length, curves: result.curves.length,
  positions: result.surfaces[0].mesh.positions.length,
  indices: result.surfaces[0].mesh.indices.length, refused, rendered: false }, null, 2));
