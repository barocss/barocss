// AST node types for barocss
export type AstNode =
  | { type: "wrap"; items: AstNode[], source?: string }
  | { type: "decl"; prop: string; value: string | [string, string][], source?: string }
  | { type: "at-rule"; name: string; params: string; nodes: AstNode[], source?: string }
  | { type: "style-rule"; selector: string; nodes: AstNode[], source?: string }
  | { type: "rule"; selector: string; nodes: AstNode[], source?: string }
  | { type: "at-root"; nodes: AstNode[], source?: string }
  | { type: "comment"; text: string, source?: string }
  | { type: "raw"; value: string, source?: string };

export type HasNodes = { nodes?: AstNode[] };
export type HasSource = { source?: string };
export type HasSelector = { selector?: string };
export type HasName = { name?: string };
export type HasParams = { params?: string };
export type HasValue = { value?: string | [string, string][] };
export type HasProp = { prop?: string };
export type HasItems = { items?: AstNode[] };
export type HasText = { text?: string };

export function decl(
  prop: string,
  value: string | [string, string][],
  source?: string
): AstNode {
  return { type: "decl", prop, value, source };
}
export function atRoot(nodes: AstNode[], source?: string): AstNode {
  return {
    type: "at-root",
    nodes,
    source
  };
}

export function atRule(
  name: string,
  params: string,
  nodes: AstNode[],
  source?: string
): AstNode {
  return { type: "at-rule", name, params, nodes, source };
}
export function styleRule(selector: string, nodes: AstNode[], source?: string): AstNode {
  return { type: "style-rule", selector, nodes, source };
}
export function rule(selector: string, nodes: AstNode[], source?: string): AstNode {
  return { type: "rule", selector, nodes, source };
}
export function comment(text: string, source?: string): AstNode {
  return { type: "comment", text, source };
}
export function raw(value: string, source?: string): AstNode {
  return { type: "raw", value, source };
}

export function property(name: string, initialValue?: string, syntax?: string, source?: string): AstNode {
  const nodes: AstNode[] = [
    decl("syntax", `"${syntax || "*"}"`, source),
    decl("inherits", "false", source),
  ];
  
  if (initialValue) {
    nodes.push(decl("initial-value", initialValue, source));
  }
  
  return atRule("property", name, nodes, source);
}