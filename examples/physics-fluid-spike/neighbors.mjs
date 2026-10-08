export class NeighborGrid {
  constructor(radiusM) {
    this.radiusM = radiusM;
    this.radiusSquared = radiusM * radiusM;
    this.cells = new Map();
    this.positions = null;
  }

  rebuild(positions) {
    this.cells.clear();
    this.positions = positions;
    for (let index = 0; index < positions.length / 3; index++) {
      const offset = index * 3;
      const cell = [0, 1, 2].map((axis) => Math.floor(positions[offset + axis] / this.radiusM));
      const key = cell.join(',');
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(index);
      else this.cells.set(key, [index]);
    }
  }

  each(index, visit) {
    const positions = this.positions;
    const offset = index * 3;
    const cx = Math.floor(positions[offset] / this.radiusM);
    const cy = Math.floor(positions[offset + 1] / this.radiusM);
    const cz = Math.floor(positions[offset + 2] / this.radiusM);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const bucket = this.cells.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!bucket) continue;
          for (const other of bucket) {
            const otherOffset = other * 3;
            const rx = positions[offset] - positions[otherOffset];
            const ry = positions[offset + 1] - positions[otherOffset + 1];
            const rz = positions[offset + 2] - positions[otherOffset + 2];
            const distanceSquared = rx * rx + ry * ry + rz * rz;
            if (distanceSquared < this.radiusSquared) visit(other, rx, ry, rz, distanceSquared);
          }
        }
      }
    }
  }
}
