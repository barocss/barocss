import { CadPartLimits } from '@barocss/cad';
import { NODE_EXTRA_FIELDS } from './doc';

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const recipeFields = new Set(['kind', 'version', 'parent', 'source', 'target', 'gap', 'lineUp']);
const faceFields = new Set(['feature', 'face', 'axis', 'sign']);
const targetFields = new Set([...faceFields, 'body']);

function bodyIndex(value: unknown, index: number): number | null {
  if (!record(value) || Object.keys(value).length !== 2 || value.side !== 'solid') return null;
  const node = value.node;
  return typeof node === 'number' && Number.isSafeInteger(node) && node >= 0 && node < index ? node : null;
}

function faceValid(value: unknown, fields: Set<string>, producer: unknown): boolean {
  return record(value) && Object.keys(value).length === fields.size && Object.keys(value).every(key => fields.has(key))
    && record(producer) && typeof value.feature === 'string' && /^n\d+$/.test(value.feature) && producer.id === value.feature
    && typeof value.face === 'string' && value.face.length > 0 && value.face.length <= 256 && !value.face.includes('+')
    && (value.axis === 'x' || value.axis === 'y' || value.axis === 'z') && (value.sign === -1 || value.sign === 1);
}

export function alignRecipeProblem(node: Record<string, unknown>, index: number, nodes: readonly unknown[]): string | null {
  if (node.version !== 1 || Object.keys(node).some(key => !recipeFields.has(key) && !(NODE_EXTRA_FIELDS as readonly string[]).includes(key))) return 'Align: the saved recipe is invalid.';
  if (typeof node.gap !== 'number' || !Number.isFinite(node.gap) || node.gap < 0 || node.gap > CadPartLimits.length
    || (node.lineUp !== 'touch' && node.lineUp !== 'centre')) return 'Align: enter a bounded nonnegative Gap and a Line up option.';
  const parent = bodyIndex(node.parent, index), target = record(node.target) ? bodyIndex(node.target.body, index) : null;
  if (parent === null || target === null || parent === target || !faceValid(node.source, faceFields, nodes[parent])
    || !faceValid(node.target, targetFields, nodes[target])) return 'Align: select named native faces on two preceding solids.';
  return null;
}

export function alignDocumentProblem(input: unknown): string | null {
  const pending: unknown[] = [input], seen = new Set<object>();
  while (pending.length) {
    const doc = pending.pop();
    if (!record(doc) || seen.has(doc)) continue;
    seen.add(doc);
    if (Array.isArray(doc.nodes)) {
      for (const [index, node] of doc.nodes.entries()) {
        if (record(node) && node.kind === 'align') {
          const problem = alignRecipeProblem(node, index, doc.nodes);
          if (problem) return problem;
        }
      }
    }
    if (Array.isArray(doc.instances)) for (const instance of doc.instances) if (record(instance)) pending.push(instance.doc);
    if (record(doc.pendingParts)) for (const part of Object.values(doc.pendingParts)) if (record(part)) pending.push(part.doc);
  }
  return null;
}
