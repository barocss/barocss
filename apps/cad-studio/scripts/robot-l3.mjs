#!/usr/bin/env node
// O15, RD10's L3 run: see server/robotL3/main.ts. Bundles the run and the MCP tool server from the sources; the fresh
// check runs scripts/cad-cli.mjs.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'cad-robot-l3-build-'));
await build({ entryPoints: { main: join(root, 'server/robotL3/main.ts'), cadMcp: join(root, 'server/cadMcp.ts') }, outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const { robotL3Main } = await import(pathToFileURL(join(out, 'main.mjs')).href);
const code = await robotL3Main(process.argv.slice(2), { mcpScript: join(out, 'cadMcp.mjs'), scripted: join(root, 'test/fixtures/scripted-claude.mjs'), cli: join(root, 'scripts/cad-cli.mjs'), conformance: join(root, '../../packages/barocss-cad/conformance') });
rmSync(out, { recursive: true, force: true });
process.exit(code);
