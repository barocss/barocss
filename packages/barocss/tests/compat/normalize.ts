import { createHash } from 'node:crypto';
import postcss, { type ChildNode } from 'postcss';

type CssNode = {
  type: string;
  name?: string;
  params?: string;
  selector?: string;
  prop?: string;
  value?: string;
  nodes?: CssNode[];
};

// Ignore comments and formatting, but preserve selectors, declarations,
// nesting, and at-rules. A known structural difference stays visible.
export function normalizeCss(css: string): CssNode[] {
  const normalizeNode = (node: ChildNode): CssNode => {
    if (node.type === 'decl') {
      return { type: node.type, prop: node.prop, value: node.value };
    }
    if (node.type === 'rule') {
      return { type: node.type, selector: node.selector, nodes: node.nodes.map(normalizeNode) };
    }
    if (node.type === 'atrule') {
      return { type: node.type, name: node.name, params: node.params, nodes: node.nodes?.map(normalizeNode) };
    }
    return { type: node.type };
  };
  return postcss.parse(css).nodes
    .filter((node) => node.type !== 'comment')
    .map(normalizeNode);
}

export function structureFingerprint(css: string): string {
  return createHash('sha256').update(JSON.stringify(normalizeCss(css))).digest('hex');
}
