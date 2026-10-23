import { CadAstError } from './language/source-ast.js';
import type { CadExpression, CadAstValue, CadAstDeclaration, CadOrdinaryAstDeclaration, CadModelAst, CadSourceRange } from './language/source-ast.js';
import { copyCadData } from './data-copy.js';

export type CadQuantityKind = 'length' | 'scalar';
interface Quantity { kind: CadQuantityKind; value: number }
export interface CadResolvedParameter {
  id: string; quantityKind: CadQuantityKind; value: number; unit: 'mm' | '1';
  expression: CadExpression; span: CadSourceRange;
}
export interface CadFieldBinding {
  objectId: string; field: string; indices: number[]; expression: CadExpression;
  value: number; quantityKind: CadQuantityKind; span: CadSourceRange; references: string[];
}
export interface CadParameterDependency { fromId: string; toId: string; kind: 'parameter-input'; span: CadSourceRange }
interface ParameterInput { declaration: CadAstDeclaration; kind: CadQuantityKind; expression: CadExpression }
interface Leaf { objectId: string; field: string; indices: number[]; expression: CadExpression; required: CadQuantityKind; references: string[] }
const numericFields = new Set(['degree', 'degree-u', 'degree-v', 'knots', 'knots-u', 'knots-v', 'control-points', 'weights', 'vector']);
function expression(value: CadAstValue, owner: string): CadExpression {
  if (value.kind === 'number' || value.kind === 'parameter-reference' || value.kind === 'unary' || value.kind === 'binary' || value.kind === 'group') return value;
  throw new CadAstError('TYPE', 'A numeric expression is required', value.range, owner);
}
function references(value: CadExpression): { id: string; range: CadSourceRange }[] {
  if (value.kind === 'call') throw new CadAstError('TYPE', 'Source2 does not support quantity function calls', value.range);
  if (value.kind === 'parameter-reference') return [{ id: value.id, range: value.range }];
  if (value.kind === 'unary') return references(value.operand);
  if (value.kind === 'group') return references(value.expression);
  if (value.kind === 'binary') return [...references(value.left), ...references(value.right)];
  return [];
}
function literalMillimetres(value: CadExpression): boolean {
  if (value.kind === 'number') return value.unit === undefined;
  if (value.kind === 'group') return literalMillimetres(value.expression);
  if (value.kind === 'unary') return literalMillimetres(value.operand);
  return false;
}

