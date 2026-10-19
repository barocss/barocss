#!/usr/bin/env node
// The A/B harness (A5.5): see server/ab/main.ts. Bundles the harness and the MCP tool server from the sources.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'cad-ab-build-'));
await build({ entryPoints: { main: join(root, 'server/ab/main.ts'), cadMcp: join(root, 'server/cadMcp.ts') }, outdir: out, bundle: true, platform: 'node', format: 'esm', target: 'node22', outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const { abMain } = await import(pathToFileURL(join(out, 'main.mjs')).href);
const code = await abMain(process.argv.slice(2), { mcpScript: join(out, 'cadMcp.mjs'), scripted: join(root, 'test/fixtures/scripted-claude.mjs') });
rmSync(out, { recursive: true, force: true });
process.exit(code);
