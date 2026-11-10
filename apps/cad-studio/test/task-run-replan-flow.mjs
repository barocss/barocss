import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { taskRunTerminal } from './task-run-status-flow.mjs';

const endpoint = '/api/chat/task-runs/';

export async function taskRunReplanFlow({ f, row, launch, open, requests, runRoot }) {
  const run = launch.directory, terminal = taskRunTerminal(f, run);
  const button = (parent, name) => parent.getByRole('button', { name, exact: true });
  const original = button(row, 'Prepare replacement for p2');
  const replacement = row.getByRole('region', { name: 'Prepared replacement', exact: true });
  const request = async (action, target) => {
    const [response] = await Promise.all([
      f.page.waitForResponse(response => new URL(response.url()).pathname === endpoint + action && response.request().method() === 'POST'),
      target.click(),
    ]);
    assert.equal(response.status(), 200);
    return response;
  };
  const readDurable = async () => ({
    bytes: await readFile(join(run, 'run.json')), entries: (await readdir(run)).sort(), native: (await readdir(join(run, 'native'))).sort(),
  });
  const saveAsWorking = async (name, doc) => {
    await open(name, doc);
    await button(f.page, 'Save').click();
    await f.page.getByRole('list', { name: 'Project documents', exact: true }).getByText(name, { exact: true }).waitFor();
  };
  const checkpoint = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
  const oldReceipt = join(f.output, 'retired-lid.bcad-candidate');
  await terminal.callCli('retired-lid', 'review', run, 'p2', oldReceipt);
  await terminal.approve('p1', 'd632-approve-original-base');
  const stale = await (await request('status', button(row, 'Refresh local run status'))).json();
  assert.deepEqual(stale.tasks.map(task => task.phase), ['completed', 'stale']);
  assert.deepEqual(stale.tasks[1].replan, { attemptId: launch.tasks[1].review.attemptId, occurrence: 'p2', feature: 'n1', field: 'height' });
  const first = await request('checkpoint', button(row, 'Open approved checkpoint'));
  await writeFile(join(f.output, 'replacement-original-approved.bcad-run'), await first.body());
  await checkpoint.getByText(/^Task p1 ·/).waitFor();
  const base = await f.doc(), before = await readDurable();
  const initialPosts = requests.length, runNames = await readdir(runRoot);
  const noReplacement = async () => {
    assert.equal(requests.length, initialPosts);
    assert.deepEqual(await readdir(runRoot), runNames);
    assert.deepEqual(await readDurable(), before);
  };

  f.phase = 'refuse the old terminal receipt and unsaved revised requirements';
  const old = spawnSync(process.execPath, [join(f.app, 'scripts/cad-cli.mjs'), 'task-run', 'decide', run,
    'd632-retired-approval', 'p2', 'approve', '--review', oldReceipt], { cwd: f.app, encoding: 'utf8', timeout: 30000 });
  assert.equal(old.status, 1, old.error?.message ?? old.stderr);
  assert.match(old.stderr, /no longer awaiting review|needs a candidate awaiting decision|awaiting review/i);
  const revised = structuredClone(base);
  revised.instances[1].doc.requirements[0].check.value = 5;
  await open('unsaved-replacement.bcad', revised);
  await original.click();
  await row.getByText('Save the revised working model in the project before replanning.', { exact: true }).waitFor();
  await noReplacement();

  f.phase = 'refuse a saved model that changes the accepted sibling';
  const other = structuredClone(revised);
  other.instances[0].doc.nodes[1].height = 8;
  await saveAsWorking('different-sibling.bcad', other);
  await original.click();
  await row.getByText('The working model does not retain the accepted run geometry and history.', { exact: true }).waitFor();
  await noReplacement();

  f.phase = 'prepare a new plan for the revised saved criterion';
  await saveAsWorking('revised-replacement.bcad', revised);
  await original.click();
  await replacement.getByText('p2 · 3 → 5 mm', { exact: true }).waitFor();
  await noReplacement();
  await f.same(revised);
  await f.snapshot('22-prepared-replacement');

  f.phase = 'start and review the replacement while preserving the prior run';
  const started = await (await request('start', button(replacement, 'Start replacement'))).json();
  assert.notEqual(started.runId, launch.runId);
  assert.deepEqual(started.tasks.map(task => [task.id, task.phase]), [['p2', 'awaiting-decision']]);
  assert.equal(requests.length, initialPosts + 1);
  const file = join(started.directory, 'run.json');
  const { record } = JSON.parse(await readFile(file));
  assert.deepEqual(record.state.plan.protectedOccurrences, ['p1']);
  assert.equal(record.state.tasks[0].candidate.geometry.sizeMm[2], 5);
  assert.deepEqual(record.commits, []);
  const saved = await readFile(join(started.directory, 'native', record.accepted.sha256 + '.bcad'));
  await writeFile(join(f.output, 'replacement-working-source.bcad'), saved);
  assert.deepEqual(JSON.parse(saved), revised);
  await button(replacement, 'Review candidate p2').click();
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  await review.getByText('Height · 3 mm → 5 mm', { exact: true }).waitFor();
  await f.same(revised);
  await f.snapshot('23-replacement-candidate-preview');
  assert.deepEqual(await readDurable(), before);

  f.phase = 'open the newly approved replacement checkpoint';
  await taskRunTerminal(f, started.directory).approve('p2', 'd632-approve-replacement');
  await request('status', button(replacement, 'Refresh local run status'));
  const final = await request('checkpoint', button(replacement, 'Open approved checkpoint'));
  await writeFile(join(f.output, 'replacement-final.bcad-run'), await final.body());
  await checkpoint.getByText(/^Task p2 ·/).waitFor();
  assert.deepEqual(await checkpoint.getByRole('cell').allTextContents(), ['Fail · 3 mm', 'Pass · 5 mm']);
  const model = await f.doc();
  assert.deepEqual(model.instances[0], base.instances[0]);
  assert.deepEqual(model.instances.map(part => part.doc.nodes[1].height), [6, 5]);
  assert.deepEqual(await readDurable(), before);
  await f.snapshot('24-approved-replacement');
  f.report.observations.push({ selectedOccurrence: 'p2', oldTargetMm: 4, revisedTargetMm: 5, earlierRunUnchanged: true,
    retiredApprovalRefused: true, unsavedAndChangedSiblingRefused: true, explicitStarts: 1, finalHeightsMm: [6, 5] });
}
