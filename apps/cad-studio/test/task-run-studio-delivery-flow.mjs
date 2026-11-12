import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from './flow-helper.mjs';

const base = '/api/chat/task-runs/';
const button = (parent, name) => parent.getByRole('button', { name, exact: true });
const parts = ['p1', 'p2'];

export async function taskRunStudioDeliveryFlow({ f, row, launch, source, saved, project, savedBytes, turn, firstStatus, firstRecord, readReview, retired, siblingDiameter = false, baseCylinder = false, baseFootprint = false, boxFootprint = false }) {
  const prefix = boxFootprint ? 'd780' : baseFootprint ? 'd779' : baseCylinder ? 'd778' : siblingDiameter ? 'd647' : 'd644';
  const [siblingBefore, siblingAfter] = siblingDiameter ? [4, 6] : [3, 4];
  const baseHeight = baseFootprint ? 5 : 6;
  const firstHeights = [baseHeight, siblingDiameter ? 6 : 3], finalHeights = [baseHeight, siblingDiameter ? 6 : 4];
  const originalDimensions = [baseFootprint ? [20, 10] : [5], [siblingBefore]];
  const finalDimensions = [baseFootprint ? [24, 14] : [6], [siblingAfter]];
  const directory = launch.directory, runFile = join(directory, 'run.json');
  const versions = () => f.page.getByRole('complementary', { name: 'Versions panel', exact: true });
  const files = () => versions().getByRole('list', { name: 'Project documents', exact: true });
  const review = f.page.getByRole('region', { name: 'Worker candidate review', exact: true });
  const capture = async (action, control) => {
    const [response] = await Promise.all([
      f.page.waitForResponse(res => new URL(res.url()).pathname === base + action && res.request().method() === 'POST'),
      control.click(),
    ]);
    assert.equal(response.status(), 200, await response.text());
    return response;
  };
  const bounds = heights => f.page.waitForFunction(expected => {
    const bounds = window.__studioInstanceBounds?.();
    return bounds?.length === 2 && expected.every((height, index) => {
      const part = bounds.find(item => item.id === 'p' + (index + 1));
      return part && part.max[2] - part.min[2] === height;
    });
  }, heights);
  const openCheckpoint = async (status, name, previous, heights) => {
    const pin = status.checkpoint, response = await capture('checkpoint', button(row, 'Open approved checkpoint'));
    assert.deepEqual(response.request().postDataJSON(), { runKey: status.runKey, runId: status.runId, ...pin });
    const checkpoint = await response.body();
    assert.equal(checkpoint.subarray(0, 8).toString(), 'BCADRUN1');
    const headerEnd = 16 + checkpoint.readUInt32LE(8), modelStart = headerEnd + checkpoint.readUInt32LE(12);
    assert.deepEqual(checkpoint.subarray(headerEnd, modelStart), previous);
    const native = checkpoint.subarray(modelStart);
    assert.equal(sha256(native), pin.acceptedSHA256);
    assert.deepEqual(native, await readFile(join(directory, 'native', pin.acceptedSHA256 + '.bcad')));
    await f.same(JSON.parse(native));
    await bounds(heights);
    await writeFile(join(f.output, name + '.bcad-run'), checkpoint);
    return native;
  };
  const checkDimensions = async (label, doc, dimensions, verdict) => {
    const { revision, results } = await turn(label, parts.map(part => ({ tool: 'requirements', args: { action: 'evidence', part } })),
      { requirementEvidence: true });
    for (const [index, { error, body }] of results.entries()) {
      const part = parts[index], [artifact] = body.files;
      assert.equal(error, false, JSON.stringify(body));
      assert.deepEqual([artifact.path, artifact.bytes, artifact.sha256],
        ['requirement-evidence.json', Buffer.byteLength(artifact.text), sha256(artifact.text)]);
      const report = JSON.parse(artifact.text), items = report.evidence.filter(row => row.result.kind === 'requirement');
      assert.deepEqual([report.part, report.revision, report.checker], [part, revision, 'checkSpec']);
      const requirements = doc.instances[index].doc.requirements;
      assert.equal(items.length, requirements.length);
      for (const [i, requirement] of requirements.entries()) {
        const item = items.find(item => item.requirement.id === requirement.id);
        assert.deepEqual(item.requirement, requirement);
        assert.deepEqual([item.requirement.hard, item.result.subject, item.result.part, item.result.run, item.result.status,
          item.result.verdict, item.result.number, item.freshness.state], [true, requirement.id, part, revision, 'ok', verdict, dimensions[index][i], 'current']);
      }
      await writeFile(join(f.output, label + '-' + part + '.json'), artifact.text);
    }
    await f.same(doc);
    return revision;
  };

  f.phase = 'check the unchanged source and open the first Studio approval';
  const originalEvidence = await checkDimensions(prefix + '-source', source, originalDimensions, 'fail');
  const first = await openCheckpoint(firstStatus, prefix + '-first', saved, firstHeights);
  const firstDoc = JSON.parse(first);
  if (baseCylinder || baseFootprint) {
    const instances = structuredClone(source.instances);
    if (baseFootprint) instances[0].doc.nodes[0].max = [27, 11];
    else instances[0].doc.nodes[1].height = 6;
    if (boxFootprint) Object.assign(instances[0].doc.nodes[1].made.values, { w: 24, d: 14 });
    assert.deepEqual(firstDoc.instances, instances);
  }
  await f.snapshot('09-first-studio-checkpoint');

  f.phase = 'rebuild p2 from the first approved native model';
  const rebuild = await capture('rebuild', button(row, 'Rebuild candidate p2'));
  const rebuilt = await rebuild.json(), oldAttempt = launch.tasks[1].review.attemptId;
  assert.deepEqual(rebuild.request().postDataJSON(), { runKey: firstStatus.runKey, runId: firstStatus.runId,
    revision: firstStatus.revision, baselineDigest: firstStatus.baselineDigest, taskId: 'p2', attemptId: oldAttempt });
  assert.deepEqual(rebuilt.tasks.map(task => task.phase), ['completed', 'awaiting-decision']);
  assert.deepEqual([rebuilt.baselineDigest, rebuilt.checkpoint, rebuilt.approvals],
    [firstStatus.baselineDigest, firstStatus.checkpoint, firstStatus.approvals]);
  const fresh = rebuilt.tasks[1].review;
  assert.notEqual(fresh.attemptId, oldAttempt);
  assert.notEqual(fresh.candidateDigest, launch.tasks[1].review.candidateDigest);
  const heldRecord = JSON.parse(await readFile(runFile)).record;
  assert.deepEqual(heldRecord.commits, firstRecord.commits);
  assert.deepEqual(heldRecord.state.tasks[1].attempt.base, firstRecord.accepted);
  await f.same(firstDoc);

  f.phase = 'approve the rebuilt p2 from its actual Studio preview';
  const pinned = await readReview('p2', siblingBefore, siblingAfter);
  assert.deepEqual([pinned.baselineDigest, pinned.attemptId, pinned.candidateDigest], [firstStatus.baselineDigest, fresh.attemptId, fresh.candidateDigest]);
  if (siblingDiameter) await review.getByText('Volume change · -94.248 mm³', { exact: true }).waitFor();
  await bounds(finalHeights);
  await f.same(firstDoc);
  await f.snapshot('10-second-studio-candidate');
  const approval = await capture('approve', button(review, 'Approve candidate'));
  assert.deepEqual(approval.request().postDataJSON(), pinned);
  const complete = await approval.json();
  assert.deepEqual(complete.tasks.map(task => task.phase), ['completed', 'completed']);
  assert.deepEqual(complete.approvals, [firstStatus.checkpoint, complete.checkpoint]);
  assert.equal(complete.checkpoint.taskId, 'p2');
  await row.getByText('p2 · completed', { exact: true }).waitFor();
  await review.waitFor({ state: 'detached' });
  await f.same(firstDoc);
  const completedBytes = await readFile(runFile), { record } = JSON.parse(completedBytes);
  assert.deepEqual(record.commits.map(commit => commit.taskId), parts);
  assert.deepEqual(record.commits[0], firstRecord.commits[0]);
  assert.deepEqual(record.commits[1].from, firstRecord.accepted);
  assert.deepEqual(record.commits[1].to, record.accepted);
  assert.ok(record.commits.every(commit => commit.operationId.startsWith('studio:approve:')));
  assert.equal(record.pending, undefined);
  const native = await openCheckpoint(complete, prefix + '-complete', first, finalHeights), doc = JSON.parse(native);
  const expected = structuredClone(firstDoc.instances);
  if (siblingDiameter) expected[1].doc.nodes[2].radius = 3;
  else expected[1].doc.nodes[1].height = siblingAfter;
  if (baseCylinder) expected[1].doc.nodes[1].made.values.h = siblingAfter;
  assert.deepEqual(doc.instances, expected);
  await f.snapshot('11-both-studio-approved');

  f.phase = 'save the final native project document without overwriting the source';
  const name = 'studio-approved-assembly.bcad';
  await f.page.getByRole('textbox', { name: 'File name', exact: true }).fill('studio-approved-assembly');
  await button(f.page, 'Save').click();
  await files().getByText(name, { exact: true }).waitFor();
  assert.deepEqual(await savedBytes(name), native);
  assert.deepEqual(await savedBytes(), saved);
  await writeFile(join(f.output, name), native);

  f.phase = 'reopen the native project document in a fresh page and check both requirements';
  await f.page.reload();
  await f.page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 });
  await f.ready();
  assert.notDeepEqual(await f.doc(), doc);
  if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
  await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
  await button(versions(), 'Project in this browser').click();
  await button(files(), 'Open ' + name).click();
  await f.same(doc);
  await bounds(finalHeights);
  const reopened = await f.snapshot('12-fresh-project-open');
  const reopenedBytes = Buffer.from(JSON.stringify(reopened.doc, null, 2));
  assert.deepEqual(reopenedBytes, native);
  await writeFile(join(f.output, prefix + '-reopened.bcad'), reopenedBytes);
  const finalEvidence = await checkDimensions(prefix + '-delivered', doc, finalDimensions, 'pass');
  let projectBytes = native;
  if (siblingDiameter) {
    const actual = await f.inspect(prefix + '-reopened-bore', reopened.doc, 'sibling-hole-native-evidence');
    assert.deepEqual([actual.face.kind, actual.face.outer, actual.face.radius], ['cylinder', false, 3]);
    assert.ok(Math.abs(actual.volumeMm3 - (1200 - 9 * Math.PI) * 6) < 1e-8);
  }
  if (baseFootprint) {
    const footprint = await f.inspect(prefix + '-approved-footprint', reopened.doc, 'footprint-native-evidence');
    await f.runOracle({ footprint, edited: false }, prefix + '-approved');

    f.phase = 'edit both extents of the approved native rectangle in Studio';
    await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: 'Base' }).click();
    await button(f.page.getByRole('complementary', { name: 'Instance', exact: true }), 'Edit part').click();
    const banner = f.page.getByRole('status', { name: 'Editing a part in place', exact: true });
    await banner.waitFor();
    await f.same(doc.instances[0].doc);
    if (boxFootprint) {
      await button(f.page, 'Box 24×14×5').waitFor();
      await f.openFeatureEditor(1, 'approved Box');
      const handle = f.page.locator('g.gizmo-handle[data-handle="d"]');
      await handle.waitFor();
      const [head, tail] = await Promise.all([handle.locator('polygon').boundingBox(), handle.locator('circle').boundingBox()]);
      assert.ok(head && tail);
      const x = head.x + head.width / 2, y = head.y + head.height / 2;
      const dx = x - tail.x - tail.width / 2, dy = y - tail.y - tail.height / 2;
      const length = Math.hypot(dx, dy);
      assert.ok(length > 0);
      await f.page.mouse.move(x, y);
      await f.page.mouse.down();
      await f.page.mouse.move(x + 20 * dx / length, y + 20 * dy / length, { steps: 6 });
      await f.page.mouse.up();
      const hud = f.page.getByRole('dialog', { name: 'Edit Box', exact: true });
      await hud.waitFor();
      for (const [label, value] of [['Width X', 24], ['Height Z', 5], ['At X', 3], ['At Y', -3], ['At Z', 0]])
        assert.equal(Number(await hud.getByLabel(label, { exact: true }).inputValue()), value);
      await hud.getByLabel('Width X', { exact: true }).fill('25');
      await hud.getByLabel('Depth Y', { exact: true }).fill('15');
      await f.page.waitForFunction(() => document.querySelector('.hud .status')?.textContent?.trim() === 'preview');
      await button(hud, 'Apply').click();
      await hud.waitFor({ state: 'hidden' });
    } else {
      await f.openFeatureEditor(1, 'approved rectangle extrusion');
      for (const [label, before, after] of [['Width', 24, 25], ['Depth', 14, 15]]) {
        const field = f.editor().getByRole('spinbutton', { name: label, exact: true });
        assert.equal(Number(await field.inputValue()), before);
        await field.fill(String(after));
      }
      await button(f.editor(), 'Apply').click();
    }
    const revised = structuredClone(doc.instances[0].doc);
    revised.nodes[0].max = [28, 12];
    if (boxFootprint) Object.assign(revised.nodes[1].made.values, { w: 25, d: 15 });
    await f.same(revised);
    await f.closeEditor();
    await button(banner, 'Finish').click();
    await banner.waitFor({ state: 'hidden' });
    await bounds([5, 4]);
    const edited = await f.snapshot('13-native-footprint-edit');
    assert.deepEqual(edited.doc.instances, [{ ...doc.instances[0], doc: revised }, doc.instances[1]]);
    const changed = await f.inspect(prefix + '-edited-footprint', edited.doc, 'footprint-native-evidence');
    await f.runOracle({ footprint: changed, edited: true }, prefix + '-edited');
    if (boxFootprint) {
      f.phase = 'save and reopen the second Box edit';
      const dirty = f.page.locator('.doc-tab [aria-label="Unsaved changes"]');
      await dirty.waitFor();
      await button(f.page, 'Save').click();
      await dirty.waitFor({ state: 'hidden' });
      projectBytes = await savedBytes(name);
      assert.deepEqual(JSON.parse(projectBytes), edited.doc);
      await f.page.reload();
      await f.page.waitForSelector('.viewport[data-renderer="webgpu"]', { timeout: 30000 });
      await f.ready();
      if (!(await versions().isVisible())) await button(f.page, 'Project and versions').click();
      await versions().getByRole('textbox', { name: 'Browser project name', exact: true }).fill(project);
      await button(versions(), 'Project in this browser').click();
      await button(files(), 'Open ' + name).click();
      await f.same(edited.doc);
      assert.deepEqual(await savedBytes(name), projectBytes);
      await f.snapshot('14-box-reedited-project-open');
    }
    f.report.observations.push({ footprintMm: [[20, 10], [24, 14], [25, 15]], approved: footprint, edited: changed,
      ...(boxFootprint ? { reopenedBoxLabel: 'Box 24×14×5', boxHudEditedAndSaved: true } : {}) });
  }
  if (baseCylinder) {
    const cylinder = await f.inspect(prefix + '-approved-cylinder', reopened.doc, 'cylinder-native-evidence');
    await f.runOracle({ cylinder, heightMm: 6 }, prefix + '-approved');

    f.phase = 'read the reopened Cylinder command label and edit the tagged extrusion in Studio';
    const banner = f.page.getByRole('status', { name: 'Editing a part in place', exact: true });
    const instance = f.page.getByRole('complementary', { name: 'Instance', exact: true });
    const enter = async (index, name) => {
      await f.page.locator('.ol.instance:not(.nested)').filter({ hasText: name }).click();
      await button(instance, 'Edit part').click();
      await banner.waitFor();
      await f.same(doc.instances[index].doc);
    };
    await enter(1, 'Lid');
    await button(f.page, 'Cylinder Ø6×4').waitFor();
    await button(banner, 'Finish').click();
    await banner.waitFor({ state: 'hidden' });
    await f.same(doc);
    await enter(0, 'Base');
    await f.openFeatureEditor(1, 'approved circular extrusion');
    const distance = f.editor().getByRole('spinbutton', { name: 'Distance', exact: true });
    assert.equal(Number(await distance.inputValue()), 6);
    await distance.fill('7');
    await button(f.editor(), 'Apply').click();
    const revised = structuredClone(doc.instances[0].doc);
    revised.nodes[1].height = 7;
    await f.same(revised);
    await f.closeEditor();
    await button(banner, 'Finish').click();
    await banner.waitFor({ state: 'hidden' });
    await bounds([7, 4]);
    const edited = await f.snapshot('13-native-cylinder-height-edit');
    assert.deepEqual(edited.doc.instances, [{ ...doc.instances[0], doc: revised }, doc.instances[1]]);
    const changed = await f.inspect(prefix + '-edited-cylinder', edited.doc, 'cylinder-native-evidence');
    await f.runOracle({ cylinder: changed, heightMm: 7 }, prefix + '-edited');
    f.report.observations.push({ cylinderHeightMm: [5, 6, 7], radiusMm: 4.23, approved: cylinder, edited: changed, siblingLabel: 'Cylinder Ø6×4' });
  }
  assert.notEqual(finalEvidence, originalEvidence);
  assert.deepEqual(await savedBytes(), saved);
  assert.deepEqual(await savedBytes(name), projectBytes);
  assert.deepEqual(await readFile(runFile), completedBytes);
  assert.deepEqual(await readFile(join(directory, 'native', record.accepted.sha256 + '.bcad')), native);
  await writeFile(join(f.output, prefix + '-run.json'), completedBytes);
  await writeFile(join(f.output, prefix + '-delivery.json'), JSON.stringify({ firstStatus, rebuilt, complete, pinned, retired, originalEvidence, finalEvidence }));
  const measurements = siblingDiameter ? { heightMm: [5, 6], diameterMm: [4, 6] }
    : { originalHeightsMm: originalDimensions, finalHeightsMm: finalDimensions };
  f.report.observations.push({ studioApprovals: parts, studioRebuilds: 1, terminalDecisions: 0, ...measurements,
    finalVerdicts: ['pass', 'pass'], oldAttempt, rebuiltAttempt: fresh.attemptId,
    nativeSHA256: sha256(native), sourcePreserved: true, freshProjectOpen: true, approvalRecordSHA256: sha256(completedBytes) });
}
