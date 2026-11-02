import type { ClothDiagnostics, ClothSheet } from './types.js';
export declare function clothDiagnostics(sheet: ClothSheet): ClothDiagnostics;
export declare function withinClothBounds(positions: Float64Array, velocities: Float64Array, diagnostics: ClothDiagnostics): boolean;
