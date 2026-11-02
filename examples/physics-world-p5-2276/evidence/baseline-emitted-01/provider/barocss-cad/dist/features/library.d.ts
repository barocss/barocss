import type { CadPartFeature } from '../part/part-model.js';
import { KernelError } from '../core/barocss-error.js';
export type CadLibraryErrorCode = 'FORMAT' | 'PARAMETER' | 'EXPRESSION' | 'REFERENCE' | 'RECIPE' | 'VERSION';
export declare class CadLibraryError extends KernelError {
    readonly code: CadLibraryErrorCode;
    readonly where: string;
    constructor(code: CadLibraryErrorCode, where: string, detail: string);
}
/** A parameter: its value (or an expression over earlier ones), unit, limits, and where the value comes from. */
export interface CadLibraryParameter {
    readonly value: number | {
        readonly expr: string;
    };
    readonly unit?: 'mm' | 'deg' | 'count' | 'ratio';
    readonly min?: number;
    readonly max?: number;
    /** Whole numbers only (counts). */
    readonly integer?: boolean;
    /** Where the value comes from (a datasheet, a standard's table by its number, a measurement); required unless `estimate`. */
    readonly source?: string;
    /** A value not taken from a source: said so wherever the part is used. */
    readonly estimate?: boolean;
    readonly description?: string;
}
/** A rule over a part's values (R6b): met when `expr` holds; `value` the quantity it is about, for the report. */
export interface CadLibraryCheck {
    readonly id: string;
    readonly expr: string;
    readonly level: 'recommended' | 'feasible';
    readonly message: string;
    readonly value?: string;
}
/** A quantity a part reports (R6b.3): a force, a ratio — an expression over its values and context, with its unit. */
export interface CadLibraryReport {
    readonly id: string;
    readonly value: string;
    readonly unit?: string;
    readonly message: string;
}
/** A reported quantity as evaluated: its value, or unknown (null) when its context was not given, why in `unknown`. */
export interface CadLibraryReportResult {
    readonly id: string;
    readonly value: number | null;
    readonly unit?: string;
    readonly message: string;
    readonly unknown?: string;
}
/** A rule as evaluated for an instance: met, not met, or unknown (`pass` null) when its context was not given — why in `unknown`. */
export interface CadLibraryCheckResult {
    readonly id: string;
    readonly level: 'recommended' | 'feasible';
    readonly pass: boolean | null;
    readonly message: string;
    readonly value?: number;
    readonly unknown?: string;
}
/** A named row of the parameter table (a size: 20×20, 20×40). */
export interface CadLibraryVariant {
    readonly id: string;
    readonly name?: string;
    readonly values: Readonly<Record<string, number>>;
}
/** A recipe step: a part-model feature whose numbers may be `{ expr }`, kept only when `when` (an expression) is true. */
export type CadLibraryRecipeFeature = Readonly<Record<string, unknown>> & {
    readonly id: string;
    readonly kind: string;
    readonly when?: string;
};
/**
 * A named mating interface (LIB2, D62): its role, the roles it accepts, its frame in the part's own coordinates —
 * `origin`, `z` (out of the part: the mating face's outward normal, or an axis) and `x` (along it), numbers or
 * expressions — and the faces mates are made on, by key (`plane`, `side`, `axis`, …) and their part-model names.
 */
export interface CadLibraryInterface {
    readonly id: string;
    readonly role: string;
    readonly accepts?: readonly string[];
    readonly frame: {
        readonly origin: readonly unknown[];
        readonly z: readonly unknown[];
        readonly x: readonly unknown[];
    };
    readonly faces?: Readonly<Record<string, string>>;
    /** Present only when this holds (an interface on a slot left closed is not there). */
    readonly when?: string;
    readonly description?: string;
}
/** One end of a declared fit: a part (its variant and values) and one of its interfaces. */
export interface CadLibraryFitEnd {
    readonly part: string;
    readonly variant?: string;
    readonly params?: Readonly<Record<string, number>>;
    readonly interface: string;
}
/**
 * A fit the library declares (LIB2): `b` placed by its interface onto `a`'s — frames facing, x along x — moved by
 * `offset` (in a's interface frame), and the overlap of the two at most `maxOverlap` (default 1e-6: touching).
 */
