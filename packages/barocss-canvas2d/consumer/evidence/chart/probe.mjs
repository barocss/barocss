import assert from 'node:assert/strict';

const { initialData, validateData, dataToLocal, localToData, validateChartView,
  makeChart, readChart, setSelection } = await import(new URL('../../chart-host.mjs', import.meta.url));
const { stringifySceneJSON } = await import(new URL('../../../dist/index.js', import.meta.url));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-12,
  `${actual} differs from ${expected}`);
const pointNear = (actual, expected) => { near(actual.x, expected.x); near(actual.y, expected.y); };
const hostRefusal = (operation, code) => assert.throws(operation, error => error?.code === code);

const input = initialData();
const originalData = structuredClone(input);
const copied = validateData(input);
assert.equal(copied.A.length, 8); assert.equal(copied.B.length, 8);
input.A[0].y = 99;
assert.deepEqual(copied, originalData);
assert.deepEqual(initialData(), originalData);
assert.notEqual(copied.A, input.A); assert.notEqual(copied.A[0], input.A[0]);
const invalidData = [null, undefined, { A: [], B: [] }, { A: originalData.A },
  { A: Array(8), B: originalData.B }, { A: originalData.A, B: Array(8) }];
for (const [key, field, value] of [['A', 'x', NaN], ['A', 'y', Infinity],
  ['B', 'x', -Infinity], ['B', 'y', 101]]) {
  const candidate = structuredClone(originalData); candidate[key][0][field] = value;
  invalidData.push(candidate);
}
for (const candidate of invalidData) hostRefusal(() => validateData(candidate), 'HOST_DATA');

pointNear(dataToLocal({ x: 0, y: 0 }), { x: 0, y: 130 });
pointNear(dataToLocal({ x: 7, y: 10 }), { x: 220, y: 0 });
pointNear(dataToLocal({ x: 3.5, y: 5 }), { x: 110, y: 65 });
for (const point of [...originalData.A, ...originalData.B]) pointNear(localToData(dataToLocal(point)), point);
assert.ok(dataToLocal({ x: -1, y: 2 }).x < 0);
assert.ok(dataToLocal({ x: 8, y: 8 }).x > 220);
const viewInput = { panX: 1000, panY: -1000, zoom: 0.5 };
const copiedView = validateChartView(viewInput);
viewInput.panX = 0;
assert.deepEqual(copiedView, { panX: 1000, panY: -1000, zoom: 0.5 });
assert.deepEqual(validateChartView({ panX: 0, panY: 0, zoom: 4 }), { panX: 0, panY: 0, zoom: 4 });
const invalidViews = [null, { panX: NaN, panY: 0, zoom: 1 },
  { panX: 0, panY: Infinity, zoom: 1 }, { panX: 0, panY: 0, zoom: NaN },
  { panX: 1000.001, panY: 0, zoom: 1 }, { panX: 0, panY: -1000.001, zoom: 1 },
  { panX: 0, panY: 0, zoom: 0.499 }, { panX: 0, panY: 0, zoom: 4.001 }];
for (const view of invalidViews) hostRefusal(() => validateChartView(view), 'HOST_VIEW');

const chartInput = initialData();
const chart = makeChart(chartInput);
chartInput.B[0].y = 99;
assert.deepEqual(chart.data, originalData);
const scene = chart.tree.snapshot();
assert.equal(scene.version, 24);
assert.deepEqual(scene.nodes.map(node => node.id), ['Back', 'Plot']);
assert.equal(chart.plot.id, 'Plot'); assert.equal(chart.plot.data.clip, true);
assert.equal(chart.plot.data.width, 220); assert.equal(chart.plot.data.height, 130);
assert.deepEqual(chart.plot.data.transform, { x: 45, y: 40, scaleX: 1, scaleY: 0.9, rotation: 0.14 });
let nodeCount = 0, commandCount = 0;
const ids = new Set();
function inspect(nodes) {
  for (const node of nodes) {
    nodeCount++; assert.equal(ids.has(node.id), false); ids.add(node.id);
    if (node.kind === 'path') commandCount += node.commands.length;
    if (node.kind === 'group' || node.kind === 'frame') inspect(node.children);
  }
}
inspect(scene.nodes);
assert.equal(nodeCount, 21); assert.ok(nodeCount <= 32); assert.ok(commandCount <= 128);
for (const key of ['A', 'B']) {
  assert.equal(chart.series[key].id, `Series${key}`);
  assert.equal(chart.series[key].data.commands.length, 8);
  assert.equal(chart.series[key].data.commands[0].kind, 'M');
  assert.ok(chart.series[key].data.commands.slice(1).every(command => command.kind === 'L'));
  assert.equal(chart.marks[key].length, 8);
  chart.marks[key].forEach((mark, index) => {
    assert.equal(mark.id, `Mark${key}${index}`);
    assert.ok(chart.plot.children.includes(mark));
  });
}
assert.equal(chart.selection.id, 'Selection'); assert.equal(chart.selection.data.hitMode, 'none');
const local = dataToLocal({ x: 3.5, y: 5 });
const world = chart.plot.toWorld(local);
pointNear(world, { x: 45 + Math.cos(0.14) * local.x - Math.sin(0.14) * 0.9 * local.y,
  y: 40 + Math.sin(0.14) * local.x + Math.cos(0.14) * 0.9 * local.y });
