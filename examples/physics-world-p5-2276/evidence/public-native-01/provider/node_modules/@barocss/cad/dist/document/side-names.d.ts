/** A sketch's tags: one per side of its outer loop, of each region loop and of each hole loop, unique in the sketch. */
export interface SideTags {
    readonly outer: readonly string[];
    readonly regions?: readonly (readonly string[])[];
    readonly holes?: readonly (readonly string[])[];
}
/** The authored segment i's side name under `prefix`: by its tag, or by position. */
export declare const sideName: (prefix: string, i: number, tags?: readonly string[]) => string;
/** A tag: letters, digits, `_` or `-`, 1 to 32 of them. */
export declare const SIDE_TAG: RegExp;
