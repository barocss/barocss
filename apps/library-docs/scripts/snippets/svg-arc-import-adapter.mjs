// Application adapter: only the supplied public Canvas2D namespace is used.
function copiedScene(API, input) {
  return API.parseSceneJSON(API.stringifySceneJSON(input));
}

export function createArcDisplayTree(API, importedScene5) {
  const scene = copiedScene(API, importedScene5);
  if (scene.version !== 5) throw new API.Canvas2DError('INVALID_SCENE', 'Arc import adapter requires the actual Scene5 result');
  const tree = API.createDisplayTree(scene.contextId);
  function attach(parent, nodes) {
    for (const node of nodes) {
      const common = { id: node.id, layer: node.layer, transform: structuredClone(node.transform),
        visible: true, alpha: 1, hitMode: 'auto' };
      let handle;
      if (node.kind === 'frame') {
        handle = tree.createFrame({ ...common, width: node.width, height: node.height,
          fill: [...node.fill], clip: node.clip });
      } else if (node.kind === 'group') {
        handle = tree.createContainer(common);
      } else if (node.kind === 'path') {
        handle = tree.createPath({ ...common, commands: structuredClone(node.commands),
          ...(node.fill ? { fill: structuredClone(node.fill) } : {}),
          ...(node.stroke ? { stroke: structuredClone(node.stroke) } : {}) });
      } else throw new API.Canvas2DError('UNSUPPORTED_FEATURE', 'Arc example supports only imported Frame, Group and Path nodes');
      parent.addChild(handle);
      if (node.kind === 'frame' || node.kind === 'group') attach(handle, node.children);
    }
  }
  attach(tree.stage, scene.nodes);
  return tree;
}

export function validateArcScene29(API, input) {
  const scene = copiedScene(API, input);
  if (scene.version !== 29) throw new API.Canvas2DError('INVALID_SCENE', 'Editable arc input must be a complete Scene29');
  const viewport = scene.nodes[0];
  if (scene.nodes.length !== 1 || viewport.kind !== 'frame' || viewport.width !== 320 || viewport.height !== 200 || !viewport.clip) {
    throw new API.Canvas2DError('INVALID_SCENE', 'Arc example requires the retained 320×200 viewport Frame');
  }
  let arc = null;
  function inspect(nodes) {
    for (const node of nodes) {
      if (node.kind === 'frame' || node.kind === 'group') inspect(node.children);
      else if (node.kind !== 'path') throw new API.Canvas2DError('UNSUPPORTED_FEATURE', 'Editable arc example supports vector Frame, Group and Path nodes');
      if (node.id === 'ArcPath') arc = node;
    }
  }
  inspect(scene.nodes);
  if (arc?.kind !== 'path' || !arc.commands.some(command => command.kind === 'C')) {
    throw new API.Canvas2DError('INVALID_SCENE', 'ArcPath must retain at least one cubic command');
  }
  return scene;
}

export function editFirstArcCubic(API, scene29, deltaX = 12) {
  if (!Number.isFinite(deltaX)) throw new API.Canvas2DError('INVALID_SCENE', 'Cubic edit must be finite');
  const tree = API.createDisplayTreeFromScene(validateArcScene29(API, scene29));
  const path = tree.get('ArcPath'), data = path.data;
  const commands = structuredClone(data.commands);
  commands.find(command => command.kind === 'C').c1x += deltaX;
  // setPath replaces paint, so retain complete copied fill and stroke.
  path.setPath({ commands, ...(data.fill ? { fill: structuredClone(data.fill) } : {}),
    ...(data.stroke ? { stroke: structuredClone(data.stroke) } : {}) });
  return { tree, scene: tree.snapshot() };
}
