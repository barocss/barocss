import type { Model, Curve } from './types.js';
import type { ExtrusionConstruction } from './construction-types.js';
import type { CadModelIR } from './semantic-model.js';
import { copyCadData } from './semantic-model.js';
import { extrudeCurve } from './extrusion.js';

/** Internal lowering consumes the resolved compiler-owned IR only. */
export function lowerCadIR(ir: CadModelIR): { model: Model; constructions: ExtrusionConstruction[] } {
  const literals = new Map(ir.nodes.filter(n => n.kind !== 'extrude').map(n => [n.id, n]));
  const constructions: ExtrusionConstruction[] = [];
  const objects = ir.nodes.map(node => {
    if (node.kind !== 'extrude') return copyCadData(node.geometry);
    const input = literals.get(node.inputId)!;
    const surface = extrudeCurve(input.geometry as Curve, { id: node.id, vector: copyCadData(node.vector) });
    const span = ({ start, end, line, column }: typeof node.span) => ({ start, end, line, column });
    constructions.push({ outputId: node.id, inputId: node.inputId, operation: 'extrude', vector: copyCadData(node.vector), span: span(node.span), referenceSpan: span(node.referenceSpan) });
    return surface;
  });
  return { model: { name: ir.name, version: 0, lengthUnit: 'mm', objects }, constructions };
}
