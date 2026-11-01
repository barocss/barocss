import type { RawNurbsSurface } from './spec.js';
/** Internal admission for the six-field whole-surface facade payload. */
export declare function surfaceSnapshot(value: RawNurbsSurface, label?: string): RawNurbsSurface;
/** Internal ordered admission for a Sew recipe; no caller array or coefficient is retained. */
export declare function surfaceSnapshots(value: readonly RawNurbsSurface[]): readonly RawNurbsSurface[];
