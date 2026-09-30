// A second freeze for the API route; the accepted CLI frozen-plan.json remains unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifyFrozen } from './freeze.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha = (value) => createHash('sha256').update(value).digest('hex');
export function verifyApiFrozen() {
  const bytes = fs.readFileSync(path.join(here, 'api-frozen.json'));
  const frozen = JSON.parse(bytes);
  if (frozen.issue !== 458 || frozen.capturePlanHash !== verifyFrozen() || frozen.route !== 'direct-openai-standard-responses') throw new Error('API freeze identity drift');
  for (const [name, expected] of Object.entries(frozen.files)) {
    if (!/^[A-Za-z0-9./-]+$/.test(name) || name.includes('..') || sha(fs.readFileSync(path.join(here, name))) !== expected) throw new Error(`API freeze drift: ${name}`);
  }
  return sha(bytes);
}
