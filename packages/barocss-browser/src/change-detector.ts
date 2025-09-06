import { IncrementalParser, parseResultCache } from "@barocss/kit";
import { BrowserRuntime } from "./browser-runtime";
import { normalizeClassNameList } from "./utils";

/**
 * Change detection system for DOM mutations
 * 
 * ⚠️ BROWSER-ONLY: This class is designed for browser environments only.
 * It uses MutationObserver and DOM APIs that are not available in Node.js.
 * 
 * This class monitors DOM changes and automatically processes new CSS classes
 * that are added to elements. It uses MutationObserver to detect:
 * - Class attribute changes on existing elements
 * - New elements being added to the DOM
 * - Changes in child elements
 * 
 * For server-side usage, use IncrementalParser directly with processClassesSync()
 * or processClasses() methods.
 */
export class ChangeDetector {
    /** MutationObserver instance for DOM change detection */
    private observer: MutationObserver | null = null;
    
    /** Reference to IncrementalParser for class processing */
    private incrementalParser: IncrementalParser;
    
    /** Reference to BrowserRuntime for CSS injection (optional) */
    private BrowserRuntime?: BrowserRuntime;
    
    /** Set of elements that have already been processed to avoid duplicates */
    private processedElements = new WeakSet<Element>();
  
    /**
     * Create a new ChangeDetector instance
     * 
     * @param incrementalParser - IncrementalParser instance for class processing
     * @param BrowserRuntime - Optional BrowserRuntime instance for CSS injection
     */
    constructor(incrementalParser: IncrementalParser, BrowserRuntime?: BrowserRuntime) {
      this.incrementalParser = incrementalParser;
      this.BrowserRuntime = BrowserRuntime;
    }
  
    /**
     * Starts observing DOM changes for new CSS classes
     * 
     * This method sets up a MutationObserver that monitors:
     * - Attribute changes (specifically class attribute modifications)
     * - Child list changes (new elements being added)
     * - Subtree changes (changes in descendant elements)
     * 
     * The observer automatically processes any new classes it discovers
     * by adding them to the IncrementalParser's pending queue.
     * 
     * @param root - The root element to observe (defaults to document.body)
     * @param options - Configuration options including initial scan and onReady callback
     * @returns The MutationObserver instance for external control
     */
    observe(root: HTMLElement = document.body, options?: { scan?: boolean; onReady?: () => void }): MutationObserver {
      if (typeof window === 'undefined') {
        // Return dummy observer for Node.js environment
        return new MutationObserver(() => {});
      }
  
      if (this.observer) {
        this.observer.disconnect();
      }
  
      this.observer = new MutationObserver((mutations) => {
        const newClasses = new Set<string>();
  
        mutations.forEach(mutation => {
          // Handle attribute changes (class modifications)
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target as HTMLElement;
            if (target.className) {
              // SVG className is SVGAnimatedString; convert to string with toString()
              // HTMLElement className is string; use as-is
              const classes = normalizeClassNameList(target.className);
              classes.forEach(cls => {
                if (!this.incrementalParser.isProcessed(cls)) {
                  newClasses.add(cls);
                }
              });
            }
          }
  
          // Handle new nodes
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node instanceof HTMLElement) {
                this.processElement(node, newClasses);
                // Process child elements
                node.querySelectorAll('[class]').forEach(el => {
                  this.processElement(el as HTMLElement, newClasses);
                });
              }
            });
          }
        });
  
        // Process new classes in batch
        if (newClasses.size > 0) {
          const classesArray = Array.from(newClasses);
          
          // Process classes directly and update BrowserRuntime cache
          const results = this.incrementalParser.processClasses(classesArray);
          // If BrowserRuntime is available, apply results via public API
          this.BrowserRuntime?.applyParseResults(results);
        }
      });
  
      this.observer.observe(root, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class'],
        childList: true
      });
  
      // Handle scan option - process existing classes
      if (options?.scan) {
        this.scanExistingClasses(root, options);
      }
  
      return this.observer;
    }
  
    /**
     * Scan existing classes in the DOM and process them
     */
    private scanExistingClasses(root: HTMLElement, options?: { onReady?: () => void }): void {
      const existingClasses = new Set<string>();
          
      // Include root itself
      if (root.className) {
        const classes = normalizeClassNameList(root.className);
        classes.forEach(cls => {
          if (!this.incrementalParser.isProcessed(cls)) {
            existingClasses.add(cls);
          }
        });
      }
      
      // Scan all child elements
      const elementsWithClass = root.querySelectorAll('[class]') as unknown as HTMLElement[];
      // console.log('[BrowserRuntime] scanExistingClasses', elementsWithClass);
      for (const el of elementsWithClass) {
        if (el.className) {
          // SVG className is SVGAnimatedString; convert to string with toString()
          // HTMLElement className is string; use as-is
          const classes = normalizeClassNameList(el.className);
          // console.log('[BrowserRuntime] scanExistingClasses', classes);
  
          for (const cls of classes) {
            if (!this.incrementalParser.isProcessed(cls)) {
              existingClasses.add(cls);
            }
          };
        }
      }
  
      // console.log('[BrowserRuntime] scanExistingClasses', existingClasses);
  
      if (existingClasses.size > 0) {
        // Process classes using IncrementalParser
        const classes = Array.from(existingClasses);
        const results = this.incrementalParser.processClasses(classes);
  
        const layoutResults = results.filter(result => parseResultCache.get(result.cls)?.utility?.category === 'layout');
        const nonLayoutResults = results.filter(result => parseResultCache.get(result.cls)?.utility?.category !== 'layout');
  
        
        // Apply layout results
        this.BrowserRuntime?.applyParseResults(layoutResults);
        options?.onReady?.();
  
        // Apply non-layout results
        this.BrowserRuntime?.applyParseResults(nonLayoutResults);
      }
    }
  
    /**
     * Processes an individual element and extracts new classes
     * 
     * This method is called for each element discovered during DOM mutations.
     * It:
     * - Checks if the element has already been processed
     * - Extracts all class names from the element's className
     * - Filters out already processed classes
     * - Adds new classes to the collection for batch processing
     * - Marks the element as processed to avoid duplicates
     * 
     * @param element - The HTML element to process
     * @param newClasses - Set to collect newly discovered class names
     */
    private processElement(element: HTMLElement, newClasses: Set<string>): void {
      if (this.processedElements.has(element)) return;
  
      if (element.className) {
        // SVG className is SVGAnimatedString; convert to string with toString()
        // HTMLElement className is string; use as-is
        const classes = normalizeClassNameList(element.className);
        classes.forEach(cls => {
          if (!this.incrementalParser.isProcessed(cls)) {
            newClasses.add(cls);
          }
        });
      }
  
      this.processedElements.add(element);
    }
  
    /**
     * Stops observing DOM changes and cleans up resources
     * 
     * This method disconnects the MutationObserver and clears the
     * observer reference to prevent memory leaks and allow the
     * ChangeDetector to be properly garbage collected.
     */
    disconnect(): void {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }
  } 