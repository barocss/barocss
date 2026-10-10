import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { classesFor } from '@barocss/render';
import { ServerRuntime } from '@barocss/server';

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const ts = require('typescript');
const here = fileURLToPath(new URL('./', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const versions = Object.freeze({
  react: require('react/package.json').version,
  reactDom: require('react-dom/package.json').version,
  esbuild: require('esbuild/package.json').version,
});
const imports = new Set(['react', '@barocss/ui']);

function checkSource(source) {
  const tree = ts.createSourceFile('generated.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  if (tree.parseDiagnostics.length) throw new Error('Invalid JSX syntax');
  let hasDefault = false;
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && (!ts.isStringLiteral(node.moduleSpecifier)
      || !imports.has(node.moduleSpecifier.text))) throw new Error('Generated dependency is not permitted');
    if ((ts.isExportDeclaration(node) && node.moduleSpecifier) || ts.isImportEqualsDeclaration(node)
      || (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))))
      throw new Error('Generated dynamic or forwarded dependency is not permitted');
    if (ts.isExportAssignment(node) && !node.isExportEquals) hasDefault = true;
    if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
      && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) hasDefault = true;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (!hasDefault) throw new Error('Generated default export is required');
}

/** Compile one complete authored JSX module into a browser bundle and fixed BaroCSS CSS. */
export async function compileUi(source, options) {
  const moduleId = options?.moduleId;
  if (typeof source !== 'string' || Buffer.byteLength(source, 'utf8') > 32 * 1024
    || typeof moduleId !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(moduleId))
    throw new Error('Invalid bounded JSX source');
  checkSource(source);

  const classes = [
    classesFor({ type: 'Layout', props: { columns: 'single', gap: 'fractional' } }),
    classesFor({ type: 'Card', props: { padding: 'spacious', tone: 'light' } }),
  ];
  const [frame, library] = await Promise.all([
    fs.readFile(new URL('./frame.jsx', import.meta.url), 'utf8'),
    fs.readFile(new URL('./library.jsx', import.meta.url), 'utf8'),
  ]);
  const result = await build({
    entryPoints: ['ui-compiler-frame'], bundle: true, write: false,
    format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'bounded-generated-module', setup(plugin) {
      plugin.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === 'entry-point' && args.path === 'ui-compiler-frame')
          return { path: 'frame.jsx', namespace: 'ui-compiler-frame' };
        if (args.namespace === 'ui-compiler-generated') {
          if (args.kind === 'dynamic-import') return { errors: [{ text: 'Generated dynamic dependency is not permitted' }] };
          if (!imports.has(args.path) && args.path !== 'react/jsx-runtime')
            return { errors: [{ text: 'Generated dependency is not permitted' }] };
        }
        if (args.path === '@barocss/ui-compiler/generated' && args.namespace === 'ui-compiler-frame')
          return { path: `${moduleId}.jsx`, namespace: 'ui-compiler-generated' };
        if (args.path === '@barocss/ui' && args.namespace === 'ui-compiler-generated')
          return { path: 'library.jsx', namespace: 'ui-compiler-library' };
        if (args.path === '@barocss/ui-compiler/classes' && args.namespace === 'ui-compiler-library')
          return { path: 'classes.js', namespace: 'ui-compiler-classes' };
        if (/^react(?:-dom)?(?:\/.*)?$/.test(args.path)) return { path: require.resolve(args.path) };
      });
      plugin.onLoad({ filter: /.*/, namespace: 'ui-compiler-frame' }, () => ({ contents: frame, loader: 'jsx', resolveDir: here }));
      plugin.onLoad({ filter: /.*/, namespace: 'ui-compiler-library' }, () => ({ contents: library, loader: 'jsx', resolveDir: here }));
      plugin.onLoad({ filter: /.*/, namespace: 'ui-compiler-generated' }, () => ({ contents: source, loader: 'jsx', resolveDir: here }));
      plugin.onLoad({ filter: /.*/, namespace: 'ui-compiler-classes' }, () => ({ contents: `export const UI_CLASSES = ${JSON.stringify(classes)};`, loader: 'js' }));
    } }],
  });
  if (result.outputFiles.length !== 1 || result.outputFiles[0].contents.length > 2 * 1024 * 1024)
    throw new Error('Compiled bundle limit');
  const bundle = new Uint8Array(result.outputFiles[0].contents);
  const css = new ServerRuntime().generateCss(classes.join(' '));
  return { version: 1, moduleId, sourceDigest: sha(Buffer.from(source, 'utf8')),
    bundleDigest: sha(bundle), bundle, css, versions: { ...versions } };
}
