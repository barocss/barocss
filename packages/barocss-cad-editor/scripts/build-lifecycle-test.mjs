// Cheap orchestration checks with explicit phase stubs, not a replacement for a real build.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const fixture = mkdtempSync(join(tmpdir(), 'cad-editor-build-lifecycle-'));
try {
  mkdirSync(resolve(fixture, 'scripts')); mkdirSync(resolve(fixture, 'src'));
  writeFileSync(resolve(fixture, 'src/styles.css'), '/* scoped fixture */');
  cpSync(resolve(import.meta.dirname, 'build.mjs'), resolve(fixture, 'scripts/build.mjs'));
  const record = `import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path'; import { getHeapStatistics } from 'node:v8';\nappendFileSync('phases.jsonl', JSON.stringify({phase:PHASE,pid:process.pid,argv:process.execArgv,rayon:process.env.RAYON_NUM_THREADS,heapMiB:getHeapStatistics().heap_size_limit/2**20,path:process.argv[2]})+'\\n');\n`;
  writeFileSync(resolve(fixture, 'scripts/build-declarations.mjs'), `const PHASE='declarations';\n${record}\nif(process.env.FAIL_PHASE===PHASE)process.exit(7); writeFileSync(resolve(process.argv[2],'index.d.ts'),'export {};');`);
  writeFileSync(resolve(fixture, 'scripts/build-bundle.mjs'), `const PHASE='bundle';\n${record}\nmkdirSync('dist',{recursive:true});writeFileSync('dist/index.js','export {};');if(process.env.FAIL_PHASE===PHASE)process.exit(8);`);
  const cases = [
    { failure: '', flags: [], env: {}, expectedFlag: '--max-old-space-size=1536', rayon: '1', heap: 1536 },
    { failure: '', flags: [], env: { NODE_OPTIONS: '--max-old-space-size=128', RAYON_NUM_THREADS: '2' }, expectedFlag: null, rayon: '2', heap: 128 },
    { failure: '', flags: [], env: { NODE_OPTIONS: '"--max_old_space_size=128"' }, expectedFlag: null, rayon: '1', heap: 128 },
    { failure: '', flags: ['--max_old_space_size=128'], env: {}, expectedFlag: '--max_old_space_size=128', rayon: '1', heap: 128 },
    { failure: '', flags: ['--max-old-space-size=256', '--max_old_space_size=128'], env: { NODE_OPTIONS: '--max-old-space-size=384' }, expectedFlag: '--max_old_space_size=128', rayon: '1', heap: 128 },
    ...['', 'declarations', 'bundle'].map(failure => ({ failure, flags: ['--max-old-space-size=128'], env: {}, expectedFlag: '--max-old-space-size=128', rayon: '1', heap: 128 })),
  ];
  for (const { failure, flags, env, expectedFlag, rayon, heap } of cases) {
    rmSync(resolve(fixture, 'phases.jsonl'), { force: true });
    mkdirSync(resolve(fixture, 'dist'), { recursive: true });
    writeFileSync(resolve(fixture, 'dist/stale.js'), 'stale output');
    const result = spawnSync(process.execPath, [...flags, resolve(fixture, 'scripts/build.mjs')], { env: { ...process.env, NODE_OPTIONS: '', RAYON_NUM_THREADS: undefined, ...env, FAIL_PHASE: failure }, encoding: 'utf8' });
    assert.ok(existsSync(resolve(fixture, 'phases.jsonl')), `${JSON.stringify({flags, env})}: ${result.stderr}`);
    const phases = readFileSync(resolve(fixture, 'phases.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(phases.map(item => item.phase), failure === 'declarations' ? ['declarations'] : ['declarations', 'bundle']);
    assert.ok(phases.every(item => expectedFlag ? item.argv.includes(expectedFlag) : !item.argv.some(arg => arg.startsWith('--max-old-space-size'))));
    assert.ok(phases.every(item => item.rayon === rayon));
    assert.ok(phases.every(item => item.heapMiB >= heap && item.heapMiB < heap + 100), 'Caller heap precedence must remain effective');
    if (flags.length) assert.ok(phases.every(item => JSON.stringify(item.argv) === JSON.stringify(flags)), 'Preserve caller flag spelling and order');
    assert.equal(new Set(phases.map(item => item.pid)).size, phases.length, 'Phases need distinct process lifetimes');
    assert.equal(existsSync(phases[0].path), false, 'Staged declarations must be cleaned on success and failure');
    if (failure) {
      assert.notEqual(result.status, 0); assert.match(result.stderr, new RegExp(`build-${failure}.mjs failed`));
      assert.equal(existsSync(resolve(fixture, 'dist')), false, 'Failed builds must not expose stale or partial output');
    } else {
      assert.equal(result.status, 0, result.stderr);
      for (const path of ['index.js', 'index.d.ts', 'cad-editor.css']) assert.ok(existsSync(resolve(fixture, 'dist', path)));
      assert.equal(existsSync(resolve(fixture, 'dist/stale.js')), false);
    }
  }
  console.log(JSON.stringify({ok:true,cases:['bounded defaults','environment overrides','quoted underscore environment flag','underscore CLI flag','duplicate CLI and environment precedence','CLI override','declaration failure','bundle failure'],checks:['phase order','separate processes','Node flags inherited','declaration staging cleanup','nonzero failure propagation','no stale or partial output'],evidence:'Orchestration with explicit phase stubs; no real TypeScript, Vite or native evaluation'}));
} finally { rmSync(fixture, { recursive: true, force: true }); }
