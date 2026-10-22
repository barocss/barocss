#!/usr/bin/env node
// The CLI (A5.4): a run_script script to .bcad, STEP and STL, its requirements checked (server/cadCli.ts).
//   node apps/cad-studio/scripts/cad-cli.mjs run part.cad.js -o part.bcad [--step part.step] [--stl part.stl] [--check]
//   node apps/cad-studio/scripts/cad-cli.mjs check part.bcad
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'cad-cli-'));
await build({ entryPoints: { cadCli: join(root, 'server/cadCli.ts') }, outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const { cliMain } = await import(pathToFileURL(join(out, 'cadCli.mjs')).href);
const code = await cliMain(process.argv.slice(2));
rmSync(out, { recursive: true, force: true });
process.exit(code);
