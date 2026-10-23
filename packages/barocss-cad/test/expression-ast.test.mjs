import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCadAst, CAD_AST_LIMITS, CAD_EXPRESSION_LIMITS } from '../dist/language/source-ast.js';

const wrap = (expression) => `@model x{version:2;length-unit:mm;@parameter #p{type:scalar;value:${expression};}}`;
const get = (source) => parseCadAst(source, 2).declarations[0].fields.find((field) => field.name === 'value').value;
function metrics(expression) {
  if (expression.kind === 'binary') { const l = metrics(expression.left), r = metrics(expression.right); return { nodes: 1 + l.nodes + r.nodes, depth: 1 + Math.max(l.depth, r.depth) }; }
  if (expression.kind === 'unary' || expression.kind === 'group') { const child = metrics(expression.operand ?? expression.expression); return { nodes: child.nodes + 1, depth: child.depth + 1 }; }
  return { nodes: 1, depth: 1 };
}
const binary = (op, left, right) => ({ kind: 'binary', operator: op, left, right });
function shape(expression) {
  if (expression.kind === 'binary') return binary(expression.operator, shape(expression.left), shape(expression.right));
  if (expression.kind === 'unary') return { kind: 'unary', operator: expression.operator, operand: shape(expression.operand) };
  if (expression.kind === 'group') return { kind: 'group', expression: shape(expression.expression) };
  if (expression.kind === 'parameter-reference') return { kind: 'parameter-reference', id: expression.id };
  return { kind: 'number', value: expression.value, ...(expression.unit ? { unit: expression.unit } : {}) };
}
const number = (value) => ({ kind: 'number', value });

test('source2 precedence, left association, unary and groups are original syntax trees', () => {
  assert.deepEqual(shape(get(wrap('1+2*3-4/2'))), binary('-', binary('+', number(1), binary('*', number(2), number(3))), binary('/', number(4), number(2))));
  assert.deepEqual(shape(get(wrap('8/4/2'))), binary('/', binary('/', number(8), number(4)), number(2)));
  assert.deepEqual(shape(get(wrap('-($a + +2cm) * $scale'))), binary('*', { kind: 'unary', operator: '-', operand: { kind: 'group', expression: binary('+', { kind: 'parameter-reference', id: 'a' }, { kind: 'unary', operator: '+', operand: { kind: 'number', value: 2, unit: 'cm' } }) } }, { kind: 'parameter-reference', id: 'scale' }));
  const negativeZero = get(wrap('-0')); assert.equal(negativeZero.kind, 'unary'); assert.equal(negativeZero.operator, '-'); assert.ok(Object.is(negativeZero.operand.value, 0));
  assert.equal(get(wrap('10 cm')).value, 10, 'AST never normalizes quantities');
});

test('actual UTF16 number/unit/reference/operator/group ranges include authored syntax', () => {
  const source = '/*😀*/\n@model x {version:2;length-unit:mm;@parameter #p{type:length;value: -(10 cm + $width_2)/2;}}';
  const expression = get(source), group = expression.left.operand, sum = group.expression;
  const slice = (range) => source.slice(range.start, range.end);
  assert.equal(slice(expression.range), '-(10 cm + $width_2)/2'); assert.equal(slice(expression.operatorRange), '/');
  assert.equal(slice(expression.left.operatorRange), '-'); assert.equal(slice(group.range), '(10 cm + $width_2)');
  assert.equal(slice(sum.left.range), '10 cm'); assert.equal(slice(sum.left.unitRange), 'cm'); assert.equal(slice(sum.right.range), '$width_2'); assert.equal(slice(sum.operatorRange), '+');
  const lines = source.slice(0, sum.left.range.start).split('\n'); assert.equal(sum.left.range.line, lines.length); assert.equal(sum.left.range.column, lines.at(-1).length + 1);
});

test('64 parameters are separate from 16 geometry declarations and all IDs are unique', () => {
  const parameters = Array.from({ length: 64 }, (_, i) => `@parameter #p${i}{type:scalar;value:1;}`).join('');
  const curves = Array.from({ length: 16 }, (_, i) => `@curve #c-${i}{type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[1,0,0]];weights:[1,1];}`).join('');
  const source = '@model x{version:2;length-unit:mm;' + parameters + curves + '}';
  assert.equal(parseCadAst(source, 2).declarations.length, 80);
  assert.throws(() => parseCadAst(source.replace(curves, '@parameter #extra{type:scalar;value:1;}' + curves), 2), (e) => e.code === 'LIMIT');
  assert.throws(() => parseCadAst(source.replace('}', '}@curve #extra{}'), 2));
  assert.throws(() => parseCadAst('@model x{version:2;@parameter #same{type:scalar;value:1;}@curve #same{}}', 2), (e) => e.code === 'DUPLICATE');
  assert.throws(() => parseCadAst('@model x{version:2;@parameter #has-hyphen{type:scalar;value:1;}}', 2));
  assert.deepEqual(shape(get(wrap('$a-$b'))), binary('-', { kind: 'parameter-reference', id: 'a' }, { kind: 'parameter-reference', id: 'b' }));
});

