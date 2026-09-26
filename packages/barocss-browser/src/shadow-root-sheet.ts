import { IncrementalParser, createContext, parseClassName, isDebug } from "@barocss/kit";
import type { Config, Context, GenerateCssRulesResult } from "@barocss/kit";
import { ruleSortKey, upperBound, type RuleKey } from "./rule-order";

/**
 * #327: Shadow DOM support. Every `BrowserRuntime({ root: shadowRoot })` with the same config shares one
 * {@link SharedRootSheet}: one generation per class, one constructable rules sheet (plus one prologue sheet with the
 * scoped preflight and theme variables) adopted by every root. Without constructable sheets, each root gets two
 * `<style>` elements that mirror the same rule list.
 */

/**
 * #327: rewrite preflight for a shadow root. `html`/`:root` selectors become `:host`; `body` rules are removed and
 * their declarations (minus the page-level `min-height`/`scroll-behavior`) are re-emitted last on `:host`, so the
 * widget's top element gets the same inherited typography a page body would (body came after html in the document).
 */
export function scopePreflightForShadowRoot(css: string): string {
  const bodyDecls: string[] = [];
  let out = css.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(?<=^|[{};])(\s*)([^{};@\s][^{};]*?)\{([^{}]*)\}/g, (_m, ws: string, prelude: string, block: string) => {
    const sels = prelude.split(',').map(s => s.trim()).filter(Boolean);
    if (sels.includes('body')) {
      for (const decl of block.split(';').map(d => d.trim()).filter(Boolean)) {
        if (!/^(min-height|scroll-behavior)\s*:/.test(decl)) bodyDecls.push(decl);
      }
    }
    const mapped = Array.from(new Set(sels.filter(s => s !== 'body').map(s => (s === 'html' || s === ':root' ? ':host' : s))));
    if (mapped.length === 0) return '';
    return `${ws}${mapped.join(', ')} {${block}}`;
  });
  if (bodyDecls.length) out += `\n@layer base {\n:host {\n  ${bodyDecls.join(';\n  ')};\n}\n}\n`;
  return out;
}

function stableKey(config: Config): string {
  return JSON.stringify(config, (_k, v) => (typeof v === 'function' ? `fn:${String(v)}` : v instanceof RegExp ? `re:${v}` : v)) ?? '';
}

/** A cheap string hash (FNV-1a), for readable registry keys. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** Whether constructable sheets can be adopted by a shadow root (#327) or, with `'document'`, by the document (#347). */
export function canConstruct(target: 'shadow' | 'document' = 'shadow'): boolean {
  try {
    const proto = target === 'document'
      ? (typeof Document !== 'undefined' ? Document.prototype : undefined)
      : (typeof ShadowRoot !== 'undefined' ? ShadowRoot.prototype : undefined);
    return !!proto && 'adoptedStyleSheets' in proto
      && typeof CSSStyleSheet === 'function' && typeof new CSSStyleSheet().replaceSync === 'function';
  } catch { return false; }
}

const escapeCssRule = (rule: string) => rule.replace(/\\\//g, '\\/');

/**
 * #384: `@property` only registers at document level; browsers ignore it inside a shadow root's sheets, so every
 * utility built on registered custom properties (gradients, shadow-*, ring-*, translate-*, ...) computed to `none`
 * in root mode. Root-mode runtimes therefore also register their `@property` rules in the document, in one small
 * sheet shared by every root and runtime: a `<style data-barocss="document-properties">` in `<head>` (carrying
 * `nonce`), or with `constructable` one sheet in `document.adoptedStyleSheets`. Only `@property` rules go there:
 * utilities, theme variables and preflight stay in the shadow root (#327).
 *
 * Destroy: the registrations are never removed. They are global and harmless without a utility that reads them,
 * another root or runtime may still rely on the same name, and removing a registration while an element uses it
 * would change its computed styles. Each rule is added at most once (by text).
 */
const PROPERTY_RULE = /^\s*@property\s/;
interface DocumentProperties { doc: Document; rules: Set<string>; sheet?: CSSStyleSheet; style?: HTMLStyleElement }
let documentProperties: DocumentProperties | null = null;

/** @internal tests: forget the document registration (does not remove it from the page). */
export function resetDocumentProperties(): void { documentProperties = null; }

/** @internal the `@property` rules registered at document level (#384). */
export function getDocumentPropertyRules(): string[] { return documentProperties ? Array.from(documentProperties.rules) : []; }

/**
 * #384: register the `@property` rules among `rules` in `doc`, idempotently. Returns false when the document cannot
 * take them (no document or head, or insertion failed), so the caller falls back to `:host` initial values.
 */
export function registerDocumentProperties(doc: Document | null | undefined, rules: string[], opts: { nonce?: string; constructable?: boolean } = {}): boolean {
  const props = rules.filter(r => PROPERTY_RULE.test(r));
  if (props.length === 0) return true;
  try {
    if (!doc) return false;
    if (!documentProperties || documentProperties.doc !== doc || (documentProperties.style && !documentProperties.style.isConnected)) {
      const entry: DocumentProperties = { doc, rules: new Set() };
      if (opts.constructable && canConstruct('document')) {
        entry.sheet = new CSSStyleSheet();
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, entry.sheet];
      } else {
        const parent = doc.head ?? doc.documentElement;
        if (!parent) return false;
        const style = doc.createElement('style');
        style.setAttribute('data-barocss', 'document-properties');
        if (opts.nonce) style.setAttribute('nonce', opts.nonce);
        parent.appendChild(style);
        entry.style = style;
      }
      documentProperties = entry;
    }
    const entry = documentProperties;
    for (const rule of props) {
      if (entry.rules.has(rule)) continue;
      const sheet = entry.sheet ?? entry.style?.sheet ?? null;
      if (sheet) sheet.insertRule(escapeCssRule(rule), sheet.cssRules.length);
      else if (entry.style) entry.style.textContent += `${rule}\n`;
      entry.rules.add(rule);
    }
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    if (isDebug()) console.warn('[BrowserRuntime] could not register @property rules in the document; using :host initial values', error);
    return false;
  }
}

