import { FLUID_SMOOTHING_RADIUS_M } from './constants.js';

export type NeighborVisitor = (other: number, rx: number, ry: number, rz: number,
  distanceSquared: number) => void;

export class NeighborGrid {
  private readonly cells = new Map<string, number[]>();
  private positions: Float64Array = new Float64Array(0);
  private readonly radiusSquared = FLUID_SMOOTHING_RADIUS_M ** 2;

  rebuild(positions: Float64Array): void {
    this.cells.clear();
    this.positions = positions;
    for (let index = 0; index < positions.length / 3; index++) {
      const offset = index * 3;
      const x = Math.floor(positions[offset] / FLUID_SMOOTHING_RADIUS_M);
      const y = Math.floor(positions[offset + 1] / FLUID_SMOOTHING_RADIUS_M);
      const z = Math.floor(positions[offset + 2] / FLUID_SMOOTHING_RADIUS_M);
      const key = `${x},${y},${z}`;
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(index);
      else this.cells.set(key, [index]);
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
          const bucket = this.cells.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!bucket) continue;
          for (const other of bucket) {
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