test('source2 union grammar keeps headers/types/geometry references literal and arrays bounded', () => {
  const source = '@model x{version:2;length-unit:mm;@surface #s{type:nurbs;degree-u:$degree;degree-v:1;knots-u:[0,0,1,1];knots-v:[0,0,1,1];control-points:[[[0mm,0,0],[$w,1,0]],[[1,0,0],[1,1,0]]];weights:[[1,1],[1,1]];}@extrude #e{curve:#profile-with-hyphen;vector:[0,0,$height*2];}@parameter #w{type:length;value:10cm;}}';
  const ast = parseCadAst(source, 2); assert.deepEqual(ast.declarations.map((node) => node.kind), ['surface', 'extrude', 'parameter']);
  const ref = ast.declarations[1].fields[0].value; assert.equal(ref.kind, 'reference'); assert.equal(ref.id, 'profile-with-hyphen');
  assert.equal(ast.fields[0].value.kind, 'number'); assert.equal(ast.fields[1].value.kind, 'identifier');
  assert.throws(() => parseCadAst(source.replace('version:2;', 'version:1+1;'), 2));
  assert.throws(() => parseCadAst(source.replace('type:nurbs;', 'type:$kind;'), 2));
  assert.throws(() => parseCadAst(source.replace('curve:#profile-with-hyphen;', 'curve:$profile;'), 2));
  assert.equal(get(wrap('1+2')).kind, 'binary', 'Scalar/length type rules belong to semantics');
});

test('unsupported expression syntax, units and literal magnitudes reject without evaluation', () => {
  for (const expression of ['1e3', '1E-3', '2%', 'sin(1)', 'foo', '"text"', '$p.x', '$p[0]', '#p', '1 in', '1mmfoo', '1000000000001', '9'.repeat(400)]) assert.throws(() => get(wrap(expression)), expression);
  assert.equal(get(wrap('1000000000000m')).value, 1e12);
  assert.deepEqual(shape(get(wrap('1 / -0'))), binary('/', number(1), { kind: 'unary', operator: '-', operand: number(0) }), 'Parser retains invalid arithmetic for semantic phase');
  assert.equal(get(wrap('$missing')).kind, 'parameter-reference');
  for (const version of [0, 1]) assert.throws(() => parseCadAst(wrap('1mm'), version));
});

test('32 is actual AST depth including left chains, unary and parentheses', () => {
  for (const expression of ['+'.repeat(31) + '1', '('.repeat(31) + '1' + ')'.repeat(31), Array(32).fill('1').join('+')]) assert.equal(metrics(get(wrap(expression))).depth, 32);
  for (const expression of ['+'.repeat(32) + '1', '('.repeat(32) + '1' + ')'.repeat(32), Array(33).fill('1').join('+'), '1+' + '('.repeat(31) + '1' + ')'.repeat(31)]) assert.throws(() => get(wrap(expression)), (e) => e.code === 'LIMIT');
});

test('256 expression nodes are accepted; just over fails independently of depth', () => {
  function balanced(leaves) { if (leaves === 1) return '1'; const n = Math.floor(leaves / 2); return '(' + balanced(n) + '+' + balanced(leaves - n) + ')'; }
  const expression = balanced(86); const ast = get(wrap(expression)); assert.equal(metrics(ast).nodes, 256); assert.ok(metrics(ast).depth < 32);
  assert.throws(() => get(wrap('+' + expression)), (e) => e.code === 'LIMIT');
});

test('exact aggregate32768 with maximal parameterized surfaces and64 parameters fits shared budgets', () => {
  const knots = '[0,0,0,0,0,0,' + Array.from({ length: 10 }, (_, i) => String((i + 1) / 11)).join(',') + ',1,1,1,1,1,1]';
  const points = '[' + Array.from({ length: 16 }, (_, u) => '[' + Array.from({ length: 16 }, (_, v) => `[+${u},+${v},+0]`).join(',') + ']').join(',') + ']';
  const weights = '[' + Array(16).fill('[' + Array(16).fill('1').join(',') + ']').join(',') + ']';
  const geometry = Array.from({ length: 16 }, (_, i) => `@surface #s${i}{type:nurbs;degree-u:5;degree-v:5;knots-u:${knots};knots-v:${knots};control-points:${points};weights:${weights};}`).join('');
  const chain = Array(26).fill('1').join('+');
  const parameters = Array.from({ length: 64 }, (_, i) => `@parameter #p${i}{type:scalar;value:${i < 32 ? '++' : '+'}${chain};}`).join('');
  const source = '@model x{version:2;length-unit:mm;' + parameters + geometry + '}'; assert.ok(Buffer.byteLength(source) <= CAD_AST_LIMITS.sourceBytes);
  const ast = parseCadAst(source, 2); let expressions = 0, totalValues = 0;
  function visit(value, expressionField) {
    if (value.kind === 'array') { totalValues++; value.items.forEach((v) => visit(v, expressionField)); }
    else if (expressionField) { const m = metrics(value); expressions += m.nodes; totalValues += m.nodes; }
    else totalValues++;
  }
  for (const node of ast.declarations) for (const field of node.fields) visit(field.value, field.name !== 'type');
  assert.equal(expressions, 32768); assert.ok(totalValues < CAD_AST_LIMITS.values);
  assert.throws(() => parseCadAst(source.replace('@parameter #p32{type:scalar;value:+', '@parameter #p32{type:scalar;value:++'), 2), (e) => e.code === 'LIMIT');
  console.log(JSON.stringify({ expressionNodes: expressions, astValuesExcludingHeader: totalValues, sourceBytes: Buffer.byteLength(source), limits: CAD_EXPRESSION_LIMITS }));
});
