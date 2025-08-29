/**
 * StylePartitionManager
 *
 * StylePartitionManager is a singleton class that manages the partition of styles into different parts.
 * It is used to manage the partition of styles into different parts.
 *
 */

import { GenerateCssRulesResult } from "../core/engine";
import { parseResultCache } from "../utils/cache";

export interface StylePartition {
  id: string;
  styles: string[];
  styleElement: HTMLStyleElement;
}

export class StylePartitionManager {
  private partitions: StylePartition[] = [];
  private categoryPartitions: Map<string, StylePartition> = new Map();
  private partitionCounter = 0;
  private maxRulesPerPartition = 50;
  private insertionPoint: HTMLElement;
  private classToPartitionMap = new Map<string, number>();
  private classToCategoryPartitionMap = new Map<string, string>();
  private styleIdPrefix = "cssma-style-partition-";

  constructor(
    insertionPoint: HTMLElement,
    maxRulesPerPartition: number = 50,
    styleIdPrefix: string = "cssma-style-partition-"
  ) {
    this.insertionPoint = insertionPoint;
    this.maxRulesPerPartition = maxRulesPerPartition;
    this.styleIdPrefix = styleIdPrefix;

    this.initializeDefaultPartition();
  }

  private initializeDefaultPartition() {
    this.createNewPartition();
  }

  private createNewCategoryPartition(category: string) {
    const newPartition: StylePartition = {
      id: this.styleIdPrefix + `-${category}`,
      styles: [],
      styleElement: document.createElement("style"),
    };

    // set id
    newPartition.styleElement.id = newPartition.id;
    newPartition.styleElement.setAttribute("data-cssma", "partition");
    newPartition.styleElement.setAttribute("data-category", category);

    // set insertion point
    this.insertionPoint.appendChild(newPartition.styleElement);

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
    newPartition.styleElement.setAttribute("data-cssma", "partition");
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

  addRule(rule: string) {
    if (this.hasRule(rule)) {
      return false;
    }

    if (this.currentPartition.styles.length >= this.maxRulesPerPartition) {
      this.createNewPartition();
    }

    const currentPartition = this.currentPartition;
    const partitionIndex = this.partitions.length - 1;

    try {
      // CSS 규칙 삽입
      const sheet = currentPartition.styleElement.sheet;
      if (sheet) {
        sheet.insertRule(rule, sheet.cssRules.length);
      } else {
        // sheet가 없는 경우 textContent로 폴백
        currentPartition.styleElement.textContent += rule + "\n";
      }

      // 성공적으로 삽입된 경우에만 캐시 업데이트
      this.setRuleCache(rule, partitionIndex);
      currentPartition.styles.push(rule);

      return true;
    } catch (error) {
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
      const sheet = categoryPartition.styleElement.sheet;
      if (sheet) {
        sheet.insertRule(rule, sheet.cssRules.length);
      } else {
        categoryPartition.styleElement.textContent += rule + "\n";
      }
    } catch (error) {
      console.warn(
        `[StylePartitionManager] Failed to insert rule in category: ${category} ${rule}`,
        error
      );
      return false;
    }

    this.setCategoryRuleCache(rule, category);
    categoryPartition.styles.push(rule);

    return true;
  }

  addRules(rules: GenerateCssRulesResult[]) {
    let success = 0;
    let failed = 0;

    // rules.sort((a, b) => {
    //   const aPriority = parseResultCache.get(a.cls)?.utility?.priority;
    //   const bPriority = parseResultCache.get(b.cls)?.utility?.priority;
    //   return (aPriority ?? 0) - (bPriority ?? 0);
    // });

    for (const rule of rules) {
      const parsedResult = parseResultCache.get(rule.cls);
      const category = parsedResult?.utility?.category;

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
    this.partitionCounter = 0;
    this.classToPartitionMap.clear();
    this.classToCategoryPartitionMap.clear();
  }
}
