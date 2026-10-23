import { CadAstError } from './language/source-ast.js';
import type { CadExpression, CadModelAst, CadAstValue, CadFunctionAst, CadOrdinaryAstDeclaration, CadSourceRange } from './language/source-ast.js';
import type { CadQuantityKind, CadResolvedParameter, CadFieldBinding, CadParameterDependency } from './parameter-semantics.js';
import { copyCadData } from './data-copy.js';

export interface CadFunctionQuantity { kind: CadQuantityKind; unit: 'mm' | '1'; value: number }
export interface CadResolvedFunction {
  id: string; declaration: CadFunctionAst; returnKind: CadQuantityKind;
  arguments: { name: string; quantityKind: CadQuantityKind; defaultQuantity: CadFunctionQuantity | null }[];
}
export interface CadFunctionCallReceipt {
  frameId: number; parentFrameId: number | null; functionId: string; depth: number;
  callSpan: CadSourceRange; definitionSpan: CadSourceRange;
  owner: { objectId: string; field: string; indices: number[] };
  bindings: { formalName: string; quantity: CadFunctionQuantity; origin: 'explicit' | 'default';
    argumentSpan: CadSourceRange | null; formalSpan: CadSourceRange; defaultSpan: CadSourceRange | null }[];
  result: CadFunctionQuantity;
}
export interface CadFunctionWork {
  limits: { maximumFunctions: 8; maximumArguments: 4; maximumCallDepth: 8; maximumCallEntries: 256;
    maximumExpressionEvaluations: 65536; maximumDefaultAdmissionEvaluations: 32;
    maximumSuccessUTF16: 16777216; maximumSuccessUTF8: 16777216; maximumOwnValues: 4194304;
    maximumOwnDepth: 128; maximumOwnArray: 65536; maximumOwnRecord: 64 };
  preflight: { callEntries: number; expressionEvaluations: number; maximumCallDepth: number };
  actual: { callEntries: number; defaultAdmissionEvaluations: number; defaultRuntimeEvaluations: number;
    expressionEvaluations: number; maximumCallDepth: number };
  fileSizes: { success: { utf16: number; utf8: number } }; ownValues: number;
}
type Owner = CadFunctionCallReceipt['owner'];
type Cost = CadFunctionWork['preflight'];
type Input = { kind: CadQuantityKind; expression: CadExpression; span: CadSourceRange };
type Leaf = { owner: Owner; expression: CadExpression; required: CadQuantityKind; references: string[] };
const numericFields = new Set(['degree', 'degree-u', 'degree-v', 'knots', 'knots-u', 'knots-v', 'control-points', 'weights', 'vector']);
function fail(code: string, detail: string, range: CadSourceRange, owner: string): never {
  throw new CadAstError(code, detail, range, owner);
}
function expression(value: CadAstValue, owner: string): CadExpression {
  if (value.kind === 'number' || value.kind === 'parameter-reference' || value.kind === 'unary' ||
    value.kind === 'binary' || value.kind === 'group' || value.kind === 'call') return value;
  return fail('TYPE', 'A numeric quantity expression is required', value.range, owner);
}
function quantity(kind: CadQuantityKind, value: number, range: CadSourceRange, owner: string): CadFunctionQuantity {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) fail('VALUE', 'Quantity must be finite and within 1e12', range, owner);
  return { kind, unit: kind === 'length' ? 'mm' : '1', value };
}
function binaryKind(operator: string, left: CadQuantityKind, right: CadQuantityKind,
  range: CadSourceRange, owner: string): CadQuantityKind {
  if (operator === '+' || operator === '-') {
    if (left !== right) fail('UNIT', 'Addition and subtraction require matching quantities', range, owner);
    return left;
  }
  if (operator === '*') {
    if (left === 'length' && right === 'length') fail('UNIT', 'Length multiplied by length is unsupported', range, owner);
    return left === 'length' || right === 'length' ? 'length' : 'scalar';
  }
  if (left === 'scalar' && right === 'length') fail('UNIT', 'Scalar divided by length is unsupported', range, owner);
  return left === right ? 'scalar' : 'length';
}
function literalMillimetres(node: CadExpression): boolean {
  if (node.kind === 'number') return node.unit === undefined;
  if (node.kind === 'unary') return literalMillimetres(node.operand);
  if (node.kind === 'group') return literalMillimetres(node.expression);
  return false;
}
function globalReferences(node: CadExpression): { id: string; range: CadSourceRange }[] {
  if (node.kind === 'parameter-reference') return [{ id: node.id, range: node.range }];
  if (node.kind === 'unary') return globalReferences(node.operand);
  if (node.kind === 'group') return globalReferences(node.expression);
  if (node.kind === 'binary') return [...globalReferences(node.left), ...globalReferences(node.right)];
  if (node.kind === 'call') return node.arguments.flatMap(argument => globalReferences(argument.value));
  return [];
}

