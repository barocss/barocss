import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appendRecords, readData } from './store.mjs';
import { catalog } from './samples.mjs';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [root, file] = process.argv.slice(2);
  if (!root || !file || process.argv.length !== 4) throw new Error('Usage: node append.mjs ABS_ROOT --seed|BOUNDED_JSON_FILE');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const records = file === '--seed' ? catalog(sha) : readData(file);
  console.log(JSON.stringify(appendRecords(root, records)));
}
