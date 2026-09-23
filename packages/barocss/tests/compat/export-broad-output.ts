import { writeFileSync } from 'node:fs';
import { coverageCases } from './coverage-catalog';
import { buildCoverageCase, coverageRun, tailwindInput } from './coverage-harness';

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error('Usage: vite-node --script tests/compat/export-broad-output.ts <output-file>');
}

const records = [];
for (const entry of coverageCases) {
  try {
    records.push({ ...entry, browserStatus: 'unverified', ...await buildCoverageCase(entry.classes) });
  } catch (error) {
    throw new Error(`Failed to measure ${entry.id}: ${String(error)}`, { cause: error });
  }
}

writeFileSync(outputPath, `${JSON.stringify({ run: coverageRun, tailwindInput, records }, null, 2)}\n`);
