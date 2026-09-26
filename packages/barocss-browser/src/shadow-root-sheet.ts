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

function canConstruct(): boolean {
  try {
    return typeof ShadowRoot !== 'undefined' && 'adoptedStyleSheets' in ShadowRoot.prototype
      && typeof CSSStyleSheet === 'function' && typeof new CSSStyleSheet().replaceSync === 'function';
  } catch { return false; }
}

const escapeCssRule = (rule: string) => rule.replace(/\\\//g, '\\/');

interface Segment { rules: string[]; keys: RuleKey[] }
interface Attached { root: ShadowRoot; styles?: [HTMLStyleElement, HTMLStyleElement] }

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
  private prologue = { preflight: '', vars: '' };
  /** Ordered: root (@property/@keyframes), uncategorised, then categories by first use (like the document partitions). */
  private segments = new Map<string, Segment>([['root', { rules: [], keys: [] }], ['', { rules: [], keys: [] }]]);
  /** rule text -> number of roots that use it. */
  private refs = new Map<string, number>();
  private attached: Attached[] = [];

  constructor(key: string, config: Config, fullKey: string = key) {
    this.key = key;
    this.fullKey = fullKey;
    this.context = createContext(config);
    this.constructable = canConstruct();
    if (this.constructable) {
      this.prologueSheet = new CSSStyleSheet();
      this.rulesSheet = new CSSStyleSheet();
    }
  }

  get rootCount(): number { return this.attached.length; }
  get ruleCount(): number { return this.refs.size; }

  attach(root: ShadowRoot): void {
    if (this.attached.some(a => a.root === root)) return;
    if (this.prologueSheet && this.rulesSheet) {
      const own = [this.prologueSheet, this.rulesSheet];
      root.adoptedStyleSheets = [...root.adoptedStyleSheets.filter(s => !own.includes(s)), ...own];
      this.attached.push({ root });
      return;
    }
    const doc = root.ownerDocument ?? document;
    const pro = doc.createElement('style'), rules = doc.createElement('style');
    pro.setAttribute('data-barocss', 'root-prologue');
    rules.setAttribute('data-barocss', 'root');
    pro.textContent = this.prologueText();
    rules.textContent = this.allRules().join('\n');
    root.insertBefore(rules, root.firstChild);
    root.insertBefore(pro, rules);
    this.attached.push({ root, styles: [pro, rules] });
  }

  detach(root: ShadowRoot): void {
    const i = this.attached.findIndex(a => a.root === root);
    if (i === -1) return;
    const [a] = this.attached.splice(i, 1);
    if (a.styles) a.styles.forEach(s => s.remove());
    else if (root.adoptedStyleSheets) root.adoptedStyleSheets = root.adoptedStyleSheets.filter(s => s !== this.prologueSheet && s !== this.rulesSheet);
  }

  setPrologue(part: 'preflight' | 'vars', css: string): void {
    if (this.prologue[part] === css) return;
    this.prologue[part] = css;
    const text = this.prologueText();
    if (this.prologueSheet) this.prologueSheet.replaceSync(text);
    for (const a of this.attached) if (a.styles) a.styles[0].textContent = text;
  }

  private prologueText(): string {
    return [this.prologue.preflight, this.prologue.vars].filter(Boolean).join('\n');
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
  retain(rule: string, segmentName: string): boolean {
    const count = this.refs.get(rule);
    if (count !== undefined) { this.refs.set(rule, count + 1); return true; }
    let seg = this.segments.get(segmentName);
    if (!seg) { seg = { rules: [], keys: [] }; this.segments.set(segmentName, seg); }
    const isRoot = segmentName === 'root';
    const key = ruleSortKey(rule);
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
  constructor(
    readonly shared: SharedRootSheet,
    private root: ShadowRoot,
    private getCategory: (cls: string) => string | undefined = cls => parseClassName(cls).utility?.category,
  ) {
    shared.attach(root);
  }

  hasDetachedPartitions(): boolean { return false; }

  updateRuleContent(category: string, ruleContent: string): void {
    if (category === 'preflight') this.shared.setPrologue('preflight', scopePreflightForShadowRoot(ruleContent));
    else if (category === 'css-vars') this.shared.setPrologue('vars', ruleContent);
  }

  private take(rule: string, segment: string): boolean {
    if (this.owned.has(rule)) return false;
    if (!this.shared.retain(rule, segment)) return false;
    this.owned.add(rule);
    return true;
  }

  addRule(rule: string): boolean { return this.take(rule, ''); }
  addCategoryRule(rule: string, category: string): boolean { return this.take(rule, `c:${category}`); }

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
        if (category ? this.addCategoryRule(css, category) : this.addRule(css)) success++; else failed++;
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