/**
 * #384 fallback: the initial values of `@property` rules as plain declarations, in the first (lowest) cascade layer
 * of the shadow root. Unregistered custom properties inherit, so they are set on every element too, which resets
 * what a parent's utility set (as the registration's `inherits: false` would).
 */
export function propertyFallbackCss(rules: string[]): string {
  const decls: string[] = [];
  for (const rule of rules) {
    const name = /^\s*@property\s+(--[\w-]+)/.exec(rule)?.[1];
    const initial = /initial-value\s*:\s*([^;}]*)/.exec(rule)?.[1]?.trim();
    if (name && initial) decls.push(`${name}: ${initial}`);
  }
  if (decls.length === 0) return '';
  return `@layer properties {\n:host, *, ::before, ::after, ::backdrop {\n  ${decls.join(';\n  ')};\n}\n}`;
}

interface Segment { rules: string[]; keys: RuleKey[] }
type SheetRoot = ShadowRoot | Document;
interface Attached { root: SheetRoot; styles?: [HTMLStyleElement, HTMLStyleElement] }

export class SharedRootSheet {
  /** Readable label (hash of the config); not used for identity. */
  readonly key: string;
  /** The full config key the registry uses. */
  readonly fullKey: string;
  readonly context: Context;
  readonly results = new Map<string, GenerateCssRulesResult>();
  /** Number of classes actually generated (not served from `results`). */
  generations = 0;
  readonly constructable: boolean;
  private prologueSheet: CSSStyleSheet | null = null;
  private rulesSheet: CSSStyleSheet | null = null;
  private prologue = { props: '', preflight: '', vars: '' };
  /** #384: `@property` rules that could not be registered in the document (served by the `:host` fallback). */
  private fallbackProps = new Set<string>();
  /** Ordered: root (@property/@keyframes), uncategorised, then categories by first use (like the document partitions). */
  private segments = new Map<string, Segment>([['root', { rules: [], keys: [] }], ['', { rules: [], keys: [] }]]);
  /** rule text -> number of roots that use it. */
  private refs = new Map<string, number>();
  private attached: Attached[] = [];

  constructor(key: string, config: Config, fullKey: string = key, opts: { context?: Context; target?: 'shadow' | 'document' } = {}) {
    this.key = key;
    this.fullKey = fullKey;
    this.context = opts.context ?? createContext(config);
    this.constructable = canConstruct(opts.target ?? 'shadow');
    if (this.constructable) {
      this.prologueSheet = new CSSStyleSheet();
      this.rulesSheet = new CSSStyleSheet();
    }
  }

  get rootCount(): number { return this.attached.length; }
  get ruleCount(): number { return this.refs.size; }

  /** Adopt the sheets into `root`; without constructable sheets a shadow root gets two `<style>`s (carrying `nonce`, #347). */
  attach(root: SheetRoot, nonce = ''): void {
    if (this.attached.some(a => a.root === root)) return;
    if (this.prologueSheet && this.rulesSheet) {
      const own = [this.prologueSheet, this.rulesSheet];
      root.adoptedStyleSheets = [...root.adoptedStyleSheets.filter(s => !own.includes(s)), ...own];
      this.attached.push({ root });
      return;
    }
    if (root.nodeType !== 11) throw new Error('[BrowserRuntime] constructable sheets are not supported for the document');
    const doc = (root as ShadowRoot).ownerDocument ?? document;
    const pro = doc.createElement('style'), rules = doc.createElement('style');
    if (nonce) { pro.setAttribute('nonce', nonce); rules.setAttribute('nonce', nonce); }
    pro.setAttribute('data-barocss', 'root-prologue');
    rules.setAttribute('data-barocss', 'root');
    pro.textContent = this.prologueText();
    rules.textContent = this.allRules().join('\n');
    root.insertBefore(rules, root.firstChild);
    root.insertBefore(pro, rules);
    this.attached.push({ root, styles: [pro, rules] });
  }

