import { normalizeClassNameList } from "./utils";

/**
 * #269: per-class refcount over the observed root, plus a delayed sweep that
 * reclaims classes no live element carries any more.
 *
 * Counting is reconciliation, not delta arithmetic: for every element a
 * mutation batch touches (attribute target, added subtree, removed subtree) we
 * compare the classes we last counted for it with what it carries *now*
 * (nothing if it is no longer inside the root). That makes the count
 * independent of record order, so remove-then-re-add in one batch, moves
 * between parents and edits made while detached all settle to the true state.
 * An element we miss can only leak a count (rule kept), never drop one.
 *
 * Before a class is reclaimed the sweep re-checks the live DOM
 * (`getElementsByClassName`), so even a miscount cannot unstyle a live element.
 */
export interface ClassGcHost {
  /** Delete the rules of these classes. */
  reclaim(classes: string[]): void;
  /** Whether a class must never be reclaimed (pinned, found in a pre-existing sheet, ...). */
  isPermanent(cls: string): boolean;
  /** Number of generated rules/classes currently cached (for the LRU cap). */
  cachedCount(): number;
}

export class ClassGc {
  private counts = new Map<string, number>();
  private counted = new WeakMap<Element, string[]>();
  /** class -> time its count reached 0 (insertion order = oldest first). */
  private candidates = new Map<string, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private root: Element | null = null;

  constructor(
    private host: ClassGcHost,
    private graceMs: number,
    private maxRules: number,
    private now: () => number = () => Date.now(),
  ) {}

  /** Start counting for a new root: count every element currently inside it. */
  setRoot(root: Element): void {
    this.counts.clear();
    this.counted = new WeakMap();
    this.candidates.clear();
    this.cancel();
    this.root = root;
    this.reconcileTree(root);
  }

  count(cls: string): number {
    return this.counts.get(cls) ?? 0;
  }

  /** Re-count `el` and (optionally) all its descendants from their current state. */
  reconcileTree(node: Node): void {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    this.reconcile(el);
    el.querySelectorAll('[class]').forEach(child => this.reconcile(child));
  }

  reconcile(el: Element): void {
    const root = this.root;
    const live = !!root && root.contains(el);
    const next = live ? Array.from(new Set(normalizeClassNameList(el.getAttribute('class')))) : [];
    const prev = this.counted.get(el);
    if (!prev && next.length === 0) return;
    const prevSet = new Set(prev ?? []);
    const nextSet = new Set(next);
    for (const cls of nextSet) {
      if (prevSet.has(cls)) continue;
      const c = (this.counts.get(cls) ?? 0) + 1;
      this.counts.set(cls, c);
      this.candidates.delete(cls);
    }
    for (const cls of prevSet) {
      if (nextSet.has(cls)) continue;
      const c = (this.counts.get(cls) ?? 0) - 1;
      if (c > 0) {
        this.counts.set(cls, c);
      } else {
        this.counts.delete(cls);
        this.candidates.delete(cls); // re-insert so order stays oldest-first
        this.candidates.set(cls, this.now());
      }
    }
    if (next.length) this.counted.set(el, next);
    else this.counted.delete(el);
  }

  /** Call after a mutation batch has been counted and its classes inserted. */
  afterBatch(): void {
    if (this.candidates.size === 0) return;
    if (this.host.cachedCount() > this.maxRules) {
      this.schedule(0);
    } else {
      this.schedule(this.graceMs);
    }
  }

  private schedule(delay: number): void {
    if (this.timer !== null) {
      if (delay > 0) return;
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.sweep();
    }, delay);
  }

  /** Reclaim candidates whose grace period elapsed (plus LRU overflow). Public for tests. */
  sweep(): void {
    const now = this.now();
    const overflow = Math.max(0, this.host.cachedCount() - this.maxRules);
    const doomed: string[] = [];
    let evicted = 0;
    for (const [cls, since] of this.candidates) {
      const expired = now - since >= this.graceMs;
      if (!expired && evicted >= overflow) continue;
      this.candidates.delete(cls);
      if (this.count(cls) > 0 || this.inDom(cls) || this.host.isPermanent(cls)) continue;
      doomed.push(cls);
      if (!expired) evicted++;
    }
    if (doomed.length) this.host.reclaim(doomed);
    if (this.candidates.size) this.schedule(this.graceMs);
  }

  private inDom(cls: string): boolean {
    const root = this.root;
    if (!root) return false;
    // Document-wide: an element outside the observed root (portal, <html class>) may share the class.
    const doc = root.ownerDocument ?? document;
    return root.classList.contains(cls)
      || doc.documentElement.classList.contains(cls)
      || doc.getElementsByClassName(cls).length > 0;
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  stats() {
    return { trackedClasses: this.counts.size, candidates: this.candidates.size };
  }
}
