import ts from 'typescript';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);
const outputRoot = resolve(process.argv[2]);
const parsed = ts.getParsedCommandLineOfConfigFile('tsconfig.json', { noEmit: false, declaration: true, emitDeclarationOnly: true }, {
  ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
});
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: f => f, getNewLine: () => '\n' }));
  process.exit(1);
}
for (const source of program.getSourceFiles()) {
  if (source.isDeclarationFile || !source.fileName.startsWith(root + '/src/')) continue;
  const output = resolve(outputRoot, relative(resolve(root, 'src'), source.fileName).replace(/\.tsx?$/, '.d.ts'));
  const result = program.emit(source, (_filename, text) => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, text); }, undefined, true);
  if (result.emitSkipped || result.diagnostics.length) throw new Error('Editor declaration emission refused: ' + source.fileName);
}
process.stdout.write('Checked editor declarations emitted.\n');
