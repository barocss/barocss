// D766/B08-03: hold a committed native version log receipt across public owner changes.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createFlow, sha256 } from './flow-helper.mjs';
import { installD322NativeSaveScheduler } from './late-save-native-scheduler.mjs';

const bracket = join(import.meta.dirname, 'fixtures', 'bracket.bcad');
const pins = [
  'apps/cad-studio/test/fixtures/bracket.bcad', 'apps/cad-studio/test/flow-helper.mjs',
  'apps/cad-studio/test/late-save-native-scheduler.mjs', 'apps/cad-studio/src/App.tsx',
  'apps/cad-studio/src/storage/useProject.ts', 'apps/cad-studio/src/storage/VersionsPanel.tsx',
  'apps/cad-studio/src/storage/project.ts', 'apps/cad-studio/src/storage/handleStore.ts',
  'packages/barocss-cad-model/src/versions/log.ts', 'packages/barocss-cad-model/src/versions/merge.ts',
];
const f = await createFlow({
  name: 'project-branch-owner', envFrozen: 'D766_SOURCE_FROZEN', output: process.argv[2],
  qualification: 'B08-03 branch switch and divergent merge across Open B, Close and New part',
  initialFiles: pins, requiredFrozen: pins,
  limits: ['Browser project on desktop Studio. The native write commits before receipt release.', 'Live project ownership and native bytes only. Intervening edits to the same document are a separate group.'],
  snapshotExtra: () => ({
    project: document.querySelector('[aria-label="Project"]')?.textContent ?? null,
    activePath: document.querySelector('[aria-label="Project documents"] [data-active="true"]')?.textContent ?? null,
    fileName: document.querySelector('.doc-tab input')?.value ?? null,
    dirty: !!document.querySelector('[aria-label="Unsaved changes"]'),
    versions: [...document.querySelectorAll('[aria-label="Versions"] > li')].map(row => row.getAttribute('aria-label')),
    branch: document.querySelector('[aria-label="Branch"]')?.value ?? null,
    options: [...(document.querySelector('[aria-label="Branch"]')?.options ?? [])].map(option => option.value),
    recoveryOffered: !!document.querySelector('[aria-label="Autosaved work"]'),
  }),
});

