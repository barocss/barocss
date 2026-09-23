import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(join(tmpdir(), 'barocss-pack-'));
const packages = [
  ['barocss', 'kit'],
  ['barocss-browser', 'browser'],
  ['barocss-server', 'server'],
];

try {
  for (const [directory, name] of packages) {
    const source = join(root, 'packages', directory);
    const sourceManifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
    execFileSync('pnpm', ['pack', '--pack-destination', temp], { cwd: source, stdio: 'pipe' });

    const archive = join(temp, `barocss-${name}-${sourceManifest.version}.tgz`);
    const destination = join(temp, 'node_modules', '@barocss', name);
    mkdirSync(destination, { recursive: true });
    execFileSync('tar', ['-xzf', archive, '-C', destination, '--strip-components=1']);

    const manifest = JSON.parse(readFileSync(join(destination, 'package.json'), 'utf8'));
    assert.equal(manifest.name, `@barocss/${name}`);
    for (const [subpath, conditions] of Object.entries(manifest.exports)) {
      for (const [condition, target] of Object.entries(conditions)) {
        assert.ok(existsSync(join(destination, target)), `${manifest.name}${subpath}: missing ${condition} target ${target}`);
      }
    }
    assert.ok(existsSync(join(destination, manifest.main)), `${manifest.name}: missing main`);
    assert.ok(existsSync(join(destination, manifest.types)), `${manifest.name}: missing types`);
    assert.ok(existsSync(join(destination, 'LICENSE')), `${manifest.name}: missing LICENSE`);
  }

  assert.ok(existsSync(join(temp, 'node_modules/@barocss/browser/dist/cdn/barocss.js')));
  assert.ok(existsSync(join(temp, 'node_modules/@barocss/browser/dist/cdn/barocss.umd.cjs')));

  const smoke = join(temp, 'smoke.mjs');
  writeFileSync(smoke, `
    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    import { createContext, generateCss } from '@barocss/kit';
    import { defaultTheme } from '@barocss/kit/theme/default';
    import { BrowserRuntime } from '@barocss/browser';
    import { ServerRuntime } from '@barocss/server';
    import { BrowserRuntime as CdnRuntime } from './node_modules/@barocss/browser/dist/cdn/barocss.js';
    assert.equal(typeof generateCss, 'function');
    assert.equal(typeof createContext, 'function');
    assert.ok(defaultTheme.colors);
    assert.equal(typeof BrowserRuntime, 'function');
    assert.equal(typeof CdnRuntime, 'function');
    assert.equal(typeof new ServerRuntime().generateCss, 'function');
    const require = createRequire(import.meta.url);
    assert.equal(typeof require('@barocss/server').ServerRuntime, 'function');
  `);
  execFileSync(process.execPath, [smoke], { cwd: temp, stdio: 'inherit' });

  writeFileSync(join(temp, 'smoke.ts'), `
    import { createContext, generateCss } from '@barocss/kit';
    import { defaultTheme } from '@barocss/kit/theme/default';
    import { BrowserRuntime } from '@barocss/browser';
    import { ServerRuntime } from '@barocss/server';
    const css: string = generateCss('p-4', createContext({}));
    const colors = defaultTheme.colors;
    const browser: typeof BrowserRuntime = BrowserRuntime;
    const server: typeof ServerRuntime = ServerRuntime;
    void [css, colors, browser, server];
  `);
  writeFileSync(join(temp, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      target: 'ES2022',
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      types: [],
    },
    include: ['smoke.ts'],
  }));
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', temp], { stdio: 'inherit' });
  console.log('Packed exports, types, CDN files, and runtime imports passed.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
