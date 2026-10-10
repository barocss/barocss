import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const commit = '5f5ad866205a21510ac69552e704cc162fa253b5';
const slugs = ['kit','browser','server','render','gpu','cad','cad-interop','canvas2d','viewer','physics','cad-editor','render-editor'];
const records = [];
for (const slug of slugs) {
  const directory = `packages/${slug === 'kit' ? 'barocss' : `barocss-${slug}`}`;
  const bytes = await readFile(resolve(root, directory, 'package.json'));
  const data = JSON.parse(bytes);
  records.push({ slug, directory, name: data.name, version: data.version, private: data.private ?? null, manifestSha256: createHash('sha256').update(bytes).digest('hex'), developmentExports: data.exports, publishConfig: data.publishConfig ?? null });
}
await writeFile(resolve(app, 'evidence/package-inventory.json'), JSON.stringify({ commit, packages: records }, null, 2) + '\n');
console.log(`Recorded ${records.length} actual manifests at ${commit}. Registry publication is not inferred.`);
