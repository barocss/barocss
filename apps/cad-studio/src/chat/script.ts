// run_script (A5.2, O10): a small TypeScript-like language for building a part in one call. Each command or feature
// call in it runs as the tool call it stands for (run_command, add_features, edit_feature, delete_feature) on a
// working copy, in order; one refusal and the script stops, nothing applied — the same all-or-nothing as apply_ops.
// It never makes geometry itself: everything goes through the feature tree, so undo, proposals and references work
// as for any other change. Our own lexer, parser and interpreter: no eval, no dependency.
//
//   const plate = box({ w: 100, d: 40, h: 10 })              // a command; values by the HUD's keys
//   hole(plate.top, { d: 6.6, x: 20, y: 12, pat: "row", pn: 4, pa: 20, pb: 0 })
//   for (const i of range(3)) { cylinder({ r: 2, h: 5, x: 30 + 20 * i, y: 30, z: 10 }) }
//   fillet([edge(plate.top, plate.side0)], { radius: 2 })     // faces by role, edges between two faces
//   const s = feature({ kind: "sketch", profile: "circle", center: [0, 0], radius: 5 })
//   feature({ kind: "extrude", sketch: s, height: 12 })        // a handle in feature JSON is its node index
//   edit(plate, { h: 12 })  remove(s)
//
// Statements: `const name = expr` (or `const a = 1, b = 2`), an expression, `for (const name of expr) { … }`, `if (expr) { … } else { … }`.
// Expressions: numbers, "strings", true/false, [arrays], { objects }, names, a.b, a[i], calls, + - * / %, comparisons,
// && || !, ( ). Built in: range(n) | range(a, b[, step]), min, max, abs, sqrt, round, floor, ceil, sin, cos, tan
// (degrees), PI; face({normal, pick?, on?, all?}), edge(a, b), body("b1"), ref(feature[, side]), node("f3" | index) (a
// feature there before the script), requirements([{id, source, hard?, check}]) (the part's requirements, as
// set_requirements takes them).
// A feature handle: `.top`, `.bottom`, `.cut`, `.side0` … (its faces by role), `.side(k)` or `.side("e3")`, `.face(role)`,
// `.id`, `.body` (the body it made, for commands that take bodies).

export const SCRIPT_VERSION = 'barocss-cad-script-v1';
/** Limits: the source, the tool calls a script makes, the loop iterations, nesting. */
export const SCRIPT_LIMITS = { sourceChars: 20000, calls: 200, iterations: 2000, depth: 48, arrayItems: 1000 } as const;

export type ScriptErrorCode = 'SYNTAX' | 'UNKNOWN_NAME' | 'TYPE' | 'LIMIT' | 'REFUSED';
export class ScriptError extends Error {
  constructor(readonly code: ScriptErrorCode, message: string, readonly line: number, readonly col: number) { super(`[${code}] line ${line}:${col}: ${message}`); this.name = 'ScriptError'; }
}

// ---------------------------------------------------------------------------------------------------------
// Lexer

type TokenKind = 'num' | 'str' | 'name' | 'punct' | 'end';
interface Token { kind: TokenKind; text: string; value?: number | string; line: number; col: number }
const PUNCT = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||', '(', ')', '[', ']', '{', '}', ',', '.', ':', ';', '=', '+', '-', '*', '/', '%', '<', '>', '!', '?'];
const KEYWORDS = new Set(['const', 'for', 'of', 'if', 'else', 'true', 'false', 'let', 'var', 'function', 'while', 'return']);

