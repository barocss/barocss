import { writeFileSync } from 'node:fs';
import { fixtures } from './fixtures';
import { buildCssPair } from './harness';

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error('Usage: vite-node --script tests/compat/export-output.ts <output-file>');
}

const records = [];
for (const { candidate, expected } of fixtures) {
  records.push({ candidate, expected, ...await buildCssPair(candidate) });
}

writeFileSync(outputPath, `${JSON.stringify({ tailwindVersion: '4.1.13', records }, null, 2)}\n`);
