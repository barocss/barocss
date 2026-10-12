import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Software-only acceptance for #1284. No browser, network, decoder or GL is used.
// The actual host declarations below run against public tree/scene/document
// providers and a deliberately controlled renderer, frame and status surface.
const CAP = 24;
const EXPECTED_CHECKS = 19;
const hostURL = new URL('../../sprite-crop.mjs', import.meta.url);
const functionNames = ['retentionKey', 'observe', 'active', 'pixel', 'show',
  'invalid', 'outOfBounds', 'documentText'];
const checks = [];
const evaluations = [];
const evidence = { controls: [], changedAuthority: [] };
const sha256 = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
let fixture;
let failure;
let sourcePins;
let currentCheck = 'baseline-key';

function consumeEvaluation(kind) {
  assert.ok(evaluations.length < CAP, 'hard comparator/control evaluation cap exceeded');
  evaluations.push({ number: evaluations.length + 1, kind, check: currentCheck });
}

function providerURL(environmentName, relative) {
  const url = process.env[environmentName]
    ? new URL(process.env[environmentName]) : new URL(relative, import.meta.url);
  assert.equal(url.protocol, 'file:', `${environmentName} must be a file URL`);
  return url;
}

async function check(name, run) {
  assert.ok(checks.length < EXPECTED_CHECKS, 'unexpected assertion group');
  assert.ok(!checks.some(result => result.name === name), 'duplicate check name');
  currentCheck = name;
  try {
    const detail = await run();
    checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) });
  } catch (error) {
    checks.push({ name, passed: false });
    error.checkName = name;
    throw error; // Preserve the first failure; do not repeat a control to repair evidence.
  }
}

function extractFunctions(source) {
  assert.ok(Buffer.byteLength(source) <= 128 * 1024, 'host source exceeds bound');
  const parsed = ts.createSourceFile('sprite-crop.mjs', source,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(parsed.parseDiagnostics.length, 0, 'host source must parse');
  const declarations = functionNames.map(name => {
    const matches = parsed.statements.filter(statement =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name);
    assert.equal(matches.length, 1, `expected exactly one top-level ${name}`);
    const node = matches[0];
    const asynchronous = node.modifiers?.some(modifier =>
      modifier.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
    assert.equal(asynchronous, name === 'documentText', `${name} async contract`);
    assert.ok(node.body && !node.asteriskToken, `${name} must have an ordinary body`);
    const text = node.getText(parsed);
    return { name, text, asynchronous, sha256: sha256(text),
      line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1 };
  });
  return declarations;
}

function makeFixture({ createDisplayTree, Canvas2DError }) {
  const pose = (x, y) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
  const tree = createDisplayTree('CropConsumer');
  const team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(0, 0) });
  const back = tree.createRect({ id: 'Back', layer: 0, transform: pose(20, 20),
    width: 80, height: 80, fill: [1, 1, 0, 1] });
  const sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20),
    imageId: 'Atlas', width: 80, height: 80, opacity: 1, sampling: 'nearest',
    anchorX: 0, anchorY: 0, sourceRect: { x: 0, y: 0, width: 1, height: 1 } });
  tree.stage.addChild(team); team.addChild(back); team.addChild(sprite);
  const atlas = { width: 2, height: 2, pixels: new Uint8Array([
    255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255, 0, 255, 0, 255,
  ]) };
  const hostAssets = new Map([['Atlas', { width: 2, height: 2,
    pixels: new Uint8Array(atlas.pixels) }]]);
  const samples = [[50, 50], [30, 30], [70, 30], [30, 70], [70, 70]];
  const options = { logicalSize: { width: 160, height: 120 }, dpr: 2 };
  const calls = { draw: 2, read: 0 };
  const telemetry = { observationCalls: 0, observationReads: 0, controlReads: 0,
    rendererAttempts: 0, rendererRefusals: [] };
  let phase = 'control';
  let closed = false;
  const gl = {
    RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    getError: () => 0,
    readPixels(x, y, width, height, format, type, bytes) {
      assert.equal(closed, false, 'software fixture is disposed');
      assert.equal(width, 1); assert.equal(height, 1);
      assert.equal(format, gl.RGBA); assert.equal(type, gl.UNSIGNED_BYTE);
      assert.ok(samples.some(([sx, sy]) => x === sx * 2 && y === 240 - sy * 2 - 1),
        'read must address a host sample');
      calls.read++;
      telemetry[phase === 'observation' ? 'observationReads' : 'controlReads']++;
      bytes.set([255, 0, 0, 255]); // Literal red software frame, not rendered pixels.
    },
  };
  const contexts = [{ gl, lost: false, calls,
    resources: { texture: { created: 1, deleted: 0, live: () => closed ? 0 : 1 } } }];
  const canvas = { height: 240, getContext(kind) {
    assert.equal(kind, 'webgl2'); return gl;
  } };
  const renderer = {
    hitTest(point) {
      assert.equal(closed, false, 'software fixture is disposed');
      assert.ok(samples.some(([x, y]) => point.x === x && point.y === y));
      return { id: 'Sprite' }; // Controlled hit result, not actual renderer picking.
    },
    updateScene(scene) {
      const image = scene.nodes[0]?.children?.find(node => node.id === 'Sprite');
      assert.deepEqual(image?.sourceRect, { x: 2, y: 0, width: 1, height: 1 });
      telemetry.rendererAttempts++;
      telemetry.rendererRefusals.push({ code: 'INVALID_ASSET',
        sourceRect: clone(image.sourceRect), calls: { ...calls },
        observationReads: telemetry.observationReads, controlReads: telemetry.controlReads });
      throw new Canvas2DError('INVALID_ASSET', 'Controlled out-of-bounds renderer refusal');
    },
  };
  return { tree, sprite, atlas, hostAssets, samples, options, canvas, contexts,
    renderer, status: { textContent: '' }, output: { textContent: '' }, telemetry,
    enterObservation() { const previous = phase; phase = 'observation';
      telemetry.observationCalls++; return previous; },
    leaveObservation(previous) { phase = previous; },
    dispose() { closed = true; hostAssets.clear(); },
    isDisposed: () => closed,
  };
}

