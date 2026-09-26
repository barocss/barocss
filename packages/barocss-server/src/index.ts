import { parseClassToAst, generateCssRules, createContext, ruleSortKey, compareKeys } from '@barocss/kit';
import type { Config, Context } from '@barocss/kit';

/**
 * Server-side runtime for Barocss
 *
 * This provides server-side utilities for parsing classes and generating CSS
 * without browser-specific features like DOM manipulation or MutationObserver.
 */
/** Cached generation result for one class (#272). Pure function of (class, config), so kept per runtime. */
interface ClassEntry {
  /** Class rules ('' when the class generates none), their #254 sort key and the var(--x) names they reference. */
  css: string;
  key: ReturnType<typeof ruleSortKey> | null;
  refs: string[];
  /** Root-level blocks (@property, keyframes ...) with their dedupe key and referenced vars. */
  roots: Array<{ css: string; dedupeKey: string; refs: string[] }>;
}

export interface ServerRuntimeOptions {
  /** Max classes kept in the per-class generation cache (LRU). Default 10000; 0 disables caching. */
  cacheSize?: number;
}

const refsOf = (text: string) => [...text.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);

export class ServerRuntime {
  private context!: Context;
  private readonly cacheSize: number;
  /** class -> generated entry; Map insertion order doubles as LRU order (#272). */
  private classCache = new Map<string, ClassEntry>();
  /** Theme var definitions parsed once from themeToCssVars() (#272). */
  private themeDefs: Map<string, string> | null = null;

  constructor(config: Config = {}, options: ServerRuntimeOptions = {}) {
    this.cacheSize = Math.max(0, options.cacheSize ?? 10000);
    this.setConfig(config);
  }

  /** Replace the config (theme included). Drops every cached result derived from the previous one. */
  setConfig(config: Config) {
    this.context = createContext(config);
    this.classCache.clear();
    this.themeDefs = null;
  }

  /** Number of classes currently in the generation cache. */
  get cachedClassCount() {
    return this.classCache.size;
  }

  /**
   * Parse a class name and return its AST
   */
  parseClass(className: string) {
    return parseClassToAst(className, this.context);
  }

  /**
   * Generate CSS for a class name (or whitespace-separated class names) as one complete sheet (#267):
   * one `:root,:host` block defining every theme var the output references, each root/@property block
   * once, then the class rules in Tailwind variant order (base < sm < md < lg ...).
   */
  generateCss(className: string) {
    const entries = className.split(/\s+/).filter(Boolean).map((cls) => this.entryFor(cls));
    const roots = this.uniqueRoots(entries.flatMap((e) => e.roots));
    const rules = this.sortRules(entries.filter((e) => e.css));
    const refs = [...roots.flatMap((r) => r.refs), ...rules.flatMap((r) => r.refs)];
    const vars = this.themeVarsBlock(refs);
    return [...(vars ? [vars] : []), ...roots.map((r) => r.css), ...rules.map((r) => r.css)].join('\n');
  }

  /** Generate (or reuse) one class's rules. Same per-class output generateCssRules gives for a class list. */
  private entryFor(cls: string): ClassEntry {
    const hit = this.classCache.get(cls);
    if (hit) {
      this.classCache.delete(cls);
      this.classCache.set(cls, hit);
      return hit;
    }
    const entry: ClassEntry = { css: '', key: null, refs: [], roots: [] };
    for (const { css, rootCssList } of generateCssRules(cls, this.context)) {
      if (css) entry.css = css;
      for (const root of rootCssList) {
        if (!root) continue;
        const dedupeKey = /^\s*@property\s+(--[\w-]+)/.exec(root)?.[1] ?? root;
        entry.roots.push({ css: root, dedupeKey, refs: refsOf(root) });
      }
    }
    if (entry.css) {
      entry.key = ruleSortKey(entry.css);
      entry.refs = refsOf(entry.css);
    }
    if (this.cacheSize > 0) {
      if (this.classCache.size >= this.cacheSize) this.classCache.delete(this.classCache.keys().next().value!);
      this.classCache.set(cls, entry);
    }
    return entry;
  }

  /**
   * CSS per class, in input order. Each entry is self-contained (its own `:root,:host` vars block,
   * @property blocks and variant-sorted rules), so entries repeat shared blocks and are not ordered
   * against each other. For one complete sheet use `generateCss(classes.join(' '))`.
   */
  generateCssForClasses(classes: string[]) {
    return classes.map((className) => ({ className, css: this.generateCss(className) }));
  }

  /** Dedupe root-level blocks by content, and @property blocks by property name. */
  private uniqueRoots(list: ClassEntry['roots']): ClassEntry['roots'] {
    const seen = new Set<string>();
    return list.filter(({ dedupeKey }) => !seen.has(dedupeKey) && !!seen.add(dedupeKey));
  }

  /** Stable sort by the #254 variant key shared with @barocss/browser. */
  private sortRules(rules: ClassEntry[]): ClassEntry[] {
    return rules
      .map((entry, i) => ({ entry, i }))
      .sort((a, b) => compareKeys(a.entry.key!, b.entry.key!) || a.i - b.i)
      .map(({ entry }) => entry);
  }

  /**
   * #228 generalised (#267): define every var(--x) the output references that the theme defines
   * (radius, text, spacing, shadow, font, colour ...), including vars those definitions reference.
   * themeToCssVars() already omits self-referencing entries (#260).
   */
  private themeVarsBlock(refs: string[]): string {
    const pending = refs;
    if (pending.length === 0) return '';
    let defs = this.themeDefs;
    if (!defs) {
      defs = this.themeDefs = new Map();
      for (const m of this.context.themeToCssVars().matchAll(/^\s*(--[\w-]+):\s*(.+);$/gm)) defs.set(m[1], m[2]);
    }
    const used = new Map<string, string>();
    while (pending.length) {
      const name = pending.pop()!;
      const value = defs.get(name);
      if (value === undefined || used.has(name)) continue;
      used.set(name, value);
      pending.push(...refsOf(value));
    }
    if (used.size === 0) return '';
    return ':root,:host {\n' + [...used].map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}';
  }
}
