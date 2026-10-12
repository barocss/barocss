// Validates emitted artifacts only; does not evaluate native geometry or require a browser.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const dependencies = new Set(Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]);
}
function requireOutput(path) {
  assert.ok(existsSync(path), `Missing build output: ${relative(root, path)}`);
  return path;
}
for (const path of ['index.js', 'index.d.ts', 'react/index.js', 'react/index.d.ts', 'cad-editor.css']) requireOutput(resolve(dist, path));
assert.equal(readFileSync(resolve(dist, 'cad-editor.css'), 'utf8'), readFileSync(resolve(root, 'src/styles.css'), 'utf8'));
const sources = files(resolve(root, 'src')).filter(path => /\.tsx?$/.test(path) && !path.endsWith('.d.ts'));
for (const source of sources) requireOutput(resolve(dist, relative(resolve(root, 'src'), source).replace(/\.tsx?$/, '.d.ts')));
const javascript = files(dist).filter(path => path.endsWith('.js'));
const workers = javascript.filter(path => /[/\\]assets[/\\](?:modeling|prism-feature|split)-worker-/.test(path));
assert.equal(workers.length, 3, 'Expected split, prism-feature and modeling worker assets');
const referencedWorkers = new Set();
let imports = 0;
for (const path of javascript) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(source.parseDiagnostics.length, 0, `Invalid emitted JavaScript: ${relative(dist, path)}`);
  const isWorker = workers.includes(path);
  function checkImport(specifier) {
    imports++;
    if (specifier.startsWith('.')) requireOutput(resolve(dirname(path), specifier));
    else {
      assert.ok(!isWorker, `Worker has unresolved external import: ${specifier}`);
      const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
      assert.ok(dependencies.has(packageName), `Undeclared external import: ${specifier}`);
    }
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) checkImport(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      assert.ok(ts.isStringLiteral(node.arguments[0]), 'Unexpected nonliteral dynamic import');
      checkImport(node.arguments[0].text);
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && node.arguments?.length === 2 && ts.isStringLiteral(node.arguments[0]) && /-worker-[^/]+\.js$/.test(node.arguments[0].text)) {
      const target = requireOutput(resolve(dirname(path), node.arguments[0].text));
      assert.ok(workers.includes(target), 'Worker URL must point to an emitted worker');
      referencedWorkers.add(target);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (isWorker) {
    const listeners = [];
    const scope = { postMessage() {}, addEventListener(type, handler) { if (type === 'message') listeners.push(handler); } };
    scope.self = scope;
    vm.runInNewContext(source.text, scope, { filename: path, timeout: 5000 });
    assert.ok(typeof scope.onmessage === 'function' || listeners.some(handler => typeof handler === 'function'), `Worker did not register its message handler: ${relative(dist, path)}`);
  }
}
assert.equal(referencedWorkers.size, 3, 'Every emitted worker must have a resolvable library URL');
console.log(JSON.stringify({ ok: true, declarations: sources.length, javascript: javascript.length, workers: workers.map(path => relative(dist, path)), imports, css: true, evidence: 'Emitted syntax, declared imports, worker URLs and isolated worker startup; no geometry evaluation, browser rendering or file workflow' }));
