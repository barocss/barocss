import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const declarationAnchor = source => 'declarations-' + createHash('sha256').update(source).digest('hex').slice(0,12);
async function pages(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const path = resolve(directory, item.name);
    if (item.isDirectory()) result.push(...await pages(path));
    else if (item.name.endsWith('.md')) result.push(path);
  }
  return result;
}
export async function repairSourceLinks(surface, { check = false } = {}) {
  const status = JSON.parse(await readFile(resolve(app, 'evidence/source-link-status.json'), 'utf8'));
  if (status.commit !== surface.sourceCommit) throw new Error('Remote availability receipt must match the exact source pin');
  const destinations = new Map();
  for (const p of surface.packages) for (const e of p.entries) for (const group of e.groups || []) {
    if (!destinations.has(group.source)) destinations.set(group.source, `/packages/${p.slug}/reference#${declarationAnchor(group.source)}`);
  }
  let converted = 0, provenance = 0;
  const pattern = /\[([^\]]+)\]\(https:\/\/github\.com\/barocss\/barocss\/blob\/([a-f0-9]{40})\/([^\s)]+)\)/g;
  for (const path of await pages(resolve(app, 'docs'))) {
    const original = await readFile(path, 'utf8');
    const next = original.replace(pattern, (whole, label, commit, ref) => {
      if (commit !== surface.sourceCommit || status.available) return whole;
      if (check) throw new Error(`Unavailable pinned source link remains in ${path}: ${ref}`);
      const source = ref.split('#')[0];
      const destination = destinations.get(source);
      if (destination) { converted++; return `[${label}](${destination})`; }
      provenance++; return `\`${source}\` (${label}; local source)`;
    });
    if (!check && next !== original) await writeFile(path, next);
  }
  return { remoteCommitAvailable: status.available, publicDeclarationLinksConverted: converted, localProvenancePaths: provenance, policy: 'Exact local pin preserved; no moving-branch substitution' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--check') && !process.argv.includes('--write')) throw new Error('Use --check or --write');
  const surface = JSON.parse(await readFile(resolve(app, 'evidence/public-api.json'), 'utf8'));
  const result = await repairSourceLinks(surface, { check: process.argv.includes('--check') });
  console.log(JSON.stringify(result));
}
