const identity = [1, 0, 0, 1, 0, 0];

function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function pose(transform) {
  const c = Math.cos(transform.rotation), s = Math.sin(transform.rotation);
  return [c * transform.scaleX, s * transform.scaleX,
    -s * transform.scaleY, c * transform.scaleY, transform.x, transform.y];
}

export function findSceneNode(id, nodes, parentMatrix = identity, ancestors = [], depth = 0,
  parentX = 0, parentY = 0) {
  for (const node of nodes) {
    if (node.id === id) return { node, parentMatrix, ancestors, depth, parentX, parentY };
    if (!node.children) continue;
    const found = findSceneNode(id, node.children, multiply(parentMatrix, pose(node.transform)),
      [...ancestors, node.id], depth + 1,
      parentX + node.transform.x, parentY + node.transform.y);
    if (found) return found;
  }
  return null;
}

export function listSceneNodes(nodes, depth = 0) {
  return nodes.flatMap(node => [{ id: node.id, name: node.id.replace(/([a-z])([A-Z])/g, '$1 $2'),
    kind: node.kind, layer: node.layer, depth },
    ...(node.children ? listSceneNodes(node.children, depth + 1) : [])]);
}

export function translateSelected(scene, selectedIds, worldDx, worldDy, snap) {
  for (const id of selectedIds) {
    const found = findSceneNode(id, scene.nodes);
    if (!found || found.ancestors.some(parentId => selectedIds.has(parentId))) continue;
    const { node, parentMatrix: m } = found;
    const originX = m[0] * node.transform.x + m[2] * node.transform.y + m[4];
    const originY = m[1] * node.transform.x + m[3] * node.transform.y + m[5];
    const targetX = snap ? Math.round((originX + worldDx) / 10) * 10 : originX + worldDx;
    const targetY = snap ? Math.round((originY + worldDy) / 10) * 10 : originY + worldDy;
    const determinant = m[0] * m[3] - m[1] * m[2];
    const x = (m[3] * (targetX - m[4]) - m[2] * (targetY - m[5])) / determinant;
    const y = (-m[1] * (targetX - m[4]) + m[0] * (targetY - m[5])) / determinant;
    node.transform.x = Object.is(x, -0) ? 0 : x;
    node.transform.y = Object.is(y, -0) ? 0 : y;
  }
}

export function removeSelected(nodes, selectedIds) {
  return nodes.filter(node => !selectedIds.has(node.id)).map(node =>
    node.children ? { ...node, children: removeSelected(node.children, selectedIds) } : node);
}
