import { signedJson } from './xy-affine-prism-feature-document-internal.js';

/** Pure calculations on already admitted data; no frame registry or geometry authority. */
interface GraphInput {
  readonly format: string; readonly schema: number; readonly units: string;
  readonly nodes: readonly unknown[]; readonly outputs: unknown; readonly parameters: Readonly<Record<string, number>>;
}
export function modelingGraphKey(document: GraphInput): string {
  return signedJson({ format: document.format, schema: document.schema, units: document.units, nodes: document.nodes, outputs: document.outputs, parameterNames: Object.keys(document.parameters).sort() });
}
export function modelingNodeParameters(node: unknown): readonly string[] {
  const names = new Set<string>();
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    if (!Array.isArray(value) && Object.hasOwn(value, 'parameter')) { names.add((value as { parameter: string }).parameter); return; }
    for (const child of Object.values(value)) visit(child);
  };
  visit(node); return Object.freeze([...names].sort());
}
export function modelingReusablePrefix(sameAuthority: boolean, key: string, previousKey: string, parameters: Readonly<Record<string, number>>, previousParameters: Readonly<Record<string, number>>, nodeParameterNames: readonly (readonly string[])[]): number {
  if (!sameAuthority || key !== previousKey) return 0;
  for (const [index, names] of nodeParameterNames.entries()) {
    if (names.some(name => !Object.is(parameters[name], previousParameters[name]))) return index;
  }
  return nodeParameterNames.length;
}
