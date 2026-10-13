import type { CadEditorModelingSnapshot } from './modeling-controller.js';

type CommandSnapshot = Pick<CadEditorModelingSnapshot, 'accepted' | 'authoredText' | 'generation' | 'drafts'>;
export interface ExtrusionCommandTarget { index: number; authoredText: string; generation: number }
export type ExtrusionCommandField = { label: 'Height' | 'Start Z' } & (
  { kind: 'parameter'; parameter: string } | { kind: 'literal'; value: number } | { kind: 'derived' }
);
export interface ExtrusionCommandProjection {
  index: number; label: string; fields: ExtrusionCommandField[]; parameters: string[];
}
/** UI projection of already accepted intent. Never evaluates or rewrites native dimensions. */
export function projectExtrusionCommand(snapshot: CommandSnapshot | null, index: number | null): ExtrusionCommandProjection | null {
  if (!snapshot || snapshot.accepted?.source !== 'model' || !snapshot.authoredText
    || index === null || !Number.isSafeInteger(index) || index < 0
    || snapshot.accepted.features[index]?.kind !== 'extrude') return null;
  try {
    const authored = JSON.parse(snapshot.authoredText), node = authored.nodes?.[index];
    if (authored.format !== 'barocss-cad-model' || authored.schema !== 1 || node?.kind !== 'extrude') return null;
    const fields: ExtrusionCommandField[] = [];
    for (const [label, value] of [['Height', node.height], ['Start Z', Object.hasOwn(node, 'from') ? node.from : 0]] as const) {
      if (typeof value === 'number' && Number.isFinite(value)) fields.push({ label, kind: 'literal', value });
      else if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1
        && typeof value.parameter === 'string' && Object.hasOwn(snapshot.accepted.parameters, value.parameter)
        && Number.isFinite(snapshot.accepted.parameters[value.parameter])) fields.push({ label, kind: 'parameter', parameter: value.parameter });
      else if (value && typeof value === 'object' && (value.op === 'add' || value.op === 'scale')) fields.push({ label, kind: 'derived' });
      else return null;
    }
    return { index, label: `Extrude ${String(snapshot.accepted.features.slice(0, index + 1).filter(feature => feature.kind === 'extrude').length).padStart(2, '0')}`,
      fields, parameters: [...new Set(fields.flatMap(field => field.kind === 'parameter' ? [field.parameter] : []))] };
  } catch { return null; }
}
/** Keep the pinned command out of newer accepted generations and unrelated global drafts. */
export function extrusionCommandCurrent(snapshot: CommandSnapshot | null, target: ExtrusionCommandTarget | null): ExtrusionCommandProjection | null {
  if (!snapshot || !target || target.authoredText !== snapshot.authoredText || target.generation !== snapshot.generation) return null;
  const projection = projectExtrusionCommand(snapshot, target.index);
  return projection && Object.keys(snapshot.drafts).every(name => projection.parameters.includes(name)) ? projection : null;
}
