import * as publicAPI from '@barocss/canvas2d';

export const LOGICAL_SIZE = Object.freeze({ width: 320, height: 220 });
export const CURRENT_SVG_IDS = Object.freeze({
  group: 'SceneGroup', nested: 'NestedGroup', solid: 'SolidPath',
  hole: 'HolePath', hidden: 'HiddenPath', transparent: 'TransparentPath',
  stroke: 'StrokePath', top: 'TopPath', curved: 'CurvedPath',
  hiddenGroup: 'HiddenGroup', hiddenChild: 'HiddenChild',
});
const pose = (x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0) =>
  ({ x, y, scaleX, scaleY, rotation });
const box = (width, height) => [
  { kind: 'M', x: 0, y: 0 }, { kind: 'L', x: width, y: 0 },
  { kind: 'L', x: width, y: height }, { kind: 'L', x: 0, y: height },
  { kind: 'Z' },
];
const solid = (color, rule = 'nonzero') => ({ color, rule });
function check(condition, message) { if (!condition) throw new Error(message); }

/** Public builders supply current defaults; no authored Scene version is changed. */
export function createCurrentSVGFixture(api = publicAPI) {
  const tree = api.createDisplayTree('CurrentSVGScene');
  const ids = CURRENT_SVG_IDS;
  const group = tree.createContainer({
    id: ids.group, layer: 0, transform: pose(25, 20, 1.1, 0.9, 0.12), alpha: 0.5,
  });
  const nested = tree.createContainer({
    id: ids.nested, layer: 0, transform: pose(6, 5, 1.05, 1.1, -0.08), alpha: 0.5,
  });
  const red = tree.createPath({
    id: ids.solid, layer: 0, transform: pose(0, 0, 1, 1, 0.05),
    commands: box(60, 40), fill: solid([1, 0, 0, 128 / 255]),
  });
  const ring = tree.createPath({
    id: ids.hole, layer: 1, transform: pose(80, 4),
    commands: [...box(70, 60), { kind: 'M', x: 20, y: 15 },
      { kind: 'L', x: 50, y: 15 }, { kind: 'L', x: 50, y: 45 },
      { kind: 'L', x: 20, y: 45 }, { kind: 'Z' }],
    fill: solid([0, 0, 1, 1], 'evenodd'),
  });
  const hidden = tree.createPath({
    id: ids.hidden, layer: 2, transform: pose(165, 0), visible: false,
    commands: box(30, 30), fill: solid([1, 0, 1, 1]),
  });
  const transparent = tree.createPath({
    id: ids.transparent, layer: 3, transform: pose(165, 40), alpha: 0,
    commands: box(30, 30), fill: solid([0, 1, 0, 1]),
  });
  const stroke = tree.createPath({
    id: ids.stroke, layer: 4, transform: pose(8, 90),
    commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 70, y: 0 },
      { kind: 'L', x: 70, y: 30 }],
    stroke: { color: [0, 1, 0, 1], width: 4 },
  });
  for (const path of [red, ring, hidden, transparent, stroke]) nested.addChild(path);
  group.addChild(nested); tree.stage.addChild(group);
  const top = tree.createPath({
    id: ids.top, layer: 1, transform: pose(225, 145),
    commands: box(60, 45), fill: solid([1, 153 / 255, 0, 1]),
  });
  tree.stage.addChild(top);
  const invisible = tree.createContainer({
    id: ids.hiddenGroup, layer: 2, transform: pose(205, 20), visible: false,
  });
  const invisibleChild = tree.createPath({
    id: ids.hiddenChild, layer: 0, transform: pose(), commands: box(25, 25),
    fill: solid([0, 1, 1, 1]),
  });
  invisible.addChild(invisibleChild); tree.stage.addChild(invisible);
  const curved = tree.createPath({
    id: ids.curved, layer: 3, transform: pose(225, 60),
    commands: [{ kind: 'M', x: 0, y: 20 },
      { kind: 'Q', cx: 0, cy: 0, x: 30, y: 0 },
      { kind: 'C', c1x: 45, c1y: 0, c2x: 60, c2y: 10, x: 60, y: 25 },
      { kind: 'L', x: 60, y: 45 }, { kind: 'L', x: 0, y: 45 }, { kind: 'Z' }],
    fill: solid([128 / 255, 64 / 255, 1, 1]),
  });
  tree.stage.addChild(curved);
  const sample = (name, handle, local, expectedHitId) =>
    ({ name, point: handle.toWorld(local), expectedHitId });
  const samples = [
    sample('solid-interior', red, { x: 25, y: 20 }, ids.solid),
    sample('evenodd-ring', ring, { x: 8, y: 30 }, ids.hole),
    sample('evenodd-hole', ring, { x: 35, y: 30 }, null),
    sample('hidden-path', hidden, { x: 15, y: 15 }, null),
    // Root browser retry1 showed the prior (15,15) overlapped CurvedPath.
    // Keep a genuine interior point in the transparent path, clear of that sibling.
    sample('alpha-zero-path', transparent, { x: 1, y: 1 }, null),
    sample('default-stroke', stroke, { x: 30, y: 0 }, ids.stroke),
    sample('opaque-sibling', top, { x: 20, y: 20 }, ids.top),
    sample('hidden-ancestor', invisibleChild, { x: 12, y: 12 }, null),
    sample('quadratic-cubic-interior', curved, { x: 30, y: 25 }, ids.curved),
    { name: 'empty', point: { x: 310, y: 210 }, expectedHitId: null },
  ];
  check(tree.snapshot().version === 29, 'Fixture must originate from the current public tree');
  return { tree, ids, samples, logicalSize: LOGICAL_SIZE };
}