export interface CadLibraryFit {
    readonly id: string;
    readonly a: CadLibraryFitEnd;
    readonly b: CadLibraryFitEnd;
    readonly offset?: readonly number[];
    readonly maxOverlap?: number;
    readonly description?: string;
    /** Rules over both parts' values (R6b.3), `a_<parameter>` and `b_<parameter>`: a snap hook's undercut against its catch's ledge. */
    readonly checks?: readonly {
        readonly id: string;
        readonly expr: string;
        readonly value?: string;
        readonly message: string;
    }[];
}
export interface CadLibraryPart {
    readonly id: string;
    readonly name: string;
    readonly category?: string;
    readonly description?: string;
    readonly parameters: Readonly<Record<string, CadLibraryParameter>>;
    readonly variants?: readonly CadLibraryVariant[];
    readonly recipe: readonly CadLibraryRecipeFeature[];
    /** The recipe features whose bodies are the part (default: the last). */
    readonly outputs?: readonly string[];
    readonly interfaces?: readonly CadLibraryInterface[];
    /** Simplified internals: the part is not for structural calculation, and says so. */
    readonly simplified?: boolean;
    /**
     * Rules over its values (R6b, D65): process rules as data. `recommended` ones that fail are warnings on the part;
     * `feasible` ones that fail refuse it (PARAMETER). Each `expr` holds (non-zero) when the rule is met; `value`, an
     * optional expression, is the margin reported with it.
     */
    readonly checks?: readonly CadLibraryCheck[];
    /** Quantities it reports (R6b.3: a snap hook's push-on force), over its values and context. */
    readonly reports?: readonly CadLibraryReport[];
    /**
     * What its checks need from where it goes (R6b, D65): the nominal wall of the body it is added to, its material's
     * values… — given at insertion (`instantiateLibraryPart`'s `context`); checks only read them (the geometry does
     * not), and a check reading one not given is unknown, with why, never passed.
     */
    readonly context?: Readonly<Record<string, {
        readonly unit?: string;
        readonly description?: string;
        readonly from?: readonly string[];
    }>>;
    /** Added to a body (R6b): united with it (`add`, the default: a boss) or taken from it (`cut`: an insert's hole). */
    readonly operation?: 'add' | 'cut';
    readonly tags?: readonly string[];
}
export interface CadLibraryManifest {
    readonly format: 'barocss-cad-library';
    readonly version: 1;
    readonly id: string;
    readonly name: string;
    /** The library's own version (major.minor.patch): inserted parts record it (LIB3). */
    readonly libraryVersion: string;
    readonly units: 'mm';
    readonly license?: string;
    readonly description?: string;
    /** Where the data comes from, as a whole; per value in each parameter's `source`. */
    readonly provenance?: string;
    readonly parts: readonly CadLibraryPart[];
    /** Fits of its parts' interfaces, checked by the library's own tests (`checkLibraryFit`). */
    readonly fits?: readonly CadLibraryFit[];
}
/**
 * What an instance is: the library, its version, the part, the variant, the values the caller gave (`params`: what is
 * kept when it is made again — a newer version's defaults and rows apply to the rest) and every value used (`values`).
 */