  detach(root: SheetRoot): void {
    const i = this.attached.findIndex(a => a.root === root);
    if (i === -1) return;
    const [a] = this.attached.splice(i, 1);
    if (a.styles) a.styles.forEach(s => s.remove());
    else if (root.adoptedStyleSheets) root.adoptedStyleSheets = root.adoptedStyleSheets.filter(s => s !== this.prologueSheet && s !== this.rulesSheet);
  }

  /** #384: add `:host` initial values for the `@property` rules among `rules` (document registration failed). */
  addPropertyFallback(rules: string[]): void {
    const before = this.fallbackProps.size;
    for (const r of rules) if (PROPERTY_RULE.test(r)) this.fallbackProps.add(r);
    if (this.fallbackProps.size !== before) this.setPrologue('props', propertyFallbackCss(Array.from(this.fallbackProps)));
  }

  setPrologue(part: 'props' | 'preflight' | 'vars', css: string): void {
    if (this.prologue[part] === css) return;
    this.prologue[part] = css;
    const text = this.prologueText();
    if (this.prologueSheet) this.prologueSheet.replaceSync(text);
    for (const a of this.attached) if (a.styles) a.styles[0].textContent = text;
  }

  private prologueText(): string {
    return [this.prologue.props, this.prologue.preflight, this.prologue.vars].filter(Boolean).join('\n');
  }

  private allRules(): string[] {
    return Array.from(this.segments.values()).flatMap(s => s.rules);
  }

  private offset(segment: Segment): number {
    let n = 0;
    for (const s of this.segments.values()) { if (s === segment) return n; n += s.rules.length; }
    return n;
  }

  /** Take a reference on `rule`; inserts it (sorted, #254) when this is the first root to use it. */
  retain(rule: string, segmentName: string, cls?: string): boolean {
    const count = this.refs.get(rule);
    if (count !== undefined) { this.refs.set(rule, count + 1); return true; }
    let seg = this.segments.get(segmentName);
    if (!seg) { seg = { rules: [], keys: [] }; this.segments.set(segmentName, seg); }
    const isRoot = segmentName === 'root';
    const key = ruleSortKey(rule, cls);
    const local = isRoot ? seg.rules.length : upperBound(seg.keys, key);
    const index = this.offset(seg) + local;
    try {
      this.insertAt(rule, index);
    } catch (error) {
      // eslint-disable-next-line no-console
      if (isDebug()) console.warn(`[BrowserRuntime] Failed to insert rule into shadow root sheet: ${rule}`, error);
      return false;
    }
    seg.rules.splice(local, 0, rule);
    seg.keys.splice(local, 0, key);
    this.refs.set(rule, 1);
    return true;
  }

  /** Drop a reference on `rule`; deletes it only when no root uses it any more (#269 across roots). */
  release(rule: string): void {
    const count = this.refs.get(rule);
    if (count === undefined) return;
    if (count > 1) { this.refs.set(rule, count - 1); return; }
    this.refs.delete(rule);
    for (const seg of this.segments.values()) {
      const local = seg.rules.indexOf(rule);
      if (local === -1) continue;
      const index = this.offset(seg) + local;
      seg.rules.splice(local, 1);
      seg.keys.splice(local, 1);
      this.deleteAt(index);
      return;
    }
  }

  private insertAt(rule: string, index: number): void {
    const css = escapeCssRule(rule);
    if (this.rulesSheet) { this.rulesSheet.insertRule(css, index); return; }
    const total = this.allRules().length;
    for (const a of this.attached) {
      const el = a.styles![1], sheet = el.sheet;
      if (sheet && sheet.cssRules.length === total) sheet.insertRule(css, index);
      else { const list = this.allRules(); list.splice(index, 0, rule); el.textContent = list.join('\n'); }
    }
  }

  private deleteAt(index: number): void {
    if (this.rulesSheet) { this.rulesSheet.deleteRule(index); return; }
    const total = this.allRules().length; // already spliced
    for (const a of this.attached) {
      const el = a.styles![1], sheet = el.sheet;
      if (sheet && sheet.cssRules.length === total + 1) sheet.deleteRule(index);
      else el.textContent = this.allRules().join('\n');
    }
  }

  /** The CSS text all roots currently share (prologue then rules). */
  cssText(): string {
    return [this.prologueText(), ...this.allRules()].join('\n');
  }
}

