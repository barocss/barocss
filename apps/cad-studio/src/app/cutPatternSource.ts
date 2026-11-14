import { refOf, selectedBodies, type Ctx } from '@barocss/cad-model/app/commands';
import type { ModelNode } from '@barocss/cad-model/engine/doc';
import { featureId } from '@barocss/cad-model/engine/ids';

const cutPatterns = new Set(['linear-feature-pattern', 'rectangular-feature-pattern', 'fill-feature-pattern', 'curve-feature-pattern']);

export function isCutPattern(kind: string): boolean {
  return cutPatterns.has(kind);
}

export function selectedCutPatternSource(ctx: Ctx): number | null {
  const indices = selectedBodies(ctx.selection);
  if (indices.length !== 1 || !ctx.bodies[indices[0]]) return null;
  const ref = refOf(ctx.bodies[indices[0]]);
  return ref.side === 'solid' && ctx.doc.nodes[ref.node]?.kind === 'difference' ? ref.node : null;
}

export function savedCutPatternSource(node: ModelNode, nodes: readonly ModelNode[]): string | null {
  if (!isCutPattern(node.kind) || !('parent' in node)) return null;
  return cutPatternSourceLabel(nodes, node.parent.node);
}

export function cutPatternSourceLabel(nodes: readonly ModelNode[], index: number | null): string | null {
  if (index === null || nodes[index]?.kind !== 'difference') return null;
  const ordinal = nodes.slice(0, index + 1).filter(node => node.kind === 'difference').length;
  return `Subtract ${ordinal} (${featureId(nodes, index)})`;
}
