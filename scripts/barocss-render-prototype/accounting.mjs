import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const groups = {
  privateRendererCore: ['../../packages/barocss-render/src/index.jsx'],
  sharedValidationPolicy: ['../../packages/barocss-render/src/contract.mjs'],
  prototypeApplicationIntegration: ['prototype-adapter.jsx'],
  jsonRenderApplicationIntegration: ['json-adapter.jsx'],
  sharedApplicationComponents: ['visual.jsx'],
  sharedHarness: ['browser-app.jsx', 'dashboard.js', 'serve.mjs'],
  authoredFixture: ['fixture.mjs'],
  verification: ['contract.test.mjs', 'browser.test.mjs'],
};
const count = (file) => fs.readFileSync(path.join(here, file), 'utf8').split('\n')
  .filter((line) => line.trim() && !line.trim().startsWith('//')).length;
const result = Object.fromEntries(Object.entries(groups).map(([group, files]) => [group, {
  sourceLines: files.reduce((total, file) => total + count(file), 0), files,
}]));
if (process.argv.includes('--write')) {
  fs.mkdirSync(path.join(here, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(here, 'evidence/accounting.json'), JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result, null, 2));
