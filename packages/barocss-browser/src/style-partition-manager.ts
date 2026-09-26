/**
 * StylePartitionManager
 *
 * Splits the runtime's generated rules over `<style>` elements ("partitions"): a category partition
 * per utility category, uncategorised chunks of at most `maxRulesPerPartition` rules, and the special
 * `preflight` / `css-vars` / `root` partitions.
 *
 * #401: the utility partitions form one ordered sequence of segments. Every rule goes to its global
 * position in the single-sheet order (#254 variant order, then Tailwind's property order, then class
 * name), so the cascade is the same as one sorted sheet whatever the partitioning. A category's first
 * rule opens a `<style data-category=…>` segment; later rules join whichever segment their position
 * falls in, so `data-category` names the category a segment was opened for, not every rule it holds.
 */

import { GenerateCssRulesResult } from "@barocss/kit";
import { parseClassName, isDebug } from "@barocss/kit";
import { ruleSortKey, upperBound, compareKeys, type RuleKey } from "./rule-order";

export interface StylePartition {
  id: string;
  styles: string[];
  styleElement: HTMLStyleElement;
  /** Sort keys parallel to `styles` / the sheet's cssRules (#254). */
  keys?: RuleKey[];
  /** Utility category of a segment; undefined for an uncategorised chunk (#401). */
  category?: string;
}

export class StylePartitionManager {
  /** Utility segments in document order (#401). */
  private segments: StylePartition[] = [];
  /** preflight / css-vars / root. */
  private specialPartitions: Map<string, StylePartition> = new Map();
  private ruleSegment = new Map<string, StylePartition>();
  private partitionCounter = 0;
  private maxRulesPerPartition = 50;
  private insertionPoint: HTMLElement;
  private styleIdPrefix = "barocss-style-partition-";
  private getCategory: (cls: string) => string | undefined;
  /** #347: CSP nonce set on every `<style>` this manager creates (empty = none). */
  private nonce: string;

  constructor(
    insertionPoint: HTMLElement,
    maxRulesPerPartition: number = 50,
    styleIdPrefix: string = "barocss-style-partition-",
    getCategory: (cls: string) => string | undefined = cls => parseClassName(cls).utility?.category,
    nonce: string = ""
  ) {
    this.nonce = nonce;
    this.insertionPoint = insertionPoint;
    this.maxRulesPerPartition = maxRulesPerPartition;
    this.styleIdPrefix = styleIdPrefix;
    this.getCategory = getCategory;

    this.segments.push(this.createSegment(undefined, null));
  }

  /** A new `<style>`, carrying the #347 CSP nonce when one is configured. */
  private createStyleElement(): HTMLStyleElement {
    const el = document.createElement("style");
    if (this.nonce) el.setAttribute("nonce", this.nonce);
    return el;
  }

  /**
   * A new utility segment whose element goes right after `after`'s (or first, before every current
   * segment, when `after` is null and segments exist; appended to the insertion point otherwise).
   * The caller splices it into `segments`.
   */
  private createSegment(category: string | undefined, after: StylePartition | null): StylePartition {
    const styleElement = this.createStyleElement();
    const segment: StylePartition = {
      id: category === undefined
        ? this.styleIdPrefix + `-${this.partitionCounter++}`
        : this.styleIdPrefix + `-${category}`,
      styles: [],
      keys: [],
      styleElement,
      category,
    };
    styleElement.id = segment.id;
    styleElement.setAttribute("data-barocss", "partition");
    if (category === undefined) styleElement.setAttribute("data-partition-index", this.partitionCounter.toString());
    else styleElement.setAttribute("data-category", category);

    const anchor = after ? after.styleElement : null;
    const first = this.segments[0]?.styleElement;
    if (anchor?.parentNode) anchor.parentNode.insertBefore(styleElement, anchor.nextSibling);
    else if (!after && first?.parentNode) first.parentNode.insertBefore(styleElement, first);
    else this.insertionPoint.appendChild(styleElement);
    return segment;
  }

  private createSpecialPartition(category: string, atDocumentStart = false) {
    const partition: StylePartition = {
      id: this.styleIdPrefix + `-${category}`,
      styles: [],
      styleElement: this.createStyleElement(),
    };
    partition.styleElement.id = partition.id;
    partition.styleElement.setAttribute("data-barocss", "partition");
    partition.styleElement.setAttribute("data-category", category);

    const head = this.insertionPoint.ownerDocument?.head;
    if (atDocumentStart && head) {
      // Layered base styles (preflight) must be the first stylesheet so their
      // cascade layer is declared before any app layer (e.g. Tailwind `base`).
      head.insertBefore(partition.styleElement, head.firstChild);
    } else {
      this.insertionPoint.appendChild(partition.styleElement);
    }
    this.specialPartitions.set(category, partition);
    return partition;
  }

