import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { releasePackages } from './release-manifests.mjs';

const root = resolve(import.meta.dirname, '../..');
const temp = mkdtempSync(join(tmpdir(), 'barocss-pack-'));
const packages = releasePackages.map(({ directory, name }) => [directory, name.split('/')[1]]);
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
    assert.notEqual(manifest.private, true, `${manifest.name}: packed package is private`);
    assert.equal(manifest.license, 'MIT', `${manifest.name}: missing MIT license metadata`);
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

  // The first renderer release is staged at its prototype version until Changesets version.
  const renderVersion = packedManifests.get('render').version;
  if (renderVersion !== kitVersion) {
    assert.equal(renderVersion, '0.0.0-private-prototype', 'Unexpected staged render version');
    const pending = readFileSync(join(root, '.changeset/public-render.md'), 'utf8');
    for (const { name } of releasePackages) assert.ok(pending.includes(`"${name}": minor`), 'Coordinated release changeset missing');
  }
  const render = packedManifests.get('render');
  assert.equal(render.type, 'module');
  assert.deepEqual(render.exports, { '.': { types: './dist/index.d.ts', import: './dist/index.js' } });
  assert.equal(render.peerDependencies.react, '19.2.3');
  assert.equal(render.dependencies?.react, undefined, 'React must remain an external peer');
  const renderDir = join(temp, 'node_modules/@barocss/render');
  assert.ok(existsSync(join(renderDir, 'examples/profile-form.tsx')));
  assert.equal(existsSync(join(renderDir, 'src')), false, 'Packed source must not be an export fallback');
  const depsRoot = process.env.REPO_DEPS_ROOT || root;
  const peerRoot = process.env.REACT_ROOT || join(depsRoot, 'packages/barocss-render');
  const typesRoot = process.env.REACT_TYPES_ROOT || join(depsRoot, 'packages/barocss-render');
  const peerRequire = createRequire(join(peerRoot, 'package.json'));
  const typesRequire = createRequire(join(typesRoot, 'package.json'));
  // Reuse installed peers. Do not install dependencies or use repository sources in the consumer.
  symlinkSync(dirname(peerRequire.resolve('react/package.json')), join(temp, 'node_modules/react'), 'dir');
  mkdirSync(join(temp, 'node_modules/@types'), { recursive: true });
  symlinkSync(dirname(typesRequire.resolve('@types/react/package.json')), join(temp, 'node_modules/@types/react'), 'dir');

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
    import { Renderer, validateSpec, classesFor } from '@barocss/render';
    import { BrowserRuntime as CdnRuntime } from './node_modules/@barocss/browser/dist/cdn/barocss.js';
    assert.equal(typeof Renderer, 'function');
    assert.equal(typeof validateSpec, 'function');
    assert.equal(typeof classesFor, 'function');
    assert.equal(validateSpec(null).ok, false);
    assert.equal(classesFor({ type: 'Text' }), '');
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
    assert.throws(() => require('@barocss/render'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  `);
  execFileSync(process.execPath, [smoke], { cwd: temp, stdio: 'inherit' });

  writeFileSync(join(temp, 'smoke.ts'), `
    import { createContext, generateCss } from '@barocss/kit';
    import { defaultTheme } from '@barocss/kit/theme/default';
    import { BrowserRuntime } from '@barocss/browser';
    import { ServerRuntime } from '@barocss/server';
    import { Renderer, validateSpec, classesFor } from '@barocss/render';
    import type { ScreenSpec, ComponentRegistry, ValidationError } from '@barocss/render';
    const spec: ScreenSpec = { root: 'layout', elements: {} };
    const errors: ValidationError[] = validateSpec(spec).errors;
    const registry: keyof ComponentRegistry = 'Input';
    void [Renderer, classesFor, errors, registry];
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
      skipLibCheck: false,
      noEmit: true,
      types: [],
    },
    include: ['smoke.ts'],
  }));
  execFileSync(process.execPath, [join(depsRoot, 'node_modules/typescript/bin/tsc'), '-p', temp], { stdio: 'inherit' });
  if (process.env.PACK_OUTPUT_DIR) {
    const output = resolve(process.env.PACK_OUTPUT_DIR);
    mkdirSync(output, { recursive: true });
    for (const [, name] of packages) {
      copyFileSync(
        join(temp, `barocss-${name}-${packedManifests.get(name).version}.tgz`),
        join(output, `barocss-${name}-${packedManifests.get(name).version}.tgz`),
      );
    }
  }
  console.log(`Packed all four @barocss packages (runtime ${kitVersion}, render ${renderVersion}): exports, types, CDN files, and runtime imports passed.`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
