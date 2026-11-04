import type { DrivenSketchNode, ModelNode, NumericDrivenSketchSeed, StudioDoc } from '../src/engine/doc';
import { bindParameter, bindSketchLength, unbindSketchLength, withParameters } from '../src/engine/parameters';
import { resolveDrivenSketch } from '../src/sketch/driven';

declare const seed: NumericDrivenSketchSeed;
declare const doc: StudioDoc;
const recipe: DrivenSketchNode = {
  kind: 'driven-sketch', version: 1, seed,
  bindings: [{ kind: 'line-length', entity: 'e1', value: { parameter: 'Width' } }],
};
const node: ModelNode = recipe;
const bound: StudioDoc = bindSketchLength(doc, 'n0', 'e1', 'Width');
const viaField: StudioDoc = bindParameter(doc, { feature: 1, value: 'olen0', parameter: 'Width' });
const changed: StudioDoc = withParameters(bound, { Width: 68 });
const detached: StudioDoc = unbindSketchLength(changed, 'n0');
const numeric = resolveDrivenSketch(recipe, { Width: 68 });
const numericKind: 'sketch' = numeric.kind;
// @ts-expect-error the authored seed has numeric coordinates
const symbolicSeed: NumericDrivenSketchSeed = { ...seed, segments: [{ kind: 'line', start: [{ parameter: 'Width' }, 0] }] };
// @ts-expect-error version 1 admits exactly one binding
const multiple: DrivenSketchNode = { ...recipe, bindings: [...recipe.bindings, ...recipe.bindings] };
// @ts-expect-error version 1 does not define radius bindings
const radius: DrivenSketchNode = { ...recipe, bindings: [{ kind: 'arc-radius', entity: 'e1', value: { parameter: 'Width' } }] };
// @ts-expect-error numeric driving constraints do not contain expressions
const expression: NumericDrivenSketchSeed = { ...seed, outline: { ...seed.outline, lengths: { 0: { parameter: 'Width' } } } };
void [node, bound, viaField, changed, detached, numericKind, symbolicSeed, multiple, radius, expression];
