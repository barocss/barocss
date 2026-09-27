// Deterministic baseline manifest. Run --write before writing the authored edit cases, then --verify.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ARMS, VIEWPORTS, REPEATS, SCENARIO_NAMES, INITIAL, VARIABLE_FIELDS, STATE_TEMPLATES, INVENTORIES, CATALOG, HOST_CSS } from './baseline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(here, 'baseline.json');
const jrRoot = process.env.JR_ROOT;
const pwDir = process.env.PW_DIR;
const chrome = process.env.CHROME;
if (!jrRoot || !pwDir || !chrome || !fs.existsSync(chrome)) throw new Error('Set JR_ROOT, PW_DIR and CHROME to the approved existing installs');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const read = (relative) => fs.readFileSync(path.join(root, relative));
const fromRepo = createRequire(path.join(root, 'packages/barocss/package.json'));
const dependencyVersion = (root, name) => JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
const { compile } = fromRepo('tailwindcss');
const twDir = path.dirname(fromRepo.resolve('tailwindcss/package.json'));
const themeCSS = read('scripts/json-render-probe/e2e/app.css').toString();
async function buildCSS(tokens) {
  const compiler = await compile(`@import "tailwindcss";\n${themeCSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const name = id.replace(/^tailwindcss\//, '');
      const candidate = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, name);
      const file = fs.existsSync(candidate) ? candidate : path.join(twDir, name);
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return compiler.build(tokens) + '\n' + HOST_CSS;
}
const inventory = {};
for (const arm of ARMS) {
  const tokens = [...new Set(INVENTORIES[arm])].sort();
  const css = await buildCSS(tokens);
  if (arm === 'variable' && !['var(--ui-pad)', 'var(--ui-gap)', 'var(--ui-radius)'].every((term) => css.includes(term))) {
    throw new Error('variable template did not compile');
  }
  if ((arm === 'preset' || arm === 'variable') && !css.includes('text-decoration-line: underline')) {
    throw new Error('precompiled hover template did not compile');
  }
  inventory[arm] = { tokens, tokenSha256: sha(JSON.stringify(tokens)), cssSha256: sha(css), cssBytes: Buffer.byteLength(css) };
}
if (inventory.utility.cssSha256 !== inventory.build.cssSha256) throw new Error('utility/build initial CSS differ');
const sources = [
  'scripts/json-render-446/contract.mjs', 'scripts/json-render-446/styles.mjs',
  'scripts/json-render-446/spec.mjs', 'scripts/json-render-446/browser-app.jsx',
  'scripts/json-render-probe/e2e/app.css', 'scripts/json-render-457/baseline.mjs',
  'scripts/json-render-457/browser-app.jsx', 'scripts/json-render-457/BASELINE.md',
  'scripts/json-render-457/freeze.mjs',
];
const manifest = {
  kind: 'json-render-457-frozen-baseline',
  releasedDevelop: '9ef236cafe618add8848aa94a0d58798958b3c91',
  packageVersions: {
    kit: JSON.parse(read('packages/barocss/package.json')).version,
    browser: JSON.parse(read('packages/barocss-browser/package.json')).version,
    jsonRenderCore: dependencyVersion(jrRoot, '@json-render/core'),
    jsonRenderReact: dependencyVersion(jrRoot, '@json-render/react'),
    react: dependencyVersion(jrRoot, 'react'),
    playwrightCore: JSON.parse(fs.readFileSync(path.join(pwDir, 'playwright-core/package.json'), 'utf8')).version,
    tailwindcss: JSON.parse(fs.readFileSync(fromRepo.resolve('tailwindcss/package.json'), 'utf8')).version,
  },
  nodeVersion: process.version,
  browser: { executableVersion: execFileSync(chrome, ['--version'], { encoding: 'utf8' }).trim(), executableSha256: sha(fs.readFileSync(chrome)) },
  baroBundleSha256: sha(read('packages/barocss-browser/dist/cdn/barocss.umd.cjs')),
  sources: Object.fromEntries(sources.map((name) => [name, sha(read(name))])),
  arms: ARMS, scenarios: SCENARIO_NAMES, viewports: VIEWPORTS, repeats: REPEATS,
  initial: INITIAL, catalog: CATALOG, variableFields: VARIABLE_FIELDS, stateTemplates: STATE_TEMPLATES,
  hostCssSha256: sha(HOST_CSS), inventory,
  limitations: ['Authored deterministic edits only', 'No model calls or population inference', 'No adaptive catalog additions in primary run'],
};
const json = JSON.stringify(manifest, null, 2) + '\n';
if (process.argv.includes('--write')) fs.writeFileSync(out, json);
else if (process.argv.includes('--verify')) {
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== json) throw new Error('frozen baseline drift');
  console.log(`Frozen baseline verified: ${sha(json)}`);
} else process.stdout.write(json);
