// LIB1 (D61): part libraries as data. A library is a manifest of parts. Each part is a table of named parameters —
// each with a value and its source, or flagged an estimate — optional variants (rows of the table), and a recipe of
// existing part-model features whose numbers may be expressions in a small, safe language: no code is run, only
// arithmetic, comparisons, a conditional and a few functions over the parameters. Libraries are checked on load,
// refused with typed errors; a part is instantiated to ordinary part-model features (its ids prefixed) carrying where
// they came from.
import type { CadPartFeature } from './part-model.js';

export type CadLibraryErrorCode = 'FORMAT' | 'PARAMETER' | 'EXPRESSION' | 'REFERENCE' | 'RECIPE' | 'VERSION';
export class CadLibraryError extends Error {
  constructor(readonly code: CadLibraryErrorCode, readonly where: string, detail: string) { super(`library: ${where ? `${where}: ` : ''}${detail}`.slice(0, 1024)); this.name = 'CadLibraryError'; }
}

/** A parameter: its value (or an expression over earlier ones), unit, limits, and where the value comes from. */
export interface CadLibraryParameter {
  readonly value: number | { readonly expr: string };
  readonly unit?: 'mm' | 'deg' | 'count' | 'ratio';
  readonly min?: number; readonly max?: number;
  /** Whole numbers only (counts). */
  readonly integer?: boolean;
  /** Where the value comes from (a datasheet, a standard's table by its number, a measurement); required unless `estimate`. */
  readonly source?: string;
  /** A value not taken from a source: said so wherever the part is used. */
  readonly estimate?: boolean;
  readonly description?: string;
}
/** A named row of the parameter table (a size: 20×20, 20×40). */
export interface CadLibraryVariant { readonly id: string; readonly name?: string; readonly values: Readonly<Record<string, number>> }
/** A recipe step: a part-model feature whose numbers may be `{ expr }`, kept only when `when` (an expression) is true. */
export type CadLibraryRecipeFeature = Readonly<Record<string, unknown>> & { readonly id: string; readonly kind: string; readonly when?: string };
/**
 * A named mating interface (LIB2, D62): its role, the roles it accepts, its frame in the part's own coordinates —
 * `origin`, `z` (out of the part: the mating face's outward normal, or an axis) and `x` (along it), numbers or
 * expressions — and the faces mates are made on, by key (`plane`, `side`, `axis`, …) and their part-model names.
 */
export interface CadLibraryInterface {
  readonly id: string; readonly role: string;
  readonly accepts?: readonly string[];
  readonly frame: { readonly origin: readonly unknown[]; readonly z: readonly unknown[]; readonly x: readonly unknown[] };
  readonly faces?: Readonly<Record<string, string>>;
  /** Present only when this holds (an interface on a slot left closed is not there). */
  readonly when?: string;
  readonly description?: string;
}
/** One end of a declared fit: a part (its variant and values) and one of its interfaces. */
export interface CadLibraryFitEnd { readonly part: string; readonly variant?: string; readonly params?: Readonly<Record<string, number>>; readonly interface: string }
/**
 * A fit the library declares (LIB2): `b` placed by its interface onto `a`'s — frames facing, x along x — moved by
 * `offset` (in a's interface frame), and the overlap of the two at most `maxOverlapMM3` (default 1e-6: touching).
 */
