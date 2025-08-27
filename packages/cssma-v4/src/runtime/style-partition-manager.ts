/**
 * StylePartitionManager
 *
 * StylePartitionManager is a singleton class that manages the partition of styles into different parts.
 * It is used to manage the partition of styles into different parts.
 *
 */

export interface StylePartition {
  id: string;
  styles: string[];
  styleElement: HTMLStyleElement;
}

export class StylePartitionManager {
  private partitions: StylePartition[] = [];
  private partitionCounter = 0;
  private maxRulesPerPartition = 50;
  private insertionPoint: HTMLElement;
  private classToPartitionMap = new Map<string, number>();
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

  setRuleCache(rule: string, partitionIndex: number) {
    this.classToPartitionMap.set(rule, partitionIndex);
  }

  get currentPartition() {
    return this.partitions[this.partitions.length - 1];
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

  addRules(rules: string[]) {
    let success = 0;
    let failed = 0;

    for (const rule of rules) {
      if (this.addRule(rule)) {
        success++;
      } else {
        failed++;
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

    // 상태 초기화
    this.partitions = [];
    this.partitionCounter = 0;
    this.classToPartitionMap.clear();
  }
}
