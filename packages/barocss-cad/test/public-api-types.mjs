import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

// Typecheck documentation and contracts only. No example or provider is executed.
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const entry = resolve(process.env.CAD_PUBLIC_API_TYPES_ENTRY ?? join(import.meta.dirname, '../src/index.ts'));
const documentation = readFileSync(new URL('../CONCISE_API.md', import.meta.url), 'utf8');
const examples = [...documentation.matchAll(/^```ts\n([\s\S]*?)^```/gm)].map(match => match[1]);
assert.equal(examples.length, 21, 'check every complete TypeScript example');
const directory = mkdtempSync(join(tmpdir(), 'barocss-public-api-types-'));
try {
  const files = examples.map((source, i) => {
    const file = join(directory, `example-${i}.mts`);
    writeFileSync(file, source);
    return file;
  });
  const config = join(directory, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({
    compilerOptions: {
      strict: true, noEmit: true, target: 'ES2022', module: 'NodeNext',
      moduleResolution: 'NodeNext', skipLibCheck: true, types: [],
      paths: { '@barocss/cad': [entry] },
    },
    files: [...files, join(import.meta.dirname, 'public-api-types.ts')],
  }));
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', config], { stdio: 'inherit' });
  console.log(`PASS: ${examples.length} documentation examples and facade type contracts (${entry})`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