/** Check the entire reference graph before evaluating any expression. */
export function resolveCadParameters(ast: CadModelAst): {
  ast: CadModelAst; parameters: CadResolvedParameter[]; bindings: CadFieldBinding[]; dependencies: CadParameterDependency[];
} {
  const byId = new Map(ast.declarations.map(d => [d.id, d]));
  const inputs = new Map<string, ParameterInput>();
  const dependencies: CadParameterDependency[] = [];
  const edges = new Map<string, { id: string; range: CadSourceRange }[]>();
  const leaves: Leaf[] = [];
  for (const declaration of ast.declarations) {
    if (declaration.kind === 'function') throw new CadAstError('TYPE', 'Source2 does not support quantity functions', declaration.range, declaration.id);
    if (declaration.kind !== 'parameter') continue;
    const type = declaration.fields.find(f => f.name === 'type'), value = declaration.fields.find(f => f.name === 'value');
    if (!type || !value) throw new CadAstError('FIELD', 'Parameter requires type and value', declaration.range, declaration.id);
    if (type.value.kind !== 'identifier' || (type.value.value !== 'length' && type.value.value !== 'scalar')) throw new CadAstError('TYPE', 'Parameter type must be length or scalar', type.value.range, declaration.id);
    inputs.set(declaration.id, { declaration, kind: type.value.value, expression: expression(value.value, declaration.id) });
  }
  if (inputs.size > 64) throw new CadAstError('LIMIT', 'At most 64 parameters are supported', ast.range);
  const addReferences = (owner: string, value: CadExpression) => {
    const found = references(value);
    for (const ref of found) {
      const target = byId.get(ref.id);
      if (!target) throw new CadAstError('REFERENCE', 'Undefined parameter ' + ref.id, ref.range, owner);
      if (target.kind !== 'parameter') throw new CadAstError('REFERENCE', ref.id + ' is geometry, not a parameter', ref.range, owner);
      dependencies.push({ fromId: owner, toId: ref.id, kind: 'parameter-input', span: { ...ref.range } });
    }
    return found;
  };
  // Traversal follows authored declaration/field/index order, including repeats.
  for (const declaration of ast.declarations) {
    if (declaration.kind === 'parameter') {
      edges.set(declaration.id, addReferences(declaration.id, inputs.get(declaration.id)!.expression));
      continue;
    }
    if (declaration.kind === 'extrude') {
      const curve = declaration.fields.find(f => f.name === 'curve');
      if (!curve) throw new CadAstError('FIELD', 'Extrusion requires a curve field', declaration.range, declaration.id);
      if (curve.value.kind !== 'reference') throw new CadAstError('TYPE', 'Extrusion curve requires a geometry reference', curve.value.range, declaration.id);
      const target = byId.get(curve.value.id);
      if (!target || target.kind !== 'curve') throw new CadAstError('REFERENCE', 'Reference ' + curve.value.id + ' must name a curve declaration', curve.value.range, declaration.id);
    }
    for (const field of declaration.fields) {
      if (!numericFields.has(field.name)) continue;
      const required: CadQuantityKind = field.name === 'control-points' || field.name === 'vector' ? 'length' : 'scalar';
      const walk = (value: CadAstValue, indices: number[]) => {
        if (value.kind === 'array') { value.items.forEach((item, index) => walk(item, [...indices, index])); return; }
        const expr = expression(value, declaration.id), refs = addReferences(declaration.id, expr);
        leaves.push({ objectId: declaration.id, field: field.name, indices, expression: expr, required, references: refs.map(r => r.id) });
      };
      walk(field.value, []);
    }
  }
  const states = new Map<string, 'visiting' | 'done'>(), order: string[] = [];
  const visit = (id: string) => {
    if (states.get(id) === 'done') return;
    states.set(id, 'visiting');
    for (const ref of edges.get(id) ?? []) {
      if (states.get(ref.id) === 'visiting') throw new CadAstError('CYCLE', 'Cyclic parameter dependency through ' + ref.id, ref.range, id);
      visit(ref.id);
    }
    states.set(id, 'done'); order.push(id);
  };
  for (const id of inputs.keys()) visit(id);

  const quantities = new Map<string, Quantity>(), evaluated = new WeakMap<CadExpression, Quantity>();
  const checked = (kind: CadQuantityKind, value: number, range: CadSourceRange, owner: string): Quantity => {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new CadAstError('VALUE', 'Quantity must be finite and within 1e12', range, owner);
    return { kind, value };
  };
  const evaluate = (node: CadExpression, owner: string): Quantity => {
    if (node.kind === 'call') throw new CadAstError('TYPE', 'Source2 does not support quantity function calls', node.range, owner);
    const cached = evaluated.get(node); if (cached) return cached;
    let result: Quantity;
    if (node.kind === 'number') {
      checked('scalar', node.value, node.range, owner);
      const scale = node.unit === 'm' ? 1000 : node.unit === 'cm' ? 10 : 1;
      result = checked(node.unit ? 'length' : 'scalar', node.value * scale, node.unitRange ?? node.range, owner);
    } else if (node.kind === 'parameter-reference') {
      const quantity = quantities.get(node.id);
      if (!quantity) throw new CadAstError('REFERENCE', 'Parameter dependency is unresolved', node.range, owner);
      result = { ...quantity };
    } else if (node.kind === 'group') result = { ...evaluate(node.expression, owner) };
    else if (node.kind === 'unary') {
      const operand = evaluate(node.operand, owner);
      result = checked(operand.kind, node.operator === '-' ? -operand.value : +operand.value, node.operatorRange, owner);
    } else {
      const left = evaluate(node.left, owner), right = evaluate(node.right, owner);
      if (node.operator === '/' && right.value === 0) throw new CadAstError('DIVISION_ZERO', 'Division by zero is unsupported', node.operatorRange, owner);
      let kind: CadQuantityKind, value: number;
      if (node.operator === '+' || node.operator === '-') {
        if (left.kind !== right.kind) throw new CadAstError('UNIT', 'Addition and subtraction require matching quantities', node.operatorRange, owner);
        kind = left.kind; value = node.operator === '+' ? left.value + right.value : left.value - right.value;
      } else if (node.operator === '*') {
        if (left.kind === 'length' && right.kind === 'length') throw new CadAstError('UNIT', 'Length multiplied by length is unsupported', node.operatorRange, owner);
        kind = left.kind === 'length' || right.kind === 'length' ? 'length' : 'scalar'; value = left.value * right.value;
      } else {
        if (left.kind === 'scalar' && right.kind === 'length') throw new CadAstError('UNIT', 'Scalar divided by length is unsupported', node.operatorRange, owner);
        kind = left.kind === right.kind ? 'scalar' : 'length'; value = left.value / right.value;
      }
      result = checked(kind, value, node.operatorRange, owner);
    }
    evaluated.set(node, result); return result;
  };
  for (const id of order) {
    const input = inputs.get(id)!, quantity = evaluate(input.expression, id);
    if (quantity.kind !== input.kind) throw new CadAstError('UNIT', 'Parameter value does not match its declared ' + input.kind + ' type', input.expression.range, id);
    quantities.set(id, quantity);
  }
  const parameters: CadResolvedParameter[] = [...inputs].map(([id, input]) => {
    const q = quantities.get(id)!;
    return { id, quantityKind: q.kind, value: q.value, unit: q.kind === 'length' ? 'mm' : '1', expression: copyCadData(input.expression), span: { ...input.declaration.range } };
  });
  const bindings: CadFieldBinding[] = [], leafValues = new Map<CadExpression, number>();
  for (const leaf of leaves) {
    let quantity = evaluate(leaf.expression, leaf.objectId);
    if (leaf.required === 'length' && quantity.kind === 'scalar' && literalMillimetres(leaf.expression)) quantity = { kind: 'length', value: quantity.value };
    if (quantity.kind !== leaf.required) throw new CadAstError('UNIT', 'Field ' + leaf.field + ' requires ' + leaf.required, leaf.expression.range, leaf.objectId);
    if (leaf.field.startsWith('degree') && !Number.isInteger(quantity.value)) throw new CadAstError('DEGREE', 'Degree expression must be an integer', leaf.expression.range, leaf.objectId);
    leafValues.set(leaf.expression, quantity.value);
    bindings.push({ objectId: leaf.objectId, field: leaf.field, indices: [...leaf.indices], expression: copyCadData(leaf.expression), value: quantity.value, quantityKind: quantity.kind, span: { ...leaf.expression.range }, references: [...leaf.references] });
  }
  const resolvedValue = (value: CadAstValue): CadAstValue => {
    if (value.kind === 'array') return { kind: 'array', items: value.items.map(resolvedValue), range: { ...value.range } };
    const mapped = leafValues.get(value as CadExpression);
    if (mapped !== undefined || leafValues.has(value as CadExpression)) return { kind: 'number', value: mapped!, range: { ...value.range } };
    return copyCadData(value);
  };
  const resolvedAst: CadModelAst = {
    kind: 'model', name: ast.name, range: { ...ast.range }, nameRange: { ...ast.nameRange }, fields: copyCadData(ast.fields),
    declarations: ast.declarations.filter((d): d is CadOrdinaryAstDeclaration => d.kind !== 'parameter' && d.kind !== 'function').map(d => ({
      kind: d.kind, id: d.id, range: { ...d.range }, idRange: { ...d.idRange },
      fields: d.fields.map(f => ({ name: f.name, range: { ...f.range }, nameRange: { ...f.nameRange }, value: resolvedValue(f.value) })),
    })),
  };
  return { ast: resolvedAst, parameters, bindings, dependencies };
}