  get currentPartition() {
    return this.segments[this.segments.length - 1];
  }

  /** The first segment of `category` (or a special partition). */
  getCategoryPartition(category: string) {
    return this.specialPartitions.get(category) ?? this.segments.find(s => s.category === category);
  }

  hasDetachedPartitions(): boolean {
    return [...this.segments, ...this.specialPartitions.values()]
      .some(partition => !partition.styleElement.isConnected);
  }

  /**
   * Escape CSS rule text
   * - Properly escape special characters
   * - Prevent CSS syntax errors
   */
  private escapeCssRule(rule: string): string {
    return rule.replace(/\\\//g, '\\/');
  }

  /** Insert `rule` at `index` of `segment`: one insertRule, or a text rebuild when the sheet isn't in sync. */
  private insertAt(segment: StylePartition, index: number, rule: string, key: RuleKey) {
    const keys = (segment.keys ??= []);
    const sheet = segment.styleElement.sheet;
    if (sheet && sheet.cssRules.length === keys.length) {
      sheet.insertRule(this.escapeCssRule(rule), index);
      segment.styles.splice(index, 0, rule);
    } else {
      segment.styles.splice(index, 0, rule);
      segment.styleElement.textContent = segment.styles.join("\n") + "\n";
    }
    keys.splice(index, 0, key);
    this.ruleSegment.set(rule, segment);
  }

  /** Move `segment`'s rules from `from` on into a new segment of the same category right after it. */
  private split(position: number, from: number): StylePartition {
    const segment = this.segments[position];
    const tail = this.createSegment(segment.category, segment);
    this.segments.splice(position + 1, 0, tail);
    const rules = segment.styles.splice(from);
    const keys = segment.keys!.splice(from);
    const sheet = segment.styleElement.sheet;
    if (sheet && sheet.cssRules.length === segment.styles.length + rules.length) {
      for (let i = sheet.cssRules.length - 1; i >= from; i--) sheet.deleteRule(i);
    } else {
      segment.styleElement.textContent = segment.styles.length ? segment.styles.join("\n") + "\n" : "";
    }
    tail.styles = rules;
    tail.keys = keys;
    tail.styleElement.textContent = rules.length ? rules.join("\n") + "\n" : "";
    for (const r of rules) this.ruleSegment.set(r, tail);
    return tail;
  }

  private hasRoom(segment: StylePartition) {
    return segment.styles.length < this.maxRulesPerPartition;
  }

  /**
   * Put `rule` at its global position (#401). The position decides the cascade; the segment only
   * decides which `<style>` holds it. A category's first rule opens a segment of that category (split
   * at the position when it falls inside another segment); later rules join the segment at their
   * position, preferring one of their own category at a boundary. Every segment holds at most
   * `maxRulesPerPartition` rules (a full one is split at the position), which bounds the number of
   * `<style>` elements by categories + rules / max instead of by category changes in the sorted order.
   */
  private place(rule: string, category: string | undefined, cls?: string): boolean {
    if (this.ruleSegment.has(rule)) return false;
    const key = ruleSortKey(rule, cls);
    // First non-empty segment holding a rule that sorts after this one.
    let at = this.segments.findIndex(s => {
      const keys = s.keys!;
      return keys.length > 0 && compareKeys(keys[keys.length - 1], key) > 0;
    });
    if (at === -1) at = this.segments.length;
    const local = at < this.segments.length ? upperBound(this.segments[at].keys!, key) : 0;
    const known = this.segments.some(s => s.category === category);

    if (local > 0) {
      // Strictly inside segment `at`.
      const segment = this.segments[at];
      if (known && this.hasRoom(segment)) {
        this.insertAt(segment, local, rule, key);
        return true;
      }
      this.split(at, local);
      if (known) {
        this.insertAt(segment, local, rule, key); // the split left room at its end
        return true;
      }
      const created = this.createSegment(category, segment);
      this.segments.splice(at + 1, 0, created);
      this.insertAt(created, 0, rule, key);
      return true;
    }

    // At the boundary before segment `at`: any segment from the last non-empty one before it up to
    // `at` itself can take the rule (at its end, or at the start of `at`).
    let lo = at - 1;
    while (lo > 0 && this.segments[lo].styles.length === 0) lo--;
    const candidates: number[] = [];
    if (known) for (let i = Math.max(lo, 0); i <= at && i < this.segments.length; i++) if (this.hasRoom(this.segments[i])) candidates.push(i);
    const pick = candidates.find(i => this.segments[i].category === category) ?? candidates[0];
    if (pick !== undefined) {
      const segment = this.segments[pick];
      this.insertAt(segment, pick === at ? 0 : segment.styles.length, rule, key);
      return true;
    }
    const before = at > 0 ? this.segments[at - 1] : null;
    const created = this.createSegment(category, before);
    this.segments.splice(at, 0, created);
    this.insertAt(created, 0, rule, key);
    return true;
  }

  hasRule(rule: string) {
    return this.ruleSegment.has(rule);
  }

  /** #401: a segment's category is a label, not a guarantee, so any held rule counts. */
  hasCategoryRule(rule: string, _category: string) {
    return this.ruleSegment.has(rule);
  }

  /** `cls` (the rule's class) is the sort's name tiebreak; it defaults to the selector's first class. */
  addRule(rule: string, cls?: string) {
    return this.tryPlace(rule, undefined, cls);
  }

  addCategoryRule(rule: string, category: string, cls?: string) {
    return this.tryPlace(rule, category, cls);
  }

  private tryPlace(rule: string, category: string | undefined, cls?: string): boolean {
    try {
      return this.place(rule, category, cls);
    } catch (error) {
      // eslint-disable-next-line no-console
      if (isDebug()) console.warn(`[StylePartitionManager] Failed to insert rule${category ? ` in category: ${category}` : ""}: ${rule}`, error);
      return false;
    }
  }

  addRootRules(rules: string[]) {
    const partition = this.specialPartitions.get("root") ?? this.createSpecialPartition("root");
    try {
      const sheet = partition.styleElement.sheet;
      for (const rule of rules) {
        if (sheet) {
          sheet.insertRule(this.escapeCssRule(rule), sheet.cssRules.length);
        } else {
          partition.styleElement.textContent += rule + "\n";
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      if (isDebug()) console.warn(
        `[StylePartitionManager] Failed to insert rule in category: root ${rules.join("\n")}`,
        error
      );
      return { success: 0, failed: rules.length };
    }
    return { success: rules.length, failed: 0 };
  }

  addRules(rules: GenerateCssRulesResult[]) {
    let success = 0;
    let failed = 0;
    for (const rule of rules) {
      const category = this.getCategory(rule.cls);
      for (const css of rule.cssList) {
        if (category) {
          this.addCategoryRule(css, category, rule.cls);
        } else if (this.addRule(css, rule.cls)) {
          success++;
        } else {
          failed++;
        }
      }
    }
    return { success, failed };
  }

  /**
   * Remove one generated rule (#269 GC). Keeps `styles`, the #254 `keys` and the
   * sheet's cssRules parallel: one deleteRule at the rule's index, or a text
   * rebuild when the sheet isn't solely ours / has no CSSOM. Returns whether
   * the rule was found.
   */
  removeRule(rule: string, _category?: string): boolean {
    const segment = this.ruleSegment.get(rule);
    if (!segment) return false;
    const index = segment.styles.indexOf(rule);
    if (index === -1) return false;
    const sheet = segment.styleElement.sheet;
    const inSync = !!sheet && sheet.cssRules.length === segment.styles.length;
    segment.styles.splice(index, 1);
    segment.keys?.splice(index, 1);
    if (inSync && sheet) {
      sheet.deleteRule(index);
    } else {
      segment.styleElement.textContent = segment.styles.length ? segment.styles.join("\n") + "\n" : "";
    }
    this.ruleSegment.delete(rule);
    return true;
  }

  /** Number of generated (non-root, non-preflight) rules currently held. */
  get ruleCount(): number {
    return this.ruleSegment.size;
  }

  /** The partition holding `rule`, if any. */
  findRulePartition(rule: string): StylePartition | null {
    return this.ruleSegment.get(rule) ?? null;
  }

  updateRuleContent(category: string, ruleContent: string, atDocumentStart = false) {
    const partition = this.specialPartitions.get(category);
    if (partition) {
      partition.styleElement.textContent = ruleContent;
    } else {
      const created = this.createSpecialPartition(category, atDocumentStart);
      // eslint-disable-next-line no-console
      if (isDebug()) console.log(`[StylePartitionManager] Created new partition for category: ${category}`);
      created.styleElement.textContent = ruleContent;
    }
  }

  /** Remove every partition element and reset state. */
  cleanup(): void {
    for (const partition of [...this.segments, ...this.specialPartitions.values()]) {
      partition.styleElement.parentNode?.removeChild(partition.styleElement);
    }
    this.segments = [];
    this.specialPartitions.clear();
    this.partitionCounter = 0;
    this.ruleSegment.clear();
  }
}
