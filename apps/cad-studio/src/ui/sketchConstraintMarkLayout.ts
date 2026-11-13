type Point = readonly [number, number];
export type ScreenBox = { x: number; y: number; width: number; height: number };

export const constraintMarkSize = { width: 18, height: 16 };
const gap = 2;
const maxMarks = 128;
const stepX = constraintMarkSize.width + gap;
const stepY = constraintMarkSize.height + gap;
const offsets: readonly Point[] = [
  [0, 0],
  [stepX, 0], [-stepX, 0], [0, -stepY], [0, stepY],
  [stepX, -stepY], [-stepX, -stepY], [stepX, stepY], [-stepX, stepY],
  [2 * stepX, 0], [-2 * stepX, 0], [0, -2 * stepY], [0, 2 * stepY],
];

function markBox([x, y]: Point): ScreenBox {
  const { width, height } = constraintMarkSize;
  return { x: x - width / 2, y: y - height / 2, width, height };
}

function collides(a: ScreenBox, b: ScreenBox): boolean {
  return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap
    && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
}

/** Move a visible mark in screen space. Keep its original placement when there is no room nearby. */
export function placeConstraintMarks(preferred: readonly Point[], dimensions: readonly ScreenBox[], view: { width: number; height: number }): Point[] {
  if (preferred.length > maxMarks) return [...preferred];
  const occupied = [...dimensions];
  return preferred.map(point => {
    const original = markBox(point);
    if (!point.every(Number.isFinite) || original.x + original.width < 0 || original.x > view.width
      || original.y + original.height < 0 || original.y > view.height) return point;
    for (const [dx, dy] of offsets) {
      const next: Point = [point[0] + dx, point[1] + dy];
      const box = markBox(next);
      if ((dx || dy) && (box.x < 0 || box.y < 0 || box.x + box.width > view.width || box.y + box.height > view.height)) continue;
      if (occupied.some(block => collides(box, block))) continue;
      occupied.push(box);
      return dx || dy ? next : point;
    }
    occupied.push(original);
    return point;
  });
}
