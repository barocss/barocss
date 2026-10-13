// Read-only CLI. Structural checks plus optional physical evidence byte verification.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateCadEvidence } from './cad-browser-evidence-validate.mjs';
import { verifyEvidenceFiles } from './cad-evidence-files.mjs';
const [file,option,root,...extra] = process.argv.slice(2);
if (!file || extra.length || (option !== undefined && (option !== '--evidence-root' || !root)) || (root && !option)) {
  console.error('Usage: node apps/library-docs/scripts/check-cad-browser-receipt.mjs <receipt.json> [--evidence-root <directory>]');
  process.exitCode = 2;
} else {
  try {
    const receipt = JSON.parse(readFileSync(file,'utf8'));
    const structural = validateCadEvidence(receipt);
    const physical = option ? verifyEvidenceFiles(receipt,resolve(root)) : {ok:true,errors:[]};
    const result = {ok:structural.ok && physical.ok,errors:[...structural.errors,...physical.errors],physicalEvidenceChecked:Boolean(option)};
    console.log(JSON.stringify(result,null,2));
    if (!result.ok) process.exitCode=1;
  } catch (e) {
    console.error(String(e));
    process.exitCode=2;
  }
}