/** Paint-only edit keeps all declared hit sample identities. */
export function applyCurrentSVGEdit(tree) {
  const path = tree.get(CURRENT_SVG_IDS.solid);
  check(path?.kind === 'path', 'SolidPath missing');
  path.setPath({ commands: path.data.commands, fill: solid([0, 1, 1, 128 / 255]) });
  return tree.snapshot();
}

/** Rebuild the genuine imported Scene5 using public factories, without retagging it. */
export function createTreeFromImportedSVG(input, api = publicAPI) {
  const scene = input.scene ?? input;
  check(scene.version === 5, 'The unchanged SVG importer must return Scene5');
  const tree = api.createDisplayTree(scene.contextId);
  function append(node, parent) {
    const { kind, children, ...spec } = node;
    let handle;
    if (kind === 'group') handle = tree.createContainer(spec);
    else if (kind === 'frame') handle = tree.createFrame(spec);
    else if (kind === 'path') handle = tree.createPath(spec);
    else throw new Error('Unexpected imported SVG node kind: ' + kind);
    parent.addChild(handle);
    for (const child of children ?? []) append(child, handle);
  }
  for (const node of scene.nodes) append(node, tree.stage);
  return tree;
}

const identity = [1, 0, 0, 1, 0, 0];
function multiply(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
function matrix(t) {
  const c = Math.cos(t.rotation), s = Math.sin(t.rotation);
  return [c * t.scaleX, s * t.scaleX, -s * t.scaleY, c * t.scaleY, t.x, t.y];
}
export function normalizeCurrentSVGScene(input) {
  const scene = input.scene ?? input;
  let nodes = scene.nodes;
  const wrappers = [];
  if (nodes.length === 1 && nodes[0].kind === 'frame') {
    const frame = nodes[0], view = frame.children?.[0];
    check(frame.clip && frame.width === LOGICAL_SIZE.width && frame.height === LOGICAL_SIZE.height
      && frame.fill.every(value => value === 0), 'Unexpected imported viewport wrapper');
    check(view?.kind === 'group' && view.children && frame.children.length === 1,
      'Unexpected imported ViewBox wrapper');
    check([...matrix(frame.transform), ...matrix(view.transform)]
      .every((value, index) => Math.abs(value - identity[index % 6]) <= 1e-12),
    'Fixture ViewBox wrapper must be identity');
    wrappers.push(frame.id, view.id); nodes = view.children;
  }
  const rows = [], pathIds = [], groupIds = [];
  function visit(children, world, alpha, visible, parentId) {
    children.forEach((node, order) => {
      check(node.layer === order, 'Fixture layer must equal sibling index');
      const nextWorld = multiply(world, matrix(node.transform));
      const nextAlpha = alpha * (node.alpha ?? 1), nextVisible = visible && node.visible !== false;
      if (node.kind === 'group') {
        groupIds.push(node.id);
        rows.push({ kind: 'group', id: node.id, parentId, layer: order, worldMatrix: nextWorld });
        visit(node.children, nextWorld, nextAlpha, nextVisible, node.id);
      } else {
        check(node.kind === 'path', 'Only source group/path semantics are normalized');
        const effective = nextVisible ? nextAlpha : 0;
        const paint = value => value
          ? { color: [...value.color.slice(0, 3), value.color[3] * effective] } : null;
        const fill = node.fill ? { ...paint(node.fill), rule: node.fill.rule } : null;
        const stroke = node.stroke ? { ...paint(node.stroke), width: node.stroke.width } : null;
        const painted = (fill?.color[3] ?? 0) > 0 || (stroke?.color[3] ?? 0) > 0;
        pathIds.push(node.id);
        rows.push({ kind: 'path', id: node.id, parentId, layer: order,
          worldMatrix: nextWorld, commands: structuredClone(node.commands), fill, stroke,
          visiblePaint: painted, hitEligible: painted && (node.hitMode ?? 'auto') === 'auto' });
      }
    });
  }
  visit(nodes, identity, 1, true, null);
  return { contextId: scene.contextId, groupIds, pathIds, rows, importerWrapperIds: wrappers };
}
export function compareCurrentSVGSemantics(original, imported) {
  const a = normalizeCurrentSVGScene(original), b = normalizeCurrentSVGScene(imported);
  function compare(x, y, path) {
    if (typeof x === 'number' && typeof y === 'number') {
      check(Number.isFinite(x) && Number.isFinite(y)
        && Math.abs(x - y) <= 1e-10 * Math.max(1, Math.abs(x), Math.abs(y)),
      'Numeric semantic mismatch at ' + path);
    } else if (x && y && typeof x === 'object' && typeof y === 'object') {
      const keys = Object.keys(x).sort();
      check(JSON.stringify(keys) === JSON.stringify(Object.keys(y).sort()), 'Fields differ at ' + path);
      for (const key of keys) compare(x[key], y[key], path + '.' + key);
    } else check(Object.is(x, y), 'Semantic mismatch at ' + path);
  }
  compare({ ...a, importerWrapperIds: [] }, { ...b, importerWrapperIds: [] }, 'scene');
  return { matched: true, contextId: a.contextId, groupIds: a.groupIds, pathIds: a.pathIds,
    normalizedPaths: a.rows.filter(row => row.kind === 'path'),
    ignoredImportedIdentityViewportWrappers: b.importerWrapperIds,
    numberTolerance: '1e-10 * max(1,abs(a),abs(b)); rotation unit conversion only',
    hitScope: 'same path paint/geometry eligibility; actual renderer samples are a separate browser gate' };
}

export function createLegacySVGScene() {
  return { version: 5, unit: 'logical-px', contextId: 'LegacySVGScene',
    nodes: [{ kind: 'path', id: 'LegacyPath', layer: 0, transform: pose(),
      commands: box(40, 30), fill: solid([0, 128 / 255, 1, 1], 'evenodd') }] };
}
/** Separate public-builder admission from exporter refusal on an admitted Scene. */
export function runCurrentSVGBuilderRefusals(api = publicAPI) {
  const { tree, ids } = createCurrentSVGFixture(api);
  const before = api.stringifySceneJSON(tree.snapshot());
  let error;
  try { tree.get(ids.group).setRotation(3 * Math.PI); }
  catch (caught) { error = caught; }
  check(error instanceof api.Canvas2DError && error.code === 'INVALID_SCENE',
    'Rotation outside the public +/-2PI range must refuse in the builder');
  check(api.stringifySceneJSON(tree.snapshot()) === before,
    'Rejected builder mutation changed the accepted snapshot');
  return [{ name: 'public-rotation-range', errorName: error.name,
    errorCode: error.code, acceptedSnapshotRetained: true,
    scope: 'Public builder preflight; SVG exporter was not invoked' }];
}
export function createSVGRefusalCases(api = publicAPI) {
  const result = [];
  const add = (name, change) => {
    const fixture = createCurrentSVGFixture(api); change(fixture.tree, fixture.ids);
    result.push({ name, scene: fixture.tree.snapshot(), expectedCode: 'UNSUPPORTED_FEATURE' });
  };
  add('polygon-mask', (tree, ids) => tree.get(ids.group).setMask({ commands: box(30, 30) }));
  add('hit-area', (tree, ids) => tree.get(ids.group).setHitArea({ x: 0, y: 0, width: 20, height: 20 }));
  add('hit-mode', (tree, ids) => tree.get(ids.solid).setHitMode('none'));
  add('pivot', (tree, ids) => tree.get(ids.group).setPivot(1, 0));
  add('signed-scale', (tree, ids) => tree.get(ids.group).setScale(-1, 1));
  add('linear-gradient', (tree, ids) => tree.get(ids.solid).setPath({
    commands: box(60, 40), fill: { rule: 'nonzero', linear: { from: { x: 0, y: 0 },
      to: { x: 60, y: 0 }, startColor: [1, 0, 0, 1], endColor: [0, 0, 1, 1] } },
  }));
  add('radial-gradient', (tree, ids) => tree.get(ids.solid).setPath({
    commands: box(60, 40), fill: { rule: 'nonzero', radial: { center: { x: 20, y: 20 },
      radius: 20, startColor: [1, 0, 0, 1], endColor: [0, 0, 1, 1] } },
  }));
  for (const [name, extra] of [['stroke-cap', { cap: 'round' }], ['stroke-join', { join: 'round' }],
    ['stroke-dash', { dash: { lengths: [2, 2], offset: 0 } }], ['stroke-miter', { miterLimit: 8 }]]) {
    add(name, (tree, ids) => tree.get(ids.stroke).setPath({
      commands: tree.get(ids.stroke).data.commands, stroke: { color: [0, 1, 0, 1], width: 4, ...extra },
    }));
  }
  add('non-grid-rgb', (tree, ids) => tree.get(ids.solid).setPath({
    commands: box(60, 40), fill: solid([0.5, 0, 0, 1]),
  }));
  add('non-sibling-layer', (tree, ids) => tree.get(ids.solid).setLayer(6));
  const extra = (tree, create) => tree.stage.addChild(create(tree));
  add('rect', tree => extra(tree, t => t.createRect({ id: 'UnsupportedRect', layer: 4,
    transform: pose(), width: 20, height: 20, fill: [1, 0, 0, 1] })));
  add('line', tree => extra(tree, t => t.createLine({ id: 'UnsupportedLine', layer: 4,
    transform: pose(), x1: 0, y1: 0, x2: 20, y2: 20, width: 2, stroke: [1, 0, 0, 1] })));
  add('frame', tree => extra(tree, t => t.createFrame({ id: 'UnsupportedFrame', layer: 4,
    transform: pose(), width: 20, height: 20, fill: [0, 0, 0, 0], clip: true })));
  add('image', tree => extra(tree, t => t.createSprite({ id: 'UnsupportedImage', layer: 4,
    transform: pose(), imageId: 'Atlas', width: 10, height: 10, opacity: 1, sampling: 'nearest',
    anchorX: 0, anchorY: 0 })));
  add('text', tree => extra(tree, t => t.createGlyphRun({ id: 'UnsupportedText', layer: 4,
    transform: pose(), atlasId: 'Atlas', text: 'A', baseline: 10, opacity: 1, sampling: 'nearest',
    glyphs: [{ sourceRect: { x: 0, y: 0, width: 10, height: 10 },
      x: 0, y: 0, width: 10, height: 10, textStart: 0, textEnd: 1 }] })));
  for (const [name, groups] of [['importer-depth-budget', 15], ['importer-node-budget', 255]]) {
    const tree = api.createDisplayTree(name === 'importer-depth-budget' ? 'DepthBudget' : 'NodeBudget');
    let parent = tree.stage;
    for (let i = 0; i < groups; i++) {
      const group = tree.createContainer({ id: 'BudgetGroup' + i,
        layer: groups === 15 ? 0 : i, transform: pose() });
      parent.addChild(group); if (groups === 15) parent = group;
    }
    parent.addChild(tree.createPath({ id: 'BudgetPath', layer: groups === 15 ? 0 : groups,
      transform: pose(), commands: box(10, 10), fill: solid([1, 0, 0, 1]) }));
    result.push({ name, scene: tree.snapshot(), expectedCode: 'UNSUPPORTED_FEATURE' });
  }
  return result;
}
