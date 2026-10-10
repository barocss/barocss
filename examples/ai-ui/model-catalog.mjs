import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const maxBytes = 1_048_576;
export const catalogHash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function selectedModel(catalog, model, effort) {
  if (!catalog || !Array.isArray(catalog.models)) throw new Error('Model catalog required');
  const matches = catalog.models.filter((entry) => entry?.slug === model);
  if (matches.length !== 1 || !matches[0].supported_reasoning_levels?.some((level) => level?.effort === effort))
    throw new Error('Exactly one matching model and effort required');
  return matches[0];
}
export function snapshotCatalog(sourceFile, model, effort) {
  const info = fs.lstatSync(sourceFile);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 8 * maxBytes) throw new Error('Bounded existing model source required');
  const source = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(sourceFile)));
  const text = JSON.stringify({ models: [selectedModel(source, model, effort)] }) + '\n';
  if (Buffer.byteLength(text) > maxBytes) throw new Error('Selected catalog too large');
  return { text, digest: catalogHash(text), sourceVersion: typeof source.client_version === 'string' ? source.client_version : null };
}
export function inspectCatalog(file, expectedDigest, model, effort) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) || info.size > maxBytes)
    throw new Error('Private regular bounded model catalog required');
  const bytes = fs.readFileSync(file);
  if (catalogHash(bytes) !== expectedDigest) throw new Error('Model catalog digest changed');
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (Object.keys(value).join(',') !== 'models' || value.models?.length !== 1) throw new Error('Single-model snapshot required');
  selectedModel(value, model, effort);
  return value;
}

// This decoder is local only: no auth and an OS network deny, never Codex exec.
export function verifyCatalogOffline(file, { root, cliPath, nodeBin, model, effort, digest }) {
  inspectCatalog(file, digest, model, effort);
  if (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/sandbox-exec'))
    throw new Error('Network-denied catalog verifier currently requires macOS');
  const directory = path.join(root, 'catalog-check');
  fs.mkdirSync(directory, { mode: 0o700 });
  for (const name of ['home', 'codex-home']) fs.mkdirSync(path.join(directory, name), { mode: 0o700 });
  const write = (name, data) => fs.writeFileSync(path.join(directory, name), data, { flag: 'wx', mode: 0o600 });
  let stdout;
  try {
    stdout = execFileSync('/usr/bin/sandbox-exec', ['-p', '(version 1) (allow default) (deny network*)',
      cliPath, '-c', `model_catalog_json=${JSON.stringify(file)}`, '-c', 'mcp_servers={}', 'debug', 'models'], {
      cwd: directory, env: { HOME: path.join(directory, 'home'), CODEX_HOME: path.join(directory, 'codex-home'),
        PATH: `${nodeBin}:/usr/bin:/bin`, LANG: 'en_US.UTF-8' }, timeout: 10_000, maxBuffer: 4 * maxBytes,
    });
  } catch (error) {
    write('failure-stdout.json', error.stdout ?? ''); write('failure-stderr.txt', error.stderr ?? '');
    throw new Error('Offline model catalog decode failed');
  }
  write('decoded.json', stdout);
  const decoded = JSON.parse(stdout.toString());
  const value = Array.isArray(decoded) ? { models: decoded } : decoded;
  if (value.models?.length !== 1) throw new Error('CLI did not honor the single-model catalog');
  selectedModel(value, model, effort);
  if (fs.existsSync(path.join(directory, 'codex-home', 'models_cache.json'))
    || fs.existsSync(path.join(directory, 'codex-home', 'auth.json'))) throw new Error('Unexpected decoder cache/auth file');
  inspectCatalog(file, digest, model, effort);
  const result = { status: 'verified-offline', digest, model, effort, network: 'OS denied', auth: 'none', modelInference: false };
  write('result.json', JSON.stringify(result, null, 2) + '\n');
  return result;
}