function evaluateHost(declarations, providers, controlled) {
  // Function construction keeps literals in the public providers' realm. No host
  // module initialization, DOM listeners, global patches or copied handlers run.
  const create = new Function('providers', 'fixture', 'consumeEvaluation', `
    'use strict';
    const { Canvas2DError, stringifySceneJSON, serializeCanvasDocument } = providers;
    const { tree, sprite, atlas, hostAssets, samples, options, canvas, contexts,
      renderer, status, output } = fixture;
    let accepted = tree.snapshot();
    let generation = 1, preparations = 0, paddingPreparations = 0, candidates = 0,
      opens = 0, edits = 0, saves = 0, pngs = 0;
    let disposed = false, binds = 1, unbinds = 0;
    let pointerLog = [];
    ${declarations.map(declaration => declaration.text).join('\n')}
    const actualRetentionKey = retentionKey;
    retentionKey = function measuredActualRetentionKey(observation) {
      consumeEvaluation('comparator');
      return actualRetentionKey(observation);
    };
    const actualObserve = observe;
    observe = function measuredActualObserve() {
      const previous = fixture.enterObservation();
      try { return actualObserve(); } finally { fixture.leaveObservation(previous); }
    };
    return { retentionKey, observe, invalid, outOfBounds, documentText,
      acceptedScene: () => accepted, acceptTree: () => { accepted = tree.snapshot(); } };
  `);
  return create(providers, controlled, consumeEvaluation);
}

