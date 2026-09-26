/**
 * StylePartitionManager
 *
 * StylePartitionManager is a singleton class that manages the partition of styles into different parts.
 * It is used to manage the partition of styles into different parts.
 *
 */

import { GenerateCssRulesResult } from "@barocss/kit";
import { parseClassName } from "@barocss/kit";
import { compareKeys, ruleSortKey, upperBound, type RuleKey } from "./rule-order";

export interface StylePartition {
  id: string;
  styles: string[];
  styleElement: HTMLStyleElement;
  /** Sort keys parallel to `styles` / the sheet's cssRules (#254). */
  keys?: RuleKey[];
}

export class StylePartitionManager {
  /**
   * Insert `rule` at its Tailwind variant position within `partition` (#254):
   * one insertRule at a binary-searched index, no sheet rewrite.
   */
  private insertSorted(partition: StylePartition, rule: string, key: RuleKey) {
    const keys = (partition.keys ??= []);
    const index = upperBound(keys, key);
    const sheet = partition.styleElement.sheet;
    if (sheet && sheet.cssRules.length === keys.length) {
      sheet.insertRule(this.escapeCssRule(rule), index);
      partition.styles.splice(index, 0, rule);
    } else {
      // No CSSOM (detached) or sheet not solely ours: rebuild text in order.
      partition.styles.splice(index, 0, rule);
      partition.styleElement.textContent = partition.styles.join("\n") + "\n";
    }
    keys.splice(index, 0, key);
  }

  private partitions: StylePartition[] = [];
  private categoryPartitions: Map<string, StylePartition> = new Map();
  private partitionCounter = 0;
  private maxRulesPerPartition = 50;
  private insertionPoint: HTMLElement;
  private classToPartitionMap = new Map<string, number>();
  private classToCategoryPartitionMap = new Map<string, string>();
  private styleIdPrefix = "barocss-style-partition-";
  private getCategory: (cls: string) => string | undefined;

  constructor(
    insertionPoint: HTMLElement,
    maxRulesPerPartition: number = 50,
    styleIdPrefix: string = "barocss-style-partition-",
    getCategory: (cls: string) => string | undefined = cls => parseClassName(cls).utility?.category
  ) {
    this.insertionPoint = insertionPoint;
    this.maxRulesPerPartition = maxRulesPerPartition;
    this.styleIdPrefix = styleIdPrefix;
    this.getCategory = getCategory;

    this.initializeDefaultPartition();
  }

  private initializeDefaultPartition() {
    this.createNewPartition();
  }

  private createNewCategoryPartition(category: string, atDocumentStart = false) {
    const newPartition: StylePartition = {
      id: this.styleIdPrefix + `-${category}`,
      styles: [],
      styleElement: document.createElement("style"),
    };

    // set id
    newPartition.styleElement.id = newPartition.id;
    newPartition.styleElement.setAttribute("data-barocss", "partition");
    newPartition.styleElement.setAttribute("data-category", category);

    // set insertion point
    const head = this.insertionPoint.ownerDocument?.head;
    if (atDocumentStart && head) {
      // Layered base styles (preflight) must be the first stylesheet so their
      // cascade layer is declared before any app layer (e.g. Tailwind `base`).
      head.insertBefore(newPartition.styleElement, head.firstChild);
    } else {
      this.insertionPoint.appendChild(newPartition.styleElement);
    }

    this.categoryPartitions.set(category, newPartition);

    return newPartition;
  }

  private createNewPartition() {
    const newPartition: StylePartition = {
      id: this.styleIdPrefix + `-${this.partitionCounter++}`,
      styles: [],
      styleElement: document.createElement("style"),
    };
    this.partitions.push(newPartition);

    // set id
    newPartition.styleElement.id = newPartition.id;
    newPartition.styleElement.setAttribute("data-barocss", "partition");
    newPartition.styleElement.setAttribute(
      "data-partition-index",
      this.partitionCounter.toString()
    );

    // set insertion point
    this.insertionPoint.appendChild(newPartition.styleElement);

    return newPartition;
  }

  hasRule(rule: string) {
    return this.classToPartitionMap.has(rule);
  }

  hasCategoryRule(rule: string, category: string) {
    return this.classToCategoryPartitionMap.get(rule) === category;
  }

  setRuleCache(rule: string, partitionIndex: number) {
    this.classToPartitionMap.set(rule, partitionIndex);
  }

  setCategoryRuleCache(rule: string, category: string) {
    this.classToCategoryPartitionMap.set(rule, category);
  }

  get currentPartition() {
    return this.partitions[this.partitions.length - 1];
  }

  getCategoryPartition(category: string) {
    return this.categoryPartitions.get(category);
  }

  hasDetachedPartitions(): boolean {
    return [...this.partitions, ...this.categoryPartitions.values()]
      .some(partition => !partition.styleElement.isConnected);
  }

