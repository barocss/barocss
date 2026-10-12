import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

// Compile only: never import/execute the CAD, Viewer, GPU or example.
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const page = resolve(app, 'docs/packages/viewer/authored-directional-lights.md');
const blocks = [...readFileSync(page, 'utf8').matchAll(/```ts\n([\s\S]*?)```/g)];
assert.equal(blocks.length, 1, 'Exactly one maintained TypeScript block');
const imports = [...blocks[0][1].matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1]);
assert.deepEqual([...new Set(imports)].sort(),
  ['@barocss/cad-interop/document', '@barocss/gpu', '@barocss/viewer'],
  'Snippet must use the documented public package entries only');
assert.ok(!/import\s*\(/.test(blocks[0][1]), 'No hidden dynamic imports');
const virtual = resolve(app, 'scripts/viewer-authored-directional-lights-doc-check.ts');
const options = {
  noEmit: true, strict: true, skipLibCheck: true,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  baseUrl: root, paths: {
    '@barocss/viewer': ['packages/barocss-viewer/src/index.ts'],
    '@barocss/gpu': ['packages/barocss-gpu/src/index.ts'],
    '@barocss/cad': ['packages/barocss-cad/src/index.ts'],
    '@barocss/cad-interop/*': ['packages/barocss-cad-interop/src/*.ts'],
    '@barocss/physics': ['packages/barocss-physics/src/index.ts'],
  },
};
const host = ts.createCompilerHost(options);
const original = host.getSourceFile.bind(host);
host.getSourceFile = (name, languageVersion, onError, shouldCreate) => name === virtual
  ? ts.createSourceFile(name, blocks[0][1], languageVersion, true)
  : original(name, languageVersion, onError, shouldCreate);
const program = ts.createProgram([virtual], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
}));
console.log('Viewer authored directional lights Manual snippet: exact public-root types passed; no emit, no native execution');