export function lex(source: string): Token[] {
  if (source.length > SCRIPT_LIMITS.sourceChars) throw new ScriptError('LIMIT', `the script is ${source.length} characters (at most ${SCRIPT_LIMITS.sourceChars})`, 1, 1);
  const out: Token[] = [];
  let i = 0, line = 1, col = 1;
  const step = (n: number) => { for (let k = 0; k < n; k++) { if (source[i] === '\n') { line++; col = 1; } else col++; i++; } };
  while (i < source.length) {
    const c = source[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { step(1); continue; }
    if (c === '/' && source[i + 1] === '/') { while (i < source.length && source[i] !== '\n') step(1); continue; }
    if (c === '/' && source[i + 1] === '*') { const at = { line, col }; step(2); while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) step(1); if (i >= source.length) throw new ScriptError('SYNTAX', 'a comment is not closed', at.line, at.col); step(2); continue; }
    const at = { line, col };
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(i))!;
      out.push({ kind: 'num', text: m[0], value: Number(m[0]), ...at }); step(m[0].length); continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < source.length && source[j] !== c) {
        if (source[j] === '\n') throw new ScriptError('SYNTAX', 'a string is not closed on its line', at.line, at.col);
        if (source[j] === '\\') { const e = source[j + 1]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e; j += 2; continue; }
        s += source[j]; j++;
      }
      if (j >= source.length) throw new ScriptError('SYNTAX', 'a string is not closed', at.line, at.col);
      out.push({ kind: 'str', text: source.slice(i, j + 1), value: s, ...at }); step(j + 1 - i); continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(i))!;
      out.push({ kind: 'name', text: m[0], ...at }); step(m[0].length); continue;
    }
    const p = PUNCT.find(q => source.startsWith(q, i));
    if (!p) throw new ScriptError('SYNTAX', `unexpected character "${c}"`, at.line, at.col);
    out.push({ kind: 'punct', text: p, ...at }); step(p.length);
  }
  out.push({ kind: 'end', text: '', line, col });
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Parser

type Pos = { line: number; col: number };
export type Expr = Pos & (
  | { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'bool'; v: boolean } | { t: 'name'; name: string }
  | { t: 'array'; items: Expr[] } | { t: 'object'; props: [string, Expr][] }
  | { t: 'member'; obj: Expr; prop: string } | { t: 'index'; obj: Expr; index: Expr } | { t: 'call'; callee: Expr; args: Expr[] }
  | { t: 'unary'; op: string; arg: Expr } | { t: 'binary'; op: string; left: Expr; right: Expr } | { t: 'cond'; test: Expr; then: Expr; else: Expr });
export type Stmt = Pos & (
  | { t: 'const'; name: string; init: Expr } | { t: 'consts'; decls: (Pos & { name: string; init: Expr })[] } | { t: 'expr'; expr: Expr }
  | { t: 'for'; name: string; iter: Expr; body: Stmt[] } | { t: 'if'; test: Expr; then: Stmt[]; else: Stmt[] });

const BINARY: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '===': 3, '!==': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };

