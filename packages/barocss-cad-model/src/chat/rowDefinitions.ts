// Row schema metadata has no document, tool or evaluator dependencies.
export const ROW_KINDS = ['fits', 'bearings', 'orings', 'rings', 'drives', 'sections', 'stock', 'frame-stock', 'bend', 'connectors'] as const;
export type RowKind = typeof ROW_KINDS[number];
