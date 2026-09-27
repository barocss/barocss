// Minimal class generation checks for the observed #438 mismatches; no browser or model calls.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEPS_ROOT = process.env.DEPS_ROOT || path.join(os.homedir(), '.barocss-ai/v3/integration');
const deps = createRequire(path.join(DEPS_ROOT, 'package.json'));
const { compile } = deps('tailwindcss');
const kit = createRequire(path.join(DEPS_ROOT, 'package.json'))(path.join(DEPS_ROOT, 'packages/barocss/dist/index.cjs'));
const theme = fs.readFileSync(path.join(path.dirname(deps.resolve('tailwindcss/package.json')), 'theme.css'), 'utf8');
const tokens = ['bg-linear-to-r/oklch', 'mask-linear-to-90%', 'mask-radial-from-20%', 'mask-radial-to-90%',
  'bg-[linear-gradient(45deg,#f59e0b_50%,transparent_50%),linear-gradient(135deg,#a855f7_50%,transparent_50%)]'];
const output = {};
for (const token of tokens) {
  const c = await compile(`${theme}\n@tailwind utilities;`);
  const noToken = c.build([]);
  const withToken = c.build([token]);
  const baro = kit.generateCss(token, kit.createContext({ preflight: false }));
  output[token] = { tailwindGenerated: withToken !== noToken, baroGenerated: !!baro,
    tailwindCssTail: withToken.slice(-900), baroCss: baro };
}
fs.writeFileSync(path.join(HERE, 'evidence/isolation.json'), `${JSON.stringify(output, null, 2)}\n`);
for (const [token, check] of Object.entries(output)) console.log(token, `Tailwind=${check.tailwindGenerated}`, `Baro=${check.baroGenerated}`);
