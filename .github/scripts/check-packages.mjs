import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(join(tmpdir(), 'barocss-pack-'));
const packages = [
  ['barocss', 'kit'],
  ['barocss-browser', 'browser'],
  ['barocss-server', 'server'],
];
const packedManifests = new Map();

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
    assert.equal(manifest.version, sourceManifest.version);
    assert.equal(manifest.repository?.url, 'git+https://github.com/barocss/barocss.git');
    assert.equal(manifest.repository?.directory, `packages/${directory}`);
    packedManifests.set(name, manifest);
    // Conditions may nest (e.g. `require: { types, default }`); walk to every leaf path.
    const leaves = (value, path) => typeof value === 'string'
      ? [{ path, target: value }]
      : Object.entries(value).flatMap(([condition, next]) => leaves(next, [...path, condition]));
    const requireDefault = (value) => {
      const req = typeof value === 'object' ? value.require : undefined;
      return typeof req === 'string' ? req : req?.default;
    };
    for (const [subpath, conditions] of Object.entries(manifest.exports)) {
      for (const { path, target } of leaves(conditions, [])) {
        const where = `${manifest.name}${subpath} [${path.join('.')}]`;
        assert.ok(existsSync(join(destination, target)), `${where}: missing target ${target}`);
        if (path.includes('require') && !path.includes('types') && manifest.type === 'module') {
          assert.match(target, /\.cjs$/, `${where}: require must target CommonJS`);
        }
        if (path.includes('types')) assert.match(target, /\.d\.c?ts$/, `${where}: types must be a declaration file`);
      }
    }
    assert.ok(existsSync(join(destination, manifest.main)), `${manifest.name}: missing main`);
    const mainRequire = requireDefault(manifest.exports['.']);
    if (mainRequire) assert.equal(manifest.main, mainRequire, `${manifest.name}: main must match the require export`);
    assert.ok(existsSync(join(destination, manifest.types)), `${manifest.name}: missing types`);
    assert.ok(existsSync(join(destination, 'LICENSE')), `${manifest.name}: missing LICENSE`);
  }

  const kitVersion = packedManifests.get('kit').version;
  for (const name of ['browser', 'server']) {
    const manifest = packedManifests.get(name);
    assert.equal(manifest.version, kitVersion, `${manifest.name}: version differs from kit`);
    assert.equal(manifest.dependencies['@barocss/kit'], kitVersion, `${manifest.name}: kit dependency version differs`);
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
    assert.equal(typeof require('@barocss/kit').generateCss, 'function');
    assert.equal(typeof require('@barocss/server').ServerRuntime, 'function');
    assert.ok(require('@barocss/kit/theme/default').defaultTheme.colors);
    assert.equal(typeof require('@barocss/browser').BrowserRuntime, 'function');
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
  if (process.env.PACK_OUTPUT_DIR) {
    const output = resolve(process.env.PACK_OUTPUT_DIR);
    mkdirSync(output, { recursive: true });
    for (const [, name] of packages) {
      copyFileSync(
        join(temp, `barocss-${name}-${kitVersion}.tgz`),
        join(output, `barocss-${name}-${kitVersion}.tgz`),
      );
    }
  }
  console.log(`Packed @barocss packages at ${kitVersion}: exports, types, CDN files, and runtime imports passed.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