export interface CadLibraryOrigin {
    readonly library: string;
    readonly version: string;
    readonly part: string;
    readonly variant?: string;
    readonly params: Readonly<Record<string, number>>;
    readonly values: Readonly<Record<string, number>>;
}
export interface CadLibraryInstance {
    readonly features: CadPartFeature[];
    /** The ids (prefixed) of the features whose bodies are the part. */
    readonly outputs: readonly string[];
    readonly origin: CadLibraryOrigin;
    /** Parameters used whose values are estimates, and the part's own caveats (simplified internals). */
    readonly warnings: readonly string[];
    /** The interfaces with their expressions evaluated (ids prefixed), for LIB2. */
    readonly interfaces: readonly CadLibraryInterface[];
    /** The part's rules as evaluated (R6b): all of them, met or not (a failed feasible one refuses the instance). */
    readonly checks: readonly CadLibraryCheckResult[];
    /** Its reported quantities as evaluated. */
    readonly reports: readonly CadLibraryReportResult[];
    /** Every parameter's value, derived ones too (fits' checks read them). */
    readonly values: Readonly<Record<string, number>>;
}
/** This kernel's version, recorded with a library's sharing check (kept equal to package.json's by a test). */
export declare const CAD_KERNEL_VERSION = "0.0.0-experimental";
/**
 * Recipe kinds that carry another model's geometry (a STEP file, a mesh, sewn surfaces): never part of a library — a
 * model downloaded from elsewhere stays an import in the user's own document, not a shared catalogue part (peer, LIB4).
 */
export declare const LIBRARY_REFUSED_KINDS: ReadonlySet<string>;
/** Limits of what a library may hold (data, not a program). */
export declare const CadLibraryLimits: {
    readonly parts: 500;
    readonly parameters: 200;
    readonly variants: 200;
    readonly recipe: 200;
    readonly expression: 500;
    readonly depth: 32;
    readonly idLength: 64;
};
type Node = {
    readonly k: 'num';
    readonly v: number;
} | {
    readonly k: 'var';
    readonly name: string;
} | {
    readonly k: 'un';
    readonly op: '-' | '!';
    readonly a: Node;
} | {
    readonly k: 'bin';
    readonly op: string;
    readonly a: Node;
    readonly b: Node;
} | {
    readonly k: 'if';
    readonly c: Node;
    readonly a: Node;
    readonly b: Node;
} | {
    readonly k: 'call';
    readonly fn: string;
    readonly args: readonly Node[];
};
/** An expression's tree, or a typed refusal (EXPRESSION) saying where it stops. */
export declare function parseLibraryExpression(text: string, where?: string): Node;
/** The names an expression reads. */
export declare function expressionNames(node: Node, out?: Set<string>): Set<string>;
/** An expression's value over `values`; a name not there, or a result not finite, is refused. */
export declare function evaluateLibraryExpression(node: Node, values: Readonly<Record<string, number>>, where?: string): number;
/** A loaded library: checked, its expressions parsed. */
export interface CadLibrary {
    readonly manifest: CadLibraryManifest;
    readonly parts: ReadonlyMap<string, LoadedPart>;
}
interface LoadedPart {
    readonly part: CadLibraryPart;
    readonly order: readonly string[];
    readonly exprs: ReadonlyMap<string, Node>;
}
/**
 * A library from its JSON (text or parsed), checked: the manifest's shape and version; each part's parameters (finite
 * values within their limits; a source for every value not flagged an estimate; derived values over earlier
 * parameters, without cycles); its variants (known parameters); its recipe (unique ids, known references, every
 * expression parsed and reading only parameters). Refusals are typed (CadLibraryError).
 */
export declare function loadCadLibrary(input: unknown): CadLibrary;
/**
 * A part's features for these parameter values: the defaults, then the variant's row, then the values given (only
 * given parameters, each within its limits and whole when it counts); derived parameters worked out; each recipe
 * feature kept when its `when` holds, its expressions replaced by numbers, its id and its references (features, face
 * and edge names) prefixed with `prefix` (default the part's id). The features carry nothing of the library; the
 * caller records `origin` with them (LIB3).
 */
export declare function instantiateLibraryPart(lib: CadLibrary, partId: string, options?: {
    readonly variant?: string;
    readonly params?: Readonly<Record<string, number>>;
    readonly prefix?: string;
    readonly context?: Readonly<Record<string, number>>;
}): CadLibraryInstance;
export {};
