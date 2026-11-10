import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const endpoint = '/api/chat/task-runs/history';
const historyResponse = response => new URL(response.url()).pathname === endpoint && response.request().method() === 'POST';

export async function taskRunHistoryFlow({ f, origin, row, launch, final, accepted, saved, savedBytes }) {
  const approvals = final.approvals;
  assert.deepEqual(approvals.map(pin => pin.taskId), ['p1', 'p2', 'p3']);
  const requestFor = pin => ({ runKey: launch.runKey, runId: launch.runId, ...pin });
  const state = async () => ({
    bytes: await readFile(join(launch.directory, 'run.json')), entries: (await readdir(launch.directory)).sort(),
  });
  const before = await state();
  await f.addParameter('workingOnly', 7, '14-working-edit');
  const working = await f.doc();
  const button = name => f.page.getByRole('button', { name, exact: true });
  assert.equal(await button('Undo').isEnabled(), true);
  assert.equal(await button('Redo').isDisabled(), true);
  const checkpoint = f.page.getByRole('region', { name: 'Worker checkpoint checks', exact: true });
  await checkpoint.getByText(/Task p3/).waitFor();

  f.phase = 'inspect each published task against its exact approval evidence';
  await row.getByText('Approval history', { exact: true }).click();
  const checks = row.getByRole('region', { name: 'Worker approval checks', exact: true });
  const pick = id => row.getByRole('button', { name: 'Inspect approval ' + id, exact: true });
  const evidence = [];
  for (const [pin, values] of approvals.map((pin, index) => [pin, [[20, 24], [3, 4], [3, 5]][index]])) {
    const [response] = await Promise.all([
      f.page.waitForResponse(historyResponse), pick(pin.taskId).click(),
    ]);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['cache-control'], 'no-store');
    assert.deepEqual(response.request().postDataJSON(), requestFor(pin));
    const bytes = await response.body();
    assert.equal(bytes.subarray(0, 8).toString(), 'BCADRUN1');
    await writeFile(join(f.output, pin.taskId + '-history.bcad-run'), bytes);
    await checks.getByText(new RegExp('^Task ' + pin.taskId + ' ·')).waitFor();
    assert.deepEqual(await checks.getByRole('cell').allTextContents(), ['Fail · ' + values[0] + ' mm', 'Pass · ' + values[1] + ' mm']);
    await checks.getByText('Evidence revisions', { exact: true }).click();
    const revisions = await checks.locator('dd').allTextContents();
    const after = JSON.parse(bytes.subarray(16 + bytes.readUInt32LE(8) + bytes.readUInt32LE(12)));
    const approval = after.proposals.find(item => item.id === 'P' + (evidence.length + 1));
    assert.deepEqual(revisions, [approval.decided.evidence_revisions.before, approval.decided.evidence_revisions.after]);
    await checks.getByText('Evidence revisions', { exact: true }).click();
    evidence.push({ taskId: pin.taskId, valuesMm: values, revisions });
    await f.same(working);
  }

  f.phase = 'ignore a delayed history response after another approval is selected';
  const route = '**' + endpoint;
  await f.page.evaluate(endpoint => {
    const fetch = window.fetch;
    window.fetch = async (input, init) => {
      const response = await fetch(input, init);
      if (input === endpoint && JSON.parse(init.body).taskId === 'p1' && response.body) {
        const getReader = response.body.getReader.bind(response.body);
        response.body.getReader = () => {
          const reader = getReader(), cancel = reader.cancel.bind(reader);
          reader.cancel = () => { window.__approvalHistoryCancelled = true; return cancel(); };
          return reader;
        };
      }
      return response;
    };
  }, endpoint);
  const held = Promise.withResolvers(), release = Promise.withResolvers();
  const delay = async request => {
    if (request.request().postDataJSON().taskId !== 'p1') return request.fallback();
    const response = await request.fetch({ timeout: 10000 }).catch(error => { held.reject(error); return null; });
    if (!response) return request.abort();
    held.resolve(response.status());
    await release.promise;
    await request.fulfill({ response });
  };
  await f.page.route(route, delay);
  try {
    await Promise.all([f.page.waitForRequest(request => new URL(request.url()).pathname === endpoint
      && request.postDataJSON().taskId === 'p1'), pick('p1').click()]);
    assert.equal(await held.promise, 200);
    await pick('p2').click();
    await checks.getByText(/^Task p2 ·/).waitFor();
    const received = f.page.waitForResponse(response => historyResponse(response) && response.request().postDataJSON().taskId === 'p1');
    release.resolve();
    assert.equal((await received).status(), 200);
    await f.page.waitForFunction(() => window.__approvalHistoryCancelled === true);
    await checks.getByText(/^Task p2 ·/).waitFor();
  } finally { release.resolve(); await f.page.unroute(route, delay); }

  f.phase = 'refuse mismatched or unowned history requests without publishing or editing';
  const headers = { origin, 'x-barocss-task-run': 'history', 'content-type': 'application/json' };
  for (const [patch, code] of [
    [{ runId: 'different-run' }, 409], [{ runKey: 'e'.repeat(64) }, 404], [{ path: launch.directory }, 400],
    [{ acceptedSHA256: approvals[2].acceptedSHA256 }, 409], [{ taskId: 'p3' }, 409],
  ]) {
    const denied = await f.page.request.post(origin + endpoint, { headers, data: { ...requestFor(approvals[0]), ...patch } });
    assert.equal(denied.status(), code);
  }
  const missingHeader = await f.page.request.post(origin + endpoint, { headers: { origin, 'content-type': 'application/json' }, data: requestFor(approvals[0]) });
  assert.equal(missingHeader.status(), 403);
  await f.same(working);
  assert.deepEqual(await state(), before);
  assert.deepEqual(await savedBytes(), saved);
  await checkpoint.getByText(/Task p3/).waitFor();
  await f.snapshot('15-approval-history-working-edit');
  await button('Undo').click();
  await f.same(accepted);
  await button('Redo').click();
  await f.same(working);
  f.report.observations.push({ approvalHistory: evidence, delayedSelectionIgnored: true, mismatchesRefused: 6,
    originalProjectUnchanged: true, runUnchanged: true, workingUndoRedoPreserved: true });
}