/** Source3 static qualification and bounded, lexical, frame-local quantity evaluation. */
export function resolveCadFunctionParameters(ast: CadModelAst): {
  ast: CadModelAst; parameters: CadResolvedParameter[]; bindings: CadFieldBinding[];
  dependencies: CadParameterDependency[]; functions: CadResolvedFunction[];
  calls: CadFunctionCallReceipt[]; work: CadFunctionWork;
} {
  const byId = new Map(ast.declarations.map(declaration => [declaration.id, declaration]));
  const definitions = new Map<string, CadFunctionAst>();
  const inputs = new Map<string, Input>(), globalKinds = new Map<string, CadQuantityKind>();
  const leaves: Leaf[] = [], dependencies: CadParameterDependency[] = [];
  const work: CadFunctionWork = {
    limits: { maximumFunctions: 8, maximumArguments: 4, maximumCallDepth: 8, maximumCallEntries: 256,
      maximumExpressionEvaluations: 65536, maximumDefaultAdmissionEvaluations: 32,
      maximumSuccessUTF16: 16777216, maximumSuccessUTF8: 16777216, maximumOwnValues: 4194304,
      maximumOwnDepth: 128, maximumOwnArray: 65536, maximumOwnRecord: 64 },
    preflight: { callEntries: 0, expressionEvaluations: 0, maximumCallDepth: 0 },
    actual: { callEntries: 0, defaultAdmissionEvaluations: 0, defaultRuntimeEvaluations: 0,
      expressionEvaluations: 0, maximumCallDepth: 0 },
    fileSizes: { success: { utf16: 0, utf8: 0 } }, ownValues: 0,
  };
  for (const declaration of ast.declarations) {
    if (declaration.kind === 'function') {
      if (definitions.size >= 8) fail('LIMIT', 'At most eight quantity functions are supported', declaration.range, declaration.id);
      if (declaration.arguments.length > 4) fail('LIMIT', 'At most four formal arguments are supported', declaration.range, declaration.id);
      definitions.set(declaration.id, declaration);
    } else if (declaration.kind === 'parameter') {
      const type = declaration.fields.find(field => field.name === 'type'), value = declaration.fields.find(field => field.name === 'value');
      if (!type || !value) fail('FIELD', 'Parameter requires type and value', declaration.range, declaration.id);
      if (type.value.kind !== 'identifier' || (type.value.value !== 'length' && type.value.value !== 'scalar'))
        fail('TYPE', 'Parameter type must be length or scalar', type.value.range, declaration.id);
      inputs.set(declaration.id, { kind: type.value.value, expression: expression(value.value, declaration.id), span: declaration.range });
      globalKinds.set(declaration.id, type.value.value);
    }
  }
  if (inputs.size > 64) fail('LIMIT', 'At most 64 global parameters are supported', ast.range, ast.name);
  const body = (definition: CadFunctionAst): CadExpression => {
    if (definition.fields.length !== 1 || definition.fields[0].name !== 'return')
      fail('FUNCTION_TYPE', 'A function requires exactly one return expression', definition.range, definition.id);
    return expression(definition.fields[0].value, definition.id);
  };
  const infer = (node: CadExpression, environment: Map<string, CadQuantityKind>, owner: string,
    scope: 'global' | 'formal' | 'closed', callsTo?: { id: string; range: CadSourceRange }[]): CadQuantityKind => {
    if (node.kind === 'number') return node.unit === undefined ? 'scalar' : 'length';
    if (node.kind === 'parameter-reference') {
      if (scope === 'closed') fail('FUNCTION_CAPTURE', 'Defaults must be closed expressions without references', node.range, owner);
      const kind = environment.get(node.id);
      if (kind === undefined) fail(scope === 'formal' ? 'FUNCTION_CAPTURE' : 'REFERENCE',
        scope === 'formal' ? 'A function may reference only its own formal arguments' : 'Reference must name a global parameter', node.range, owner);
      return kind;
    }
    if (node.kind === 'group') return infer(node.expression, environment, owner, scope, callsTo);
    if (node.kind === 'unary') return infer(node.operand, environment, owner, scope, callsTo);
    if (node.kind === 'binary') return binaryKind(node.operator,
      infer(node.left, environment, owner, scope, callsTo), infer(node.right, environment, owner, scope, callsTo), node.operatorRange, owner);
    if (scope === 'closed') fail('FUNCTION_CAPTURE', 'Defaults cannot invoke functions', node.range, owner);
    const definition = definitions.get(node.functionId);
    if (!definition) fail('FUNCTION_REFERENCE', 'Call must name a declared quantity function', node.functionRange, owner);
    if (node.arguments.length > 4) fail('FUNCTION_ARGUMENT', 'At most four named arguments are supported', node.range, owner);
    const names = new Set<string>();
    for (const argument of node.arguments) {
      if (names.has(argument.name)) fail('FUNCTION_ARGUMENT', 'Duplicate named argument', argument.nameRange, owner);
      names.add(argument.name);
      const formal = definition.arguments.find(value => value.name === argument.name);
      if (!formal) fail('FUNCTION_ARGUMENT', 'Unknown named argument', argument.nameRange, owner);
      const kind = infer(argument.value, environment, owner, scope, callsTo);
      if (kind !== formal.quantityKind) fail('FUNCTION_TYPE', 'Named argument does not match its formal quantity kind', argument.value.range, owner);
    }
    for (const formal of definition.arguments) if (!names.has(formal.name) && formal.defaultExpression === null)
      fail('FUNCTION_ARGUMENT', 'Required named argument is missing', node.range, owner);
    if (callsTo) callsTo.push({ id: definition.id, range: node.functionRange });
    return definition.returnKind;
  };
  const functionEdges = new Map<string, { id: string; range: CadSourceRange }[]>();
  for (const definition of definitions.values()) {
    const environment = new Map<string, CadQuantityKind>();
    for (const formal of definition.arguments) {
      if (environment.has(formal.name)) fail('FUNCTION_ARGUMENT', 'Duplicate formal argument', formal.nameRange, definition.id);
      environment.set(formal.name, formal.quantityKind);
      if (formal.defaultExpression !== null && infer(formal.defaultExpression, new Map(), definition.id, 'closed') !== formal.quantityKind)
        fail('FUNCTION_TYPE', 'Default quantity does not match its formal kind', formal.defaultExpression.range, definition.id);
    }
    const edges: { id: string; range: CadSourceRange }[] = [];
    if (infer(body(definition), environment, definition.id, 'formal', edges) !== definition.returnKind)
      fail('FUNCTION_TYPE', 'Return expression does not match the declared quantity kind', definition.returnTypeRange, definition.id);
    functionEdges.set(definition.id, edges);
  }
  const functionStates = new Map<string, 'visiting' | 'done'>();
  const visitFunction = (id: string): void => {
    if (functionStates.get(id) === 'done') return;
    functionStates.set(id, 'visiting');
    for (const edge of functionEdges.get(id) ?? []) {
      if (functionStates.get(edge.id) === 'visiting') fail('FUNCTION_RECURSION', 'Recursive function calls are unsupported', edge.range, id);
      visitFunction(edge.id);
    }
    functionStates.set(id, 'done');
  };
  for (const id of definitions.keys()) visitFunction(id);
  const parameterEdges = new Map<string, { id: string; range: CadSourceRange }[]>();
  const references = (owner: string, node: CadExpression): { id: string; range: CadSourceRange }[] => {
    const refs = globalReferences(node);
    for (const ref of refs) {
      if (byId.get(ref.id)?.kind !== 'parameter') fail('REFERENCE', 'Reference must name a global parameter', ref.range, owner);
      dependencies.push({ fromId: owner, toId: ref.id, kind: 'parameter-input', span: { ...ref.range } });
    }
    return refs;
  };
  for (const declaration of ast.declarations) {
    if (declaration.kind === 'function') continue;
    if (declaration.kind === 'parameter') {
      const input = inputs.get(declaration.id)!;
      if (infer(input.expression, globalKinds, declaration.id, 'global') !== input.kind)
        fail('UNIT', 'Parameter value does not match its declared quantity kind', input.expression.range, declaration.id);
      parameterEdges.set(declaration.id, references(declaration.id, input.expression));
      continue;
    }
    if (declaration.kind === 'extrude') {
      const curve = declaration.fields.find(field => field.name === 'curve');
      if (!curve) fail('FIELD', 'Extrusion requires a curve field', declaration.range, declaration.id);
      if (curve.value.kind !== 'reference' || byId.get(curve.value.id)?.kind !== 'curve')
        fail('REFERENCE', 'Extrusion input must name a curve', curve.value.range, declaration.id);
    }
    for (const field of declaration.fields) {
      if (!numericFields.has(field.name)) continue;
      const required: CadQuantityKind = field.name === 'control-points' || field.name === 'vector' ? 'length' : 'scalar';
      const walk = (value: CadAstValue, indices: number[]): void => {
        if (value.kind === 'array') { value.items.forEach((item, index) => walk(item, [...indices, index])); return; }
        const node = expression(value, declaration.id), kind = infer(node, globalKinds, declaration.id, 'global');
        if (kind !== required && !(required === 'length' && kind === 'scalar' && literalMillimetres(node)))
          fail('UNIT', 'Geometry field requires ' + required, node.range, declaration.id);
        leaves.push({ owner: { objectId: declaration.id, field: field.name, indices }, expression: node, required,
          references: references(declaration.id, node).map(ref => ref.id) });
      };
      walk(field.value, []);
    }
  }
  const parameterStates = new Map<string, 'visiting' | 'done'>(), order: string[] = [];
  const visitParameter = (id: string): void => {
    if (parameterStates.get(id) === 'done') return;
    parameterStates.set(id, 'visiting');
    for (const edge of parameterEdges.get(id) ?? []) {
      if (parameterStates.get(edge.id) === 'visiting') fail('CYCLE', 'Cyclic global parameter dependency', edge.range, id);
      visitParameter(edge.id);
    }
    parameterStates.set(id, 'done'); order.push(id);
  };
  for (const id of inputs.keys()) visitParameter(id);

  // Saturating costs share definition ASTs; no expanded tree or frame is allocated here.
  const add = (a: Cost, b: Cost): Cost => ({ callEntries: Math.min(257, a.callEntries + b.callEntries),
    expressionEvaluations: Math.min(65537, a.expressionEvaluations + b.expressionEvaluations),
    maximumCallDepth: Math.min(9, Math.max(a.maximumCallDepth, b.maximumCallDepth)) });
  const bodyCosts = new Map<string, Cost>();
  const cost = (node: CadExpression): Cost => {
    let value: Cost = { callEntries: 0, expressionEvaluations: 1, maximumCallDepth: 0 };
    if (node.kind === 'unary') return add(value, cost(node.operand));
    if (node.kind === 'group') return add(value, cost(node.expression));
    if (node.kind === 'binary') return add(add(value, cost(node.left)), cost(node.right));
    if (node.kind !== 'call') return value;
    for (const argument of node.arguments) value = add(value, cost(argument.value));
    const definition = definitions.get(node.functionId)!;
    let inner = bodyCosts.get(definition.id);
    if (!inner) { inner = cost(body(definition)); bodyCosts.set(definition.id, inner); }
    for (const formal of definition.arguments) if (formal.defaultExpression !== null && !node.arguments.some(argument => argument.name === formal.name))
      inner = add(inner, cost(formal.defaultExpression));
    return add(value, { callEntries: Math.min(257, inner.callEntries + 1), expressionEvaluations: inner.expressionEvaluations,
      maximumCallDepth: Math.min(9, inner.maximumCallDepth + 1) });
  };
  const preflight = (node: CadExpression, owner: string): void => {
    work.preflight = add(work.preflight, cost(node));
    if (work.preflight.callEntries > 256 || work.preflight.expressionEvaluations > 65536 || work.preflight.maximumCallDepth > 8)
      fail('LIMIT', 'Function expansion exceeds call, expression or active-frame limits before numerical evaluation', node.range, owner);
  };
  for (const [id, input] of inputs) preflight(input.expression, id);
  for (const leaf of leaves) preflight(leaf.expression, leaf.owner.objectId);

  const quantities = new Map<string, CadFunctionQuantity>(), globalMemo = new WeakMap<CadExpression, CadFunctionQuantity>();
  const calls: CadFunctionCallReceipt[] = [];
  const evaluate = (node: CadExpression, owner: Owner, environment: Map<string, CadFunctionQuantity>,
    memo: WeakMap<CadExpression, CadFunctionQuantity>, frameId: number | null, depth: number,
    admission = false): CadFunctionQuantity => {
    if (!admission) {
      if (work.actual.expressionEvaluations >= 65536) fail('LIMIT', 'Runtime expression evaluation budget exhausted', node.range, owner.objectId);
      work.actual.expressionEvaluations++;
    }
    const cached = memo.get(node); if (cached) return { ...cached };
    let result: CadFunctionQuantity;
    if (node.kind === 'number') {
      quantity('scalar', node.value, node.range, owner.objectId);
      const scale = node.unit === 'm' ? 1000 : node.unit === 'cm' ? 10 : 1;
      result = quantity(node.unit ? 'length' : 'scalar', node.value * scale, node.unitRange ?? node.range, owner.objectId);
    } else if (node.kind === 'parameter-reference') {
      const found = environment.get(node.id);
      if (!found) fail('REFERENCE', 'Quantity reference is unresolved in this lexical frame', node.range, owner.objectId);
      result = { ...found };
    } else if (node.kind === 'group') result = evaluate(node.expression, owner, environment, memo, frameId, depth, admission);
    else if (node.kind === 'unary') {
      const operand = evaluate(node.operand, owner, environment, memo, frameId, depth, admission);
      result = quantity(operand.kind, node.operator === '-' ? -operand.value : +operand.value, node.operatorRange, owner.objectId);
    } else if (node.kind === 'binary') {
      const left = evaluate(node.left, owner, environment, memo, frameId, depth, admission);
      const right = evaluate(node.right, owner, environment, memo, frameId, depth, admission);
      if (node.operator === '/' && right.value === 0) fail('DIVISION_ZERO', 'Division by zero is unsupported', node.operatorRange, owner.objectId);
      const kind = binaryKind(node.operator, left.kind, right.kind, node.operatorRange, owner.objectId);
      const value = node.operator === '+' ? left.value + right.value : node.operator === '-' ? left.value - right.value :
        node.operator === '*' ? left.value * right.value : left.value / right.value;
      result = quantity(kind, value, node.operatorRange, owner.objectId);
    } else {
      const definition = definitions.get(node.functionId)!;
      const explicit = new Map<string, { quantity: CadFunctionQuantity; span: CadSourceRange }>();
      // The pending outer call is not an active frame while its eager arguments run.
      for (const argument of node.arguments) explicit.set(argument.name, {
        quantity: evaluate(argument.value, owner, environment, memo, frameId, depth), span: argument.range });
      if (work.actual.callEntries >= 256 || depth >= 8) fail('LIMIT', 'Actual function call or frame budget exhausted', node.range, owner.objectId);
      const nextId = work.actual.callEntries++;
      work.actual.maximumCallDepth = Math.max(work.actual.maximumCallDepth, depth + 1);
      const frame = new Map<string, CadFunctionQuantity>(), localMemo = new WeakMap<CadExpression, CadFunctionQuantity>();
      const receipt: CadFunctionCallReceipt = { frameId: nextId, parentFrameId: frameId, functionId: definition.id, depth: depth + 1,
        callSpan: { ...node.range }, definitionSpan: { ...definition.range }, owner: copyCadData(owner), bindings: [],
        result: { kind: definition.returnKind, unit: definition.returnKind === 'length' ? 'mm' : '1', value: 0 } };
      calls.push(receipt);
      for (const formal of definition.arguments) {
        const supplied = explicit.get(formal.name);
        let bound: CadFunctionQuantity;
        if (supplied) bound = { ...supplied.quantity };
        else {
          work.actual.defaultRuntimeEvaluations++;
          bound = evaluate(formal.defaultExpression!, owner, frame, localMemo, nextId, depth + 1);
        }
        if (bound.kind !== formal.quantityKind) fail('FUNCTION_TYPE', 'Bound quantity differs from formal type', formal.typeRange, owner.objectId);
        frame.set(formal.name, { ...bound });
        receipt.bindings.push({ formalName: formal.name, quantity: { ...bound }, origin: supplied ? 'explicit' : 'default',
          argumentSpan: supplied ? { ...supplied.span } : null, formalSpan: { ...formal.range },
          defaultSpan: supplied ? null : { ...formal.defaultExpression!.range } });
      }
      result = evaluate(body(definition), owner, frame, localMemo, nextId, depth + 1);
      if (result.kind !== definition.returnKind) fail('FUNCTION_TYPE', 'Actual return quantity differs from signature', definition.returnTypeRange, owner.objectId);
      receipt.result = { ...result };
    }
    memo.set(node, { ...result }); return { ...result };
  };
  const functions: CadResolvedFunction[] = [];
  for (const definition of definitions.values()) {
    const arguments_: CadResolvedFunction['arguments'] = [];
    for (const formal of definition.arguments) {
      let defaultQuantity: CadFunctionQuantity | null = null;
      if (formal.defaultExpression !== null) {
        if (work.actual.defaultAdmissionEvaluations >= 32) fail('LIMIT', 'Default admission budget exhausted', formal.range, definition.id);
        work.actual.defaultAdmissionEvaluations++;
        defaultQuantity = evaluate(formal.defaultExpression, { objectId: definition.id, field: 'default', indices: [] },
          new Map(), new WeakMap(), null, 0, true);
      }
      arguments_.push({ name: formal.name, quantityKind: formal.quantityKind, defaultQuantity });
    }
    functions.push({ id: definition.id, declaration: copyCadData(definition), returnKind: definition.returnKind, arguments: arguments_ });
  }
  for (const id of order) {
    const input = inputs.get(id)!;
    const value = evaluate(input.expression, { objectId: id, field: 'value', indices: [] }, quantities, globalMemo, null, 0);
    if (value.kind !== input.kind) fail('UNIT', 'Parameter quantity does not match its declared type', input.expression.range, id);
    quantities.set(id, value);
  }
  const parameters: CadResolvedParameter[] = [...inputs].map(([id, input]) => {
    const value = quantities.get(id)!;
    return { id, quantityKind: value.kind, value: value.value, unit: value.unit, expression: copyCadData(input.expression), span: { ...input.span } };
  });
  const bindings: CadFieldBinding[] = [], leafValues = new Map<CadExpression, number>();
  for (const leaf of leaves) {
    let value = evaluate(leaf.expression, leaf.owner, quantities, globalMemo, null, 0);
    if (leaf.required === 'length' && value.kind === 'scalar' && literalMillimetres(leaf.expression))
      value = { kind: 'length', unit: 'mm', value: value.value };
    if (value.kind !== leaf.required) fail('UNIT', 'Field requires ' + leaf.required, leaf.expression.range, leaf.owner.objectId);
    if (leaf.owner.field.startsWith('degree') && !Number.isInteger(value.value))
      fail('DEGREE', 'Degree expression must be an integer', leaf.expression.range, leaf.owner.objectId);
    leafValues.set(leaf.expression, value.value);
    bindings.push({ ...copyCadData(leaf.owner), expression: copyCadData(leaf.expression), value: value.value,
      quantityKind: value.kind, span: { ...leaf.expression.range }, references: [...leaf.references] });
  }
  const resolvedValue = (value: CadAstValue): CadAstValue => {
    if (value.kind === 'array') return { kind: 'array', items: value.items.map(resolvedValue), range: { ...value.range } };
    if (leafValues.has(value as CadExpression)) return { kind: 'number', value: leafValues.get(value as CadExpression)!, range: { ...value.range } };
    return copyCadData(value);
  };
  const resolvedAst: CadModelAst = { kind: 'model', name: ast.name, range: { ...ast.range }, nameRange: { ...ast.nameRange },
    fields: copyCadData(ast.fields), declarations: ast.declarations.filter((declaration): declaration is CadOrdinaryAstDeclaration =>
      declaration.kind !== 'function' && declaration.kind !== 'parameter').map(declaration => ({
      kind: declaration.kind, id: declaration.id, range: { ...declaration.range }, idRange: { ...declaration.idRange },
      fields: declaration.fields.map(field => ({ name: field.name, range: { ...field.range }, nameRange: { ...field.nameRange }, value: resolvedValue(field.value) })),
    })) };
  return { ast: resolvedAst, parameters, bindings, dependencies, functions, calls, work };
}
