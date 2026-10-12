import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

// Compile only: never import/execute the native builder, validator or demo.
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const page = resolve(app, 'docs/packages/cad/paired-roof-body-split.md');
const blocks = [...readFileSync(page, 'utf8').matchAll(/```ts\n([\s\S]*?)```/g)];
assert.equal(blocks.length, 1, 'Exactly one maintained TypeScript block');
const virtual = resolve(app, 'scripts/paired-roof-body-split-doc-check.ts');
const options = {
  noEmit: true, strict: true, skipLibCheck: true,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  baseUrl: root, paths: { '@barocss/cad': ['packages/barocss-cad/src/index.ts'] },
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
console.log('Paired-roof Body split Manual snippet: exact public-root types passed; no emit, no native execution');
