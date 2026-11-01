// D416: actual SVG text bounds on an authored short linear dimension; no outbound file action.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFlow } from './flow-helper.mjs';

const file = resolve(process.argv[3] ?? ''); assert.ok(process.argv[3]);
const fullOnly = process.env.LINEAR_CLEARANCE_FULL_ONLY === '1';
const originalSvgs = process.env.LINEAR_CLEARANCE_ORIGINAL_SVGS;
if (fullOnly) assert.ok(originalSvgs, 'Full remaining integration requires saved original-segment SVGs');
const f = await createFlow({
  name: 'drawing-linear-clearance', envFrozen: 'DRAWING_LINEAR_CLEARANCE_SOURCE_FROZEN', output: process.argv[2], qualification: 'D416_LINEAR_TEXT_BOUND_CLEARANCE',
  initialFiles: ['apps/cad-studio/test/drawing-linear-clearance-browser.mjs', file],
  inspectorSource: "export { buildSheet } from '@barocss/cad-model/drawing/sheet'; export { sheetDxf } from '@barocss/cad-model/io/dxf';",
  requiredFrozen: ['packages/barocss-cad-model/src/drawing/sheet.ts'],
  limits: [
    'One native64x32x8mm plate, authored8mm linear dimension with+0.05/-0.1 tolerance. SVG getBBox annotation bounds are tested; this is not pixel-ink or standards certification.',
    'Bounded linear-label placement is checked against actual SVG bounds, own lines/heads, view regions, other annotations, title and frame. Circles/angles remain focused-test controls, not new UI qualification.',
    'No Save/export/download, paid call or new dependency. View zoom changes only workspace presentation.',
  ],
});
const target = () => f.page.locator('svg[aria-label="Drawing sheet"] g.dimension[data-dim="d2"]');
let original, authored;
function separation(a, b) {
  let gap = -Infinity;
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (!length) continue;
    const axis = [-(q[1] - p[1]) / length, (q[0] - p[0]) / length];
    const left = a.map(point => point[0] * axis[0] + point[1] * axis[1]);
    const right = b.map(point => point[0] * axis[0] + point[1] * axis[1]);
    gap = Math.max(gap, Math.min(...left) - Math.max(...right), Math.min(...right) - Math.max(...left));
  }
  return gap;
}
async function visibleLabelContext() {
  const viewport = f.page.locator('svg[aria-label="Drawing sheet"]');
  for (let attempt = 0; attempt < 5; attempt++) {
    const bounds = await target().boundingBox(), area = await viewport.boundingBox();
    assert.ok(bounds && area);
    if (bounds.x >= area.x + 12 && bounds.y >= area.y + 12 &&
        bounds.x + bounds.width <= area.x + area.width - 12 && bounds.y + bounds.height <= area.y + area.height - 12) return;
    await f.page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
    await f.page.mouse.wheel(0, 250);
    await f.page.evaluate(() => new Promise(requestAnimationFrame));
  }
  assert.fail('Complete dimension/label context is outside the visible drawing viewport');
}
async function read(label, standard, units, dual) {
  await f.page.waitForFunction(expected => (window.__studioDoc?.drawing?.standard ?? '') === expected.standard && (window.__studioDoc?.drawing?.units ?? 'mm') === expected.units && !!window.__studioDoc?.drawing?.dual === expected.dual && !!document.querySelector('svg[aria-label="Drawing sheet"] g.dimension[data-dim="d2"]'), { standard, units, dual });
  await f.page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); });
  const doc = await f.doc();
  assert.deepEqual(doc.drawing.dimensions, authored);
  const { drawing: _next, ...model } = doc, { drawing: _old, ...before } = original; void _next; void _old;
  assert.deepEqual(model, before);
  const state = await target().evaluate(group => {
    const svg = group.ownerSVGElement, inverse = svg.getScreenCTM().inverse();
    const point = (element, x, y) => { const p = new DOMPoint(x, y).matrixTransform(element.getScreenCTM()).matrixTransform(inverse); return [p.x, p.y]; };
    const texts = [...group.querySelectorAll('text')].map(text => {
      const box = text.getBBox();
      return { text: text.textContent, box: [[box.x, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + box.height], [box.x, box.y + box.height]].map(([x, y]) => point(text, x, y)) };
    });
    const heads = [...group.querySelectorAll('path[fill="#000"][stroke="none"]')].map(path => {
      const numbers = path.getAttribute('d').match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g).map(Number), points = [];
      for (let i = 0; i < numbers.length; i += 2) points.push(point(path, numbers[i], numbers[i + 1]));
      return points;
    });
    const rectangle = (element, padding = 0) => {
      const box = element.getBBox();
      return [[box.x - padding, box.y - padding], [box.x + box.width + padding, box.y - padding],
        [box.x + box.width + padding, box.y + box.height + padding], [box.x - padding, box.y + box.height + padding]]
        .map(([x, y]) => point(element, x, y));
    };
    const strokeLine = line => {
      const a = [Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))];
      const b = [Number(line.getAttribute('x2')), Number(line.getAttribute('y2'))];
      const half = Number(line.getAttribute('stroke-width') ?? '.25') / 2;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = [-(b[1] - a[1]) / length * half, (b[0] - a[0]) / length * half];
      return [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]],
        [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]].map(([x, y]) => point(line, x, y));
    };
    const lines = [...group.querySelectorAll('line')];
    const rawLines = lines.map(line => ['x1', 'y1', 'x2', 'y2', 'stroke-width'].map(name => Number(line.getAttribute(name) ?? '.25')));
    const segments = lines.map(strokeLine);
    const lineEntries = lines.map((line, index) => ({ raw: rawLines[index], box: segments[index],
      a: point(line, rawLines[index][0], rawLines[index][1]), b: point(line, rawLines[index][2], rawLines[index][3]) }));
    const rawHeadTips = [...group.querySelectorAll('path[fill="#000"][stroke="none"]')].map(path =>
      path.getAttribute('d').match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g).slice(0, 2).map(Number));
    for (const polyline of group.querySelectorAll('polyline')) {
      const numbers = polyline.getAttribute('points').match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g).map(Number);
      const half = Number(polyline.getAttribute('stroke-width') ?? '.25') / 2;
      for (let index = 0; index + 3 < numbers.length; index += 2) {
        const a = [numbers[index], numbers[index + 1]], b = [numbers[index + 2], numbers[index + 3]];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!length) continue;
        const n = [-(b[1] - a[1]) / length * half, (b[0] - a[0]) / length * half];
        segments.push([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]],
          [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]].map(([x, y]) => point(polyline, x, y)));
      }
    }
    const drawing = window.__studioDrawing();
    const bounds = box => [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]];
    const obstacles = Object.entries(drawing.boxes).filter(([view]) => svg.querySelector(`g.view[data-view="${view}"]`))
      .map(([view, box]) => ({ kind: 'view-region', id: view, box: bounds(box) }));
    for (const element of svg.querySelectorAll('g > text, g > line, g > path, g > polyline, g > polygon, g > rect')) {
      if (group.contains(element) || element.closest('g.frame, g.title, g.view')) continue;
      let box = element.tagName === 'line' ? strokeLine(element) : rectangle(element, element.tagName === 'text' ? 0 : Number(element.getAttribute('stroke-width') ?? '.25') / 2);
      if (element.tagName === 'path' && element.getAttribute('fill') === '#000' && element.getAttribute('stroke') === 'none') {
        const numbers = element.getAttribute('d').match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g).map(Number);
        box = [];
        for (let index = 0; index < numbers.length; index += 2) box.push(point(element, numbers[index], numbers[index + 1]));
      }
      obstacles.push({ kind: 'other-annotation', id: element.parentElement.outerHTML.slice(0, 160), ownerDimension: element.closest('g.dimension')?.getAttribute('data-dim') ?? null, box });
    }
    const title = svg.querySelector('g.title');
    if (title) obstacles.push({ kind: 'title-region', id: 'title', box: rectangle(title) });
    // This literal fixture is A4 with its authored/default 10 mm inner frame.
    const frame = [10, 10, 287, 200];
    return { svg: svg.outerHTML, dimension: drawing.dimensions.find(d => d.id === 'd2'), texts, heads, rawHeadTips, rawLines, lineEntries, segments, obstacles, frame, unsupportedStrokedPaths: [...group.querySelectorAll('path')].filter(path => path.getAttribute('stroke') !== 'none').length };
  });
  assert.equal(state.unsupportedStrokedPaths, 0, 'Own stroked paths need explicit segment decoding');
  assert.equal(state.heads.length, 2); assert.ok(state.heads.every(head => head.length === 3));
  assert.equal(state.dimension.value, 8);
  if (fullOnly) {
    const baseline = await readFile(join(originalSvgs, units === 'mm' ? '01-asme-mm-dual.svg' : '02-asme-inch-dual.svg'), 'utf8');
    const own = baseline.match(/<g class="dimension"[^>]*data-dim="d2"[^>]*>([\s\S]*?)<\/g>/)?.[1];
    assert.ok(own, 'Saved original dimension group is required');
    const originalLines = [...own.matchAll(/<line\b[^>]*>/g)].map(match =>
      ['x1', 'y1', 'x2', 'y2', 'stroke-width'].map(name => Number(match[0].match(new RegExp(name + '="([^"]+)"'))?.[1] ?? '.25')));
    assert.equal(originalLines.length, 3);
    for (const line of originalLines) assert.ok(state.rawLines.some(candidate => JSON.stringify(candidate) === JSON.stringify(line)), 'Original fixed segment changed: ' + JSON.stringify(line));
    state.originalThreeSegmentsUnchanged = true;
    state.connectors = state.lineEntries.filter(entry => !originalLines.some(line => JSON.stringify(line) === JSON.stringify(entry.raw)));
    assert.equal(state.connectors.length, 1, 'Endpoint candidate must have one explicit derived connector');
    assert.ok(state.rawHeadTips.some(tip => JSON.stringify(tip) === JSON.stringify(state.connectors[0].raw.slice(0, 2))), 'Connector starts at an original head tip');
    state.originalLineEntries = state.lineEntries.filter(entry => originalLines.some(line => JSON.stringify(line) === JSON.stringify(entry.raw)));
    assert.equal(doc.drawing.dimensions.length, 6);
    assert.ok(state.obstacles.some(obstacle => obstacle.ownerDimension && obstacle.ownerDimension !== 'd2'), 'Full fixture must contain other dimension obstacles');
  }
  state.separatingAxisGaps = state.texts.flatMap(text => state.heads.map(head => separation(text.box, head)));
  state.collisions = [];
  for (const text of state.texts) {
    for (const [kind, polygons] of [['head', state.heads], ['own-segment', state.segments]]) {
      polygons.forEach((polygon, index) => {
        if (separation(text.box, polygon) <= 0) state.collisions.push({ text: text.text, kind, index });
      });
    }
    for (const obstacle of state.obstacles) {
      if (separation(text.box, obstacle.box) <= 0) state.collisions.push({ text: text.text, kind: obstacle.kind, id: obstacle.id });
    }
    if (!text.box.every(([x, y]) => x >= state.frame[0] && y >= state.frame[1] && x <= state.frame[2] && y <= state.frame[3])) {
      state.collisions.push({ text: text.text, kind: 'outside-frame' });
    }
  }
  for (const connector of state.connectors ?? []) {
    for (const obstacle of state.obstacles) {
      if (separation(connector.box, obstacle.box) <= 0) state.collisions.push({ kind: 'connector-' + obstacle.kind, id: obstacle.id });
    }
    // The exact shared tip is intentional. Check the rest against all original own fixed geometry.
    const [a, b] = [connector.a, connector.b], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    assert.ok(length > 0.5);
    const start = [a[0] + (b[0] - a[0]) * 0.5 / length, a[1] + (b[1] - a[1]) * 0.5 / length];
    const half = connector.raw[4] / 2, n = [-(b[1] - a[1]) / length * half, (b[0] - a[0]) / length * half];
    const trimmed = [[start[0] + n[0], start[1] + n[1]], [b[0] + n[0], b[1] + n[1]],
      [b[0] - n[0], b[1] - n[1]], [start[0] - n[0], start[1] - n[1]]];
    const tip = connector.raw.slice(0, 2);
    for (const entry of state.originalLineEntries) {
      const [x1, y1, x2, y2] = entry.raw;
      const incident = (tip[0] - x1) * (y2 - y1) === (tip[1] - y1) * (x2 - x1) &&
        tip[0] >= Math.min(x1, x2) && tip[0] <= Math.max(x1, x2) && tip[1] >= Math.min(y1, y2) && tip[1] <= Math.max(y1, y2);
      if (separation(incident ? trimmed : connector.box, entry.box) <= 0) state.collisions.push({ kind: 'connector-own-fixed', incident });
    }
    state.heads.forEach((head, index) => {
      const incident = JSON.stringify(state.rawHeadTips[index]) === JSON.stringify(tip);
      if (separation(incident ? trimmed : connector.box, head) <= 0) state.collisions.push({ kind: 'connector-own-head', incident });
    });
  }
  await writeFile(join(f.output, label + '.svg'), state.svg);
  await writeFile(join(f.output, label + '-bounds.json'), JSON.stringify(state, null, 2));
  assert.deepEqual(state.collisions, [], JSON.stringify(state.collisions));
  f.report.observations.push({ label, standard: standard || 'plain', units, dual, ownSegments: state.segments.length, fixedObstacles: state.obstacles.length, originalThreeSegmentsUnchanged: state.originalThreeSegmentsUnchanged ?? null, derivedConnectors: state.connectors?.map(connector => ({ from: connector.a, to: connector.b })) ?? [], otherDimensionObstacles: state.obstacles.filter(obstacle => obstacle.ownerDimension && obstacle.ownerDimension !== 'd2').length, collisions: state.collisions, nativeValue: 8, authoredUnchanged: true, texts: state.texts.map(text => text.text), separatingAxisGaps: state.separatingAxisGaps });
  return doc;
}
await f.run(async () => {
  const fonts = { stylesheets: 0, assets: 0 }, newContext = f.browser.newContext.bind(f.browser);
  f.browser.newContext = async (...args) => {
    const context = await newContext(...args);
    await context.route('https://fonts.googleapis.com/**', route => { fonts.stylesheets++; return route.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
    await context.route('https://fonts.gstatic.com/**', route => { fonts.assets++; return route.fulfill({ status: 204, body: '' }); });
    return context;
  };
  try { await f.newPage(); } finally { f.browser.newContext = newContext; }
  f.phase = 'Open authored8mm short dimension';
  await f.openFile(file, 3); await f.ready();
  await f.page.waitForFunction(() => window.__studioDoc?.drawing?.dimensions?.some(dimension => dimension.id === 'd2'));
  original = await f.doc(); authored = original.drawing.dimensions;
  await f.page.click('.mode button:text-is("Drawing")'); await target().waitFor();
  f.phase = 'enlarged linear-label context';
  const box = await target().boundingBox();
  await f.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await f.page.mouse.wheel(0, -650);
  let previous, last;
  let index = 0;
  for (const standard of ['', 'iso', 'asme']) {
    await f.page.getByLabel('Drawing standard', { exact: true }).selectOption(standard);
    for (const units of ['mm', 'inch']) {
      await f.page.getByLabel('Drawing units', { exact: true }).selectOption(units);
      for (const dual of [false, true]) {
        if (fullOnly && (standard !== 'asme' || !dual)) continue;
        f.phase = `${standard || 'plain'} ${units} ${dual ? 'dual' : 'single'} complete label clearance`;
        await f.page.getByLabel('Dual units', { exact: true }).setChecked(dual);
        const label = String(++index).padStart(2, '0') + '-' + (standard || 'plain') + '-' + units + '-' + (dual ? 'dual' : 'single');
        previous = last;
        last = await read(label, standard, units, dual);
        // Capture every affected single-unit family and both ASME dual witnesses.
        if (!dual || standard === 'asme') {
          await visibleLabelContext();
          await f.snapshot(label);
        }
      }
    }
  }
  if (!fullOnly) {
    f.phase = 'exact Undo and Redo retain authored data';
    await f.undo(); await f.same(previous); await read('13-undo-asme-inch', 'asme', 'inch', false);
    await f.redo(); await f.same(last); await read('14-redo-asme-dual', 'asme', 'inch', true);
  }
  assert.equal(fonts.assets, 0); assert.deepEqual(f.report.downloads, []);
  f.report.observations.push({ fonts, authoredPlaceAndReferencesUnchanged: true, numericToleranceUnchanged: true, undoRedo: fullOnly ? 'NOT_RUN remaining full-plate integration only; run02 retained' : 'PASS', fullPlateOnly: fullOnly, outboundExportAndSave: 'NOT_RUN' });
});