await f.run(async () => {
  const origin = new URL(f.server.resolvedUrls.local[0]).origin;
  const newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async options => {
    const context = await newContext({ ...options, acceptDownloads: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    return context;
  };
  for (const action of ['switch', 'merge']) {
    for (const change of ['open', 'close', 'detach']) {
      const scenario = action + '-' + change;
      const projectName = 'D766 ' + scenario;
      const logPath = '.barocss/versions/bracket.bcad.json';
      const target = 'projects/' + projectName + '/' + logPath;
      f.phase = scenario + ': prepare fresh Studio';
      await f.newPage();
      await f.context.addInitScript(installD322NativeSaveScheduler, { projectName });
      const page = f.page;
      await page.reload();
      await f.ready();
      const button = name => page.getByRole('button', { name, exact: true });
      const panel = page.getByRole('complementary', { name: 'Versions panel', exact: true });
      const project = panel.getByLabel('Project', { exact: true });
      const branch = panel.getByLabel('Branch', { exact: true });
      const version = name => panel.getByLabel('Version ' + name, { exact: true });
      const makeVersion = async name => {
        await panel.getByLabel('Version name', { exact: true }).fill(name);
        await button('Make version').click();
        await version(name).waitFor();
      };
      const read = path => page.evaluate(async ([name, path]) => {
        const root = await window.__d322Save.inspectRoot();
        let dir = await (await root.getDirectoryHandle('projects')).getDirectoryHandle(name);
        const segments = path.split('/');
        for (const part of segments.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
        return (await (await dir.getFileHandle(segments.at(-1))).getFile()).text();
      }, [projectName, path]);
      const trace = () => page.evaluate(() => window.__d322Save.snapshot());
      const editHeight = async height => {
        const before = await f.doc();
        await f.openFeatureEditor(1);
        await f.editor().getByLabel('Distance', { exact: true }).fill(String(height));
        await button('Apply').click();
        await f.changed(before);
        await f.closeEditor();
      };
      const switchTo = async (name, doc) => {
        await branch.selectOption(name);
        await f.same(doc);
        await page.waitForFunction(name => document.querySelector('[aria-label="Branch"]')?.value === name, name);
      };
      try {
        f.phase = scenario + ': create divergent heads through the Versions panel';
        await f.openFile(bracket, 2);
        const base = await f.doc();
        await button('Project and versions').click();
        await panel.getByLabel('Browser project name', { exact: true }).fill(projectName);
        await button('Project in this browser').click();
        await project.waitFor();
        await makeVersion('Base');
        await panel.getByLabel('Branch name', { exact: true }).fill('side');
        await button('Make branch').click();
        await branch.locator('option[value="side"]').waitFor({ state: 'attached' });
        await switchTo('side', base);
        const { doc: side } = await f.addParameter('margin', 3, scenario + '-side-authored');
        await makeVersion('Side margin');
        await switchTo('main', base);
        await editHeight(8);
        await makeVersion('Main H8');
        const main = await f.doc();
        const aSaved = await read('bracket.bcad');
        assert.deepEqual(JSON.parse(aSaved), main);
        const initialLog = JSON.parse(await read(logPath));
        const heads = Object.fromEntries(initialLog.branches.map(item => [item.name, item.head]));
        assert.notEqual(heads.main, heads.side);

        let b;
        if (change === 'open') {
          await button('New part').click();
          await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
          await f.openFile(bracket, 2);
          await editHeight(12);
          await page.locator('.doc-tab input').fill('B');
          await makeVersion('B H12');
          b = { doc: await f.doc(), saved: await read('B.bcad'), log: await read('.barocss/versions/B.bcad.json') };
          assert.deepEqual(JSON.parse(b.saved), b.doc);
          assert.notDeepEqual(b.doc, main);
          await button('Open bracket.bcad').click();
          await version('Main H8').waitFor();
          await f.same(main);
        }

        f.phase = scenario + ': commit A log and hold the real native close receipt';
        await page.evaluate(path => window.__d322Save.arm(path), target);
        if (action === 'switch') await branch.selectOption('side');
        else {
          await panel.getByLabel('Merge from', { exact: true }).selectOption('side');
          await button('Merge').click();
        }
        await page.waitForFunction(() => window.__d322Save.snapshot().claimed?.closedNative === true);
        assert.deepEqual((await trace()).claimed, { path: target, closedNative: true, returnedToCaller: false });
        await f.same(main);
        assert.equal(await branch.inputValue(), 'main');
        const committedLog = await read(logPath);
        const log = JSON.parse(committedLog);
        const merged = log.versions.at(-1);
        const result = action === 'switch' ? side : { ...main, parameters: { margin: 3 } };
        const resultVersion = action === 'switch' ? log.versions.find(item => item.id === heads.side) : merged;
        if (action === 'switch') {
          assert.equal(log.current, 'side');
          assert.deepEqual(log.versions, initialLog.versions);
        } else {
          assert.equal(log.current, 'main');
          assert.deepEqual(merged.parents, [heads.main, heads.side]);
          assert.equal(log.branches.find(item => item.name === 'main').head, merged.id);
          assert.equal(log.versions.length, initialLog.versions.length + 1);
        }
        const snapshotPath = '.barocss/snapshots/' + resultVersion.snapshot + '.bcad';
        const committedSnapshot = await read(snapshotPath);
        assert.deepEqual(JSON.parse(committedSnapshot), result);
        assert.notDeepEqual(result, main);
        assert.equal(await read('bracket.bcad'), aSaved);

        f.phase = scenario + ': accept the newer owner before receipt release';
        if (change === 'open') {
          await button('Open B.bcad').click();
          await version('B H12').waitFor();
          await f.same(b.doc);
        } else if (change === 'close') {
          await button('Close project').click();
          await project.waitFor({ state: 'hidden' });
          await f.same(main);
        } else {
          await button('New part').click();
          await page.waitForFunction(() => window.__studioDoc.nodes.length === 0);
          await branch.waitFor({ state: 'hidden' });
        }
        await f.ready();
        const before = await f.snapshot(scenario + '-before-release');
        assert.equal((await trace()).claimed.returnedToCaller, false);
        assert.equal(before.activePath, change === 'open' ? 'B.bcad' : null);
        assert.equal(before.fileName, change === 'open' ? 'B' : change === 'close' ? 'bracket' : 'Untitled');
        assert.equal(!!before.project, change !== 'close');
        assert.deepEqual(before.versions, change === 'open' ? ['Version B H12'] : []);
        assert.equal(before.branch, change === 'open' ? 'main' : null);

        f.phase = scenario + ': release the native close and compare accepted state';
        await page.evaluate(() => window.__d322Save.release());
        await page.waitForFunction(path => {
          const { events } = window.__d322Save.snapshot();
          const released = events.find(event => event.kind === 'native-close-return-released');
          return released && events.some(event => event.path === path && event.kind === 'native-getFile-return' &&
            event.scope === 'production' && event.sequence > released.sequence);
        }, target);
        await page.evaluate(() => new Promise(resolve => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
          channel.port2.postMessage(null);
        }));
        await f.ready();
        const after = await f.snapshot(scenario + '-after-release');
        for (const key of ['project', 'activePath', 'fileName', 'dirty', 'versions', 'branch', 'options',
          'recoveryOffered', 'doc', 'bodies', 'selection', 'history', 'notices']) {
          assert.deepEqual(after[key], before[key], scenario + ' changed ' + key);
        }
        assert.equal(await read('bracket.bcad'), aSaved);
        assert.equal(await read(logPath), committedLog);
        assert.equal(await read(snapshotPath), committedSnapshot);
        if (b) {
          assert.equal(await read('B.bcad'), b.saved);
          assert.equal(await read('.barocss/versions/B.bcad.json'), b.log);
        }
        f.report.observations.push({
          scenario, owner: after.activePath ?? (after.project ? 'detached' : 'closed'),
          resultVersion: resultVersion.id, resultParents: resultVersion.parents,
          saved: sha256(aSaved), log: sha256(committedLog), snapshot: sha256(committedSnapshot),
          acceptedLog: b ? sha256(b.log) : null, native: await trace(),
        });
      } finally {
        await page.evaluate(() => window.__d322Save?.release());
      }
    }
  }
  assert.equal(f.report.observations.length, 6);
  assert.deepEqual(f.report.downloads, []);
});
