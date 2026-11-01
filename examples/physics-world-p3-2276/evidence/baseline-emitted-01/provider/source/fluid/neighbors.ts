import { FLUID_BASIN_M, FLUID_SMOOTHING_RADIUS_M } from './constants.js';

export type NeighborVisitor = (other: number, rx: number, ry: number, rz: number,
  distanceSquared: number) => void;

const minimum = [-1, -2, -1];
const size = FLUID_BASIN_M.map((extent, axis) =>
  Math.floor(extent / FLUID_SMOOTHING_RADIUS_M) + 2 - minimum[axis]);
const cellCount = size[0] * size[1] * size[2];

function cellIndex(x: number, y: number, z: number): number {
  const gx = x - minimum[0], gy = y - minimum[1], gz = z - minimum[2];
  if (gx < 0 || gx >= size[0] || gy < 0 || gy >= size[1]
    || gz < 0 || gz >= size[2]) return -1;
  return (gz * size[1] + gy) * size[0] + gx;
}

export class NeighborGrid {
  private readonly head = new Int32Array(cellCount);
  private readonly tail = new Int32Array(cellCount);
  private next = new Int32Array(0);
  private positions: Float64Array = new Float64Array(0);
  private readonly radiusSquared = FLUID_SMOOTHING_RADIUS_M ** 2;

  rebuild(positions: Float64Array): void {
    this.positions = positions;
    this.head.fill(-1);
    this.tail.fill(-1);
    const count = positions.length / 3;
    if (this.next.length < count) this.next = new Int32Array(count);
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      const x = Math.floor(positions[offset] / FLUID_SMOOTHING_RADIUS_M);
      const y = Math.floor(positions[offset + 1] / FLUID_SMOOTHING_RADIUS_M);
      const z = Math.floor(positions[offset + 2] / FLUID_SMOOTHING_RADIUS_M);
      const cell = cellIndex(x, y, z);
      if (cell < 0) throw new Error('Fluid neighbor cell is outside the admitted basin');
      this.next[index] = -1;
      const last = this.tail[cell];
      if (last < 0) this.head[cell] = index;
      else this.next[last] = index;
      this.tail[cell] = index;
    }
  }

  each(index: number, visit: NeighborVisitor): void {
    const offset = index * 3;
    const cx = Math.floor(this.positions[offset] / FLUID_SMOOTHING_RADIUS_M);
    const cy = Math.floor(this.positions[offset + 1] / FLUID_SMOOTHING_RADIUS_M);
    const cz = Math.floor(this.positions[offset + 2] / FLUID_SMOOTHING_RADIUS_M);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cell = cellIndex(cx + dx, cy + dy, cz + dz);
          if (cell < 0) continue;
          for (let other = this.head[cell]; other >= 0; other = this.next[other]) {
            const otherOffset = other * 3;
            const rx = this.positions[offset] - this.positions[otherOffset];
            const ry = this.positions[offset + 1] - this.positions[otherOffset + 1];
            const rz = this.positions[offset + 2] - this.positions[otherOffset + 2];
            const distanceSquared = rx * rx + ry * ry + rz * rz;
            if (distanceSquared < this.radiusSquared) visit(other, rx, ry, rz, distanceSquared);
          }
        }
      }
    }
  }
}
