// AST node types for cssma-v4
export type AstNode =
  | { type: "decl"; prop: string; value: string | [string, string][] }
  | { type: "at-rule"; name: string; params: string; nodes: AstNode[] }
  | { type: "rule"; selector: string; nodes: AstNode[] }
  | { type: "at-root"; nodes: AstNode[] }
  | { type: "comment"; text: string }
  | { type: "raw"; value: string };

export function decl(
  prop: string,
  value: string | [string, string][]
): AstNode {
  return { type: "decl", prop, value };
}
export function atRoot(nodes: AstNode[]): AstNode {
  return {
    type: "at-root",
    nodes,
  };
}

export function atRule(
  name: string,
  params: string,
  nodes: AstNode[]
): AstNode {
  return { type: "at-rule", name, params, nodes };
}
export function rule(selector: string, nodes: AstNode[]): AstNode {
  return { type: "rule", selector, nodes };
}
export function comment(text: string): AstNode {
  return { type: "comment", text };
}
export function raw(value: string): AstNode {
  return { type: "raw", value };
}

export function property(ident: string, initialValue?: string, syntax?: string) {
  return atRule('@property', ident, [
    decl('syntax', syntax ? `"${syntax}"` : `"*"`),
    decl('inherits', 'false'),

    ...(initialValue ? [decl('initial-value', initialValue)] : []),
  ])
}