const registry = new Map<string, SharedRootSheet>();

/** #327: the shared sheet for `config` (keyed by a config hash, so equal configs and prefixes share). */
export function acquireSharedRootSheet(config: Config, label: (text: string) => string = hash): SharedRootSheet {
  // Keyed by the full config text (a hash alone could collide and let one tenant's config style another's widget).
  const full = stableKey(config);
  let entry = registry.get(full);
  if (!entry) { entry = new SharedRootSheet(label(full), config, full); registry.set(full, entry); }
  return entry;
}

export function releaseIfUnused(entry: SharedRootSheet): void {
  if (entry.rootCount === 0 && registry.get(entry.fullKey) === entry) registry.delete(entry.fullKey);
}

/** #327: diagnostics for the shared shadow-root sheets (one per distinct config). */
export function getSharedRootSheetStats(): Array<{ key: string; roots: number; rules: number; generations: number; constructable: boolean }> {
  return Array.from(registry.values(), e => ({ key: e.key, roots: e.rootCount, rules: e.ruleCount, generations: e.generations, constructable: e.constructable }));
}

/** An IncrementalParser whose generated results are shared by every root on the same {@link SharedRootSheet}. */
export class SharedIncrementalParser extends IncrementalParser {
  constructor(readonly shared: SharedRootSheet) { super(shared.context); }
  processClass(className: string): GenerateCssRulesResult | null {
    if (this.isProcessed(className)) return null;
    const cached = this.shared.results.get(className);
    if (cached) { this.markProcessed(className); return cached; }
    const result = super.processClass(className);
    if (result) { this.shared.results.set(className, result); this.shared.generations++; }
    return result;
  }
}

/**
 * The per-root view of a shared sheet, with the subset of the StylePartitionManager API BrowserRuntime uses.
 * It holds one reference per rule this root uses.
 */
export class ShadowRootStyles {
  private owned = new Set<string>();
  private scopePreflight: boolean;
  constructor(
    readonly shared: SharedRootSheet,
    private root: SheetRoot,
    private getCategory: (cls: string) => string | undefined = cls => parseClassName(cls).utility?.category,
    private opts: { nonce?: string; constructable?: boolean } = {},
  ) {
    // #347: in the document mode (constructable) the preflight stays as written (html/:root/body).
    this.scopePreflight = root.nodeType === 11;
    shared.attach(root, opts.nonce);
  }

  hasDetachedPartitions(): boolean { return false; }

  updateRuleContent(category: string, ruleContent: string): void {
    if (category === 'preflight') this.shared.setPrologue('preflight', this.scopePreflight ? scopePreflightForShadowRoot(ruleContent) : ruleContent);
    else if (category === 'css-vars') this.shared.setPrologue('vars', ruleContent);
  }

  private take(rule: string, segment: string, cls?: string): boolean {
    if (this.owned.has(rule)) return false;
    // #384: @property does nothing inside a shadow root (it arrives both as a root rule and among a utility's
    // rules); register it in the document, or fall back to :host initial values. It also stays in the root sheet.
    if (this.root.nodeType === 11 && PROPERTY_RULE.test(rule)) {
      const doc = (this.root as ShadowRoot).ownerDocument ?? (typeof document !== 'undefined' ? document : null);
      if (!registerDocumentProperties(doc, [rule], this.opts)) this.shared.addPropertyFallback([rule]);
    }
    if (!this.shared.retain(rule, segment, cls)) return false;
    this.owned.add(rule);
    return true;
  }

  addRule(rule: string, cls?: string): boolean { return this.take(rule, '', cls); }
  // #401: one globally sorted segment for every utility rule (variant, then TW property order).
  addCategoryRule(rule: string, _category: string, cls?: string): boolean { return this.take(rule, '', cls); }

  addRootRules(rules: string[]) {
    let success = 0;
    for (const rule of rules) if (this.take(rule, 'root')) success++;
    return { success, failed: rules.length - success };
  }

  addRules(rules: GenerateCssRulesResult[]) {
    let success = 0, failed = 0;
    for (const result of rules) {
      const category = this.getCategory(result.cls);
      for (const css of result.cssList) {
        if (category ? this.addCategoryRule(css, category, result.cls) : this.addRule(css, result.cls)) success++; else failed++;
      }
    }
    return { success, failed };
  }

  removeRule(rule: string, _category?: string): boolean {
    if (!this.owned.delete(rule)) return false;
    this.shared.release(rule);
    return true;
  }

  get ruleCount(): number { return this.owned.size; }

  /** Release every rule this root holds and stop adopting the shared sheet. */
  cleanup(): void {
    this.owned.forEach(rule => this.shared.release(rule));
    this.owned.clear();
    this.shared.detach(this.root);
    releaseIfUnused(this.shared);
  }
}
