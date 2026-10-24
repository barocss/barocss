import { validatePreviewPacket } from '@barocss/cad';

const RADIUS_MM = 150, HALF_LINE_MM = 350, SECTORS = 24, END_SEGMENTS = 8;

/** An approximate, explicitly derived display mesh. It has no native CAD face authority. */
export function createCapsulePacket() {
  const positions = [0, -HALF_LINE_MM - RADIUS_MM, 0], normals = [0, -1, 0], parameters = [0, 0];
  const indices = [];
  const ring = (latitude, centreY, v) => {
    const radial = Math.cos(latitude), vertical = Math.sin(latitude);
    for (let sector = 0; sector < SECTORS; sector++) {
      const angle = sector * 2 * Math.PI / SECTORS, x = radial * Math.cos(angle), z = radial * Math.sin(angle);
      positions.push(RADIUS_MM * x, centreY + RADIUS_MM * vertical, RADIUS_MM * z);
      normals.push(x, vertical, z); parameters.push(sector / SECTORS, v);
    }
  };
  for (let segment = 1; segment <= END_SEGMENTS; segment++) {
    ring(-Math.PI / 2 + segment * Math.PI / (2 * END_SEGMENTS), -HALF_LINE_MM, segment / 17);
  }
  for (let segment = 0; segment < END_SEGMENTS; segment++) {
    ring(segment * Math.PI / (2 * END_SEGMENTS), HALF_LINE_MM, (9 + segment) / 17);
  }
  const top = positions.length / 3;
  positions.push(0, HALF_LINE_MM + RADIUS_MM, 0); normals.push(0, 1, 0); parameters.push(0, 1);
  for (let sector = 0; sector < SECTORS; sector++) {
    const next = (sector + 1) % SECTORS;
    indices.push(0, 1 + sector, 1 + next);
    for (let row = 0; row < 15; row++) {
      const a = 1 + row * SECTORS + sector, b = a + SECTORS;
      const c = 1 + row * SECTORS + next, d = c + SECTORS;
      indices.push(a, b, c, b, d, c);
    }
    indices.push(1 + 15 * SECTORS + sector, top, 1 + 15 * SECTORS + next);
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let vertex = 0; vertex < positions.length / 3; vertex++) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], positions[vertex * 3 + axis]); max[axis] = Math.max(max[axis], positions[vertex * 3 + axis]);
  }
  const packet = {
    version: 0, surfaceId: 'capsule-derived', revision: 0, lengthUnit: 'mm',
    coordinateSystem: 'right-handed-z-up', winding: 'ccw', positions, normals, indices, parameters, bounds: { min, max },
  };
  validatePreviewPacket(packet);
  return { modelId: 'physics-character', packet };
}
