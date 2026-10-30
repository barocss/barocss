import { writeFile } from 'node:fs/promises';
import { loadLifetimeSource, growth, setup, drawing, items } from '../../../../../packages/barocss-viewer/tests/fixtures/presenter-lifetime-harness.mjs';
const source = new URL('../../../../../packages/barocss-viewer/src/presenter.ts', import.meta.url);
const api = await loadLifetimeSource(source, { name: 'after-bundle', base: import.meta.url }), result = growth(api), f = setup(api);
try { f.presenter.show(drawing([{ ...items()[0], color: 'invalid-color' }])); } catch (e) { result.failedAdd = { code: e.code, message: e.message, retained: f.core.geometries.size, meshes: f.core.meshList.length }; }
f.presenter.dispose();
console.log(JSON.stringify(result, null, 2));
await writeFile(new URL('./after-results.json', import.meta.url), JSON.stringify({ node: process.version, result }, null, 2) + '\n');
