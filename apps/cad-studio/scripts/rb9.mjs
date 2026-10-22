#!/usr/bin/env node
// The RB9 ladder with the scripted agent (O70): see packages/barocss-cad-model/src/rb9/main.ts. Bundles it from the sources and runs it.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'cad-rb9-build-'));
await build({ entryPoints: { main: join(root, '../../packages/barocss-cad-model/src/rb9/main.ts') }, outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const { rb9Main } = await import(pathToFileURL(join(out, 'main.mjs')).href);
const code = await rb9Main(process.argv.slice(2));
rmSync(out, { recursive: true, force: true });
process.exit(code);
