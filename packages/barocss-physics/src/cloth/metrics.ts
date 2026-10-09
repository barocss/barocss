import { CLOTH_PROFILE } from './profile.js';
import type { ClothDiagnostics, ClothSheet } from './types.js';

export function clothDiagnostics(sheet: ClothSheet): ClothDiagnostics {
  const p = sheet.positions;
  let maxStructuralExtension = 0, maxStructuralCompression = 0;
  let maxVertexPenetrationM = 0, maxPinDriftM = 0;
  for (const edge of sheet.constraints) {
    if (edge.kind !== 'stretch') continue;
    const length = Math.hypot(...[0, 1, 2].map(axis => p[3 * edge.a + axis] - p[3 * edge.b + axis]));
    const strain = length / edge.rest - 1;
    maxStructuralExtension = Math.max(maxStructuralExtension, strain);
    maxStructuralCompression = Math.max(maxStructuralCompression, -strain);
  }
  for (let i = 0; i < p.length / 3; i++) {
    const distance = Math.hypot(...[0, 1, 2].map(axis => p[3 * i + axis] - CLOTH_PROFILE.sphereCentreM[axis]));
    maxVertexPenetrationM = Math.max(maxVertexPenetrationM,
      CLOTH_PROFILE.sphereRadiusM + CLOTH_PROFILE.collisionOffsetM - distance);
  }
  for (const pin of sheet.pins) maxPinDriftM = Math.max(maxPinDriftM,
    Math.hypot(...[0, 1, 2].map(axis => p[3 * pin + axis] - sheet.restPositions[3 * pin + axis])));
  return { maxStructuralExtension, maxStructuralCompression, maxVertexPenetrationM,
    maxPinDriftM, totalMassKg: sheet.totalMassKg };
}

export function withinClothBounds(positions: Float64Array, velocities: Float64Array,
  diagnostics: ClothDiagnostics): boolean {
  return positions.every(value => Number.isFinite(value) && Math.abs(value) <= 10)
    && velocities.every(value => Number.isFinite(value) && Math.abs(value) <= 1000)
    && Object.values(diagnostics).every(Number.isFinite)
    && diagnostics.maxStructuralExtension <= 0.10
    && diagnostics.maxVertexPenetrationM <= 1e-6 && diagnostics.maxPinDriftM === 0;
}
