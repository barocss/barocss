import { writeFileSync } from 'node:fs';
import { compatibilityFollowup } from './catalog';
import { buildCssPair } from './harness';

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error('Usage: vite-node --script tests/compat/export-followup-output.ts <output-file>');
}

const records = [];
for (const { input: candidate, cssStructure: expected } of compatibilityFollowup.cases) {
  records.push({ candidate, expected, ...await buildCssPair(candidate) });
}

writeFileSync(outputPath, `${JSON.stringify({ tailwindVersion: compatibilityFollowup.tailwindVersion, barocssCommit: compatibilityFollowup.barocssCommit, records }, null, 2)}\n`);
