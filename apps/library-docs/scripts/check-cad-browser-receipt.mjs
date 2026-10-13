// Read-only CLI. Validate one local CAD browser evidence JSON receipt.
import { readFileSync } from 'node:fs';
import { validateCadEvidence } from './cad-browser-evidence-validate.mjs';
const [file,...extra]=process.argv.slice(2);
if (!file || extra.length) {
  console.error('Usage: node apps/library-docs/scripts/check-cad-browser-receipt.mjs <receipt.json>');
  process.exitCode=2;
} else {
  try {
    const result=validateCadEvidence(JSON.parse(readFileSync(file,'utf8')));
    console.log(JSON.stringify(result,null,2));
    if (!result.ok) process.exitCode=1;
  } catch (e) {
    console.error(String(e));
    process.exitCode=2;
  }
}
