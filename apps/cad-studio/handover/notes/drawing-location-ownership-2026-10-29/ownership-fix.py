from pathlib import Path
root=Path('packages/barocss-cad-model/src')
p=root/'drawing/callout.ts';s=p.read_text()
start=s.index('/** The callout of the hole')
end=s.index('  const h = nodes[i];',start)
s=s[:start]+'''function lengthOf(value: unknown, parameters: Readonly<Record<string, number>>): number | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const key = (value as { parameter?: unknown }).parameter;
    if (typeof key !== 'string' || !Object.hasOwn(parameters, key)) return null;
    value = parameters[key];
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const rounded = n(value);
  return Number.isFinite(rounded) ? rounded : null;
}
/** The authored inner-hole feature used by both the formatter and its companion location identity. */
function calloutSource(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>>): { index: number; prefix: string; copy: string } | null {
  let i = -1, prefix = '', copy = '';
  for (const face of edge.split('|')) {
    const match = /^(.*?)(n\\d+)(_p\\d+)?\\.side\\d+/.exec(face);
    if (!match) continue;
    const index = nodeIndexOf(nodes, match[2]);
    if (nodes[index]?.kind === 'hole') { i = index; prefix = match[1]; copy = match[3] ?? ''; break; }
  }
  if (i < 0) return null;
  const prev = nodes[i - 1], cur = nodes[i];
  if (cur.kind === 'hole' && prev?.kind === 'hole' && cur.parent.node === i - 1 && same(cur.center, prev.center)) {
    const radius = lengthOf(cur.radius, parameters), previousRadius = lengthOf(prev.radius, parameters);
    if (radius === null || previousRadius === null) return null;
    // The wider dependent cut is a compound location only when its depth also defines a valid callout.
    if (radius > previousRadius) { if (lengthOf(cur.depth, parameters) === null) return null; i--; }
  }
  return { index: i, prefix, copy };
}

/** The callout's authored location owner, preserving an assembly path and a pattern-copy suffix. */
export function holeCalloutOwner(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>> = {}): string | null {
  const source = calloutSource(nodes, edge, parameters); if (!source) return null;
  const h = nodes[source.index];
  if (h.kind !== 'hole' || lengthOf(h.radius, parameters) === null || (h.depth !== undefined && lengthOf(h.depth, parameters) === null)) return null;
  return `${source.prefix}${h.id ?? `n${source.index}`}${source.copy}`;
}

/** The callout of the hole whose round face an edge (by its name) bounds, or null for any other edge. */
export function holeCallout(nodes: readonly ModelNode[], edge: string, parameters: Readonly<Record<string, number>> = {}): string | null {
  const source = calloutSource(nodes, edge, parameters); if (!source) return null;
  const i = source.index;
'''+s[end:]
s=s.replace('length(h.radius)', 'lengthOf(h.radius, parameters)').replace('length(h.depth)', 'lengthOf(h.depth, parameters)').replace('length(next.radius)', 'lengthOf(next.radius, parameters)').replace('length(next.depth)', 'lengthOf(next.depth, parameters)')
p.write_text(s)
p=root/'drawing/measurement.ts';s=p.read_text().replace('type Callout = (edge: string) => string | null;', 'type LocationOwner = (edge: string) => string | null;')
s=s.replace('callout?: Callout', 'locationOwner?: LocationOwner').replace(', callout)', ', locationOwner)').replace(', callout,', ', locationOwner,')
s=s.replace("    // A combined callout explicitly names both concentric sizes, including a separately cut counterbore.\n    const ca = callout?.(a.edge), cb = callout?.(b.edge);\n    if (ca && ca === cb && /CBORE|CSK/.test(ca)) return true;", "    // A compound location must come from the actual authored inner/outer association, never rendered text.\n    const ao = locationOwner?.(a.edge), bo = locationOwner?.(b.edge);\n    if (ao && ao === bo) return true;")
s=s.replace("  return a.at === 'end' && b.at === 'end' ? equalOwners(owners(a.edge), owners(b.edge)) : samePointDependency(a, av, b, bv, axis, locationOwner);", "  if (a.at !== 'end' || b.at !== 'end') return samePointDependency(a, av, b, bv, axis, locationOwner);\n  if (!equalOwners(owners(a.edge), owners(b.edge))) return false;\n  const ap = resolvePoint(av, a), bp = resolvePoint(bv, b), k = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;\n  return !!ap && !!bp && Math.abs(ap[k] - bp[k]) <= SAME;")
p.write_text(s)
p=root/'drawing/issues.ts';s=p.read_text().replace('ctx.callout)) { had', 'ctx.locationOwner)) { had').replace('axis, ctx.callout)', 'axis, ctx.locationOwner)').replace('axis, ctx.callout, true)', 'axis, ctx.locationOwner, true)')
s=s.replace('ctx.elements ?? [], ctx.sections).dimensions', 'ctx.elements ?? [], ctx.sections, ctx.locationOwner).dimensions')
s=s.replace("sheet: Sheet; callout: (edge: string, diameter?: number) => string | null;", "sheet: Sheet; callout: (edge: string, diameter?: number) => string | null;\n  /** Authored identity for a combined hole callout; text equality cannot establish it. */\n  locationOwner?: (edge: string) => string | null;")
s=s.replace("callout: (edge: string, diameter?: number) => string | null; fitMiss?", "callout: (edge: string, diameter?: number) => string | null; locationOwner?: (edge: string) => string | null; fitMiss?")
s=s.replace("sheet, callout: i.callout, ...(i.sections", "sheet, callout: i.callout, ...(i.locationOwner ? { locationOwner: i.locationOwner } : {}), ...(i.sections")
p.write_text(s)
p=root/'drawing/auto.ts';s=p.read_text()
s=s.replace("sections: readonly SheetSection[] = []): { dimensions", "sections: readonly SheetSection[] = [], locationOwner?: (edge: string) => string | null): { dimensions")
s=s.replace('axisOf(id, k), callout)', 'axisOf(id, k), locationOwner)')
s=s.replace('manualSpans, dimViews, base, callout);', 'manualSpans, dimViews, base, locationOwner);')
s=s.replace('base: (v: DimView) => ViewId, callout: (edge: string) => string | null): void', 'base: (v: DimView) => ViewId, locationOwner?: (edge: string) => string | null): void')
s=s.replace('0 : 1), callout)) return;', '0 : 1), locationOwner)) return;')
s=s.replace("if (d.kind === 'linear' && m.kind === 'linear') return d.orient === m.orient && new Set([ref(d.a), ref(d.b)]).size === new Set([ref(d.a), ref(d.b), ref(m.a), ref(m.b)]).size;", "if (d.kind === 'linear' && m.kind === 'linear') {\n    if (d.orient !== m.orient || (d.count ?? 1) !== (m.count ?? 1)) return false;\n    return (ref(d.a) === ref(m.a) && ref(d.b) === ref(m.b)) || (!d.count && !m.count && ref(d.a) === ref(m.b) && ref(d.b) === ref(m.a));\n  }")
p.write_text(s)
p=root/'chat/drawing.ts';s=p.read_text().replace("import { holeCallout }", "import { holeCallout, holeCalloutOwner }")
s=s.replace('return { views: r.views, settings, fastenerSizes:', 'return { views: r.views, settings, locationOwner: e => holeCalloutOwner(doc.nodes, e, doc.parameters), fastenerSizes:')
s=s.replace('i.callout, i.elements, i.sections)', 'i.callout, i.elements, i.sections, i.locationOwner)')
p.write_text(s)
p=root/'drawing/layout.ts';s=p.read_text().replace('i.callout, i.elements, i.sections)', 'i.callout, i.elements, i.sections, i.locationOwner)');p.write_text(s)
# Existing direct Model conformance consumers also provide the actual owner relation.
for name in ['auto-dimension.test.ts','drawing-issues.test.ts','auto-layout.test.ts']:
 p=Path('packages/barocss-cad-model/test')/name;s=p.read_text().replace("import { holeCallout }", "import { holeCallout, holeCalloutOwner }")
 if name=='auto-dimension.test.ts':
  s=s.replace('autoDimensions(v, layout, settings, callout)', 'autoDimensions(v, layout, settings, callout, [], [], e => holeCalloutOwner(doc.nodes, e))')
  s=s.replace('autoDimensions(first.v, first.layout, withMine, e => holeCallout(doc.nodes, e))', 'autoDimensions(first.v, first.layout, withMine, e => holeCallout(doc.nodes, e), [], [], e => holeCalloutOwner(doc.nodes, e))')
 else:
  s=s.replace('settings, callout: e => holeCallout(doc.nodes, e), meta:', 'settings, callout: e => holeCallout(doc.nodes, e), locationOwner: e => holeCalloutOwner(doc.nodes, e), meta:')
  s=s.replace('autoDimensions(i.views, issueContext(i).layout, s, i.callout)', 'autoDimensions(i.views, issueContext(i).layout, s, i.callout, [], [], i.locationOwner)')
 p.write_text(s)
p=Path('packages/barocss-cad-model/test/drawing-independent-locations.test.ts');s=p.read_text().replace('autoDimensions(ctx.views, ctx.layout, settings, ctx.callout)', 'autoDimensions(ctx.views, ctx.layout, settings, ctx.callout, [], [], ctx.locationOwner)').replace('autoDimensions(ctx.views, ctx.layout, input, ctx.callout)', 'autoDimensions(ctx.views, ctx.layout, input, ctx.callout, [], [], ctx.locationOwner)');p.write_text(s)
