import { parseClassName } from './parser';
import { parseClassToAst, generateCssRules, GenerateCssRulesResult } from './engine';
import type { Context } from './context';
import { astCache } from '../utils/cache';

/**
 * Incremental parsing system for efficient class processing
 * 
 * This class provides an optimized approach to CSS class processing by:
 * - Tracking processed classes to avoid redundant work
 * - Batching multiple class operations for better performance
 * - Supporting both synchronous and asynchronous processing modes
 * 
 * ## Usage Patterns
 * 
 * ### Universal Usage (Node.js & Browser)
 * ```typescript
 * const parser = new IncrementalParser(ctx);
 * 
 * // Process classes synchronously
 * const results = parser.processClasses(['bg-blue-500', 'text-lg']);
 * 
 * // Process single class
 * const result = parser.processClass('bg-red-500');
 * 
 * // Get statistics
 * const stats = parser.getStats();
 * ```
 * 
 * ### Browser Integration
 * ```typescript
 * const parser = new IncrementalParser(ctx);
 * const BrowserRuntime = new BrowserRuntime();
 * 
 * // Process classes and manually inject CSS
 * const results = parser.processClasses(['bg-blue-500', 'text-lg']);
 * results.forEach(result => {
 *   if (result.css) {
 *     BrowserRuntime.insertRule(result.css);
 *   }
 * });
 * 
 * // Use with ChangeDetector for automatic DOM monitoring
 * const detector = new ChangeDetector(parser);
 * detector.observe(document.body, { scan: true });
 * ```
 * 
 * ## Architecture
 * 
 * - **IncrementalParser**: Pure CSS processing (works in Node.js and browser)
 * - **ChangeDetector**: Browser-only DOM monitoring (uses MutationObserver)
 * - **BrowserRuntime**: Browser-only CSS injection (uses DOM APIs)
 */
export class IncrementalParser {
  /** Set of class names that have already been processed to avoid duplicates */
  private processedClasses = new Set<string>();
  
  /** BAROCSS context for theme and utility resolution */
  private ctx: Context;
  
  /** Maximum number of classes to process in a single batch */
  private batchSize = 50;
  
  /** Debounce delay for batch processing in milliseconds */
  private debounceMs = 16;
  
  /** Set of classes waiting to be processed */
  private pendingClasses = new Set<string>();
  
  /** Timer for debounced batch processing */
  private batchTimer: number | null = null;

  /**
   * Create a new IncrementalParser instance
   * 
   * @param ctx - BAROCSS context for theme and utility resolution
   */
  constructor(ctx: Context) {
    this.ctx = ctx;
  }

