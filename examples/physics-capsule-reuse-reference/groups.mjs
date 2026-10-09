// Original binary64 geometry only. ID, normalization and approximate equivalence are not key inputs.
export function geometryKey(box) {
  const values = [...box.centerM, ...box.halfExtentsM, ...box.orientationXYZW];
  const bytes = new Uint8Array(80), view = new DataView(bytes.buffer);
  for (let i = 0; i < 10; i++) view.setFloat64(i * 8, values[i], true);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

export function groupCopiedBoxes(boxes) {
  const byKey = new Map();
  for (const box of boxes) {
    const key = geometryKey(box), existing = byKey.get(key);
    if (existing) existing.memberIDs.push(box.id);
    else byKey.set(key, { key, memberIDs: [box.id], representative: { id: box.id,
      centerM: box.centerM.slice(), halfExtentsM: box.halfExtentsM.slice(), orientationXYZW: box.orientationXYZW.slice() } });
  }
  return [...byKey.values()];
}
