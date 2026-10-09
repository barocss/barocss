import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Actual browser events and the native public session. No synthetic composition dispatch. */
export async function runDraftSelectionFlow({ page, cad, result, curveUnchanged, evidence, prefix, resolve }) {
  const snap = () => page.evaluate(() => window.__cadEditorFlow.snapshot());
  const frame = () => page.evaluate(() => window.__cadEditorFlow.display());
  const baseline = await snap();
  const baselineFrame = await frame();
  const field = page.getByTestId('cad-editor-zMM');
  await field.focus();
  await field.selectText();
  await page.evaluate(() => {
    window.__cadEditorImeEvents = [];
    for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'input', 'keydown']) {
      document.addEventListener(type, event => {
        if (event.target?.getAttribute?.('data-testid') === 'cad-editor-zMM') {
          window.__cadEditorImeEvents.push({ type, data: event.data ?? null, key: event.key ?? null, isComposing: event.isComposing ?? null, value: event.target.value });
        }
      }, true);
    }
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: '３０', selectionStart: 2, selectionEnd: 2 });
  await page.keyboard.press('Enter');
  assert.equal((await snap()).generation, baseline.generation, 'Enter during composition must not apply.');
  assert.equal((await snap()).candidate, null);
  await cdp.send('Input.insertText', { text: '30' });
  await page.waitForFunction(() => window.__cadEditorFlow.snapshot().pending.zMM === '30');
  const ime = await page.evaluate(() => window.__cadEditorImeEvents);
  assert.ok(ime.some(event => event.type === 'compositionstart'));
  assert.ok(ime.some(event => event.type === 'compositionend'));
  assert.ok(ime.some(event => event.type === 'keydown' && event.key === 'Enter' && event.isComposing === true));
  await cdp.detach();
  await page.keyboard.press('Escape');
  assert.equal((await snap()).pending.zMM, '30');
  assert.equal(await field.evaluate(element => element === document.activeElement), true);
  await page.getByTestId('cad-editor-canvas').focus();
  await page.keyboard.press('ControlOrMeta+z');
  assert.deepEqual((await snap()).accepted, baseline.accepted);
  assert.deepEqual((await snap()).history, baseline.history);
  assert.equal((await snap()).pending.zMM, '30');
  await field.focus();
  await page.getByTestId('cad-editor-u').selectOption('0');
  await page.getByTestId('cad-editor-transition').waitFor();
  const decision = await snap();
  assert.equal(decision.selection.uIndex, 1);
  assert.equal(decision.selectionTransition.target.uIndex, 0);
  assert.deepEqual(decision.accepted, baseline.accepted);
  assert.deepEqual(decision.history, baseline.history);
  assert.equal((await frame()).pixelHash, baselineFrame.pixelHash);
  await page.keyboard.press('Escape');
  await page.getByTestId('cad-editor-transition').waitFor({ state: 'hidden' });
  assert.equal((await snap()).pending.zMM, '30');
  assert.equal((await snap()).selection.uIndex, 1);
  assert.equal(await field.evaluate(element => element === document.activeElement), true);
  result.events.push({ stage: 'actual-browser-ime-cancel', events: ime, enterDuringCompositionGuarded: true, inputEscapeRetained: true, decisionEscapeFocusRestored: true, acceptedHistoryFrameRetained: true, scope: 'CDP native browser composition pipeline; OS input-method certification is not claimed' });

  await page.getByTestId('cad-editor-weight').fill('0');
  await page.getByTestId('cad-editor-u').selectOption('0');
  const beforeInvalid = await frame();
  await page.getByTestId('cad-editor-transition-apply').click();
  await page.waitForFunction(() => window.__cadEditorFlow.error()?.causeChain?.some(cause=>cause.message.includes('Weights must')));
  await page.waitForFunction(read => window.__cadEditorFlow.display().readIndex > read, beforeInvalid.readIndex);
  const invalid = await snap();
  const invalidFrame = await frame();
  assert.deepEqual(invalid.accepted, baseline.accepted); assert.deepEqual(invalid.history, baseline.history);
  assert.equal(invalid.pending.weight, '0'); assert.equal(invalid.pending.zMM, '30');
  assert.equal(invalid.selection.uIndex, 1); assert.ok(invalid.selectionTransition);
  assert.equal(invalidFrame.pixelHash, beforeInvalid.pixelHash);
  assert.equal(invalidFrame.width, beforeInvalid.width); assert.equal(invalidFrame.height, beforeInvalid.height);
  assert.deepEqual(invalidFrame.state.camera, beforeInvalid.state.camera);
  await page.getByTestId('cad-editor-transition-cancel').click();
  assert.equal((await snap()).pending.weight, '0');
  await page.getByTestId('cad-editor-u').selectOption('0');
  await page.getByTestId('cad-editor-transition-discard').click();
  assert.equal((await snap()).selection.uIndex, 0);
  assert.deepEqual((await snap()).pending, {}); assert.deepEqual((await snap()).accepted, baseline.accepted);
  await page.getByTestId('cad-editor-u').selectOption('1');
  result.events.push({ stage: 'selection-invalid-apply-discard', nativeCauseReached: true, acceptedHistoryDraftSelectionFrameRetained: true, discardExplicit: true });

  await field.fill('30');
  await page.getByTestId('cad-editor-u').selectOption('0');
  const beforeDisplayRefusal = await frame();
  await page.evaluate(() => window.__cadEditorFlow.setDisplayRefusal(true));
  await page.waitForFunction(() => window.__cadEditorFlow.error()?.message.includes('Display options were refused'));
  await page.getByTestId('cad-editor-transition-apply').click();
  await page.waitForFunction(() => window.__cadEditorFlow.error()?.message.includes('pending values remain'));
  await page.waitForFunction(read => window.__cadEditorFlow.display().readIndex > read, beforeDisplayRefusal.readIndex);
  const displayRefused = await snap();
  assert.deepEqual(displayRefused.accepted, baseline.accepted); assert.deepEqual(displayRefused.history, baseline.history);
  assert.equal(displayRefused.pending.zMM, '30'); assert.equal(displayRefused.selection.uIndex, 1);
  assert.ok(displayRefused.selectionTransition); assert.equal(displayRefused.candidate, null);
  const retainedDisplay = await frame();
  assert.equal(retainedDisplay.pixelHash, beforeDisplayRefusal.pixelHash);
  assert.deepEqual(retainedDisplay.state.camera, beforeDisplayRefusal.state.camera);
  assert.deepEqual(retainedDisplay.state.selectedGeometry, beforeDisplayRefusal.state.selectedGeometry);
  await page.evaluate(() => window.__cadEditorFlow.setDisplayRefusal(false));
  result.events.push({ stage: 'selection-actual-viewer-refusal', rejectedNativeSamplingCount: 1, acceptedHistoryDraftDecisionSelectionFrameRetained: true, freshReadIndex: retainedDisplay.readIndex });
  await page.getByTestId('cad-editor-transition-apply').click();
  await page.waitForFunction(generation => window.__cadEditorFlow.snapshot().generation === generation && !window.__cadEditorFlow.snapshot().candidate, baseline.generation + 1);
  const applied = await snap(); curveUnchanged(applied);
  assert.equal(applied.selection.uIndex, 0); assert.equal(applied.selection.vIndex, 1);
  assert.equal(applied.selectionTransition, null); assert.deepEqual(applied.pending, {});
  const ref = cad.createCadGeometryReference(applied.accepted, { bodyId: 'surface_body' }).reference;
  const point = cad.queryCadDocumentPoint(applied.accepted, ref, { kind: 'surface', u: 0.5, v: 0.5 }).pointMM;
  [30, 20, 68 / 5].forEach((value, index) => assert.ok(Math.abs(point[index] - value) < 1e-8));
  assert.notEqual((await frame()).pixelHash, baselineFrame.pixelHash);
  result.events.push({ stage: 'selection-apply-commit', independentNativePoint: point, oldPoleEditedThenNewPoleSelected: true, curveUnchanged: true, display: await frame() });

  await page.getByRole('button', { name: /Read-only curve/ }).click();
  await page.waitForFunction(() => window.__cadEditorFlow.snapshot().selectedBodyId === 'curve_body' && window.__cadEditorFlow.display().state.selectedGeometry?.kind === 'curve');
  assert.equal((await snap()).selection, null);
  await page.getByRole('button', { name: /Weighted surface Editable surface/ }).click();
  await field.fill('32');
  await page.getByRole('button', { name: /Read-only curve/ }).click();
  await page.getByTestId('cad-editor-transition-cancel').click();
  assert.equal((await snap()).selectedBodyId, 'surface_body'); assert.equal((await snap()).pending.zMM, '32');
  await page.getByRole('button', { name: /Read-only curve/ }).click();
  await page.getByTestId('cad-editor-transition-discard').click();
  await page.waitForFunction(() => window.__cadEditorFlow.display().state.selectedGeometry?.kind === 'curve');
  await page.getByRole('button', { name: /Weighted surface Editable surface/ }).click();
  const refused = await page.evaluate(oldRef => {
    const s = window.__cadEditorFlow.session;
    s.stageSurfacePoleField('zMM', '33');
    const before = s.getSnapshot();
    const errors = [];
    for (const target of [{ bodyId: 'surface_body', uIndex: 99, vIndex: 1 }, { bodyId: 'surface_body', uIndex: 1, vIndex: 1, reference: oldRef }]) {
      try { s.requestSelection(target); errors.push('accepted'); } catch (error) { errors.push({ code: error.code, cause: error.cause?.message ?? null }); }
    }
    const decision = s.requestSelection({ bodyId: 'surface_body', uIndex: 0, vIndex: 1 });
    s.resolveSelectionTransition(decision.token, 'cancel');
    try { s.resolveSelectionTransition(decision.token, 'discard'); errors.push('accepted'); } catch (error) { errors.push({ code: error.code }); }
    const after = s.getSnapshot();
    s.discardPending();
    return { before, after, errors };
  }, baseline.selection.reference);
  assert.deepEqual(refused.after.accepted, refused.before.accepted); assert.deepEqual(refused.after.history, refused.before.history);
  assert.deepEqual(refused.after.pending, refused.before.pending); assert.deepEqual(refused.after.selection, refused.before.selection);
  assert.equal(refused.errors[0].code, 'INPUT'); assert.equal(refused.errors[1].code, 'STALE'); assert.ok(refused.errors[1].cause); assert.equal(refused.errors[2].code, 'STALE');
  result.events.push({ stage: 'readonly-body-and-stale-selection', selectedReadonlyCurve: true, cancelDraftRetained: true, invalidTargetAndActualNativeStaleReference: refused.errors, staleTransitionRefused: true });

  // Real text editing stays in the browser; accepted document history is separate.
  await field.focus(); await field.selectText(); await page.keyboard.type('31');
  const beforeTextUndo = await snap();
  await page.keyboard.press('ControlOrMeta+z');
  assert.equal((await snap()).generation, beforeTextUndo.generation);
  assert.deepEqual((await snap()).history, beforeTextUndo.history);
  assert.notEqual(await field.inputValue(), '31', 'The browser must actually undo text input.');
  await page.getByTestId('cad-editor-discard').click();
  const canvas = page.getByTestId('cad-editor-canvas');
  await canvas.focus();
  const selectionBeforeEscape = (await snap()).selection;
  await page.keyboard.press('Escape');
  assert.deepEqual((await snap()).selection, selectionBeforeEscape);
  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForFunction(generation => window.__cadEditorFlow.snapshot().generation === generation, applied.generation + 1);
  curveUnchanged(await snap());
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await page.waitForFunction(generation => window.__cadEditorFlow.snapshot().generation === generation, applied.generation + 2);
  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForFunction(generation => window.__cadEditorFlow.snapshot().generation === generation, applied.generation + 3);
  await page.keyboard.press('Control+y');
  await page.waitForFunction(generation => window.__cadEditorFlow.snapshot().generation === generation, applied.generation + 4);
  const redone = await snap(); curveUnchanged(redone);
  assert.equal(cad.resolveCadGeometryReference(redone.accepted, cad.createCadGeometryReference(redone.accepted, { bodyId: 'surface_body' }).reference).geometry.controlPoints[1][1][2], 30);
  result.events.push({ stage: 'actual-keyboard-history', browserTextUndoExcludedFromDocumentHistory: true, canvasEscapeSelectionRetained: true, undoRedoAcceptedOnly: true });

  // Enter after composition end is a real Apply gesture.
  await field.fill('30'); await field.press('Enter');
  assert.equal((await snap()).generation, redone.generation, 'Native bitwise no-op must not create history.');
  assert.deepEqual((await snap()).pending, {});
  await field.fill('32'); await field.press('Enter');
  await page.waitForFunction(generation => window.__cadEditorFlow.snapshot().generation === generation, redone.generation + 1);
  const entered = await snap(); curveUnchanged(entered);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const download = await downloadPromise;
  const path = resolve(evidence, prefix + '-draft-' + download.suggestedFilename());
  await download.saveAs(path);
  const bytes = readFileSync(path, 'utf8');
  assert.equal(bytes, cad.serializeCadDocument(entered.accepted.document));
  const cold = cad.parseCadDocument(bytes);
  const midpoint = document => cad.queryCadDocumentPoint(document, cad.createCadGeometryReference(document, { bodyId: 'surface_body' }).reference, { kind: 'surface', u: 0.5, v: 0.5 }).pointMM;
  assert.ok(Math.abs(midpoint(cold)[2] - 72 / 5) < 1e-8);
  await page.screenshot({ path: resolve(evidence, prefix + '-draft-selection.png') });
  const reopenedContext = await page.context().browser().newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  try {
    const reopened = await reopenedContext.newPage();
    reopened.on('pageerror', error => result.pageErrors.push(error.message));
    await reopened.goto(page.url());
    await reopened.locator('[data-viewer-ready="true"]').waitFor();
    await reopened.getByLabel('Open native document file').setInputFiles(path);
    await reopened.waitForFunction(() => window.__cadEditorFlow.snapshot().generation === 1 && !window.__cadEditorFlow.snapshot().candidate);
    await reopened.getByRole('button', { name: /Weighted surface Editable surface/ }).click();
    await reopened.getByTestId('cad-editor-zMM').fill('34');
    await reopened.getByTestId('cad-editor-zMM').press('Enter');
    await reopened.waitForFunction(() => window.__cadEditorFlow.snapshot().generation === 2 && !window.__cadEditorFlow.snapshot().candidate);
    const actual = await reopened.evaluate(() => window.__cadEditorFlow.snapshot()); curveUnchanged(actual);
    const actualFrame = await reopened.evaluate(() => window.__cadEditorFlow.display());
    assert.ok(Math.abs(midpoint(actual.accepted)[2] - 76 / 5) < 1e-8);
    assert.ok(actualFrame.nonBackgroundPixels > 0);
    result.events.push({ stage: 'draft-keyboard-genuine-file-roundtrip', enteredPoint: midpoint(entered.accepted), downloadedNativePoint: midpoint(cold), freshEnterReeditPoint: midpoint(actual.accepted), path, curveUnchanged: true, display: actualFrame });
  } finally { await reopenedContext.close(); }
}
