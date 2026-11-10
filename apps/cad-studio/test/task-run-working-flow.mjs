import assert from 'node:assert/strict';

export function instrumentWorkingChecks() {
  const state = window.__workingReply = { armed: false, id: undefined, held: false, delivered: 0, release: undefined };
  const post = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (message, ...rest) {
    if (state.armed && message?.type === 'part' && message.slot === 'read') {
      state.armed = false;
      state.id = message.id;
    }
    return post.call(this, message, ...rest);
  };
  const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
  Object.defineProperty(Worker.prototype, 'onmessage', { ...descriptor, set(fn) {
    descriptor.set.call(this, typeof fn !== 'function' ? fn : function (event) {
      if (event.data?.id === state.id && event.data.result && !state.held) {
        state.held = true;
        state.release = () => {
          state.id = undefined;
          state.held = false;
          fn.call(this, event);
          state.delivered++;
        };
      } else fn.call(this, event);
    });
  } });
}

export async function taskRunWorkingFlow({ f, row, accepted, source, open }) {
  const panel = row.getByRole('region', { name: 'Worker approval checks', exact: true });
  const check = row.getByRole('button', { name: 'Check working model', exact: true });
  const p3 = row.getByRole('button', { name: 'Inspect approval p3', exact: true });
  const workingColumn = panel.getByRole('columnheader', { name: 'Working model', exact: true });
  const rows = () => panel.getByRole('cell').allTextContents();
  const expectWorking = async label => {
    await workingColumn.waitFor();
    assert.deepEqual(await rows(), ['Fail · 3 mm', 'Pass · 5 mm', label]);
  };
  const retired = async () => {
    await row.getByText('Working model changed. Check again.', { exact: true }).waitFor();
    assert.equal(await workingColumn.count(), 0);
    assert.deepEqual(await rows(), ['Fail · 3 mm', 'Pass · 5 mm']);
  };
  const hold = async () => {
    await f.page.evaluate(() => { window.__workingReply.armed = true; });
    await check.click();
    await f.page.waitForFunction(() => window.__workingReply.held);
  };
  const release = async count => {
    await f.page.evaluate(() => window.__workingReply.release());
    await f.page.waitForFunction(count => window.__workingReply.delivered === count, count);
  };

  f.phase = 'compare the latest approved occurrence to the working model';
  await p3.click();
  await panel.getByText(/^Task p3 ·/).waitFor();
  await check.click();
  await expectWorking('Pass · 5 mm');
  await f.snapshot('16-working-pass');

  const regressed = structuredClone(accepted);
  regressed.instances[2].doc.nodes[1].height = 7;
  await open('working-regression.bcad', regressed);
  await retired();
  await check.click();
  await expectWorking('Fail · 7 mm');
  await panel.getByText('Evidence revisions', { exact: true }).click();
  const revisions = await panel.locator('dd').allTextContents();
  assert.equal(revisions.length, 3);
  assert.notEqual(revisions[1], revisions[2]);
  await panel.getByText('Evidence revisions', { exact: true }).click();
  await f.snapshot('17-working-regression');

  f.phase = 'keep a later edit when an old Worker check arrives';
  await hold();
  await f.addParameter('afterCheck', 11, '18-edit-during-working-check');
  const edited = await f.doc();
  await retired();
  await release(1);
  await retired();
  await f.same(edited);
  await check.click();
  await expectWorking('Fail · 7 mm');

  f.phase = 'flag a criterion change without assigning its pass to the approved criterion';
  const changed = structuredClone(regressed);
  changed.instances[2].doc.requirements[0].check.value = 7;
  await open('working-changed-criterion.bcad', changed);
  await retired();
  await check.click();
  await panel.getByText('Requirement changed', { exact: false }).waitFor();
  assert.match((await rows())[2], /Requirement changed.*7.*mm/s);
  assert.deepEqual((await rows()).slice(0, 2), ['Fail · 3 mm', 'Pass · 5 mm']);
  await f.snapshot('19-working-criterion-changed');

  f.phase = 'refuse the late check after a replacement with the same occurrence key';
  await hold();
  await open('unrelated-same-key.bcad', source);
  await retired();
  await release(2);
  await retired();
  await check.click();
  await row.getByText('The approved occurrence is unavailable in the working model.', { exact: true }).waitFor();
  assert.deepEqual(await rows(), ['Fail · 3 mm', 'Pass · 5 mm']);
  await f.same(source);
  await f.snapshot('20-working-unrelated');
  f.report.observations.push({ historicalMm: [3, 5], currentPassMm: 5, currentFailMm: 7, revisions,
    changedCriterionFlagged: true, lateWorkerRepliesRetired: 2, unrelatedSameOccurrenceKeyRefused: true });
}
