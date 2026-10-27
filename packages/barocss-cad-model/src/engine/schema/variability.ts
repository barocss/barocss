// The document's variability schema (O11): an assembly's inputs — each a name, a type, a unit, a range and a default —
// bound explicitly to what they drive (a part's parameter, a feature's suppression, which part a placed instance uses,
// a mate's value), and its variants, named sets of input values. The master document is the default variant; a
// variant is regenerated from it (assembly/variability.ts) and never stored as its own model.

export type InputValue = number | boolean | string;
export type InputType = 'number' | 'boolean' | 'choice';

/** What an input drives. `part`: 'base' (the root document) or a placed instance's id. */
export type Binding =
  /** A number input: the parameter set to scale·v + offset. */
  | { to: 'parameter'; part: string; parameter: string; scale?: number; offset?: number }
  /** A boolean or choice input: the feature (by its stable id) suppressed when the value is `when` (or one of them). */
  | { to: 'suppress'; part: string; feature: string; when: boolean | string[] }
  /** A choice input: the instance uses another instance's part, or a shipped library part, for each choice. */
  | { to: 'component'; instance: string; options: Record<string, ComponentOption> }
  /** A number input: the mate's distance (mm) or angle (degrees). */
  | { to: 'mate'; mate: string; field: 'distance' | 'angle' };

/** A component choice: the part `like` another placed instance's, or a part of a shipped library (as insert_part makes it). */
export type ComponentOption = { like: string } | { library: string; part: string; variant?: string; params?: Record<string, number> };

export interface Input {
  name: string;
  type: InputType;
  unit?: 'mm' | 'deg';
  min?: number; max?: number;
  /** A choice input's values (a label to show, optional). */
  choices?: { value: string; label?: string }[];
  /** The value the master document is: bound targets in the master hold what the default gives them. */
  default: InputValue;
  bindings: Binding[];
}

export interface Variant { name: string; values: Record<string, InputValue> }

export interface Variability { version: 1; inputs: Input[]; variants?: Variant[]; active?: string }
