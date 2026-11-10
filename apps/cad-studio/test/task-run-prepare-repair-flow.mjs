import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';
import { taskRunTerminal } from './task-run-status-flow.mjs';

export async function taskRunPrepareRepairFlow({ f, row, accepted, open, requests, runRoot }) {
  const history = row.getByRole('region', { name: 'Worker approval checks', exact: true });
  const button = (parent, name) => parent.getByRole('button', { name, exact: true });
  const check = button(row, 'Check working model'), prepare = button(row, 'Prepare repair');
  const card = row.getByRole('region', { name: 'Prepared repair', exact: true });
  const start = button(card, 'Start repair');
  const initialPosts = requests.length, existingRuns = await readdir(runRoot);
  const noNewRun = async () => {
    assert.equal(requests.length, initialPosts);
    assert.deepEqual(await readdir(runRoot), existingRuns);
  };
  const post = async (action, clicked) => {
    const [response] = await Promise.all([
      f.page.waitForResponse(response => new URL(response.url()).pathname === '/api/chat/task-runs/' + action
        && response.request().method() === 'POST'), clicked.click(),
    ]);
    assert.equal(response.status(), 200);
    return response;
  };

  f.phase = 'refuse a changed criterion and an unsaved working repair';
  const changed = structuredClone(accepted);
  changed.instances[2].doc.nodes[1].height = 7;
  changed.instances[2].doc.requirements[0].check.value = 8;
  await open('changed-repair-criterion.bcad', changed);
  await check.click();
  await history.getByText('Requirement changed', { exact: false }).waitFor();
  assert.equal(await prepare.count(), 0);
  const regressed = structuredClone(accepted);
  regressed.instances[2].doc.nodes[1].height = 7;
  await open('saved-working-repair.bcad', regressed);
  await check.click();
  await history.getByRole('cell', { name: 'Fail · 7 mm', exact: true }).waitFor();
  await prepare.click();
  await row.getByText('Save the working model in the project before preparing a repair.', { exact: true }).waitFor();
  await noNewRun();
  assert.equal(await card.count(), 0);

  f.phase = 'prepare a saved repair and retire it after a working edit';
  await button(f.page, 'Save').click();
  await f.page.getByRole('list', { name: 'Project documents', exact: true }).getByText('saved-working-repair.bcad', { exact: true }).waitFor();
  await prepare.click();
  await card.getByText('p3 · 7 → 5 mm', { exact: true }).waitFor();
  await noNewRun();
  assert.equal(await start.isEnabled(), true);
  await f.snapshot('21-prepared-repair');
  await f.addParameter('staleRepair', 9, '22-edit-after-preparation');
  assert.equal(await start.isDisabled(), true);
  await noNewRun();
  await button(f.page, 'Undo').click();
  await f.same(regressed);
  assert.equal(await start.isDisabled(), true);
  await check.click();
  await prepare.click();
  await f.page.waitForFunction(() => {
    const card = document.querySelector('section[aria-label="Prepared repair"]');
    return Array.from(card?.querySelectorAll('button') ?? []).some(button => button.textContent === 'Start repair' && !button.disabled);
  });
  assert.equal(await card.count(), 1);
  await noNewRun();

  f.phase = 'start only the prepared occurrence and open its terminal-approved repair';
  const response = await post('start', start);
  const launch = await response.json();
  assert.equal(requests.length, initialPosts + 1);
  assert.equal((await readdir(runRoot)).length, existingRuns.length + 1);
  assert.deepEqual(launch.tasks.map(task => [task.id, task.phase]), [['p3', 'awaiting-decision']]);
  await card.getByText('p3 · awaiting decision', { exact: false }).waitFor();
  const run = join(launch.directory, 'run.json'), { record: staged } = JSON.parse(await readFile(run));
  assert.deepEqual(staged.state.plan.protectedOccurrences, ['p1', 'p2']);
  const saved = await readFile(join(launch.directory, 'native', staged.accepted.sha256 + '.bcad'));
  assert.equal(sha256(saved), staged.accepted.sha256);
  assert.deepEqual(JSON.parse(saved), regressed);
  await writeFile(join(f.output, 'prepared-saved-source.bcad'), saved);
  const { approve } = taskRunTerminal(f, launch.directory);
  await approve('p3', 'd628-approve-prepared-repair');
  await post('status', button(card, 'Refresh local run status'));
  const checkpoint = await post('checkpoint', button(card, 'Open approved checkpoint'));
  await writeFile(join(f.output, 'prepared-repair-approved.bcad-run'), await checkpoint.body());
  await f.page.waitForFunction(() => window.__studioDoc.instances?.find(part => part.id === 'p3')?.doc.nodes[1].height === 5);
  await f.ready();
  const repaired = await f.doc();
  assert.deepEqual(repaired.instances, accepted.instances);
  assert.equal(repaired.history.at(-1).kind, 'accept');
  await card.getByText('Approval history', { exact: true }).click();
  await button(card, 'Inspect approval p3').click();
  await button(card, 'Check working model').click();
  const checks = card.getByRole('region', { name: 'Worker approval checks', exact: true });
  await checks.getByRole('columnheader', { name: 'Working model', exact: true }).waitFor();
  assert.deepEqual(await checks.getByRole('cell').allTextContents(), ['Fail · 7 mm', 'Pass · 5 mm', 'Pass · 5 mm']);
  await f.snapshot('23-prepared-repair-opened');
  f.report.observations.push({ occurrence: 'p3', protected: staged.state.plan.protectedOccurrences, unsavedRefused: true,
    changedCriterionRefused: true, stalePreparedStartDisabled: true, explicitStarts: 1, savedSHA256: staged.accepted.sha256, repairedMm: 5 });
}