  /**
   * Escape CSS rule text
   * - Properly escape special characters
   * - Prevent CSS syntax errors
   */
  private escapeCssRule(rule: string): string {
    // Basic CSS string normalization
    const escaped = rule.replace(/\\\//g, '\\/');

    return escaped;
  }

  addRule(rule: string) {
    if (this.hasRule(rule)) {
      return false;
    }

    const key = ruleSortKey(rule);
    // Earliest partition holding a rule that must come after this one; the
    // chunks are consecutive <style> elements, so this keeps global order.
    let partitionIndex = this.partitions.findIndex(p => {
      const keys = p.keys;
      return !!keys && keys.length > 0 && compareKeys(keys[keys.length - 1], key) > 0;
    });
    if (partitionIndex === -1) {
      if (this.currentPartition.styles.length >= this.maxRulesPerPartition) {
        this.createNewPartition();
      }
      partitionIndex = this.partitions.length - 1;
    }
    const partition = this.partitions[partitionIndex];

    try {
      this.insertSorted(partition, rule, key);
      this.setRuleCache(rule, partitionIndex);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        `[StylePartitionManager] Failed to insert rule: ${rule}`,
        error
      );
      return false;
    }
  }

  addCategoryRule(rule: string, category: string) {
    if (this.hasCategoryRule(rule, category)) {
      return false;
    }

    let categoryPartition = this.getCategoryPartition(category);
    if (!categoryPartition) {
      categoryPartition = this.createNewCategoryPartition(category);
    }

    try {
      this.insertSorted(categoryPartition, rule, ruleSortKey(rule));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        `[StylePartitionManager] Failed to insert rule in category: ${category} ${rule}`,
        error
      );
      return false;
    }

    this.setCategoryRuleCache(rule, category);

    return true;
  }
  
  addRootRules(rules: string[]) {
    let categoryPartition = this.getCategoryPartition("root");
    if (!categoryPartition) {
      categoryPartition = this.createNewCategoryPartition("root");
    }   

    try {

      const sheet = categoryPartition.styleElement.sheet;

      for (const rule of rules) {
        if (sheet) {
          sheet.insertRule(this.escapeCssRule(rule), sheet.cssRules.length);
        } else {
          categoryPartition.styleElement.textContent += rule + "\n";
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
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

      if (category) {
        for (const css of rule.cssList) {
          this.addCategoryRule(css, category);
        }
      } else {
        for (const css of rule.cssList) {
          if (this.addRule(css)) {
            success++;
          } else {
            failed++;
          }
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
  removeRule(rule: string, category?: string): boolean {
    let partition: StylePartition | undefined;
    if (category) {
      if (this.classToCategoryPartitionMap.get(rule) !== category) return false;
      partition = this.categoryPartitions.get(category);
    } else {
      const partitionIndex = this.classToPartitionMap.get(rule);
      partition = partitionIndex === undefined ? undefined : this.partitions[partitionIndex];
    }
    if (!partition) return false;
    const index = partition.styles.indexOf(rule);
    if (index === -1) return false;
    const sheet = partition.styleElement.sheet;
    const inSync = !!sheet && sheet.cssRules.length === partition.styles.length;
    partition.styles.splice(index, 1);
    partition.keys?.splice(index, 1);
    if (inSync && sheet) {
      sheet.deleteRule(index);
    } else {
      partition.styleElement.textContent = partition.styles.length ? partition.styles.join("\n") + "\n" : "";
    }
    if (category) this.classToCategoryPartitionMap.delete(rule);
    else this.classToPartitionMap.delete(rule);
    return true;
  }

  /** Number of generated (non-root, non-preflight) rules currently held. */
  get ruleCount(): number {
    return this.classToPartitionMap.size + this.classToCategoryPartitionMap.size;
  }

  /**
   * 특정 규칙이 어느 파티션에 있는지 찾기
   */
  findRulePartition(rule: string): StylePartition | null {
    const partitionIndex = this.classToPartitionMap.get(rule);
    if (partitionIndex !== undefined && this.partitions[partitionIndex]) {
      return this.partitions[partitionIndex];
    }

    const categoryPartition = this.classToCategoryPartitionMap.get(rule);
    if (categoryPartition !== undefined) {
      return this.categoryPartitions.get(categoryPartition) || null;
    }

    return null;
  }


  updateRuleContent(category: string, ruleContent: string, atDocumentStart = false) {
    const partition = this.getCategoryPartition(category);
    if (partition) {
      partition.styleElement.textContent = ruleContent;
    } else {
      const newPartition = this.createNewCategoryPartition(category, atDocumentStart);
      // eslint-disable-next-line no-console
      console.log(`[StylePartitionManager] Created new partition for category: ${category}`);
      newPartition.styleElement.textContent = ruleContent;
    }
  }

  /**
   * 모든 파티션 정리
   */
  cleanup(): void {
    // DOM에서 모든 스타일 엘리먼트 제거
    this.partitions.forEach((partition) => {
      if (partition.styleElement.parentNode) {
        partition.styleElement.parentNode.removeChild(partition.styleElement);
      }
    });

    this.categoryPartitions.forEach((partition) => {
      if (partition.styleElement.parentNode) {
        partition.styleElement.parentNode.removeChild(partition.styleElement);
      }
    });

    // 상태 초기화
    this.partitions = [];
    this.categoryPartitions.clear();
    this.partitionCounter = 0;
    this.classToPartitionMap.clear();
    this.classToCategoryPartitionMap.clear();
  }
}
