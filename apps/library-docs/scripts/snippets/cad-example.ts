import {
  compileCadModel, curveDomain, evaluateCurve, evaluateSurface,
  tessellateSurface, exportIGES,
} from '@barocss/cad';
import type { Curve, Surface } from '@barocss/cad';
import { prepareMesh } from '@barocss/gpu';

export const surfaceSource = `@model preview_weighted {
  version: 0; length-unit: mm;
  @surface #weighted {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[1,7,3]],[[9,2,4],[12,8,-2]]];
    weights: [[1,2],[3,4]];
  }
}`;
export const originalCurveSource = `@model original_domain {
  version: 0; length-unit: mm;
  @curve #edge {
    type: nurbs; degree: 1; knots: [2,2,7,7];
    control-points: [[0,0,0],[20,0,0]]; weights: [1,1];
  }
}`;
export const extrusionSource = `@model raised_edge {
  version: 1; length-unit: mm;
  @curve #profile {
    type: nurbs; degree: 1; knots: [0,0,1,1];
    control-points: [[0,0,0],[20,0,0]]; weights: [1,1];
  }
  @extrude #wall { curve: #profile; vector: [0,0,30]; }
}`;
export const parameterSource = `@model driven {
  version: 2; length-unit: mm;
  @parameter #width { type: length; value: 10 cm; }
  @parameter #height { type: length; value: $width / 2; }
  @parameter #scale { type: scalar; value: 2; }
  @curve #profile {
    type: nurbs; degree: 1; knots: [0,0,1,1];
    control-points: [[0,0,0],[$width,0,0]]; weights: [1,1];
  }
  @extrude #wall { curve: #profile; vector: [0,0,$height * $scale]; }
}`;
function compile(source: string, sourceVersion: 0 | 1 | 2) {
  const result = compileCadModel(source, { sourceVersion });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result;
}
function near(actual: number[], expected: number[]) {
  if (actual.length !== expected.length || actual.some((n, i) => Math.abs(n - expected[i]) > 1e-12)) {
    throw new Error(`Expected ${expected}, got ${actual}`);
  }
}
function curve(input: Curve | Surface): Curve {
  if (input.kind !== 'curve') throw new Error('Expected Curve');
  return input;
}
function surface(input: Curve | Surface): Surface {
  if (input.kind !== 'surface') throw new Error('Expected Surface');
  return input;
}
function refuse(source: string, sourceVersion: 0 | 1 | 2, expected: string) {
  const result = compileCadModel(source, { sourceVersion });
  if (result.ok || result.diagnostics[0].code !== expected) {
    throw new Error(`Expected ${expected}: ${JSON.stringify(result)}`);
  }
  return result.diagnostics[0].code;
}
const weighted = compile(surfaceSource, 0);
const patch = surface(weighted.model.objects[0]);
const centerMM = evaluateSurface(patch, 0.5, 0.5);
near(centerMM, [7.7, 5.2, 1]);
const preview = tessellateSurface(patch, { countU: 17, countV: 17, revision: 0 });
if (preview.report.vertexCount !== 289 || preview.report.triangleCount !== 512 || preview.report.certified !== false) {
  throw new Error('Unexpected Surface preview report');
}
const buffers = prepareMesh(preview.packet, {
  mmToSceneUnit: 0.1, translate: [0, 0, 0], color: [0.2, 0.6, 0.9], background: [0.04, 0.06, 0.1],
});
if (buffers.positions.length !== 867 || buffers.indices.length !== 1536) throw new Error('Unexpected display buffers');
const exchange = exportIGES(weighted.model, ['weighted']);
if (exchange.report.objects[0].entity !== 128 || exchange.report.solid !== false) throw new Error('Unexpected geometry export');
const original = curve(compile(originalCurveSource, 0).model.objects[0]);
near(curveDomain(original), [2, 7]);
near(evaluateCurve(original, 4.5), [10, 0, 0]);
const raised = compile(extrusionSource, 1);
near(evaluateSurface(surface(raised.model.objects[1]), 0.5, 0.5), [10, 0, 15]);
const driven = compile(parameterSource, 2);
const edited = compile(parameterSource.replace('10 cm', '12 cm'), 2);
near(evaluateSurface(surface(driven.model.objects[1]), 0.5, 0.5), [50, 0, 50]);
near(evaluateSurface(surface(edited.model.objects[1]), 0.5, 0.5), [60, 0, 60]);
if (driven.ir.schemaVersion !== 2 || driven.model.version !== 0) throw new Error('Version contract mismatch');
const refused = {
  source1Surface: refuse(surfaceSource.replace('version: 0', 'version: 1'), 1, 'KIND'),
  mismatchedVersion: refuse(originalCurveSource, 1, 'VERSION'),
  scalarCoordinate: refuse(parameterSource.replace('[$width,0,0]', '[1+2,0,0]'), 2, 'UNIT'),
  divisionByZero: refuse(parameterSource.replace('$width / 2', '$width / 0'), 2, 'DIVISION_ZERO'),
};
console.log(JSON.stringify({
  package: '@barocss/cad', version: '0.0.0-experimental',
  curve: { domain: curveDomain(original), midpointMM: evaluateCurve(original, 4.5) },
  surface: { id: patch.id, centerMM, grid: preview.report.grid, vertices: preview.report.vertexCount,
    triangles: preview.report.triangleCount, maxSampledDeviationMM: preview.report.maxSampledDeviationMM,
    certified: preview.report.certified, positionComponents: buffers.positions.length,
    indexCount: buffers.indices.length, igesEntity: exchange.report.objects[0].entity },
  extrusion: { sourceVersion: raised.ir.sourceVersion, modelVersion: raised.model.version,
    midpointMM: evaluateSurface(surface(raised.model.objects[1]), 0.5, 0.5) },
  parameters: { values: driven.ir.parameters.map(p => [p.id, p.value, p.unit]),
    midpointMM: evaluateSurface(surface(driven.model.objects[1]), 0.5, 0.5),
    editedMidpointMM: evaluateSurface(surface(edited.model.objects[1]), 0.5, 0.5) },
  refused, drawing: 'not executed',
}, null, 2));
