import { writeFileSync } from 'node:fs';
import { coverageCases } from './coverage-catalog';
import { buildCoverageCase, coverageRun, tailwindInput } from './coverage-harness';
import { browserEvidenceV4_3_3, unverifiedBrowser } from './browser-evidence';

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error('Usage: vite-node --script tests/compat/export-broad-output.ts <output-file>');
}

const records = [];
for (const entry of coverageCases) {
  try {
    records.push({
      ...entry,
      browserV4_1_13: unverifiedBrowser,
      browserV4_3_3: browserEvidenceV4_3_3(entry.classes),
      ...await buildCoverageCase(entry.classes),
    });
  } catch (error) {
    throw new Error(`Failed to measure ${entry.id}: ${String(error)}`, { cause: error });
  }
}

writeFileSync(outputPath, `${JSON.stringify({ run: coverageRun, tailwindInput, records }, null, 2)}\n`);