export function parse(source: string): Stmt[] {
  const tokens = lex(source);
  let k = 0, depth = 0;
  const peek = () => tokens[k], next = () => tokens[k++];
  const is = (text: string) => (peek().kind === 'punct' || peek().kind === 'name') && peek().text === text;
  const expect = (text: string, what = `"${text}"`) => { const t = next(); if (t.text !== text || (t.kind !== 'punct' && t.kind !== 'name')) throw new ScriptError('SYNTAX', `${what} expected, found ${t.kind === 'end' ? 'the end' : `"${t.text}"`}`, t.line, t.col); return t; };
  const deeper = (t: Token) => { if (++depth > SCRIPT_LIMITS.depth) throw new ScriptError('LIMIT', `nested more than ${SCRIPT_LIMITS.depth} deep`, t.line, t.col); };
  const nameToken = (what: string) => { const t = next(); if (t.kind !== 'name' || KEYWORDS.has(t.text)) throw new ScriptError('SYNTAX', `${what} expected, found ${t.kind === 'end' ? 'the end' : `"${t.text}"`}`, t.line, t.col); return t; };

  function block(): Stmt[] {
    expect('{'); const out: Stmt[] = [];
    while (!is('}')) { if (peek().kind === 'end') throw new ScriptError('SYNTAX', '"}" expected, found the end', peek().line, peek().col); out.push(statement()); }
    next(); return out;
  }
  function statement(): Stmt {
    const t = peek(); deeper(t);
    try {
      if (t.kind === 'name' && (t.text === 'let' || t.text === 'var')) throw new ScriptError('SYNTAX', `use const: names are set once (${t.text} is not part of the language)`, t.line, t.col);
      if (t.kind === 'name' && (t.text === 'function' || t.text === 'while' || t.text === 'return')) throw new ScriptError('SYNTAX', `"${t.text}" is not part of the language: use for (const … of range(n)) and calls`, t.line, t.col);
      if (t.kind === 'name' && t.text === 'const') {
        // (`const a = 1, b = 2`: several names in one statement, set in order.)
        next(); const decls: (Pos & { name: string; init: Expr })[] = [];
        do { if (decls.length) next(); const n = nameToken('a name'); expect('='); decls.push({ name: n.text, init: expression(), line: n.line, col: n.col }); } while (is(','));
        semi();
        return decls.length === 1 ? { t: 'const', name: decls[0].name, init: decls[0].init, line: t.line, col: t.col } : { t: 'consts', decls, line: t.line, col: t.col };
      }
      if (t.kind === 'name' && t.text === 'for') {
        next(); expect('('); expect('const'); const n = nameToken('a name'); expect('of'); const iter = expression(); expect(')');
        return { t: 'for', name: n.text, iter, body: block(), line: t.line, col: t.col };
      }
      if (t.kind === 'name' && t.text === 'if') {
        next(); expect('('); const test = expression(); expect(')'); const then = block();
        let otherwise: Stmt[] = [];
        if (is('else')) { next(); otherwise = is('if') ? [statement()] : block(); }
        return { t: 'if', test, then, else: otherwise, line: t.line, col: t.col };
      }
      const expr = expression(); semi();
      return { t: 'expr', expr, line: t.line, col: t.col };
    } finally { depth--; }
  }
  function semi() { if (is(';')) next(); }
  function expression(): Expr { const e = binary(0); if (is('?')) { const q = next(); const a = expression(); expect(':'); const b = expression(); return { t: 'cond', test: e, then: a, else: b, line: q.line, col: q.col }; } return e; }
  function binary(min: number): Expr {
    let left = unary();
    for (;;) {
      const t = peek(), prec = t.kind === 'punct' ? BINARY[t.text] : undefined;
      if (prec === undefined || prec <= min) return left;
      next(); const right = binary(prec);
      left = { t: 'binary', op: t.text, left, right, line: t.line, col: t.col };
    }
  }
  function unary(): Expr {
    const t = peek();
    if (t.kind === 'punct' && (t.text === '-' || t.text === '!' || t.text === '+')) { next(); deeper(t); try { return { t: 'unary', op: t.text, arg: unary(), line: t.line, col: t.col }; } finally { depth--; } }
    return postfix(primary());
  }
  function postfix(e: Expr): Expr {
    for (;;) {
      const t = peek();
      if (is('.')) { next(); const n = next(); if (n.kind !== 'name') throw new ScriptError('SYNTAX', 'a name expected after "."', n.line, n.col); e = { t: 'member', obj: e, prop: n.text, line: n.line, col: n.col }; continue; }
      if (is('[')) { next(); const index = expression(); expect(']'); e = { t: 'index', obj: e, index, line: t.line, col: t.col }; continue; }
      if (is('(')) {
        next(); const args: Expr[] = [];
        while (!is(')')) { args.push(expression()); if (!is(')')) expect(',', '"," or ")"'); }
        next(); e = { t: 'call', callee: e, args, line: t.line, col: t.col }; continue;
      }
      return e;
    }
  }
  function primary(): Expr {
    const t = next(); deeper(t);
    try {
      if (t.kind === 'num') return { t: 'num', v: t.value as number, line: t.line, col: t.col };
      if (t.kind === 'str') return { t: 'str', v: t.value as string, line: t.line, col: t.col };
      if (t.kind === 'name') {
        if (t.text === 'true' || t.text === 'false') return { t: 'bool', v: t.text === 'true', line: t.line, col: t.col };
        if (KEYWORDS.has(t.text)) throw new ScriptError('SYNTAX', `"${t.text}" cannot start an expression`, t.line, t.col);
        return { t: 'name', name: t.text, line: t.line, col: t.col };
      }
      if (t.text === '(') { const e = expression(); expect(')'); return e; }
      if (t.text === '[') {
        const items: Expr[] = [];
        while (!is(']')) { items.push(expression()); if (!is(']')) expect(',', '"," or "]"'); }
        next(); return { t: 'array', items, line: t.line, col: t.col };
      }
      if (t.text === '{') {
        const props: [string, Expr][] = [];
        while (!is('}')) {
          const key = next();
          if (key.kind !== 'name' && key.kind !== 'str' && key.kind !== 'num') throw new ScriptError('SYNTAX', 'a property name expected', key.line, key.col);
          const name = key.kind === 'str' ? String(key.value) : key.text;
          // (A shorthand `{ w }` is `{ w: w }`.)
          if (is(',') || is('}')) { if (key.kind !== 'name') throw new ScriptError('SYNTAX', '":" expected', key.line, key.col); props.push([name, { t: 'name', name, line: key.line, col: key.col }]); }
          else { expect(':'); props.push([name, expression()]); }
          if (!is('}')) expect(',', '"," or "}"');
        }
        next(); return { t: 'object', props, line: t.line, col: t.col };
      }
      throw new ScriptError('SYNTAX', t.kind === 'end' ? 'the script ends too early' : `unexpected "${t.text}"`, t.line, t.col);
    } finally { depth--; }
  }
  const out: Stmt[] = [];
  while (peek().kind !== 'end') out.push(statement());
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Values and the interpreter

/** Handles: a feature the script made (or one there before, by id), a face, an edge, a body. */
export type Handle = { h: 'feature'; id: string } | { h: 'face'; sel: unknown } | { h: 'edge'; sel: unknown } | { h: 'body'; key: string };
export type Value = number | string | boolean | Value[] | { [k: string]: Value } | Handle | Builtin;
type Builtin = { fn: string; self?: Handle };
// (Handles and functions are told from a script's own objects by identity, not by their keys: `{h: 8}` is a value.)
const MADE = new WeakSet<object>();
const made = <T extends Handle | Builtin>(v: T): T => { MADE.add(v); return v; };
const isHandle = (v: unknown): v is Handle => typeof v === 'object' && v !== null && MADE.has(v) && 'h' in v;
const isFn = (v: unknown): v is Builtin => typeof v === 'object' && v !== null && MADE.has(v) && 'fn' in v;

/** What the interpreter needs from the studio: the commands' names, the feature tree and a tool call. */
export interface ScriptHost {
  commands: readonly string[];
  /** Node index of a feature id in the working part (−1: none). */
  indexOf(id: string): number;
  /** The feature id at a node index (null: none). */
  idAt(index: number): string | null;
  /** The body key of a feature's solid. */
  bodyOf(id: string): string;
  /** Runs one tool call on the working part; the new features' ids, or the refusal. */
  call(tool: string, args: Record<string, unknown>): Promise<{ ok: true; added: string[]; did: string } | { ok: false; why: string }>;
}
export interface ScriptRun { calls: { line: number; tool: string; did: string; features: string[] }[]; names: Record<string, string> }

const PURE: Record<string, (args: number[]) => number> = {
  min: a => Math.min(...a), max: a => Math.max(...a), abs: a => Math.abs(a[0]), sqrt: a => Math.sqrt(a[0]), round: a => Math.round(a[0]),
  floor: a => Math.floor(a[0]), ceil: a => Math.ceil(a[0]), sin: a => Math.sin(a[0] * Math.PI / 180), cos: a => Math.cos(a[0] * Math.PI / 180), tan: a => Math.tan(a[0] * Math.PI / 180),
};
const SPECIAL = new Set(['range', 'face', 'edge', 'body', 'ref', 'node', 'feature', 'edit', 'remove', 'requirements']);

/** Runs a parsed script against the host. Throws ScriptError (typed, with its line) on the first problem. */
export async function runScript(program: Stmt[], host: ScriptHost): Promise<ScriptRun> {
  const scopes: Map<string, Value>[] = [new Map()], run: ScriptRun = { calls: [], names: {} };
  const commandOf = new Map(host.commands.map(c => [c.replace(/-/g, '_'), c]));
  let iterations = 0;
  const fail = (code: ScriptErrorCode, msg: string, at: Pos): never => { throw new ScriptError(code, msg, at.line, at.col); };
  const lookup = (name: string, at: Pos): Value => {
    for (let s = scopes.length - 1; s >= 0; s--) if (scopes[s].has(name)) return scopes[s].get(name)!;
    if (name === 'PI') return Math.PI;
    if (name in PURE || SPECIAL.has(name) || commandOf.has(name)) return made({ fn: name });
    return fail('UNKNOWN_NAME', `"${name}" is not defined${similar(name, [...commandOf.keys(), ...SPECIAL, ...Object.keys(PURE)])}`, at);
  };
  const num = (v: Value, at: Pos, what: string): number => typeof v === 'number' && Number.isFinite(v) ? v : fail('TYPE', `${what} must be a number`, at);

  async function exec(stmts: Stmt[]): Promise<void> {
    for (const s of stmts) {
      if (s.t === 'const') await declare(s.name, s.init, s);
      else if (s.t === 'consts') for (const d of s.decls) await declare(d.name, d.init, d);
      else if (s.t === 'expr') await evaluate(s.expr);
      else if (s.t === 'if') { const c = await evaluate(s.test); scopes.push(new Map()); try { await exec(truthy(c) ? s.then : s.else); } finally { scopes.pop(); } }
      else {
        const items = await evaluate(s.iter);
        if (!Array.isArray(items)) fail('TYPE', 'for … of takes a list (range(n) makes one)', s.iter);
        for (const item of items as Value[]) {
          if (++iterations > SCRIPT_LIMITS.iterations) fail('LIMIT', `more than ${SCRIPT_LIMITS.iterations} loop iterations`, s);
          scopes.push(new Map([[s.name, item]])); try { await exec(s.body); } finally { scopes.pop(); }
        }
      }
    }
  }

  async function declare(name: string, init: Expr, at: Pos): Promise<void> {
    const scope = scopes[scopes.length - 1];
    if (scope.has(name)) fail('TYPE', `"${name}" is already set`, at);
    const v = await evaluate(init); scope.set(name, v);
    if (scopes.length === 1 && isHandle(v) && v.h === 'feature') run.names[name] = v.id;
  }
  async function evaluate(e: Expr): Promise<Value> {
    switch (e.t) {
      case 'num': return e.v;
      case 'str': return e.v;
      case 'bool': return e.v;
      case 'name': return lookup(e.name, e);
      case 'array': { const out: Value[] = []; for (const x of e.items) out.push(await evaluate(x)); if (out.length > SCRIPT_LIMITS.arrayItems) fail('LIMIT', `a list of more than ${SCRIPT_LIMITS.arrayItems}`, e); return out; }
      case 'object': { const out: Record<string, Value> = {}; for (const [k, x] of e.props) out[k] = await evaluate(x); return out; }
      case 'unary': {
        const v = await evaluate(e.arg);
        if (e.op === '!') return !truthy(v);
        const n = num(v, e.arg, `the operand of ${e.op}`); return e.op === '-' ? -n : n;
      }
      case 'binary': {
        if (e.op === '&&') { const l = await evaluate(e.left); return truthy(l) ? evaluate(e.right) : l; }
        if (e.op === '||') { const l = await evaluate(e.left); return truthy(l) ? l : evaluate(e.right); }
        const l = await evaluate(e.left), r = await evaluate(e.right);
        if (e.op === '==' || e.op === '===') return same(l, r);
        if (e.op === '!=' || e.op === '!==') return !same(l, r);
        if (e.op === '+' && (typeof l === 'string' || typeof r === 'string')) { if (isHandle(l) || isHandle(r) || typeof l === 'object' || typeof r === 'object') fail('TYPE', '+ joins numbers or strings', e); return `${l as string}${r as string}`; }
        const a = num(l, e.left, `the left of ${e.op}`), b = num(r, e.right, `the right of ${e.op}`);
        switch (e.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b;
          case '/': return b === 0 ? fail('TYPE', 'division by zero', e) : a / b;
          case '%': return b === 0 ? fail('TYPE', 'division by zero', e) : a % b;
          case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
        }
        return fail('SYNTAX', `unknown operator ${e.op}`, e);
      }
      case 'cond': return truthy(await evaluate(e.test)) ? evaluate(e.then) : evaluate(e.else);
      case 'index': {
        const o = await evaluate(e.obj), i = await evaluate(e.index);
        if (Array.isArray(o)) { const n = num(i, e.index, 'an index'); if (!Number.isInteger(n) || n < 0 || n >= o.length) fail('TYPE', `index ${n} is outside the list (0–${o.length - 1})`, e.index); return o[n]; }
        if (o && typeof o === 'object' && !isHandle(o) && !isFn(o) && typeof i === 'string') { if (!(i in o)) fail('TYPE', `no property "${i}"`, e); return (o as Record<string, Value>)[i]; }
        return fail('TYPE', 'only lists and objects can be indexed', e);
      }
      case 'member': {
        const o = await evaluate(e.obj);
        if (isHandle(o) && o.h === 'feature') {
          if (e.prop === 'id') return o.id;
          if (e.prop === 'body') return made({ h: 'body', key: host.bodyOf(o.id) });
          if (e.prop === 'side' || e.prop === 'face') return made({ fn: e.prop, self: o });
          return made({ h: 'face', sel: { feature: o.id, role: e.prop } });
        }
        if (Array.isArray(o) && e.prop === 'length') return o.length;
        if (o && typeof o === 'object' && !isHandle(o) && !isFn(o) && !Array.isArray(o)) { if (!(e.prop in o)) fail('TYPE', `no property "${e.prop}"`, e); return (o as Record<string, Value>)[e.prop]; }
        return fail('TYPE', `"${e.prop}" of something that has none`, e);
      }
      case 'call': {
        const callee = await evaluate(e.callee);
        if (!isFn(callee)) return fail('TYPE', 'only commands and built-in functions can be called', e.callee);
        const args: Value[] = []; for (const a of e.args) args.push(await evaluate(a));
        return call(callee, args, e);
      }
    }
  }

  async function call(f: Builtin, args: Value[], at: Expr & { t: 'call' }): Promise<Value> {
    const name = f.fn;
    if (f.self) {
      // A feature's face by role: .side(k) (by position) or .side("e3") (by the sketch edge's id); .face(role).
      const v = args[0];
      if (name === 'side') { if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return made({ h: 'face', sel: { feature: (f.self as { id: string }).id, role: `side${v}` } }); if (typeof v === 'string') return made({ h: 'face', sel: { feature: (f.self as { id: string }).id, role: `side[${v}]` } }); return fail('TYPE', '.side takes a position (0, 1, …) or a sketch edge id ("e3")', at); }
      if (typeof v !== 'string') return fail('TYPE', '.face takes a role ("top", "cut", "side2", …)', at);
      return made({ h: 'face', sel: { feature: (f.self as { id: string }).id, role: v } });
    }
    if (name in PURE) { if (!args.length) fail('TYPE', `${name} takes a number`, at); return PURE[name](args.map((a, i) => num(a, at.args[i], `${name}'s argument`))); }
    switch (name) {
      case 'range': {
        const n = args.map((a, i) => num(a, at.args[i], 'range\'s arguments'));
        const [a, b, s] = n.length === 1 ? [0, n[0], 1] : [n[0], n[1], n[2] ?? 1];
        if (!n.length || n.length > 3 || s === 0) return fail('TYPE', 'range(n), range(a, b) or range(a, b, step) with a step not 0', at);
        const out: number[] = [];
        for (let x = a; s > 0 ? x < b - 1e-12 : x > b + 1e-12; x += s) { out.push(x); if (out.length > SCRIPT_LIMITS.arrayItems) fail('LIMIT', `a range of more than ${SCRIPT_LIMITS.arrayItems}`, at); }
        return out;
      }
      case 'face': { const o = args[0]; if (!o || typeof o !== 'object' || Array.isArray(o) || isHandle(o)) return fail('TYPE', 'face takes {normal: [x, y, z], pick?: "max" | "min", on?: body key, all?: true}', at); return made({ h: 'face', sel: plain(o, at) }); }
      case 'edge': { if (args.length !== 2) fail('TYPE', 'edge takes two faces (the edge between them)', at); return made({ h: 'edge', sel: { between: args.map((a, i) => faceSel(a, at.args[i])) } }); }
      case 'body': { if (typeof args[0] !== 'string') fail('TYPE', 'body takes a body key ("b1")', at); return made({ h: 'body', key: args[0] as string }); }
      case 'ref': { const h = args[0]; if (!isHandle(h) || h.h !== 'feature') fail('TYPE', 'ref takes a feature', at); const side = args[1] === undefined ? 'solid' : args[1]; if (typeof side !== 'string') fail('TYPE', 'ref\'s side is a string ("solid", "negative", …)', at); return { node: indexOf((h as { id: string }).id, at), side }; }
      case 'node': {
        const v = args[0];
        if (typeof v === 'string') { if (host.indexOf(v) < 0) fail('TYPE', `no feature ${v} in the part`, at); return made({ h: 'feature', id: v }); }
        if (typeof v === 'number' && Number.isInteger(v)) { const id = host.idAt(v); return id ? made({ h: 'feature', id }) : fail('TYPE', `no feature at index ${v}`, at); }
        return fail('TYPE', 'node takes a feature id ("f3") or a node index', at);
      }
      case 'feature': {
        if (args.length !== 1 || !args[0] || typeof args[0] !== 'object' || Array.isArray(args[0]) || isHandle(args[0])) fail('TYPE', 'feature takes one feature node ({kind: …}, as add_features takes them)', at);
        return tool('add_features', { features: [plain(args[0], at)] }, at);
      }
      case 'edit': {
        const h = args[0]; if (!isHandle(h) || h.h !== 'feature') fail('TYPE', 'edit takes a feature and its new values', at);
        const values = args[1]; if (!values || typeof values !== 'object' || Array.isArray(values) || isHandle(values)) fail('TYPE', 'edit takes {key: value} values', at);
        await tool('edit_feature', { index: indexOf((h as { id: string }).id, at), values: plain(values, at) }, at); return h;
      }
      case 'requirements': {
        // (The brief as checks, A5.4: set_requirements, so a script carries what it must meet and cad-cli --check runs it.)
        if (args.length !== 1 || !Array.isArray(args[0])) fail('TYPE', 'requirements takes a list of {id, source, hard?, check}', at);
        await tool('set_requirements', { requirements: plain(args[0], at) }, at); return true;
      }
      case 'remove': { const h = args[0]; if (!isHandle(h) || h.h !== 'feature') fail('TYPE', 'remove takes a feature', at); await tool('delete_feature', { index: indexOf((h as { id: string }).id, at) }, at); return true; }
    }
    // A command: an optional selection (a face, edge or feature, or a list of them) and optional values.
    const command = commandOf.get(name)!;
    let selection: Value | undefined, values: Value | undefined;
    for (const [i, a] of args.entries()) {
      if (a && typeof a === 'object' && !Array.isArray(a) && !isHandle(a) && !isFn(a) && values === undefined && i === args.length - 1) values = a;
      else if (selection === undefined && (isHandle(a) || Array.isArray(a) || typeof a === 'string')) selection = a;
      else fail('TYPE', `${name} takes a selection (faces, edges or features) and then {values}`, at.args[i]);
    }
    const out: Record<string, unknown> = { command };
    if (values) out.values = plain(values, at);
    if (selection !== undefined) {
      const faces: unknown[] = [], edges: unknown[] = [], bodies: string[] = [];
      for (const s of Array.isArray(selection) ? selection : [selection]) {
        if (typeof s === 'string') (s.includes('|') ? edges : faces).push(s);
        else if (isHandle(s) && s.h === 'face') faces.push(s.sel);
        else if (isHandle(s) && s.h === 'edge') edges.push(s.sel);
        else if (isHandle(s) && s.h === 'body') bodies.push(s.key);
        else if (isHandle(s) && s.h === 'feature') bodies.push(host.bodyOf(s.id));
        else fail('TYPE', 'a selection holds faces, edges, bodies or features', at);
      }
      if (faces.length) out.faces = faces; if (edges.length) out.edges = edges; if (bodies.length) out.bodies = bodies;
    }
    return tool('run_command', out, at);
  }

  function indexOf(id: string, at: Pos): number { const i = host.indexOf(id); return i >= 0 ? i : fail('TYPE', `feature ${id} is no longer in the part`, at); }
  function faceSel(v: Value, at: Pos): unknown { if (typeof v === 'string') return v; if (isHandle(v) && v.h === 'face') return v.sel; return fail('TYPE', 'a face: a feature\'s role (plate.top), face({…}) or a name', at); }
  /** A value as tool JSON: handles in feature JSON become node indices; functions refused. */
  function plain(v: Value, at: Pos): unknown {
    if (Array.isArray(v)) return v.map(x => plain(x, at));
    if (isFn(v)) return fail('TYPE', 'a function cannot be passed as a value', at);
    if (isHandle(v)) { if (v.h === 'feature') return indexOf(v.id, at); if (v.h === 'body') return v.key; return v.sel; }
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x, at)]));
    if (typeof v === 'number' && !Number.isFinite(v)) return fail('TYPE', 'a value is not a finite number', at);
    return v;
  }
  async function tool(name: string, args: Record<string, unknown>, at: Pos): Promise<Value> {
    if (run.calls.length >= SCRIPT_LIMITS.calls) fail('LIMIT', `more than ${SCRIPT_LIMITS.calls} commands and features in one script`, at);
    const r = await host.call(name, args);
    if (!r.ok) return fail('REFUSED', r.why, at);
    run.calls.push({ line: at.line, tool: name, did: r.did, features: r.added });
    return r.added.length ? made({ h: 'feature', id: r.added[r.added.length - 1] }) : true;
  }

  await exec(program);
  return run;
}

const truthy = (v: Value) => v !== false && v !== 0 && v !== '';
const same = (a: Value, b: Value) => JSON.stringify(a) === JSON.stringify(b);
function similar(name: string, known: string[]): string {
  const near = known.filter(k => k.startsWith(name.slice(0, 3)) || name.startsWith(k.slice(0, 3))).slice(0, 4);
  return near.length ? ` (did you mean ${near.join(', ')}?)` : '';
}
