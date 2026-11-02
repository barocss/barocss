/** The authored Z spread: partial spreads include both endpoints; full turns share the turn. */
export function circularPatternStep(span: number, count: number): number {
  if (count === 1) return 360;
  return Math.round((span >= 360 ? 360 / count : span / (count - 1)) * 1e6) / 1e6;
}

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Validate optional intent metadata without changing legacy nodes or native pattern admission. */
export function circularPatternSpanProblem(input: unknown): string | null {
  const stack: unknown[] = [input], seen = new Set<object>();
  while (stack.length) {
    const doc = stack.pop();
    if (!record(doc) || seen.has(doc)) continue;
    seen.add(doc);
    if (Array.isArray(doc.nodes)) for (const node of doc.nodes) {
      if (!record(node) || node.kind !== 'circular-pattern' || node.span === undefined) continue;
      if (typeof node.span !== 'number' || !Number.isFinite(node.span) || node.axis !== 'z') return '[VALUE] Circular body pattern spread must be a finite number on axis Z.';
      // Count admission belongs to the native pattern. Metadata must not admit or clamp invalid counts.
      if (typeof node.count !== 'number' || !Number.isInteger(node.count) || node.count < 1 || node.count > 64) continue;
      if (typeof node.angle !== 'number' || !Number.isFinite(node.angle) || node.angle !== circularPatternStep(node.span, node.count)) return '[VALUE] Circular body pattern spread does not match its count and angle.';
    }
    if (Array.isArray(doc.instances)) for (const instance of doc.instances) if (record(instance)) stack.push(instance.doc);
    if (record(doc.pendingParts)) for (const pending of Object.values(doc.pendingParts)) if (record(pending)) stack.push(pending.doc);
  }
  return null;
}
