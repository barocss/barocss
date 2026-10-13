import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { impactForPaths } from './cad-impact-map.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
if (args.length !== 2 || args.some(arg => !/^[a-zA-Z0-9._/-]+$/.test(arg) || arg.startsWith('-') || arg.includes('..'))) {
  console.error('Usage: node apps/library-docs/scripts/check-cad-impact.mjs <base-ref> <head-ref>');
  process.exitCode = 2;
} else {
  try {
    // The diff explicitly uses the named refs. No network, checkout, mutation,
    // automatic documentation rewrite or trust in arbitrary file input.
    const bytes = execFileSync('git', ['diff', '--name-only', '-z', args[0] + '...' + args[1]], {
      cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    });
    const report = impactForPaths(bytes.split('\0').filter(Boolean));
    const app = resolve(root, 'apps/library-docs');
    for (const record of report.impacts) {
      record.existingDocumentation = record.documentation.filter(p => existsSync(resolve(app, p)));
      record.missingDocumentation = record.documentation.filter(p => !existsSync(resolve(app, p)));
    }
    console.log(JSON.stringify({ base: args[0], head: args[1], ...report }, null, 2));
    if (report.unmapped.length || report.impacts.some(item => item.missingDocumentation.length)) process.exitCode = 1;
  } catch (error) {
    console.error('Cannot inspect requested local Git refs:', error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
