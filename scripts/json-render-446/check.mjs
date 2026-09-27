// Offline preflight. Missing official renderer dependencies remain blocked; no substitute renderer is used.
import { createRequire } from 'node:module';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { ARMS, SCENARIOS, MEASURES, fixtureCases, validateContract } from './contract.mjs';

const errors = validateContract();
if (errors.length) throw new Error(errors.join('\n'));
const require = createRequire(import.meta.url);
const rendererRequire = process.env.JR_ROOT ? createRequire(path.join(process.env.JR_ROOT, 'package.json')) : require;
const browserRequire = process.env.PW_DIR ? createRequire(path.join(process.env.PW_DIR, 'package.json')) : require;
const version = (name, from = require) => { try { return from(`${name}/package.json`).version; } catch { return null; } };
const dependencies = {
  '@json-render/core': version('@json-render/core', rendererRequire),
  '@json-render/react': version('@json-render/react', rendererRequire),
  react: version('react', rendererRequire),
  'react-dom': version('react-dom', rendererRequire),
  'playwright-core': version('playwright-core', browserRequire),
  tailwindcss: version('tailwindcss'),
  '@barocss/browser': version('@barocss/browser'),
};
const browserManifest = JSON.parse(readFileSync(new URL('../../packages/barocss-browser/package.json', import.meta.url), 'utf8'));
const kitManifest = JSON.parse(readFileSync(new URL('../../packages/barocss/package.json', import.meta.url), 'utf8'));
const ready = Boolean(dependencies['@json-render/core'] && dependencies['@json-render/react'] && dependencies.react && dependencies['react-dom'] && dependencies['playwright-core']);
const cases = fixtureCases().map(({ scenario, arm, stage }) => ({ scenario, arm, stage, status: ready ? 'not-run' : 'blocked:official-renderer-unavailable', measures: null }));
const report = {
  kind: 'offline-preflight',
  node: process.version,
  contractSha256: createHash('sha256').update(JSON.stringify({ ARMS, SCENARIOS, MEASURES })).digest('hex'),
  localPackageVersions: { '@barocss/browser': browserManifest.version, '@barocss/kit': kitManifest.version, tailwindcss: kitManifest.devDependencies?.tailwindcss ?? null },
  dependencies,
  measureKeys: MEASURES,
  evidence: { prior: 'scripts/json-render-376/result.json', sampleLimit: 'one output per model/format/request; no edit replay' },
  blockedReason: ready ? null : 'Official json-render React renderer or browser dependencies are absent from this worktree. No substitute renderer or model output is used.',
  cases,
};
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv.includes('--write')) writeFileSync(new URL('./offline-preflight.json', import.meta.url), json);
else process.stdout.write(json);
