async page => {
  const evidence = 'packages/barocss-canvas2d/consumer/evidence/image-rotate-preflight';
  await page.waitForFunction(() => !!window.captureFixture);
  const setup = await page.evaluate(async () => {
    const f = window.captureFixture;
    const api = await import('../dist/index.js');
    const tuples = [
      [255, 0, 0, 255], [0, 255, 0, 128], [0, 0, 255, 255],
      [255, 255, 0, 0], [0, 255, 255, 255], [255, 0, 255, 1]
    ];
    const pixels = new Uint8Array(tuples.flat());
    pixels.extra = 42;
    Object.defineProperty(pixels, 'hidden', { value: 'ignored' });
    pixels[Symbol('extra')] = true;
    let getterReads = 0;
    Object.defineProperty(pixels, 'lazy', { get() { getterReads++; throw Error('extra getter read'); } });
    const source = { width: 3, height: 2, pixels };
    const order = [[0, 1, 2, 3, 4, 5], [3, 0, 4, 1, 5, 2],
                   [5, 4, 3, 2, 1, 0], [2, 5, 1, 4, 0, 3]];
    const originalOwnKeys = Reflect.ownKeys;
    let indexedScans = 0;
    let rotated;
    const direct = [];
    try {
      Reflect.ownKeys = target => {
        if (target === pixels) indexedScans++;
        return originalOwnKeys(target);
      };
      for (let turn = 0; turn < 4; turn++) {
        const result = api.rotateImageAsset(source, turn);
        const expected = order[turn].flatMap(index => tuples[index]);
        if (result.width !== (turn % 2 ? 2 : 3) || result.height !== (turn % 2 ? 3 : 2) ||
            result.pixels.length !== 24 || result.pixels.some((byte, index) => byte !== expected[index])) {
          throw Error('direct literal rotation mismatch at turn ' + turn);
        }
        direct.push({ turn, width: result.width, height: result.height, bytes: result.pixels.length });
        if (turn === 1) rotated = result;
      }
    } finally {
      Reflect.ownKeys = originalOwnKeys;
    }
    if (getterReads !== 0 || indexedScans !== 0) throw Error('unexpected extra getter or indexed keys');
    const tree = f.tree();
    f.target.setImageAsset('Correction', rotated);
    tree.stage.addChild(tree.createSprite({
      id: 'CorrectionSprite', layer: 0,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      imageId: 'Correction', sourceRect: { x: 0, y: 0, width: 2, height: 3 },
      width: 60, height: 48, opacity: 1, anchorX: 0, anchorY: 0, sampling: 'nearest'
    }));
    f.target.updateScene(tree.snapshot());
    f.target.render();
    const expectedDisplay = (x, y) => {
      if (x < 0 || x >= 60 || y < 0 || y >= 48) return [0, 0, 0, 0];
      const column = x < 30 ? 0 : 1;
      const row = Math.floor(y / 16);
      return [
        [[0, 0, 0, 0], [255, 0, 0, 255]],
        [[0, 255, 255, 255], [0, 128, 0, 128]],
        [[1, 0, 1, 1], [0, 0, 255, 255]]
      ][row][column];
    };
    const gl = f.canvas.getContext('webgl2');
    const actual = new Uint8Array(128 * 64 * 4);
    gl.readPixels(0, 0, 128, 64, gl.RGBA, gl.UNSIGNED_BYTE, actual);
    let maxDifference = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
      const expected = expectedDisplay(x, y);
      const offset = ((63 - y) * 128 + x) * 4;
      for (let channel = 0; channel < 4; channel++) {
        const difference = Math.abs(actual[offset + channel] - expected[channel]);
        maxDifference = Math.max(maxDifference, difference);
        if (difference > 2) throw Error(`GPU pixel ${x},${y},${channel}: ${actual[offset + channel]} versus ${expected[channel]}`);
      }
    }
    const points = [[15, 8], [45, 8], [15, 24], [45, 24], [15, 40], [45, 40], [90, 8]];
    const samples = points.map(([x, y]) => {
      const value = f.targetSample(x, y);
      const expected = expectedDisplay(x, y);
      const hit = expected[3] ? 'CorrectionSprite' : null;
      if (value.hit !== hit || value.rgba.some((byte, channel) => Math.abs(byte - expected[channel]) > 2)) {
        throw Error(`sample ${x},${y}: ${JSON.stringify(value)} versus ${JSON.stringify({ rgba: expected, hit })}`);
      }
      return { x, y, rgba: value.rgba, hit: value.hit };
    });
    window.__c2d1283 = { api, source, rotated, expectedDisplay, points, samples, direct,
      getterReads, indexedScans, gpu: { comparedBytes: actual.length, tolerance: 2, maxDifference } };
    return { direct, getterReads, indexedScans, gpu: window.__c2d1283.gpu, samples,
      webglVersion: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) };
  });
  const box = await page.locator('canvas').nth(1).boundingBox();
  if (!box) throw Error('target canvas missing');
  for (const [x, y] of await page.evaluate(() => window.__c2d1283.points)) {
    await page.mouse.click(box.x + 1 + x + 0.5, box.y + 1 + y + 0.5);
  }
  const retained = await page.evaluate(() => {
    const f = window.captureFixture, p = window.__c2d1283;
    const first = f.observe();
    const expectedHits = p.samples.map(sample => sample.hit ?? 'none');
    if (first.pointers !== 7 || JSON.stringify(first.hits) !== JSON.stringify(expectedHits)) {
      throw Error('real pointer routing mismatch: ' + JSON.stringify(first.hits));
    }
    const scene = JSON.stringify(f.tree().snapshot());
    const registered = [...f.target.getImageAsset('Correction').pixels];
    const calls = first.contexts.map(context => context.calls);
    let extraReads = 0, assetReads = 0, metadataReads = 0;
    const largePixels = new Uint8Array(1024 * 257 * 4);
    Object.defineProperty(largePixels, 'lazy', { get() { extraReads++; throw Error('large extra read'); } });
    const large = { width: 1024, height: 257, pixels: largePixels };
    const badAsset = { width: 1, height: 1 };
    Object.defineProperty(badAsset, 'pixels', { enumerable: true, get() { assetReads++; throw Error('asset getter read'); } });
    const badPixels = new Uint8Array(4);
    Object.defineProperty(badPixels, 'byteLength', { get() { metadataReads++; throw Error('metadata getter read'); } });
    const cases = [
      ['oversize', () => p.api.rotateImageAsset(large, 1), 'ASSET_LIMIT'],
      ['assetGetter', () => p.api.rotateImageAsset(badAsset, 1), 'INVALID_ASSET'],
      ['metadataGetter', () => p.api.rotateImageAsset({ width: 1, height: 1, pixels: badPixels }, 1), 'INVALID_ASSET']
    ];
    const refusals = [];
    const originalOwnKeys = Reflect.ownKeys;
    let indexedScans = 0;
    try {
      Reflect.ownKeys = target => {
        if (target === largePixels || target === badPixels) indexedScans++;
        return originalOwnKeys(target);
      };
      for (const [label, call, expected] of cases) {
        let code;
        try { call(); } catch (error) { code = error.code; }
        if (code !== expected) throw Error(`refusal ${label}: ${code} versus ${expected}`);
        refusals.push({ label, code });
      }
    } finally {
      Reflect.ownKeys = originalOwnKeys;
    }
    if (extraReads || assetReads || metadataReads || indexedScans) throw Error('refusal read extra getter or indexed keys');
    const after = f.observe();
    if (JSON.stringify(f.tree().snapshot()) !== scene ||
        JSON.stringify([...f.target.getImageAsset('Correction').pixels]) !== JSON.stringify(registered) ||
        JSON.stringify(after.contexts.map(context => context.calls)) !== JSON.stringify(calls)) {
      throw Error('refusal changed accepted state or GL calls');
    }
    for (const sample of p.samples) {
      const again = f.targetSample(sample.x, sample.y);
      if (JSON.stringify(again) !== JSON.stringify({ rgba: sample.rgba, hit: sample.hit })) {
        throw Error('refusal changed pixel or hit');
      }
    }
    return { pointerCount: first.pointers, hits: first.hits, refusals, getterReads: { extraReads, assetReads, metadataReads }, indexedScans,
      sceneRetained: true, assetRetained: true, drawReadCallsRetained: true, pixelsHitsRetained: true };
  });
  await page.screenshot({ path: evidence + '/screenshot.png' });
  const beforeDispose = await page.evaluate(() => window.captureFixture.observe().pointers);
  await page.getByRole('button', { name: 'Dispose', exact: true }).click();
  await page.mouse.click(box.x + 16, box.y + 16);
  const lifetime = await page.evaluate(before => {
    const f = window.captureFixture;
    const state = f.observe();
    if (state.pointers !== before || state.binds !== state.unbinds || !state.disposed) {
      throw Error('late pointer or listener lifetime mismatch');
    }
    for (const [index, context] of state.contexts.entries()) {
      if (context.lost || context.error !== 0 ||
          Object.values(context.resources).some(resource => resource.live !== 0 || resource.created !== resource.deleted)) {
        throw Error('GL lifetime mismatch at context ' + index + ': ' + JSON.stringify(context));
      }
    }
    const calls = JSON.stringify(state.contexts.map(context => context.calls));
    const after = window.__c2d1283.api.rotateImageAsset(window.__c2d1283.source, 1);
    if (after.pixels.some((byte, index) => byte !== window.__c2d1283.rotated.pixels[index]) ||
        calls !== JSON.stringify(f.observe().contexts.map(context => context.calls))) {
      throw Error('CPU helper after dispose changed bytes or touched GL');
    }
    return { disposed: state.disposed, latePointerIgnored: true, binds: state.binds, unbinds: state.unbinds,
      contexts: state.contexts, cpuAfterDispose: true };
  }, beforeDispose);
  return JSON.stringify({ setup, retained, lifetime, url: page.url(), userAgent: await page.evaluate(() => navigator.userAgent) });
}
