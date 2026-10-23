// R4's oracle (the kernel's R5 fingerprint, for cad-model): what the model makes of a fixed set of documents, hashed,
// so a refactor that changes nothing gives the same fingerprint byte for byte. Bundles scripts/r4-fingerprint.ts with
// the package's sources and runs it: `node scripts/r4-fingerprint.mjs [out.json]` prints each document's SHA-256 and
// the whole; out.json (never committed) holds the full records for a diff.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..'), out = mkdtempSync(join(tmpdir(), 'cad-model-r4-'));
await build({ entryPoints: [join(root, 'scripts/r4-fingerprint.ts')], outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning', define: { 'import.meta.dirname': JSON.stringify(join(root, 'scripts')) } });
const result = spawnSync(process.execPath, [join(out, 'r4-fingerprint.mjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
process.exit(result.status ?? 1);
