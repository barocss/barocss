import { materialLooksDocOf } from '../assembly/looks';
import { cutsOf } from '../engine/assemblyCut';
import type { PartInstance, StudioDoc } from '../engine/doc';
import { splitPart } from '../engine/occurrences';
import { resolveShopRows, resolveShopTree } from '../engine/shopRows';

type NestedScope = { host: PartInstance; leaf: PartInstance; ancestors: PartInstance[]; path: string[] };
type ScopeProblem = { error: string; why: 'gone' | 'ambiguous' | 'reference' };

/** Resolve one visible occurrence at each level. Never interpret a leaf ID as a global lookup. */
export function nestedRequirementScope(root: StudioDoc, part: string): NestedScope | ScopeProblem {
  const { host, path } = splitPart(part), ids = [host, ...path];
  if (!path.length || ids.some(id => !id.length)) return { error: `Invalid occurrence path ${part}.`, why: 'reference' };
  if (host === 'base') return { error: `Invalid occurrence path ${part}: base is reserved.`, why: 'reference' };
  const chain: PartInstance[] = [];
  let doc = root;
  for (const id of ids) {
    const matches = (doc.instances ?? []).filter(instance => instance.id === id);
    if (!matches.length) return { error: `No part ${part}.`, why: 'gone' };
    if (matches.length > 1) return { error: `Ambiguous part ${part}.`, why: 'ambiguous' };
    const [instance] = matches;
    if (instance.hidden) return { error: `Part ${part} is hidden.`, why: 'gone' };
    if (cutsOf(instance, doc).length) return { error: `Part ${part} has an assembly cut. Its requirement evidence is unavailable.`, why: 'reference' };
    chain.push(instance);
    doc = instance.doc;
  }
  const leaf = chain[chain.length - 1];
  if (leaf.doc.instances?.length) return { error: `Part ${part} is a sub-assembly. Select a leaf occurrence for requirement evidence.`, why: 'reference' };
  if (leaf.doc.nodes.some(node => node.kind === 'bearing' && !node.suppressed && node.housingRef !== undefined))
    return { error: `Part ${part} has a linked bearing housing. Its requirement evidence is unavailable.`, why: 'reference' };
  return { host: chain[0], leaf, ancestors: chain.slice(0, -1), path };
}

/** Use the leaf's local geometry, its effective parent rows and the original root occurrence's material overrides. */
export function nestedRequirementDoc(root: StudioDoc, scope: NestedScope): StudioDoc {
  let parent = root;
  for (const ancestor of scope.ancestors) parent = resolveShopRows(ancestor.doc, parent).doc;
  const authored = scope.leaf.doc;
  const resolved = resolveShopTree(authored, parent);
  const looked = materialLooksDocOf(scope.host, scope.path);
  return looked === authored ? resolved : { ...resolved, bodies: looked.bodies };
}
