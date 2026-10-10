import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { classesFor } from '../render-stream-research/.build/render-api.mjs';
import { ServerRuntime } from '../render-stream-research/.build/server-api.mjs';

const deps = createRequire(new URL('../../package.json', import.meta.url));
const { build } = deps('esbuild'), ts = deps('typescript');
const here = fileURLToPath(new URL('./', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const versions = Object.freeze({ react: deps('react/package.json').version,
  reactDom: deps('react-dom/package.json').version, esbuild: deps('esbuild/package.json').version });
const allowed = new Set(['react', '@research/ui']);
function checkImports(source) {
  const tree = ts.createSourceFile('generated.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  if (tree.parseDiagnostics.length) throw new Error('Invalid JSX syntax');
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier) || !allowed.has(node.moduleSpecifier.text)))
      throw new Error('Generated dependency is not permitted');
    if ((ts.isExportDeclaration(node) && node.moduleSpecifier) || ts.isImportEqualsDeclaration(node)
      || (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))))
      throw new Error('Generated dynamic or forwarded dependency is not permitted');
    ts.forEachChild(node, visit);
  };
  visit(tree);
}
export async function compileUi(source, { moduleId = 'counter' } = {}) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 32 * 1024
    || typeof moduleId !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(moduleId)) throw new Error('Invalid bounded JSX source');
  checkImports(source);
  const [frame, library] = await Promise.all([
    fs.readFile(new URL('./frame.jsx', import.meta.url), 'utf8'), fs.readFile(new URL('./library.jsx', import.meta.url), 'utf8'),
  ]);
  const result = await build({ entryPoints: ['research-frame'], bundle: true, write: false,
    format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'bounded-generated-module', setup(plugin) {
      plugin.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === 'entry-point' && args.path === 'research-frame') return { path: 'frame.jsx', namespace: 'research-frame' };
        if (args.namespace === 'research-generated') {
          if (!allowed.has(args.path) && args.path !== 'react/jsx-runtime') return { errors: [{ text: 'Generated dependency is not permitted' }] };
          if (args.kind === 'dynamic-import') return { errors: [{ text: 'Generated dynamic dependency is not permitted' }] };
        }
        if (args.path === '@research/generated' && args.namespace === 'research-frame')
          return { path: `${moduleId}.jsx`, namespace: 'research-generated' };
        if (args.path === '@research/ui' && args.namespace === 'research-generated') return { path: 'library.jsx', namespace: 'research-library' };
        if (/^react(?:-dom)?(?:\/.*)?$/.test(args.path)) return { path: deps.resolve(args.path) };
      });
      plugin.onLoad({ filter: /.*/, namespace: 'research-frame' }, () => ({ contents: frame, loader: 'jsx', resolveDir: here }));
      plugin.onLoad({ filter: /.*/, namespace: 'research-library' }, () => ({ contents: library, loader: 'jsx', resolveDir: here }));
      plugin.onLoad({ filter: /.*/, namespace: 'research-generated' }, () => ({ contents: source, loader: 'jsx', resolveDir: here }));
    } }],
  });
  if (result.outputFiles.length !== 1 || result.outputFiles[0].contents.length > 2 * 1024 * 1024) throw new Error('Compiled bundle limit');
  const bundle = new Uint8Array(result.outputFiles[0].contents);
  const classes = [classesFor({ type: 'Layout', props: { columns: 'single', gap: 'fractional' } }),
    classesFor({ type: 'Card', props: { padding: 'spacious', tone: 'light' } })];
  const css = new ServerRuntime().generateCss(classes.join(' '));
  return { bundle, css, sourceDigest: sha(source), bundleDigest: sha(bundle), versions: { ...versions }, moduleId };
}
