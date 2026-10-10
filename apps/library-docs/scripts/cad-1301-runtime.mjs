import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { deepStrictEqual } from 'node:assert';

export const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function loadCad1301Consumer() {
  const profilePath = resolve(app, 'scripts/profiles/cad-1301.json');
  const profile = JSON.parse(await readFile(profilePath, 'utf8'));
  if (profile.format !== 'barocss-docs-cad-1301-profile-v1' || profile.archive !== 'cad-1301.runtime.json.gz' || profile.sourceCommit !== 'ded1ef68b9877de2b487721bc7228e37daed2865' || profile.nativeCommit !== '51821d21c7880edbdb54ad7f2688b848ae56bde2' || profile.files.length !== 358) throw Error('Invalid CAD1301 runtime profile');
  const archiveBytes = await readFile(resolve(dirname(profilePath), profile.archive));
  if (sha256(archiveBytes) !== profile.archiveSha256) throw Error('CAD1301 runtime archive hash mismatch');
  const archive = JSON.parse(gunzipSync(archiveBytes, { maxOutputLength: 32 * 1024 * 1024 }).toString('utf8'));
  if (archive.format !== 'barocss-docs-public-runtime-snapshot-v1' || archive.sourceCommit !== profile.sourceCommit || archive.nativeCommit !== profile.nativeCommit || archive.files.length !== 358) throw Error('Invalid compiled runtime archive');
  if (sha256(archive.manifestText) !== profile.manifestSha256 || sha256(archive.license) !== profile.licenseSha256) throw Error('CAD1301 original manifest/license hash mismatch');
  deepStrictEqual(JSON.parse(archive.manifestText), archive.manifest);
  const manifest = archive.manifest;
  const published = manifest.publishConfig;
  if (manifest.name !== '@barocss/cad' || manifest.version !== profile.packageVersion || published.exports['.'].import !== './dist/index.js' || published.exports['.'].types !== './dist/index.d.ts' || profile.entry !== 'dist/index.js' || profile.types !== 'dist/index.d.ts') throw Error('Unexpected compiled public entry map');
  const cache = resolve(app, 'docs/.vitepress/cache/cad-1301-cli');
  const packageRoot = resolve(cache, 'node_modules/@barocss/cad');
  const hashes = new Map(profile.files.map(file => [file.path, file.sha256]));
  if (hashes.size !== 358) throw Error('Duplicate runtime profile member');
  const seen = new Set();
  let javascript = 0, declarations = 0;
  for (const file of archive.files) {
    if (!/^dist\/[A-Za-z0-9_-]+\.(?:js|d\.ts)$/.test(file.path) || seen.has(file.path)) throw Error('Invalid runtime archive member path');
    seen.add(file.path);
    const bytes = Buffer.from(file.base64, 'base64');
    if (sha256(bytes) !== file.sha256 || hashes.get(file.path) !== file.sha256) throw Error(`Compiled member hash mismatch: ${file.path}`);
    if (file.path.endsWith('.d.ts')) declarations++; else javascript++;
    const destination = resolve(packageRoot, file.path);
    await mkdir(dirname(destination), { recursive: true });
    try {
      if (sha256(await readFile(destination)) !== file.sha256) throw Error(`Modified compiled cache refused: ${file.path}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await writeFile(destination, bytes, { flag: 'wx' });
    }
  }
  if (javascript !== 179 || declarations !== 179) throw Error('Incomplete compiled JS/types closure');
  const cacheManifest = { ...manifest, main: published.main, types: published.types, exports: published.exports, private: true };
  await writeFile(resolve(packageRoot, 'package.json'), JSON.stringify(cacheManifest, null, 2) + '\n');
  await writeFile(resolve(packageRoot, 'LICENSE'), archive.license);
  const consumer = resolve(cache, 'consumer.mjs');
  await writeFile(consumer, await readFile(resolve(app, 'scripts/snippets/cad-body-1301.mjs')));
  const module = await import(pathToFileURL(consumer).href);
  return { module, profile, provenance: {
    sourceCommit: profile.sourceCommit, nativeCommit: profile.nativeCommit,
    packageName: manifest.name, packageVersion: manifest.version,
    resolution: 'bare @barocss/cad through actual publishConfig root maps in isolated docs cache',
    javascriptFiles: javascript, declarationFiles: declarations,
    archiveSha256: profile.archiveSha256, memberHashes: 'all358matched; existing cache members rechecked',
    workspaceBaseline: '5f5ad866205a21510ac69552e704cc162fa253b5 unchanged',
  } };
}