export interface CadLibraryFit { readonly id: string; readonly a: CadLibraryFitEnd; readonly b: CadLibraryFitEnd; readonly offset?: readonly number[]; readonly maxOverlapMM3?: number; readonly description?: string }
export interface CadLibraryPart {
  readonly id: string; readonly name: string; readonly category?: string; readonly description?: string;
  readonly parameters: Readonly<Record<string, CadLibraryParameter>>;
  readonly variants?: readonly CadLibraryVariant[];
  readonly recipe: readonly CadLibraryRecipeFeature[];
  /** The recipe features whose bodies are the part (default: the last). */
  readonly outputs?: readonly string[];
  readonly interfaces?: readonly CadLibraryInterface[];
  /** Simplified internals: the part is not for structural calculation, and says so. */
  readonly simplified?: boolean;
  readonly tags?: readonly string[];
}
export interface CadLibraryManifest {
  readonly format: 'barocss-cad-library'; readonly version: 1;
  readonly id: string; readonly name: string;
  /** The library's own version (major.minor.patch): inserted parts record it (LIB3). */
  readonly libraryVersion: string;
  readonly units: 'mm';
  readonly license?: string; readonly description?: string;
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
export interface CadLibraryOrigin { readonly library: string; readonly version: string; readonly part: string; readonly variant?: string; readonly params: Readonly<Record<string, number>>; readonly values: Readonly<Record<string, number>> }
export interface CadLibraryInstance {
  readonly features: CadPartFeature[];
  /** The ids (prefixed) of the features whose bodies are the part. */
  readonly outputs: readonly string[];
  readonly origin: CadLibraryOrigin;
  /** Parameters used whose values are estimates, and the part's own caveats (simplified internals). */
  readonly warnings: readonly string[];
  /** The interfaces with their expressions evaluated (ids prefixed), for LIB2. */
  readonly interfaces: readonly CadLibraryInterface[];
}

/** Limits of what a library may hold (data, not a program). */
export const CadLibraryLimits = { parts: 500, parameters: 200, variants: 200, recipe: 200, expression: 500, depth: 32, idLength: 64 } as const;

// ---- the expression language ---------------------------------------------------------------------------------------
// numbers, parameter names, + − * / % ^ (right-associative), unary −, comparisons < <= > >= == !=, && || !, the
// conditional c ? a : b, parentheses, and min max round floor ceil abs sqrt sin cos tan (degrees) atan2 (degrees) pi.
// Parsed once to a tree of plain records; evaluated by a switch. Booleans are 1 and 0.

type Node =
  | { readonly k: 'num'; readonly v: number }
  | { readonly k: 'var'; readonly name: string }
  | { readonly k: 'un'; readonly op: '-' | '!'; readonly a: Node }
  | { readonly k: 'bin'; readonly op: string; readonly a: Node; readonly b: Node }
  | { readonly k: 'if'; readonly c: Node; readonly a: Node; readonly b: Node }
  | { readonly k: 'call'; readonly fn: string; readonly args: readonly Node[] };
const FUNCTIONS: Readonly<Record<string, number>> = { min: -2, max: -2, round: 1, floor: 1, ceil: 1, abs: 1, sqrt: 1, sin: 1, cos: 1, tan: 1, atan2: 2 };
const TOKEN = /\s*(?:(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|==|!=|&&|\|\||[-+*/%^()<>?:,!]))/y;

/** An expression's tree, or a typed refusal (EXPRESSION) saying where it stops. */
export function parseLibraryExpression(text: string, where = ''): Node {
  if (typeof text !== 'string' || !text.trim()) throw new CadLibraryError('EXPRESSION', where, 'an expression must be non-empty text');
  if (text.length > CadLibraryLimits.expression) throw new CadLibraryError('EXPRESSION', where, `an expression is at most ${CadLibraryLimits.expression} characters`);
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  let at = 0;
  while (at < text.length) {
    if (/^\s*$/.test(text.slice(at))) break;
    TOKEN.lastIndex = at;
    const m = TOKEN.exec(text);
    if (!m) throw new CadLibraryError('EXPRESSION', where, `cannot read "${text.slice(at).trim().slice(0, 20)}" in ${JSON.stringify(text)}`);
    tokens.push(m[1] ?? m[2] ?? m[3]); at = TOKEN.lastIndex;
  }
  const p = new Parser(tokens, text, where), node = p.conditional(0);
  if (p.i < tokens.length) throw new CadLibraryError('EXPRESSION', where, `unexpected "${tokens[p.i]}" in ${JSON.stringify(text)}`);
  return node;
}
const BINARY: readonly (readonly string[])[] = [['||'], ['&&'], ['==', '!='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];
class Parser {
  i = 0;
  constructor(readonly t: readonly string[], readonly text: string, readonly where: string) {}
  fail(what: string): never { throw new CadLibraryError('EXPRESSION', this.where, `${what} in ${JSON.stringify(this.text)}`); }
  deep(depth: number) { if (depth > CadLibraryLimits.depth) this.fail(`nested deeper than ${CadLibraryLimits.depth}`); }
  conditional(depth: number): Node {
    this.deep(depth);
    const c = this.binary(0, depth);
    if (this.t[this.i] !== '?') return c;
    this.i++;
    const a = this.conditional(depth + 1);
    if (this.t[this.i] !== ':') this.fail('a conditional needs ":"');
    this.i++;
    return { k: 'if', c, a, b: this.conditional(depth + 1) };
  }
  binary(level: number, depth: number): Node {
    if (level === BINARY.length) return this.power(depth);
    let a = this.binary(level + 1, depth);
    while (this.i < this.t.length && BINARY[level].includes(this.t[this.i])) { const op = this.t[this.i++]; a = { k: 'bin', op, a, b: this.binary(level + 1, depth) }; }
    return a;
  }
  power(depth: number): Node {
    const a = this.unary(depth);
    if (this.t[this.i] !== '^') return a;
    this.i++;
    return { k: 'bin', op: '^', a, b: this.power(depth + 1) };
  }
  unary(depth: number): Node {
    this.deep(depth);
    const tok = this.t[this.i];
    if (tok === '-' || tok === '!') { this.i++; return { k: 'un', op: tok, a: this.unary(depth + 1) }; }
    if (tok === '+') { this.i++; return this.unary(depth + 1); }
    return this.atom(depth);
  }
  atom(depth: number): Node {
    const tok = this.t[this.i++];
    if (tok === undefined) this.fail('the expression ends early');
    if (tok === '(') { const a = this.conditional(depth + 1); if (this.t[this.i++] !== ')') this.fail('a "(" is not closed'); return a; }
    if (/^[\d.]/.test(tok)) return { k: 'num', v: Number(tok) };
    if (/^[A-Za-z_]/.test(tok)) {
      if (this.t[this.i] !== '(') return tok === 'pi' ? { k: 'num', v: Math.PI } : { k: 'var', name: tok };
      const arity = FUNCTIONS[tok];
      if (arity === undefined) this.fail(`unknown function ${tok}`);
      this.i++;
      const args: Node[] = [];
      if (this.t[this.i] !== ')') for (;;) { args.push(this.conditional(depth + 1)); if (this.t[this.i] === ',') { this.i++; continue; } break; }
      if (this.t[this.i++] !== ')') this.fail(`${tok}( is not closed`);
      if (arity > 0 ? args.length !== arity : args.length < -arity) this.fail(`${tok} takes ${arity > 0 ? arity : `at least ${-arity}`} argument${Math.abs(arity) > 1 ? 's' : ''}`);
      return { k: 'call', fn: tok, args };
    }
    return this.fail(`unexpected "${tok}"`);
  }
}
/** The names an expression reads. */
export function expressionNames(node: Node, out = new Set<string>()): Set<string> {
  switch (node.k) {
    case 'var': out.add(node.name); break;
    case 'un': expressionNames(node.a, out); break;
    case 'bin': expressionNames(node.a, out); expressionNames(node.b, out); break;
    case 'if': expressionNames(node.c, out); expressionNames(node.a, out); expressionNames(node.b, out); break;
    case 'call': for (const a of node.args) expressionNames(a, out); break;
  }
  return out;
}
const DEG = Math.PI / 180;
/** An expression's value over `values`; a name not there, or a result not finite, is refused. */
export function evaluateLibraryExpression(node: Node, values: Readonly<Record<string, number>>, where = ''): number {
  const v = evaluate(node, values, where);
  if (!Number.isFinite(v)) throw new CadLibraryError('EXPRESSION', where, `the expression's value is not a finite number (${v})`);
  return v;
}
function evaluate(n: Node, values: Readonly<Record<string, number>>, where: string): number {
  switch (n.k) {
    case 'num': return n.v;
    case 'var': { if (!Object.prototype.hasOwnProperty.call(values, n.name)) throw new CadLibraryError('REFERENCE', where, `no parameter ${n.name}`); return values[n.name]; }
    case 'un': { const a = evaluate(n.a, values, where); return n.op === '-' ? -a : a ? 0 : 1; }
    case 'if': return evaluate(n.c, values, where) ? evaluate(n.a, values, where) : evaluate(n.b, values, where);
    case 'call': {
      const a = n.args.map(x => evaluate(x, values, where));
      switch (n.fn) {
        case 'min': return Math.min(...a); case 'max': return Math.max(...a); case 'round': return Math.round(a[0]); case 'floor': return Math.floor(a[0]);
        case 'ceil': return Math.ceil(a[0]); case 'abs': return Math.abs(a[0]); case 'sqrt': return Math.sqrt(a[0]);
        case 'sin': return Math.sin(a[0] * DEG); case 'cos': return Math.cos(a[0] * DEG); case 'tan': return Math.tan(a[0] * DEG);
        default: return Math.atan2(a[0], a[1]) / DEG;
      }
    }
    case 'bin': {
      // (Logic short-circuits.)
      if (n.op === '&&') return evaluate(n.a, values, where) && evaluate(n.b, values, where) ? 1 : 0;
      if (n.op === '||') return evaluate(n.a, values, where) || evaluate(n.b, values, where) ? 1 : 0;
      const a = evaluate(n.a, values, where), b = evaluate(n.b, values, where);
      switch (n.op) {
        case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '%': return a % b; case '^': return a ** b;
        case '<': return a < b ? 1 : 0; case '<=': return a <= b ? 1 : 0; case '>': return a > b ? 1 : 0; case '>=': return a >= b ? 1 : 0;
        case '==': return a === b ? 1 : 0; default: return a !== b ? 1 : 0;
      }
    }
  }
}

// ---- loading -------------------------------------------------------------------------------------------------------

const ID = /^[A-Za-z][A-Za-z0-9_-]*$/, VARIANT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/, SEMVER = /^\d+\.\d+\.\d+$/;
/** Recipe keys that name other recipe features (renamed with the instance's prefix). */
const REFERENCE_KEYS = new Set(['sketch', 'target', 'tool', 'gear']);
/** Recipe keys holding face or edge names, `<feature>.<role>` joined by | or + (their feature ids renamed). */
const NAME_KEYS = new Set(['edges', 'faces', 'open']);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A loaded library: checked, its expressions parsed. */
export interface CadLibrary { readonly manifest: CadLibraryManifest; readonly parts: ReadonlyMap<string, LoadedPart> }
interface LoadedPart { readonly part: CadLibraryPart; readonly order: readonly string[]; readonly exprs: ReadonlyMap<string, Node> }

/**
 * A library from its JSON (text or parsed), checked: the manifest's shape and version; each part's parameters (finite
 * values within their limits; a source for every value not flagged an estimate; derived values over earlier
 * parameters, without cycles); its variants (known parameters); its recipe (unique ids, known references, every
 * expression parsed and reading only parameters). Refusals are typed (CadLibraryError).
 */
export function loadCadLibrary(input: unknown): CadLibrary {
  let m: unknown = input;
  if (typeof input === 'string') { try { m = JSON.parse(input); } catch (cause) { throw new CadLibraryError('FORMAT', '', `not JSON: ${(cause as Error).message}`); } }
  if (!isRecord(m)) throw new CadLibraryError('FORMAT', '', 'a library is a JSON object');
  if (m.format !== 'barocss-cad-library') throw new CadLibraryError('FORMAT', '', 'format must be "barocss-cad-library"');
  if (m.version !== 1) throw new CadLibraryError('VERSION', '', `library format version ${String(m.version)}: this kernel reads version 1`);
  if (typeof m.id !== 'string' || !ID.test(m.id) || m.id.length > CadLibraryLimits.idLength) throw new CadLibraryError('FORMAT', '', 'id must be a name (letters, digits, _ and -, starting with a letter)');
  if (typeof m.name !== 'string' || !m.name) throw new CadLibraryError('FORMAT', m.id as string, 'name must be text');
  if (typeof m.libraryVersion !== 'string' || !SEMVER.test(m.libraryVersion)) throw new CadLibraryError('VERSION', m.id as string, 'libraryVersion must be major.minor.patch');
  if (m.units !== 'mm') throw new CadLibraryError('FORMAT', m.id as string, 'units must be "mm"');
  if (!Array.isArray(m.parts) || !m.parts.length || m.parts.length > CadLibraryLimits.parts) throw new CadLibraryError('FORMAT', m.id as string, `parts must list 1 to ${CadLibraryLimits.parts} parts`);
  const parts = new Map<string, LoadedPart>();
  for (const p of m.parts as unknown[]) {
    const loaded = loadPart(p, m.id as string);
    if (parts.has(loaded.part.id)) throw new CadLibraryError('FORMAT', `${m.id}/${loaded.part.id}`, 'a part id appears twice');
    parts.set(loaded.part.id, loaded);
  }
  if (m.fits !== undefined) {
    if (!Array.isArray(m.fits)) throw new CadLibraryError('FORMAT', m.id as string, 'fits must be a list');
    const seen = new Set<string>();
    for (const fit of m.fits as unknown[]) {
      if (!isRecord(fit) || typeof fit.id !== 'string' || !ID.test(fit.id)) throw new CadLibraryError('FORMAT', m.id as string, 'a fit is { id, a, b, offset?, maxOverlapMM3? }');
      const at = `${m.id}~${fit.id}`;
      if (seen.has(fit.id)) throw new CadLibraryError('FORMAT', at, 'a fit id appears twice'); seen.add(fit.id);
      const ends = (['a', 'b'] as const).map(side => {
        const e = fit[side];
        if (!isRecord(e) || typeof e.part !== 'string' || typeof e.interface !== 'string') throw new CadLibraryError('FORMAT', `${at}.${side}`, 'an end is { part, variant?, params?, interface }');
        const lp = parts.get(e.part); if (!lp) throw new CadLibraryError('REFERENCE', `${at}.${side}`, `no part ${e.part}`);
        const itf = lp.part.interfaces?.find(i => i.id === e.interface); if (!itf) throw new CadLibraryError('REFERENCE', `${at}.${side}`, `${e.part} has no interface ${e.interface}`);
        if (e.variant !== undefined && !lp.part.variants?.some(v => v.id === e.variant)) throw new CadLibraryError('REFERENCE', `${at}.${side}`, `${e.part} has no variant ${String(e.variant)}`);
        return itf;
      });
      if (!(ends[0].accepts?.includes(ends[1].role) || ends[1].accepts?.includes(ends[0].role))) throw new CadLibraryError('REFERENCE', at, `${ends[0].role} and ${ends[1].role} do not accept each other`);
      if (fit.offset !== undefined && (!Array.isArray(fit.offset) || fit.offset.length !== 3 || fit.offset.some(x => typeof x !== 'number' || !Number.isFinite(x)))) throw new CadLibraryError('FORMAT', at, 'offset must be three numbers');
      if (fit.maxOverlapMM3 !== undefined && !(typeof fit.maxOverlapMM3 === 'number' && fit.maxOverlapMM3 >= 0)) throw new CadLibraryError('FORMAT', at, 'maxOverlapMM3 must be a number, 0 or more');
    }
  }
  return { manifest: m as unknown as CadLibraryManifest, parts };
}

function loadPart(p: unknown, lib: string): LoadedPart {
  if (!isRecord(p) || typeof p.id !== 'string' || !ID.test(p.id) || p.id.length > CadLibraryLimits.idLength) throw new CadLibraryError('FORMAT', lib, 'each part needs an id (a name)');
  const where = `${lib}/${p.id}`;
  if (typeof p.name !== 'string' || !p.name) throw new CadLibraryError('FORMAT', where, 'name must be text');
  if (!isRecord(p.parameters)) throw new CadLibraryError('FORMAT', where, 'parameters must be an object of named parameters');
  const names = Object.keys(p.parameters);
  if (names.length > CadLibraryLimits.parameters) throw new CadLibraryError('FORMAT', where, `at most ${CadLibraryLimits.parameters} parameters`);
  const exprs = new Map<string, Node>(), deps = new Map<string, Set<string>>();
  for (const name of names) {
    const q = p.parameters[name], at = `${where}.${name}`;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || name === 'pi' || name in FUNCTIONS) throw new CadLibraryError('PARAMETER', at, 'a parameter name is a word (letters, digits, _), not pi or a function name');
    if (!isRecord(q)) throw new CadLibraryError('PARAMETER', at, 'a parameter is { value, unit?, min?, max?, source? | estimate: true }');
    if (isRecord(q.value)) {
      const node = parseLibraryExpression(q.value.expr as string, at); exprs.set(`param:${name}`, node);
      const used = expressionNames(node);
      for (const u of used) if (!names.includes(u)) throw new CadLibraryError('REFERENCE', at, `reads ${u}, which is not a parameter`);
      deps.set(name, used);
    } else if (typeof q.value !== 'number' || !Number.isFinite(q.value)) throw new CadLibraryError('PARAMETER', at, 'value must be a finite number or { expr }');
    for (const k of ['min', 'max'] as const) if (q[k] !== undefined && (typeof q[k] !== 'number' || !Number.isFinite(q[k]))) throw new CadLibraryError('PARAMETER', at, `${k} must be a number`);
    if (q.estimate !== undefined && typeof q.estimate !== 'boolean') throw new CadLibraryError('PARAMETER', at, 'estimate must be true or false');
    // (Provenance: a value given outright has a source or says it is an estimate; a derived one follows its inputs.)
    if (!isRecord(q.value) && q.estimate !== true && (typeof q.source !== 'string' || !q.source.trim())) throw new CadLibraryError('PARAMETER', at, 'a value needs its source, or estimate: true');
  }
  // Derived parameters in an order that has their inputs first (a cycle is refused).
  const order: string[] = [], state = new Map<string, 1 | 2>();
  const visit = (name: string, trail: string[]) => {
    if (state.get(name) === 2) return;
    if (state.get(name) === 1) throw new CadLibraryError('REFERENCE', `${where}.${name}`, `parameters depend on each other in a cycle: ${[...trail, name].join(' → ')}`);
    state.set(name, 1);
    for (const d of deps.get(name) ?? []) visit(d, [...trail, name]);
    state.set(name, 2); order.push(name);
  };
  for (const name of names) visit(name, []);
  // Variants.
  if (p.variants !== undefined) {
    if (!Array.isArray(p.variants) || p.variants.length > CadLibraryLimits.variants) throw new CadLibraryError('FORMAT', where, `variants must list at most ${CadLibraryLimits.variants}`);
    const seen = new Set<string>();
    for (const v of p.variants as unknown[]) {
      // (A variant may be named by its size: 2020.)
      if (!isRecord(v) || typeof v.id !== 'string' || !VARIANT_ID.test(v.id) || !isRecord(v.values)) throw new CadLibraryError('FORMAT', where, 'a variant is { id, name?, values }, its id letters, digits, _ and -');
      if (seen.has(v.id)) throw new CadLibraryError('FORMAT', `${where}@${v.id}`, 'a variant id appears twice'); seen.add(v.id);
      for (const [k, x] of Object.entries(v.values)) {
        if (!names.includes(k)) throw new CadLibraryError('REFERENCE', `${where}@${v.id}`, `sets ${k}, which is not a parameter`);
        if (isRecord((p.parameters as Record<string, CadLibraryParameter>)[k].value)) throw new CadLibraryError('PARAMETER', `${where}@${v.id}`, `${k} is derived; a variant sets given values only`);
        if (typeof x !== 'number' || !Number.isFinite(x)) throw new CadLibraryError('PARAMETER', `${where}@${v.id}`, `${k} must be a finite number`);
      }
    }
  }
  // The recipe.
  if (!Array.isArray(p.recipe) || !p.recipe.length || p.recipe.length > CadLibraryLimits.recipe) throw new CadLibraryError('RECIPE', where, `recipe must list 1 to ${CadLibraryLimits.recipe} features`);
  const ids = new Set<string>();
  (p.recipe as unknown[]).forEach((f, i) => {
    if (!isRecord(f) || typeof f.id !== 'string' || !ID.test(f.id) || typeof f.kind !== 'string') throw new CadLibraryError('RECIPE', `${where}#${i}`, 'a recipe feature is { id, kind, … }');
    const at = `${where}:${f.id}`;
    if (ids.has(f.id)) throw new CadLibraryError('RECIPE', at, 'a feature id appears twice');
    if (f.when !== undefined) { const node = parseLibraryExpression(f.when as string, `${at}.when`); checkNames(node, names, `${at}.when`); exprs.set(`when:${f.id}`, node); }
    walkRecipe(f, (value, key, path) => {
      if (isRecord(value) && 'expr' in value) {
        if (Object.keys(value).length !== 1) throw new CadLibraryError('EXPRESSION', `${at}.${path}`, '{ expr } takes nothing else');
        const node = parseLibraryExpression(value.expr as string, `${at}.${path}`); checkNames(node, names, `${at}.${path}`); exprs.set(`${f.id}:${path}`, node);
        return true;
      }
      if (typeof value === 'string' && REFERENCE_KEYS.has(key) && !ids.has(value.split('/')[0])) throw new CadLibraryError('REFERENCE', `${at}.${path}`, `${value} is not an earlier feature of the recipe`);
      return false;
    });
    ids.add(f.id);
  });
  if (p.outputs !== undefined && (!Array.isArray(p.outputs) || !p.outputs.length || p.outputs.some(o => typeof o !== 'string' || !ids.has(o.split('/')[0])))) throw new CadLibraryError('REFERENCE', where, 'outputs must name recipe features');
  if (p.interfaces !== undefined) {
    if (!Array.isArray(p.interfaces)) throw new CadLibraryError('FORMAT', where, 'interfaces must be a list');
    const seen = new Set<string>();
    for (const itf of p.interfaces as unknown[]) {
      if (!isRecord(itf) || typeof itf.id !== 'string' || !ID.test(itf.id) || typeof itf.role !== 'string' || !itf.role) throw new CadLibraryError('FORMAT', where, 'an interface is { id, role, frame: { origin, z, x }, faces?, accepts? }');
      if (seen.has(itf.id)) throw new CadLibraryError('FORMAT', `${where}.${itf.id}`, 'an interface id appears twice'); seen.add(itf.id);
      const fr = itf.frame;
      if (!isRecord(fr) || !(['origin', 'z', 'x'] as const).every(k => Array.isArray(fr[k]) && (fr[k] as unknown[]).length === 3 && (fr[k] as unknown[]).every(c => typeof c === 'number' ? Number.isFinite(c) : isRecord(c) && typeof c.expr === 'string')))
        throw new CadLibraryError('FORMAT', `${where}.${itf.id}`, 'frame must be { origin, z, x }, each three numbers or { expr }');
      if (itf.when !== undefined) { const node = parseLibraryExpression(itf.when as string, `${where}.${itf.id}.when`); checkNames(node, names, `${where}.${itf.id}.when`); exprs.set(`itfwhen:${itf.id}`, node); }
      if (itf.accepts !== undefined && (!Array.isArray(itf.accepts) || itf.accepts.some(r => typeof r !== 'string'))) throw new CadLibraryError('FORMAT', `${where}.${itf.id}`, 'accepts must list roles');
      if (itf.faces !== undefined) {
        if (!isRecord(itf.faces)) throw new CadLibraryError('FORMAT', `${where}.${itf.id}`, 'faces must map keys to face names');
        for (const [k, name] of Object.entries(itf.faces)) if (typeof name !== 'string' || !ids.has(name.split('.')[0])) throw new CadLibraryError('REFERENCE', `${where}.${itf.id}.faces.${k}`, `${String(name)} is not a face of a recipe feature (<feature>.<face>)`);
      }
      walkRecipe(itf, (value, _key, path) => {
        if (!isRecord(value) || !('expr' in value)) return false;
        const node = parseLibraryExpression(value.expr as string, `${where}.${itf.id}.${path}`); checkNames(node, names, `${where}.${itf.id}.${path}`); exprs.set(`itf:${itf.id}:${path}`, node);
        return true;
      });
    }
  }
  return { part: p as unknown as CadLibraryPart, order, exprs };
}
function checkNames(node: Node, names: readonly string[], at: string): void {
  for (const u of expressionNames(node)) if (!names.includes(u)) throw new CadLibraryError('REFERENCE', at, `reads ${u}, which is not a parameter`);
}
/** Every value under a record or list with its key and dotted path; `visit` returning true stops the descent there. */
function walkRecipe(value: unknown, visit: (value: unknown, key: string, path: string) => boolean, key = '', path = ''): void {
  if (path && visit(value, key, path)) return;
  if (Array.isArray(value)) value.forEach((x, i) => walkRecipe(x, visit, key, `${path}[${i}]`));
  else if (isRecord(value)) for (const [k, x] of Object.entries(value)) if (!(path === '' && (k === 'id' || k === 'when'))) walkRecipe(x, visit, k, path ? `${path}.${k}` : k);
}

// ---- instantiating -------------------------------------------------------------------------------------------------

/**
 * A part's features for these parameter values: the defaults, then the variant's row, then the values given (only
 * given parameters, each within its limits and whole when it counts); derived parameters worked out; each recipe
 * feature kept when its `when` holds, its expressions replaced by numbers, its id and its references (features, face
 * and edge names) prefixed with `prefix` (default the part's id). The features carry nothing of the library; the
 * caller records `origin` with them (LIB3).
 */
export function instantiateLibraryPart(lib: CadLibrary, partId: string, options: { readonly variant?: string; readonly params?: Readonly<Record<string, number>>; readonly prefix?: string } = {}): CadLibraryInstance {
  const loaded = lib.parts.get(partId);
  if (!loaded) throw new CadLibraryError('REFERENCE', lib.manifest.id, `no part ${partId} (parts: ${[...lib.parts.keys()].slice(0, 20).join(', ')})`);
  const { part, order, exprs } = loaded, where = `${lib.manifest.id}/${part.id}`;
  const prefix = options.prefix ?? part.id;
  if (!ID.test(prefix)) throw new CadLibraryError('FORMAT', where, `prefix ${prefix} must be a name`);
  const given: Record<string, number> = {};
  let variant: CadLibraryVariant | undefined;
  if (options.variant !== undefined) {
    variant = part.variants?.find(v => v.id === options.variant);
    if (!variant) throw new CadLibraryError('REFERENCE', where, `no variant ${options.variant} (variants: ${(part.variants ?? []).map(v => v.id).join(', ') || 'none'})`);
  }
  for (const [k, v] of Object.entries(options.params ?? {})) {
    const q = part.parameters[k];
    if (!q) throw new CadLibraryError('REFERENCE', where, `no parameter ${k}`);
    if (isRecord(q.value)) throw new CadLibraryError('PARAMETER', `${where}.${k}`, 'is derived from other parameters: set those');
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new CadLibraryError('PARAMETER', `${where}.${k}`, 'must be a finite number');
    given[k] = v;
  }
  const values: Record<string, number> = {}, warnings: string[] = [], used: Record<string, number> = {};
  for (const name of order) {
    const q = part.parameters[name], at = `${where}.${name}`;
    let v: number;
    if (isRecord(q.value)) v = evaluateLibraryExpression(exprs.get(`param:${name}`)!, values, at);
    else v = given[name] ?? variant?.values[name] ?? q.value;
    if (q.integer && !Number.isInteger(v)) throw new CadLibraryError('PARAMETER', at, `${v}: a whole number`);
    if ((q.min !== undefined && v < q.min) || (q.max !== undefined && v > q.max)) throw new CadLibraryError('PARAMETER', at, `${v} is outside ${q.min ?? '−∞'} … ${q.max ?? '∞'}`);
    values[name] = v;
    if (!isRecord(q.value)) used[name] = v;
    // (An estimate the caller replaced with a value of their own is theirs.)
    if (q.estimate && !(name in given)) warnings.push(`${name} = ${v}${q.unit && q.unit !== 'count' ? ` ${q.unit}` : ''} is an estimate${q.source ? ` (${q.source})` : ''}`);
  }
  if (part.simplified) warnings.push(`${part.name}: simplified internals — not for structural calculation`);
  const kept = part.recipe.filter(f => !f.when || evaluateLibraryExpression(exprs.get(`when:${f.id}`)!, values, `${where}:${f.id}.when`) !== 0);
  const keptIds = new Set(kept.map(f => f.id)), rename = (id: string) => `${prefix}_${id}`, byId = new Map(part.recipe.map(f => [f.id, f]));
  // (A reference to a step left out by its `when` — an optional finish or cut — is to the body that step would have
  // changed: back along its `target` to a kept feature; a left-out step that makes a body has none, refused.)
  const resolve = (ref: string, at: string): string => {
    let [id, k] = ref.split('/');
    for (let guard = 0; !keptIds.has(id) && guard < CadLibraryLimits.recipe; guard++) {
      const target = byId.get(id)?.target;
      if (typeof target !== 'string') throw new CadLibraryError('RECIPE', at, `${ref} is left out by its when for these values, and changes no other body`);
      [id, k] = target.split('/');
    }
    return k === undefined ? rename(id) : `${rename(id)}/${k}`;
  };
  const features: CadPartFeature[] = kept.map(f => {
    const out = substitute(f, values, exprs, f.id, '', '', where, keptIds, rename, resolve) as Record<string, unknown>;
    delete out.when; out.id = rename(f.id);
    return out as unknown as CadPartFeature;
  });
  // (An output left out by its `when` is the body it would have changed, as for references.)
  const outputs = (part.outputs ?? [part.recipe[part.recipe.length - 1].id]).map(o => resolve(o, `${where} output`));
  const interfaces = (part.interfaces ?? []).filter(itf => !itf.when || evaluateLibraryExpression(exprs.get(`itfwhen:${itf.id}`)!, values, `${where}.${itf.id}.when`) !== 0).map(itf => {
    const out = { ...(substituteInterface(itf, values, exprs, where) as Record<string, unknown>), id: itf.id, role: itf.role } as unknown as CadLibraryInterface;
    const z = out.frame.z as number[], x = out.frame.x as number[], nz = Math.hypot(...z), nx = Math.hypot(...x);
    if (!(nz > 0 && nx > 0) || Math.abs(z[0] * x[0] + z[1] * x[1] + z[2] * x[2]) > 1e-9 * nz * nx) throw new CadLibraryError('RECIPE', `${where}.${itf.id}`, 'frame z and x must be non-zero and perpendicular');
    const faces = itf.faces ? Object.fromEntries(Object.entries(itf.faces).map(([k, name]) => { const [id, ...rest] = name.split('.'); return [k, keptIds.has(id) ? [rename(id), ...rest].join('.') : name]; })) : undefined;
    const kept = { ...out, ...(faces ? { faces } : {}) } as Record<string, unknown>; delete kept.when;
    return kept as unknown as CadLibraryInterface;
  });
  return { features, outputs, origin: { library: lib.manifest.id, version: lib.manifest.libraryVersion, part: part.id, ...(variant ? { variant: variant.id } : {}), params: given, values: used }, warnings, interfaces };
}
/** A recipe value with its expressions evaluated and its references renamed. */
function substitute(value: unknown, values: Readonly<Record<string, number>>, exprs: ReadonlyMap<string, Node>, fid: string, key: string, path: string, where: string, kept: ReadonlySet<string>, rename: (id: string) => string, resolve: (ref: string, at: string) => string): unknown {
  if (Array.isArray(value)) return value.map((x, i) => substitute(x, values, exprs, fid, key, `${path}[${i}]`, where, kept, rename, resolve));
  if (isRecord(value)) {
    if ('expr' in value && path) return evaluateLibraryExpression(exprs.get(`${fid}:${path}`)!, values, `${where}:${fid}.${path}`);
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(value)) out[k] = path === '' && k === 'id' ? x : substitute(x, values, exprs, fid, k, path ? `${path}.${k}` : k, where, kept, rename, resolve);
    return out;
  }
  if (typeof value === 'string' && path) {
    if (REFERENCE_KEYS.has(key)) return resolve(value, `${where}:${fid}.${path}`);
    if (NAME_KEYS.has(key.replace(/\[\d+\]$/, ''))) return value.replace(/(^|[|+])([A-Za-z][A-Za-z0-9_-]*)(?=\.)/g, (m, sep, id) => kept.has(id) ? `${sep}${rename(id)}` : m);
  }
  return value;
}
function substituteInterface(itf: CadLibraryInterface, values: Readonly<Record<string, number>>, exprs: ReadonlyMap<string, Node>, where: string): unknown {
  const walk = (value: unknown, path: string): unknown => {
    if (Array.isArray(value)) return value.map((x, i) => walk(x, `${path}[${i}]`));
    if (isRecord(value)) {
      if ('expr' in value && path) return evaluateLibraryExpression(exprs.get(`itf:${itf.id}:${path}`)!, values, `${where}.${itf.id}.${path}`);
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(value)) out[k] = walk(x, path ? `${path}.${k}` : k);
      return out;
    }
    return value;
  };
  return walk(itf, '');
}
