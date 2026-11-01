import { type FrameSectionSpec } from '../frame-sheet/frame-section.js';
export type SectionTableKind = 'rect-tube' | 'round-tube' | 'angle' | 'channel' | 'i-beam' | 'tslot';
export interface SectionTableRow {
    readonly size: string;
    readonly source?: string;
    readonly estimate?: boolean;
    readonly [dimension: string]: unknown;
}
export interface SectionTable {
    readonly id: string;
    readonly kind: SectionTableKind;
    readonly label?: string;
    /** The table's source (a catalogue page: URL, date read), or `estimate` — a row's own takes its place. */
    readonly source?: string;
    readonly estimate?: boolean;
    readonly rows: readonly SectionTableRow[];
}
/** Why a section table is not one, or null. */
export declare function sectionTableProblem(t: unknown): string | null;
/** A size from a table (checked first): its spec, and whether it is an estimate and where from; or the miss, naming the sizes held. */
export declare function lookupSection(t: SectionTable, size: string): {
    readonly spec: FrameSectionSpec;
    readonly estimate: boolean;
    readonly source?: string;
} | {
    readonly miss: string;
};
