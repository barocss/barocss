// AST node types for cssma-v4
export type AstNode =
  | { type: 'decl'; prop: string; value: string | [string, string][] }
  | { type: 'atrule'; name: string; params: string; nodes: AstNode[] }
  | { type: 'rule'; selector: string; nodes: AstNode[] }
  | { type: 'comment'; text: string }
  | { type: 'raw'; value: string };

export function decl(prop: string, value: string | [string, string][]): AstNode {
  return { type: 'decl', prop, value };
}
export function atrule(name: string, params: string, nodes: AstNode[]): AstNode {
  return { type: 'atrule', name, params, nodes };
}
export function rule(selector: string, nodes: AstNode[]): AstNode {
  return { type: 'rule', selector, nodes };
}
export function comment(text: string): AstNode {
  return { type: 'comment', text };
}
export function raw(value: string): AstNode {
  return { type: 'raw', value };
}