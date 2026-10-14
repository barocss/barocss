import type { CadEditorModelingSnapshot } from './modeling-controller.js';

type CommandSnapshot = Pick<CadEditorModelingSnapshot, 'accepted' | 'authoredText' | 'generation' | 'drafts'>;
export interface SketchCommandTarget { index: number; authoredText: string; generation: number }
export type SketchCommandField = { label: 'Min X' | 'Min Y' | 'Max X' | 'Max Y' } & (
  { kind: 'parameter'; parameter: string } | { kind: 'literal'; value: number } | { kind: 'derived' }
);
export interface SketchCommandProjection {
  index: number; label: string; fields: SketchCommandField[]; parameters: string[];
}
/** Project accepted rectangle coordinates only; the provider owns geometry and expression evaluation. */
export function projectSketchCommand(snapshot: CommandSnapshot | null, index: number | null): SketchCommandProjection | null {
  if (!snapshot || snapshot.accepted?.source !== 'model' || !snapshot.authoredText
    || index === null || !Number.isSafeInteger(index) || index < 0
    || snapshot.accepted.features[index]?.kind !== 'sketch') return null;
  try {
    const authored = JSON.parse(snapshot.authoredText), node = authored.nodes?.[index];
    if (authored.format !== 'barocss-cad-model' || authored.schema !== 1 || authored.units !== 'mm'
      || node?.kind !== 'sketch' || node.profile !== 'rectangle'
      || !Array.isArray(node.min) || node.min.length !== 2 || !Array.isArray(node.max) || node.max.length !== 2) return null;
    // This bounded walk recognizes already accepted syntax only; it never computes a value.
    const recognizedTerm = (input: unknown): boolean => {
      let nodes = 0;
      const visit = (value: unknown, depth: number): boolean => {
        if (++nodes > 32 || depth > 6) return false;
        if (typeof value === 'number') return Number.isFinite(value);
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const record = value as Record<string, unknown>, keys = Object.keys(record).sort().join(',');
        if (keys === 'parameter') return typeof record.parameter === 'string'
          && Object.hasOwn(snapshot.accepted!.parameters, record.parameter)
          && Number.isFinite(snapshot.accepted!.parameters[record.parameter]);
        if (keys === 'left,op,right' && record.op === 'add') return visit(record.left, depth + 1) && visit(record.right, depth + 1);
        return keys === 'factor,op,value' && record.op === 'scale' && typeof record.factor === 'number'
          && Number.isFinite(record.factor) && visit(record.value, depth + 1);
      };
      return visit(input, 1);
    };
    const fields: SketchCommandField[] = [];
    for (const [label, value] of [['Min X', node.min[0]], ['Min Y', node.min[1]], ['Max X', node.max[0]], ['Max Y', node.max[1]]] as const) {
      if (!recognizedTerm(value)) return null;
      if (typeof value === 'number' && Number.isFinite(value)) fields.push({ label, kind: 'literal', value });
      else if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1
        && typeof value.parameter === 'string' && Object.hasOwn(snapshot.accepted.parameters, value.parameter)
        && Number.isFinite(snapshot.accepted.parameters[value.parameter])) fields.push({ label, kind: 'parameter', parameter: value.parameter });
      else if (value && typeof value === 'object' && !Array.isArray(value) && (value.op === 'add' || value.op === 'scale')) fields.push({ label, kind: 'derived' });
      else return null;
    }
    return { index, label: `Sketch ${String(snapshot.accepted.features.slice(0, index + 1).filter(feature => feature.kind === 'sketch').length).padStart(2, '0')}`,
      fields, parameters: [...new Set(fields.flatMap(field => field.kind === 'parameter' ? [field.parameter] : []))] };
  } catch { return null; }
}
/** Reject stale authority and unrelated pending model parameters before a scoped command acts. */
export function sketchCommandCurrent(snapshot: CommandSnapshot | null, target: SketchCommandTarget | null): SketchCommandProjection | null {
  if (!snapshot || !target || target.authoredText !== snapshot.authoredText || target.generation !== snapshot.generation) return null;
  const projection = projectSketchCommand(snapshot, target.index);
  return projection && Object.keys(snapshot.drafts).every(name => projection.parameters.includes(name)) ? projection : null;
}