pointNear(chart.plot.toLocal(world), local);
const sourceBefore = stringifySceneJSON(scene);
const reopened = readChart(scene);
assert.notEqual(reopened.tree, chart.tree);
assert.equal(stringifySceneJSON(reopened.tree.snapshot()), sourceBefore);
assert.equal(stringifySceneJSON(scene), sourceBefore);
for (const key of ['A', 'B']) reopened.data[key].forEach((point, index) => pointNear(point, originalData[key][index]));
reopened.series.A.setPosition(1, 0);
assert.equal(stringifySceneJSON(chart.tree.snapshot()), sourceBefore);

setSelection(chart, 'SeriesA', local);
assert.equal(chart.selection.data.visible, true);
assert.equal(chart.selection.data.hitMode, 'none');
assert.equal(chart.selection.data.commands.length, 5);
const selectedBefore = stringifySceneJSON(chart.tree.snapshot());
const dataBefore = structuredClone(chart.data);
const commands = Array.from({ length: 257 }, (_, index) =>
  ({ kind: index === 0 ? 'M' : 'L', x: index, y: index % 2 }));
assert.throws(() => chart.series.A.setPath({ commands, stroke: chart.series.A.data.stroke }),
  error => error?.code === 'SCENE_LIMIT');
assert.equal(stringifySceneJSON(chart.tree.snapshot()), selectedBefore);
assert.deepEqual(chart.data, dataBefore);
hostRefusal(() => setSelection(chart, 'Back', local), 'HOST_CHART');
hostRefusal(() => setSelection(chart, 'SeriesA', { x: NaN, y: 0 }), 'HOST_CHART');
assert.equal(stringifySceneJSON(chart.tree.snapshot()), selectedBefore);

const topologyRefusals = [];
function incompatible(label, change) {
  const candidate = structuredClone(scene); change(candidate);
  stringifySceneJSON(candidate);
  hostRefusal(() => readChart(candidate), 'HOST_CHART');
  assert.equal(stringifySceneJSON(chart.tree.snapshot()), selectedBefore);
  topologyRefusals.push(label);
}
const plotNode = candidate => candidate.nodes.find(node => node.id === 'Plot');
const child = (candidate, id) => plotNode(candidate).children.find(node => node.id === id);
incompatible('missing series ID', candidate => { child(candidate, 'SeriesA').id = 'OtherSeries'; });
incompatible('missing mark', candidate => {
  plotNode(candidate).children = plotNode(candidate).children.filter(node => node.id !== 'MarkA0');
});
incompatible('disabled frame clip', candidate => { plotNode(candidate).clip = false; });
incompatible('changed frame transform', candidate => { plotNode(candidate).transform.rotation = 0; });
incompatible('noncanonical series stroke', candidate => { child(candidate, 'SeriesA').stroke.width = 5; });
incompatible('selection intercepts input', candidate => { child(candidate, 'Selection').hitMode = 'auto'; });

console.log(JSON.stringify({ scope: 'pure chart policy and compiled public tree metadata',
  dataCopied: true, invalidDataCount: invalidData.length, invalidViewCount: invalidViews.length,
  mappingRoundtrip: true, transformedPointRoundtrip: true, sceneVersion: scene.version,
  nodeCount, commandCount, savedTreeRoundtrip: true, selectionHitMode: chart.selection.data.hitMode,
  commandLimitCode: 'SCENE_LIMIT', rejectedCandidateRetainedOriginal: true,
  topologyRefusals, gpuTested: false, hitOrderTested: false, browserTested: false }));