  /**
   * Processes a single CSS class and generates its AST and CSS representation
   * 
   * This method performs the complete pipeline for a single class:
   * 1. Checks if the class has already been processed
   * 2. Parses the class name to extract utility information
   * 3. Generates the Abstract Syntax Tree (AST)
   * 4. Converts the AST to CSS rules
   * 5. Marks the class as processed to avoid future duplicates
   * 
   * @param className - The CSS class name to process (e.g., 'bg-blue-500')
   * @returns Object containing AST and CSS, or null if processing failed or class was already processed
   */
  processClass(className: string): GenerateCssRulesResult | null {
    // Check if already processed
    if (this.processedClasses.has(className)) {
      // console.log('[IncrementalParser] Class already processed:', className);
      return null; // Already processed
    }

    try {      
      // Parse class
      const parseResult = parseClassName(className);
      
      if (!parseResult.utility) {
        return null;
      }

      // Generate AST
      const ast = parseClassToAst(className, this.ctx);

      // console.log('[IncrementalParser] ast', className, ast);
      
      if (ast.length === 0) {
        // eslint-disable-next-line no-console
        console.warn('[IncrementalParser] ast is empty', className);
        return null;
      }

      // Generate CSS using the same method as runtime
      const rules = generateCssRules(className, this.ctx, { dedup: false });
      
      if (rules.length === 0) {
        return null;
      }

      const rule = rules[0];
      if (!rule.css) {
        return null;
      }

      // Mark as processed
      this.processedClasses.add(className);

      return { 
        cls: className, 
        ast, 
        css: rule.css, 
        cssList: rule.cssList, 
        rootCss: rule.rootCss,
        rootCssList: rule.rootCssList
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[IncrementalParser] Failed to process class:', className, error);
      return null;
    }
  }

  /**
   * Processes multiple CSS classes in batches for optimal performance
   * 
   * This method handles multiple classes efficiently by:
   * - Filtering out already processed classes to avoid redundant work
   * - Processing classes in configurable batch sizes
   * - Returning comprehensive results for each processed class
   * 
   * @param classes - Array of CSS class names to process
   * @returns Array of processing results, each containing className, AST, and CSS
   */
  processClasses(classes: string[]): Array<GenerateCssRulesResult> {
    const results: Array<GenerateCssRulesResult> = [];
    const newClasses = classes.filter(cls => !this.processedClasses.has(cls));

    if (newClasses.length === 0) {
      return results; // All classes already processed
    }

    // Process in batches for better performance
    for (let i = 0; i < newClasses.length; i += this.batchSize) {
      const batch = newClasses.slice(i, i + this.batchSize);
      
      for (const className of batch) {
        const result = this.processClass(className);
        if (result) {
          results.push(result);
        }
      };
    }

    return results;
  }

  /**
   * Adds classes to the pending queue for asynchronous batch processing
   * 
   * This method is used by the ChangeDetector when new classes are discovered
   * in the DOM. Classes are queued and processed together to minimize
   * performance impact from frequent DOM mutations.
   * 
   * @param classes - Array of CSS class names to queue for processing
   */
  addToPending(classes: string[]): void {
    classes.forEach(cls => this.pendingClasses.add(cls));
    this.scheduleBatchProcessing();
  }

  /**
   * Schedule batch processing with debouncing
   * 
   * This method uses setTimeout to debounce rapid class additions
   * and process them in batches for better performance.
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    if (typeof window !== 'undefined') {
      this.batchTimer = window.setTimeout(() => {
        this.processPendingClasses();
      }, this.debounceMs);
    } else {
      // In server environment, process immediately
      this.processPendingClasses();
    }
  }

  /**
   * Process pending classes from the queue
   * 
   * This method is called by the debounced timer to process
   * all classes that have been added to the pending queue.
   */
  private processPendingClasses(): void {
    if (this.pendingClasses.size === 0) return;

    const classesToProcess = Array.from(this.pendingClasses);
    this.pendingClasses.clear();

    // Use common method for processing
    this.applyClasses(classesToProcess);
  }

  /**
   * Core method that processes classes and marks them as processed
   * 
   * This is the common processing logic used by both pending and synchronous
   * processing methods. It:
   * 1. Processes the provided classes using the batch processor
   * 2. Marks classes as processed to prevent duplicates
   * 
   * @param classes - Array of CSS class names to process
   */
  private applyClasses(classes: string[]): void {
    this.processClasses(classes);
    
    // Mark classes as processed
    classes.forEach(cls => {
      this.markProcessed(cls);
    });
  }

  /**
   * Returns comprehensive statistics about the incremental parser's state
   * 
   * This method provides detailed metrics including:
   * - Number of processed classes
   * - Number of pending classes
   * - Cache statistics from AST and CSS caches
   * 
   * @returns Object containing processing statistics and cache information
   */
  getStats() {
    return {
      processedClasses: this.processedClasses.size,
      pendingClasses: this.pendingClasses.size,
      cacheStats: {
        ast: astCache.getStats(),
        css: {} // No CSS cache, so return empty object
      }
    };
  }

  /**
   * Clears all processed classes and pending queue
   * 
   * This method is useful when the theme or configuration changes,
   * requiring all classes to be reprocessed. It:
   * - Clears the processed classes set
   * - Clears the pending classes queue
   * - Cancels any pending batch processing timer
   */
  clearProcessed(): void {
    this.processedClasses.clear();
    this.pendingClasses.clear();
    if (this.batchTimer && typeof window !== 'undefined') {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Checks if a specific class has been processed
   * 
   * @param cls - The CSS class name to check
   * @returns True if the class has been processed, false otherwise
   */
  isProcessed(cls: string): boolean {
    return this.processedClasses.has(cls);
  }

  /**
   * Marks a class as processed to prevent future duplicate processing
   * 
   * @param cls - The CSS class name to mark as processed
   */
  markProcessed(cls: string): void {
    this.processedClasses.add(cls);
  }

  /**
   * Process classes synchronously and update BrowserRuntime cache
   * This method is used by ChangeDetector for scan operations
   */
  processClassesSync(classes: string[]): void {
    this.applyClasses(classes);
  }

  /**
   * Returns all currently processed class names
   * 
   * This method is useful for debugging and monitoring purposes,
   * providing visibility into which classes have been processed.
   * 
   * @returns Array of all processed class names
   */
  getProcessedClasses(): string[] {
    return Array.from(this.processedClasses);
  }
}
