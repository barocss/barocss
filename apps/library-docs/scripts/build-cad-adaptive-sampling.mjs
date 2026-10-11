import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readlink, symlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultApp = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function bundleCadAdaptiveSampling(app = defaultApp, platform = 'browser', consumerText, consumerName = 'cad-adaptive-sampling') {
  if (!/^[a-z][a-z0-9-]{0,47}$/.test(consumerName)) throw Error('Invalid CAD consumer name');
  const root = resolve(app, '../..');
  const profile = JSON.parse(await readFile(resolve(app, 'scripts/profiles/cad-adaptive-sampling-v0.json'), 'utf8'));
  const snapshot = resolve(app, 'docs/.vitepress/cache/cad-adaptive-sampling', profile.sourcePin);
  const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  if (git(['rev-parse', '--show-object-format']).toString().trim() !== 'sha1') throw Error('Unexpected Git format');
  const hash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const actual = Object.fromEntries(git(['ls-tree', '-r', '-z', profile.sourcePin, '--', ...profile.sourcePaths])
    .toString().split('\0').filter(Boolean).map(record => {
      const [info, path] = record.split('\t'), [mode, kind, oid] = info.split(' ');
      if (kind !== 'blob' || !['100644', '100755'].includes(mode)) throw Error('Unsupported source blob');
      return [path, oid];
    }));
  if (JSON.stringify(actual) !== JSON.stringify(profile.files)) throw Error('CAD adaptive sampling source profile mismatch');
  for (const [path, oid] of Object.entries(profile.files)) {
    const destination = resolve(snapshot, path);
    let bytes;
    try { bytes = await readFile(destination); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      bytes = git(['show', `${profile.sourcePin}:${path}`]);
      if (hash(bytes) !== oid) throw Error(`Source mismatch: ${path}`);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
    }
    if (hash(bytes) !== oid) throw Error(`Cached source mismatch: ${path}`);
  }
  const namespace = resolve(snapshot, 'node_modules/@barocss');
  await mkdir(namespace, { recursive: true });
  for (const name of profile.packages) {
    const link = resolve(namespace, name), target = resolve(snapshot, `packages/barocss-${name}`);
    try { await symlink(relative(namespace, target), link, 'dir'); }
    catch (error) {
      if (error.code !== 'EEXIST' || resolve(namespace, await readlink(link)) !== target) throw error;
    }
  }
  const presets = consumerText === undefined ? { 'cad-adaptive-sampling': JSON.parse(await readFile(resolve(app, 'scripts/snippets/cad-adaptive-sampling.json'), 'utf8')) } : {};
  const host = consumerText === undefined ? await readFile(resolve(app, 'scripts/snippets/cad-adaptive-sampling-host.mjs'), 'utf8') : '';
  const consumers = resolve(snapshot, 'consumers');
  await mkdir(consumers, { recursive: true });
  async function checkedClosure(output, allowed, requireOwn) {
    const ownInputs=Object.keys(output.metafile.inputs).filter(path=>path.startsWith('packages/'));
    for(const path of ownInputs) {
      if(!profile.files[path]||path.includes('/dist/')||hash(await readFile(resolve(snapshot,path)))!==profile.files[path]) {
        throw Error(`Unpinned CAD adaptive sampling input: ${path}`);
      }
    }
    const unexpected=Object.keys(output.metafile.inputs).filter(path=>!path.startsWith('packages/')&&!allowed.includes(path));
    if((requireOwn&&!ownInputs.length)||unexpected.length)throw Error(`Unexpected CAD adaptive sampling closure: ${unexpected.join(', ')}`);
    return ownInputs;
  }
  let workerResult,workerInputs=[],workerEntryHash;
  let text=consumerText ?? `${host}\nexport const presets = ${JSON.stringify(presets)};\n`;
  const workerBrowser=platform==='browser'&&consumerText===undefined;
  if(workerBrowser) {
    const workerSource=await readFile(resolve(app,'scripts/snippets/cad-adaptive-sampling-worker.mjs'));
    const workerEntry=resolve(consumers,'cad-adaptive-sampling-worker.mjs');
    await writeFile(workerEntry,workerSource);
    workerResult=await build({absWorkingDir:snapshot,entryPoints:[workerEntry],bundle:true,
      platform:'browser',format:'esm',target:'es2022',write:false,metafile:true});
    workerInputs=await checkedClosure(workerResult,[relative(snapshot,workerEntry)],true);
    if(!workerSource.equals(await readFile(workerEntry)))throw Error('Adaptive Worker source copy mismatch');
    workerEntryHash=createHash('sha256').update(workerSource).digest('hex');
    // A complete, pinned ESM Worker is embedded; no extra public asset URL.
    text=`const workerCode = ${JSON.stringify(workerResult.outputFiles[0].text)};\n`+text;
    await writeFile(resolve(consumers,'worker-metafile.json'),JSON.stringify(workerResult.metafile,null,2)+'\n');
  }
  const entry = resolve(consumers, platform === 'browser' ? 'cad-adaptive-sampling-entry.mjs' : `${consumerName}-check.mjs`);
  await writeFile(entry, text);
  const result = await build({ absWorkingDir: snapshot, entryPoints: [entry], bundle: true,
    platform, format: 'esm', target: platform === 'node' ? 'node22' : 'es2022', write: false, metafile: true });
  const ownInputs=await checkedClosure(result,[relative(snapshot,entry)],!workerBrowser);
  if(workerBrowser&&ownInputs.length)throw Error('Public CAD execution escaped the Worker closure');
  const provenance = { sourcePin: profile.sourcePin, verifiedBlobs: Object.keys(profile.files).length,
    ownSourceInputs: workerBrowser?workerInputs.length:ownInputs.length, ownDistInputs: 0,
    host: workerBrowser?'Public CAD sampling in an app Worker; main-thread Canvas2D drawing':platform === 'browser' ? 'Public CAD adaptive points and app Canvas2D drawing' : 'Public CAD adaptive sampling consumer; no GL',
    oldVisualPinUnchanged: '5f5ad866205a21510ac69552e704cc162fa253b5' };
  if(workerBrowser) {
    provenance.sourceInputScope='Worker metafile; main app contains no public CAD imports';
    provenance.worker={ownSourceInputs:workerInputs.length,ownDistInputs:0,entrySHA256:workerEntryHash,
      bundleSHA256:createHash('sha256').update(workerResult.outputFiles[0].contents).digest('hex'),
      bundleBytes:workerResult.outputFiles[0].contents.length,embedded:true};
    provenance.main={ownSourceInputs:ownInputs.length,ownDistInputs:0,
      entrySHA256:createHash('sha256').update(text).digest('hex')};
  }
  await writeFile(resolve(consumers, platform === 'browser' ? 'browser-metafile.json' : `${consumerName}-node-metafile.json`), JSON.stringify(result.metafile, null, 2) + '\n');
  return { result, provenance };
}
export async function buildCadAdaptiveSampling(app = defaultApp) {
  const { result, provenance } = await bundleCadAdaptiveSampling(app);
  const output = resolve(app, 'docs/.vitepress/generated');
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'cad-adaptive-sampling.js'), result.outputFiles[0].contents);
  console.log(JSON.stringify({ cadAdaptiveSampling: provenance, bundleBytes: result.outputFiles[0].contents.length }));
  return provenance;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildCadAdaptiveSampling();
