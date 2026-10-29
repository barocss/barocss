// Independent integer reference-mask and stock-minus-disjoint-prism moments. Product imports: zero.
export const region = { points: [[4, 4], [52, 4], [52, 36], [4, 36]], holes: [[[20, 16], [34, 16], [34, 30], [20, 30]], [[42, 6], [46, 6], [44, 10]]] };
export function classify(ring, input) {
  const [x, y] = input.map(BigInt); let inside = false;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i].map(BigInt), [bx, by] = ring[(i + 1) % ring.length].map(BigInt), side = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (side === 0n && x >= (ax < bx ? ax : bx) && x <= (ax > bx ? ax : bx) && y >= (ay < by ? ay : by) && y <= (ay > by ? ay : by)) return 'boundary';
    if ((ay > y) !== (by > y) && (by > ay ? side > 0n : side < 0n)) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}
export function cells(spacing2, mask = region) {
  const result = [[0, 0]];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
    if (i === 0 && j === 0) continue;
    const p = [8 + 12 * i, 8 + spacing2 * j];
    if (classify(mask.points, p) !== 'outside' && !(mask.holes ?? []).some(hole => classify(hole, p) !== 'outside')) result.push([i, j]);
  }
  return result;
}
export function material(accepted, spacing2) {
  const volume = 24000n - 150n * BigInt(accepted.length); let twiceX = 0n, twiceY = 0n;
  for (const [i, j] of accepted) { twiceX += 17n + 24n * BigInt(i); twiceY += 17n + 2n * BigInt(spacing2 * j); }
  return { volume: Number(volume), centroid: [Number(1440000n - 150n * twiceX) / Number(2n * volume), Number(960000n - 150n * twiceY) / Number(2n * volume), 5] };
}
