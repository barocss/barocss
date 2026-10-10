import { createViewer } from '@barocss/viewer';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { evaluateSurface } from '@barocss/cad';
const source = `@model panel_demo {
  version: 0; length-unit: mm;
  @surface #panel {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,0,40]],[[100,0,0],[100,0,40]]];
    weights: [[1,1],[1,1]];
  }
}`;
const result = parseBaroCadSource(source, { sourceVersion: 0,
  countU: 3, countV: 3, unitsPerMillimeter: 0.001 });
const surface = result.model.objects.find(object => object.kind === 'surface');
if (!surface || surface.kind !== 'surface') throw new Error('Expected native Surface');
const midpoint = evaluateSurface(surface, 0.5, 0.5);
if (midpoint[0] !== 50 || midpoint[1] !== 0 || midpoint[2] !== 20) throw new Error('Unexpected native midpoint');
console.log(JSON.stringify({ task: 'viewer-native-input', model: result.model.name,
  surface: surface.id, midpointMM: midpoint, sampledSurfaces: result.surfaces.length,
  factoryAvailable: typeof createViewer === 'function', viewerInstantiated: false,
  rendered: false }, null, 2));
