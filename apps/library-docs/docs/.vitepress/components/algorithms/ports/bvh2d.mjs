// The kernel's triangle hierarchy build (packages/barocss-cad/src/mesh/triangle-bvh.ts, triangleBvh) in 2D, for the
// figures of /how/mesh-boolean: corner boxes, the longest side, quickselect (Hoare) to the median by centre, leaves of
// at most LEAF triangles, the explicit stack. `P` holds x, y per vertex, `I` three indices a triangle. Each node also
// keeps where its split is drawn (between the two halves' centres). apps/library-docs/samples/how-ports.test.mjs builds
// the kernel's tree on the same triangles with z = 0 and compares nodes, boxes and order.
/** order[lo..hi] partly sorted by centre on `axis` so that order[k] is in its sorted place (quickselect, Hoare). */
function select(order, CX, axis, lo, hi, k) {
  while (hi > lo) {
    const pivot = CX[2 * order[(lo + hi) >> 1] + axis];
    let i = lo, j = hi;
    while (i <= j) {
      while (CX[2 * order[i] + axis] < pivot) i++;
      while (CX[2 * order[j] + axis] > pivot) j--;
      if (i <= j) { const x = order[i]; order[i] = order[j]; order[j] = x; i++; j--; }
    }
    if (k <= j) hi = j; else if (k >= i) lo = i; else return;
  }
}
export function build(P, I, LEAF = 4) {
  const NT = I.length / 3, CX = new Float64Array(2 * NT);
  for (let t = 0; t < NT; t++) for (let k = 0; k < 2; k++) CX[2 * t + k] = (P[2 * I[3 * t] + k] + P[2 * I[3 * t + 1] + k] + P[2 * I[3 * t + 2] + k]) / 3;
  const order = Array.from({ length: NT }, (_, t) => t), nodes = [], popped = [], todo = [[0, 0, NT, 0, -1]];
  let count = 1;
  while (todo.length) {
    const [n, s, c, depth, parent] = todo.pop();
    popped.push(n);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = s; i < s + c; i++) for (let v = 0; v < 3; v++) { const p = 2 * I[3 * order[i] + v]; x0 = Math.min(x0, P[p]); y0 = Math.min(y0, P[p + 1]); x1 = Math.max(x1, P[p]); y1 = Math.max(y1, P[p + 1]); }
    const node = { n, start: s, count: c, depth, parent, box: [x0, y0, x1, y1], left: -1, axis: -1, cut: 0 };
    nodes[n] = node;
    if (c <= LEAF) continue;
    const ax = x1 - x0 >= y1 - y0 ? 0 : 1, half = c >> 1;
    select(order, CX, ax, s, s + c - 1, s + half);
    node.axis = ax; node.left = count; count += 2;
    todo.push([node.left, s, half, depth + 1, n], [node.left + 1, s + half, c - half, depth + 1, n]);
  }
  // Where to draw each split: between the two halves' centres.
  for (const nd of nodes) if (nd.left >= 0) {
    const half = nd.count >> 1; let lo = -Infinity, hi = Infinity;
    for (let i = nd.start; i < nd.start + half; i++) lo = Math.max(lo, CX[2 * order[i] + nd.axis]);
    for (let i = nd.start + half; i < nd.start + nd.count; i++) hi = Math.min(hi, CX[2 * order[i] + nd.axis]);
    nd.cut = (lo + hi) / 2;
  }
  return { order, nodes, popped };
}
