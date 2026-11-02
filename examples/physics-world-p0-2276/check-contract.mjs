// Checks P0 artifacts against current admission constants. Does not implement a World.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = join(root, 'packages/barocss-physics/design/p0');
const read = p => readFileSync(join(root, p), 'utf8');
const catalog = JSON.parse(readFileSync(join(dir, 'profiles.json'), 'utf8'));
const types = readFileSync(join(dir, 'types.ts'), 'utf8');
function constants(path) {
  const ast = ts.createSourceFile(path, read(path), ts.ScriptTarget.ES2022, true);
  function value(node) {
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -value(node.operand);
    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.SlashToken) return value(node.left) / value(node.right);
      if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return value(node.left) * value(node.right);
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(value);
    return undefined;
  }
  const out = {};
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) out[declaration.name.text] = value(declaration.initializer);
    }
  }
  return out;
}
const limits = constants('packages/barocss-physics/src/limits.ts');
const fluid = constants('packages/barocss-physics/src/fluid/constants.ts');
const cloth = constants('packages/barocss-physics/src/cloth/profile.ts');
const byId = Object.fromEntries(catalog.profiles.map(p => [p.id, p]));
const shared = catalog.rigidShared;
assert.equal(shared.steps, limits.MAX_STEPS);
assert.equal(shared.solverPasses, limits.SOLVER_PASSES);
assert.equal(shared.commandCount, limits.MAX_COMMANDS);
assert.equal(shared.displacementPerStepM, limits.MAX_STEP_DISPLACEMENT_M);
assert.equal(shared.forceComponentN, limits.MAX_FORCE_N);
assert.equal(shared.torqueComponentNm, limits.MAX_TORQUE_NM);
assert.equal(shared.linearImpulseComponentNs, limits.MAX_IMPULSE_NS);
assert.equal(shared.angularImpulseComponentNms, limits.MAX_ANGULAR_IMPULSE_NMS);
assert.equal(byId['rigid-discrete-v1'].maximumBodies, limits.MAX_BODIES);
assert.equal(byId['rigid-large-v1'].maximumBodies, limits.MAX_LARGE_BODIES);
assert.equal(byId['rigid-persistent-box-v1'].maximumBodies, 4);
assert.ok(read('packages/barocss-physics/src/world.ts').includes('usePersistentBox && input.bodies.length > 4'));
assert.deepEqual(shared.fixedStepSeconds, [1 / 240, 1 / 30]);
for (const p of catalog.profiles) {
  assert.ok(types.includes(`'${p.id}'`), `${p.id} is absent from target types`);
  assert.equal(p.runtimeTarget, 'NOT_IMPLEMENTED');
  if (p.id.startsWith('fluid-')) {
    assert.equal(p.particles, fluid.FLUID_COUNT);
    assert.equal(p.fixedStepSeconds, fluid.FLUID_STEP_SECONDS);
    assert.equal(p.steps, fluid.FLUID_MAX_STEPS);
    assert.deepEqual(p.basinM, fluid.FLUID_BASIN_M);
    assert.deepEqual(p.gravityMps2, fluid.FLUID_GRAVITY_MPS2);
    assert.equal(p.dynamicCoupling, false);
  }
}
assert.equal(byId['cloth-pinned-sphere-visual-v1'].fixedStepSeconds, cloth.CLOTH_STEP_SECONDS);
assert.equal(byId['cloth-pinned-sphere-visual-v1'].steps, cloth.CLOTH_MAX_STEPS);
assert.equal(byId['cloth-pinned-sphere-visual-v1'].substeps, cloth.CLOTH_SUBSTEPS);
assert.equal(byId['cloth-pinned-sphere-visual-v1'].iterationsPerSubstep, cloth.CLOTH_ITERATIONS);
assert.equal(catalog.defaultAllowNewCombinations, false);
assert.equal(catalog.existingResearchGates.normalQrCap, 64);
assert.equal(catalog.existingResearchGates.referenceTimeBudgetSeconds, 180);
const vectors = JSON.parse(readFileSync(join(dir, 'encoding-vectors.json'), 'utf8'));
for (const v of vectors.vectors) {
  assert.equal('sha256:' + createHash('sha256').update(Buffer.from(v.encodedHex, 'hex')).digest('hex'), v.expectedSha256);
}
assert.notEqual(vectors.vectors[0].expectedSha256, vectors.vectors[1].expectedSha256);
for (const v of vectors.vectors.slice(0, 3)) {
  const bytes = Buffer.from(v.encodedHex, 'hex');
  assert.equal(bytes[0], 4);
  const number = bytes.readDoubleLE(1);
  assert.ok(Object.is(number, v.id === 'negative-zero' ? -0 : v.id === 'one' ? 1 : 0));
}
const matrix = JSON.parse(readFileSync(join(dir, 'validation.json'), 'utf8'));
assert.equal(new Set(matrix.cases.map(c => c.id)).size, matrix.cases.length);
assert.ok(matrix.cases.every(c => c.execution === 'NOT_RUN'), 'requirements are not runtime pass receipts');
const pkg = JSON.parse(read('packages/barocss-physics/package.json'));
assert.ok(!JSON.stringify(pkg.exports).includes('design/p0'));
for (const name of ['CONTRACT.md', 'MIGRATION.md', 'types.ts', 'contract-check.ts', 'tsconfig.json']) assert.ok(existsSync(join(dir, name)));
console.log(JSON.stringify({ result: 'PASS', targetProfiles: catalog.profiles.length,
  frozenEncodingVectors: vectors.vectors.length, validationRequirements: matrix.cases.length,
  targetApiRuntime: 'NOT_IMPLEMENTED', numericalTests: 'NOT_RUN', publishedTypes: false }));
