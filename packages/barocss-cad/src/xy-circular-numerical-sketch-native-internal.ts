import { buildXYArc } from './xy-arc.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './curve-source.js';
import type { Curve } from './types.js';
import { check, exact } from './xy-circular-numerical-sketch-admission-internal.js';
import type { XYCircularNumericalSketchDocumentV0, XYCircularNumericalSketchPoint, XYCircularNumericalSketchRadius, XYCircularNumericalSketchSuccess, XYCircularNumericalSketchBinding } from './xy-circular-numerical-sketch.js';
export function native(document: XYCircularNumericalSketchDocumentV0, points: XYCircularNumericalSketchPoint[], radii: XYCircularNumericalSketchRadius[]): Omit<XYCircularNumericalSketchSuccess['solution'], 'points' | 'radii'> {
  const positions = new Map(points.map(p => [p.id, p.position]));
  const curves: Curve[] = document.segments.map(s => ({ kind: 'curve', id: s.id, degree: 1, knots: [0, 0, 1, 1],
    controlPoints: [positions.get(s.startPointId)!, positions.get(s.endPointId)!].map(p => [p[0], p[1], 0]), weights: [1, 1] }));
  const bindings: XYCircularNumericalSketchBinding[] = [];
  for (let i = 0; i < document.circles.length; i++) {
    const circle = document.circles[i], arc = buildXYArc({ kind: 'circle', id: circle.id, center: positions.get(circle.centerPointId)!, radius: radii[i].valueMM });
    check(arc.curve.degree === 2 && arc.curve.controlPoints.length === 9 && exact(arc.curve.knots, [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4])
      && exact(arc.curve.weights, [1, Math.SQRT1_2, 1, Math.SQRT1_2, 1, Math.SQRT1_2, 1, Math.SQRT1_2, 1]) && exact(arc.curve.controlPoints[0], arc.curve.controlPoints[8]), 'COMPILATION', 'Actual native circle coefficients or seam differ');
    curves.push(arc.curve); bindings.push({ circleId: circle.id, centerPointId: circle.centerPointId, radiusId: circle.radius.id, seamId: circle.seamId, seamParameters: [0, 4], seamPoleIndices: [0, 8] });
  }
  const decimal = (n: number) => curveDecimal(n, 'XY circular numerical sketch');
  const source = '@model ' + document.id + ' { version:0; length-unit:mm; ' + curves.map(c => '@curve #' + c.id + ' { type:nurbs; degree:' + c.degree + '; knots:[' + c.knots.map(decimal).join(',') + ']; control-points:['
    + c.controlPoints.map(p => '[' + p.map(decimal).join(',') + ']').join(',') + ']; weights:[' + c.weights.map(decimal).join(',') + ']; }').join(' ') + ' }\n';
  check(source.length <= 262144 && new TextEncoder().encode(source).length <= 262144, 'LIMIT', 'Native source exceeds bounded characters or bytes');
  const compiled = compileCadModel(source, { sourceVersion: 0 }); check(compiled.ok, 'COMPILATION', 'Actual native circle/line source must compile');
  check(compiled.ir.schemaVersion === 1 && exact(compiled.model.objects, curves), 'COMPILATION', 'Native IDs and coefficients differ from independently verified solution');
  return { source, sourceVersion: 0, model: compiled.model, ir: compiled.ir, bindings };
}