try {
  const rootURL = providerURL('BAROCSS_CROP_ROOT', '../../../dist/index.js');
  const documentURL = providerURL('BAROCSS_CROP_DOCUMENT', '../../../dist/document.js');
  const [source, probe, rootBytes, documentBytes] = await Promise.all([
    readFile(hostURL, 'utf8'), readFile(new URL(import.meta.url)),
    readFile(rootURL), readFile(documentURL),
  ]);
  const declarations = extractFunctions(source);
  sourcePins = { host: sha256(source), probe: sha256(probe),
    rootEntry: sha256(rootBytes), documentEntry: sha256(documentBytes),
    extracted: declarations.map(({ text: _text, ...metadata }) => metadata) };
  // The adoption receipt must bind reused built providers to current unchanged
  // package source before this probe is executed. This probe never builds them.
  const root = await import(rootURL.href);
  const { serializeCanvasDocument } = await import(documentURL.href);
  fixture = makeFixture(root);
  const host = evaluateHost(declarations, { ...root, serializeCanvasDocument }, fixture);
  const canonical = () => serializeCanvasDocument(host.acceptedScene(),
    id => fixture.hostAssets.get(id) ?? null);
  const baseline = host.observe();
  const key = host.retentionKey(baseline);
  const initialDocument = await canonical();
  const mutate = async (name, change) => check(name, () => {
    const changed = clone(baseline); change(changed);
    assert.notEqual(host.retentionKey(changed), key);
  });

  await check('unchanged-observation-and-all-actual-keys', () => {
    assert.equal(host.retentionKey(clone(baseline)), key);
    assert.deepEqual(Object.keys(JSON.parse(key)).sort(),
      Object.keys(baseline).filter(name => name !== 'contexts').sort());
  });
  await check('draw-and-read-only-diagnostics-ignored', () => {
    const changed = clone(baseline);
    changed.contexts[0].calls.draw++; changed.contexts[0].calls.read++;
    assert.equal(host.retentionKey(changed), key);
  });
  await check('repeated-actual-observation-only-adds-five-diagnostic-reads', async () => {
    const first = baseline, second = host.observe(), third = host.observe();
    for (const observation of [second, third]) {
      assert.equal(host.retentionKey(observation), key);
      for (const field of Object.keys(baseline).filter(name => name !== 'contexts')) {
        assert.deepEqual(observation[field], baseline[field], field);
      }
      assert.deepEqual(observation.samples.map(sample => sample.rgba),
        fixture.samples.map(() => [255, 0, 0, 255]));
    }
    assert.equal(second.contexts[0].calls.read - first.contexts[0].calls.read, 5);
    assert.equal(third.contexts[0].calls.read - second.contexts[0].calls.read, 5);
    assert.equal(await canonical(), initialDocument);
    assert.equal(await host.documentText(), initialDocument);
    evidence.repeatedObservations = [first.contexts, second.contexts, third.contexts];
  });
  await mutate('scene-significant', observation => { observation.scene += ' '; });
  await mutate('tree-scene-significant', observation => { observation.treeScene += ' '; });
  await mutate('asset-bytes-and-registry-significant', observation => {
    observation.assetBytes[0]--; observation.assets.Atlas.pixels[0]--;
  });
  await mutate('original-bytes-significant', observation => { observation.originalBytes[0]--; });
  await mutate('sprite-data-significant', observation => { observation.spriteData.width++; });
  await mutate('crop-significant', observation => { observation.crop.x++; });
  await mutate('sample-pixels-significant', observation => { observation.samples[0].rgba[0]--; });
  await mutate('sample-hits-significant', observation => { observation.samples[0].hit = 'Back'; });
  await mutate('pointer-log-significant', observation => { observation.pointerLog.push('Sprite'); });
  await check('lifetime-state-significant', () => {
    const fields = ['generation', 'disposed', 'binds', 'unbinds'];
    const changed = clone(baseline);
    for (const field of fields) {
      changed[field] = typeof changed[field] === 'boolean' ? !changed[field] : changed[field] + 1;
    }
    assert.notEqual(host.retentionKey(changed), key);
    return { fields };
  });
  await check('operation-state-significant', () => {
    const fields = ['preparations', 'paddingPreparations', 'candidates', 'opens', 'edits', 'saves', 'pngs'];
    const changed = clone(baseline);
    for (const field of fields) changed[field]++;
    assert.notEqual(host.retentionKey(changed), key);
    return { fields };
  });

  async function control(name, expectedCode, expectedStatus, refusalProvider) {
    await check(`actual-synchronous-${name}-retains-authority`, async () => {
      const before = host.observe(), beforeDocument = await canonical();
      const beforeTelemetry = clone(fixture.telemetry);
      const beforeCalls = { ...fixture.contexts[0].calls };
      consumeEvaluation('control');
      const code = host[name]();
      const afterCalls = { ...fixture.contexts[0].calls };
      const afterTelemetry = clone(fixture.telemetry);
      assert.equal(typeof code, 'string', 'handler must return synchronously');
      assert.equal(code, expectedCode);
      assert.equal(fixture.status.textContent, expectedStatus);
      const shown = JSON.parse(fixture.output.textContent);
      const after = host.observe(), afterDocument = await canonical();
      assert.deepEqual(Object.keys(after), Object.keys(before));
      assert.deepEqual(Object.keys(shown), Object.keys(before));
      for (const field of Object.keys(before).filter(field => field !== 'contexts')) {
        assert.deepEqual(after[field], before[field], field);
        assert.deepEqual(shown[field], before[field], field);
      }
      assert.equal(afterDocument, beforeDocument);
      assert.equal(await host.documentText(), afterDocument);
      const delta = {
        observationCalls: afterTelemetry.observationCalls - beforeTelemetry.observationCalls,
        observationReads: afterTelemetry.observationReads - beforeTelemetry.observationReads,
        controlReads: afterTelemetry.controlReads - beforeTelemetry.controlReads,
        draw: afterCalls.draw - beforeCalls.draw, read: afterCalls.read - beforeCalls.read,
      };
      assert.deepEqual(delta, { observationCalls: 3, observationReads: 15,
        controlReads: 0, draw: 0, read: 15 });
      assert.equal(afterTelemetry.rendererAttempts - beforeTelemetry.rendererAttempts,
        name === 'outOfBounds' ? 1 : 0);
      evidence.controls.push({ name, code, status: fixture.status.textContent,
        synchronous: true, refusalProvider, documentUnchanged: true,
        documentSHA256: sha256(afterDocument), delta,
        beforeContexts: before.contexts, shownContexts: shown.contexts, afterContexts: after.contexts });
    });
  }
  await control('invalid', 'INVALID_SCENE', 'Rejected crop INVALID_SCENE; retained true',
    'actual public SpriteHandle.setSourceRect validation');
  await control('outOfBounds', 'INVALID_ASSET', 'Renderer refused crop INVALID_ASSET; retained true',
    'controlled software renderer refusal; not actual WebGL validation');

  await check('real-accepted-tree-change-alters-key-and-canonical-document', async () => {
    const before = host.observe(), beforeDocument = await canonical();
    fixture.sprite.setPosition(21, 20); host.acceptTree();
    const after = host.observe(), afterDocument = await canonical();
    assert.notEqual(host.retentionKey(after), key);
    assert.notEqual(after.scene, before.scene); assert.notEqual(after.treeScene, before.treeScene);
    assert.notEqual(afterDocument, beforeDocument);
    assert.equal(await host.documentText(), afterDocument);
    evidence.changedAuthority.push({ kind: 'actual accepted public tree position',
      beforeDocumentSHA256: sha256(beforeDocument), afterDocumentSHA256: sha256(afterDocument) });
  });
  await check('real-accepted-asset-change-alters-key-and-canonical-document', async () => {
    fixture.sprite.setPosition(20, 20); host.acceptTree();
    const before = host.observe(), beforeDocument = await canonical();
    assert.equal(beforeDocument, initialDocument, 'restore original tree authority before asset witness');
    fixture.hostAssets.get('Atlas').pixels[0] = 254;
    const after = host.observe(), afterDocument = await canonical();
    assert.notEqual(host.retentionKey(after), key);
    assert.notDeepEqual(after.assetBytes, before.assetBytes);
    assert.deepEqual(after.originalBytes, before.originalBytes);
    assert.equal(after.scene, before.scene); assert.equal(after.treeScene, before.treeScene);
    assert.notEqual(afterDocument, beforeDocument);
    assert.equal(await host.documentText(), afterDocument);
    evidence.changedAuthority.push({ kind: 'actual accepted asset registry bytes',
      beforeDocumentSHA256: sha256(beforeDocument), afterDocumentSHA256: sha256(afterDocument) });
  });
  await check('complete-contexts-readable-and-all-reads-attributed', async () => {
    const last = host.observe();
    assert.deepEqual(Object.keys(last.contexts[0]).sort(), ['calls', 'error', 'lost', 'resources']);
    assert.deepEqual(last.contexts[0].resources.texture, { created: 1, deleted: 0, live: 1 });
    assert.equal(fixture.telemetry.controlReads, 0);
    assert.equal(fixture.telemetry.observationReads, fixture.telemetry.observationCalls * 5);
    assert.equal(fixture.contexts[0].calls.read, fixture.telemetry.observationReads);
    assert.equal(fixture.contexts[0].calls.draw, 2);
    assert.equal(fixture.telemetry.rendererAttempts, 1);
    assert.equal(sha256(await readFile(hostURL)), sourcePins.host, 'host changed during probe');
    assert.equal(sha256(await readFile(new URL(import.meta.url))), sourcePins.probe, 'probe changed during run');
    evidence.finalContexts = last.contexts;
    evidence.telemetry = clone(fixture.telemetry);
  });
  assert.equal(checks.length, EXPECTED_CHECKS, 'exact bounded matrix must finish');
  assert.equal(evaluations.length, CAP, 'exact comparator/control evaluation count');
  assert.equal(evaluations.filter(item => item.kind === 'comparator').length, 22);
  assert.equal(evaluations.filter(item => item.kind === 'control').length, 2);
} catch (error) {
  failure = { check: error?.checkName ?? 'setup-or-completion',
    name: String(error?.name ?? 'Error').slice(0, 80),
    message: String(error?.message ?? error).slice(0, 1200) };
  process.exitCode = 1;
} finally {
  // Public DisplayTree is pure retained data and has no dispose API. The owned
  // software fixture has no native resources; clear its registry and close it.
  fixture?.dispose();
}

console.log(JSON.stringify({ issue: 1284,
  scope: 'current-source synchronous crop-status software fixture',
  runtime: process.version, cap: CAP, expectedChecks: EXPECTED_CHECKS,
  evaluationCount: evaluations.length, evaluations,
  checkCount: checks.length, passed: checks.filter(check => check.passed).length,
  complete: !failure && checks.length === EXPECTED_CHECKS,
  sourcePins, checks, evidence, fixtureDisposed: fixture?.isDisposed() ?? false,
  limits: ['No browser, physical click, actual GL, renderer pixel or renderer hit proof',
    'Canonical document checks are external to the unchanged synchronous handler contract',
    'No Extract, Save, Open, PNG, decoder or image-helper campaign',
    'Provider dependency/source binding is required from the adoption receipt'],
  ...(failure ? { failure } : {}),
}, null, 2));
