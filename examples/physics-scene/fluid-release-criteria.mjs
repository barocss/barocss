import assert from 'node:assert/strict';

export const MAX_RETAINED_HEAP_BYTES = 1024 * 1024;

const raw = {
  initial: '9f3fec9d63e9be9f313857c9591bbe1deda5ffa471382184081e4c18cf8c618b',
  bare60: 'f14b5eaa5b34c074c8ecbe501be5b84af56eabbfdfbbcb823940aa999605e1bc',
  bare240: '6a951b6fe9baeee2d40a5cd2fd4752d7681f484ef07f167a8edc7dd03f8c068b',
  shelf60: '2cfda35a877aaf8bd21cfa83eaadc3179c0b70e896b44fd5f3698c47ad6c5086',
  shelf240: '3d261943d75f9b94363c4c6085900a2e6e8a096b36c13a7310f7811d115bdb8d',
};

export function checkSourceImports(result) {
  assert.equal(result.result, 'ok');
  assert.equal(result.sourceEntries, 5);
  assert.equal(result.compiledEntries, 5);
}

export function checkBareWorld(result) {
  assert.equal(result.result, 'ok');
  assert.equal(result.count, 256);
  assert.equal(result.steps, 240);
  assert.equal(result.finalPositionSha256, raw.bare240);
  assert.equal(result.copiedAndInvalidRetained, true);
  assert.ok(result.densityError60 <= 0.25 && result.densityError240 <= 0.05);
  assert.ok(Number.isFinite(result.retainedHeapDeltaBytes));
  assert.ok(result.retainedHeapDeltaBytes <= MAX_RETAINED_HEAP_BYTES,
    `Retained heap ${result.retainedHeapDeltaBytes} exceeds 1 MiB`);
}

export function checkVisualProfile(result) {
  assert.equal(result.result, 'ok');
  assert.equal(result.fixtures.length, 2);
  const [release, highDrop] = result.fixtures;
  assert.equal(release.high, false);
  assert.equal(highDrop.high, true);
  const expected = [
    { fixture: release, hashes: [
      [60, raw.bare60, 'dd2882d9419042bce8cf3dede4861de08d226b23a422790b35c17e8833ae39a5'],
      [240, raw.bare240, '772c8d5b613bff311ec1ab2a40d9965a52ab026fb413771a77dde120be0c9dac'],
      [720, 'c47d1aa95cae3200a6c7c534b9fe69f68a0ff00ad14116d3d56b67e9b0af4dd3',
        'adc36dc1df9ba1c1c64c4135b97011487daa12c196b567da324addb924d96509'],
    ] },
    { fixture: highDrop, hashes: [
      [60, '33aa6e732073ffecfd7a51f1a16a59b40766619291ab9e64e839dcd51be86341',
        'b053a4c578e876225ba621eaedd30def2f4461b5012728eca8e13cf5d59eb29e'],
      [240, 'a3f1f0b785bf871bfcbef1da600a937c8e9251e2617837dbd5807f5850a572cc',
        'd8edda0487697b5464ce5033a269a6e713cb4605d86aa53bf8c30804851a9d8c'],
      [720, 'f8f55e31da24018134bfe40f09ec9f6475b5dd0b119b556781f83774d96613fd',
        'd55b9bef8d14ca7fe0b280cb063c606ad3ea504403627fd5a9b4eefcf765cc58'],
    ] },
  ];
  for (const { fixture, hashes } of expected) {
    for (const [step, original, tuned] of hashes) {
      assert.equal(fixture.states[step].originalSHA, original);
      assert.equal(fixture.states[step].tunedSHA, tuned);
    }
  }
  for (const fixture of result.fixtures) {
    assert.ok(fixture.costRatio <= 1.5, 'Visual profile exceeded the frozen relative cost');
  }
}

export function checkCadShelf(result) {
  assert.equal(result.result, 'ok');
  assert.equal(result.obstacle, 'fixture:fluid_shelf.shelf');
  assert.deepEqual(result.receipts.map(receipt => receipt.step), [60, 240]);
  assert.equal(result.receipts[0].bareSHA, raw.bare60);
  assert.equal(result.receipts[0].shelfSHA, raw.shelf60);
  assert.equal(result.receipts[1].bareSHA, raw.bare240);
  assert.equal(result.receipts[1].shelfSHA, raw.shelf240);
  assert.ok(result.receipts[0].cumulativeShelfHits > 0);
  assert.ok(result.costRatio <= 1.5, 'CAD shelf exceeded the frozen relative cost');
}
