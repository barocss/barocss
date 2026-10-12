import type { PrismDisplayComponent, PrismSerialLineage } from './prism-feature-scene.js';
function check(condition: unknown, detail: string): asserts condition { if (!condition) throw new Error(`Serial display: ${detail}`); }
/** Copied DTO self-consistency only; native reconstruction remains authoritative. */
export function checkSerialLineage(component: PrismDisplayComponent, source: PrismDisplayComponent) {
  const l = component.lineage as PrismSerialLineage;
  const sameFields = (a: unknown, b: unknown, fields: string[]) => !!a && !!b && fields.every(k => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
  const F = ['sourceId', 'faceId', 'surfaceId', 'loopId'];
  const U = [...F, 'useId', 'curveId', 'pcurveId'];
  const faceKey = (f: unknown) => JSON.stringify(F.map(k => (f as Record<string, unknown>)[k]));
  const one = <T>(values: T[], reason: string): T => { check(values.length === 1, reason); return values[0]; };
  const bounded = (values: unknown, lo: number, hi: number, reason: string): void => {
    check(Array.isArray(values) && values.length >= lo && values.length <= hi, reason);
  };
  const sourceUse = (ref: unknown) => source.boundaries.filter(b =>
    sameFields(b, ref, ['sourceId', 'faceId', 'loopId', 'useId', 'curveId', 'pcurveId']) &&
    source.mesh.faces[b.faceIndex].surfaceId === (ref as { surfaceId: string }).surfaceId);
  const { original, subtraction: sub, split, chamfer: ch, resolution: r } = l;
  check(JSON.stringify(original) === JSON.stringify(source.lineage), 'serial source lineage differs');
  bounded(original.caps, 2, 2, 'original caps'); bounded(original.segments, 3, 8, 'original segments');
  const originalFaces = [...original.caps.map(c => c.target), ...original.segments.map(s => s.wall)];
  check(originalFaces.length === source.mesh.faces.length && originalFaces.every(f =>
    source.mesh.faces.filter(m => sameFields(m, f, ['sourceId', 'faceId', 'surfaceId'])).length === 1), 'complete original face inventory');
  bounded(sub.nodes, 4, 32, 'subtraction node budget'); bounded(sub.faces, 4, 12, 'subtraction face budget');
  check(new Set(sub.nodes.map(n => n.key)).size === sub.nodes.length &&
    new Set(sub.faces.map(f => faceKey(f.output))).size === sub.faces.length, 'unique subtraction inventory');
  const subNodeKeys = new Set(sub.nodes.map(n => n.key));
  for (const sf of sub.faces) {
    bounded(sf.sources, 1, 24, 'subtraction source inventory'); bounded(sf.edges, 3, 8, 'subtraction edge inventory');
    check(new Set(sf.edges.map(e => e.useId)).size === sf.edges.length, 'unique subtraction uses');
    for (const s of sf.sources) if (s.operand === 'parent')
      one(source.mesh.faces.filter(f => sameFields(f, s, F)), 'original face source missing');
    for (const e of sf.edges) {
      check(e.nodeKeys.length === 2 && e.nodeKeys.every(k => subNodeKeys.has(k)), 'subtraction edge node link');
      for (const o of e.originalEdges) if (o.operand === 'parent') {
        const b = one(sourceUse(o), 'original complete use missing');
        check(b.edgeId === o.edgeId, 'original native edge differs');
      }
    }
  }
  for (const d of [r.a, r.b]) {
    check(d.origin.operand === 'parent', 'resolution original operand');
    const b = one(sourceUse(d.origin), 'resolution original complete use missing');
    check(b.edgeId === d.origin.edgeId && b.solidEdgeId === r.originalTopEdgeId, 'resolution original edge differs');
    const sf = one(sub.faces.filter(f => sameFields(f.output, d.reference, F)), 'resolution component face missing');
    check(sf.sources.some(s => s.operand === 'parent' && sameFields(s, d.origin, F)), 'resolution owner source differs');
    const se = one(sf.edges.filter(e => e.useId === d.reference.useId), 'resolution component use missing');
    check(se.originalEdges.filter(o => JSON.stringify(o) === JSON.stringify(d.origin)).length === 1, 'resolution origin differs');
  }
  check(!sameFields(r.a.reference, r.b.reference, U), 'distinct derived uses required');
  check(ch.parentEdgeId === r.componentEdgeId && ch.retainedSide === 'negative' && ch.removedSide === 'positive', 'chamfer edge/side mismatch');
  bounded(split.nodes, 4, 64, 'split node budget'); bounded(split.faces, 10, 26, 'split face budget');
  check(new Set(split.nodes.map(n => n.key)).size === split.nodes.length, 'unique split nodes');
  const splitNodes = new Map(split.nodes.map(n => [n.key, n]));
  for (const side of ['negative', 'positive'] as const) {
    const fs = split.faces.filter(f => f.side === side);
    check(fs.length === sub.faces.length + 1, 'complete split parent inventory');
    one(fs.filter(f => f.role === 'cap' && f.parent === null && f.output !== null), 'one split cap required');
    for (const sf of sub.faces) one(fs.filter(f => sameFields(f.parent, sf.output, F)), 'split parent missing/duplicated');
    const outputs = fs.filter(f => f.output !== null);
    check(new Set(outputs.map(f => faceKey(f.output))).size === outputs.length, 'unique split output faces');
    for (const f of fs) {
      check(['retained', 'clipped', 'deleted', 'cap'].includes(f.role), 'split role');
      if (f.role === 'deleted') { check(f.output === null && f.edges.length === 0, 'deleted split face output'); continue; }
      check(f.output !== null, 'split output required'); bounded(f.edges, 3, 8, 'split edge budget');
      check(new Set(f.edges.map(e => e.useId)).size === f.edges.length, 'unique split uses');
      const sf = f.role === 'cap' ? null : one(sub.faces.filter(s => sameFields(s.output, f.parent, F)), 'split parent link');
      for (const [i, e] of f.edges.entries()) {
        check(e.nodeKeys.length === 2 && e.nodeKeys.every(k => splitNodes.has(k)) &&
          e.nodeKeys[1] === f.edges[(i + 1) % f.edges.length].nodeKeys[0], 'split node loop');
        if (e.origin.kind === 'parent-edge') {
          check(sf !== null && sameFields(sf.output, e.origin, ['sourceId', 'faceId']), 'split edge parent face');
          const origin = e.origin;
          one(sf!.edges.filter(se => se.useId === origin.useId), 'split edge parent use');
        } else check(e.origin.kind === 'section', 'split origin kind');
      }
    }
  }
  // Every mesh face and boundary must identify one actual negative output use.
  const negative = split.faces.filter(f => f.side === 'negative' && f.output !== null);
  check(negative.length === component.mesh.faces.length, 'complete final face inventory');
  for (const [faceIndex, mf] of component.mesh.faces.entries()) {
    const f = one(negative.filter(f => sameFields(f.output, mf, F)), 'final face not in split lineage');
    const bs = component.boundaries.filter(b => b.faceIndex === faceIndex);
    check(bs.length === f.edges.length, 'final boundary inventory differs');
    for (const b of bs) {
      const e = one(f.edges.filter(e => sameFields(e, b, ['useId', 'edgeId', 'curveId', 'pcurveId'])), 'final boundary not in split lineage');
      for (const [j, vertexIndex] of b.vertexIndices.entries()) {
        const point = splitNodes.get(e.nodeKeys[j])!.pointMM;
        check(point.every((x, k) => x === component.mesh.positionsMM[vertexIndex * 3 + k]), 'split endpoint geometry differs');
      }
    }
  }
  // The selected pre-chamfer edge survives only in the removed side. This binds
  // the derived pair's complete curve/pcurve refs and global component edge ID.
  for (const d of [r.a, r.b]) {
    const origins = split.faces.flatMap(f => f.edges.filter(e => e.origin.kind === 'parent-edge' &&
      sameFields(e.origin, d.reference, ['sourceId', 'faceId', 'useId', 'curveId', 'pcurveId'])).map(e => e.origin));
    check(origins.length > 0 && origins.every(o => o.kind === 'parent-edge' && o.parentEdgeId === r.componentEdgeId), 'derived selected global edge differs');
  }
  check(negative.every(f => f.edges.every(e => e.origin.kind !== 'parent-edge' || e.origin.parentEdgeId !== r.componentEdgeId)), 'selected edge retained unexpectedly');
  const caps = (['negative', 'positive'] as const).map(side => one(split.faces.filter(f => f.side === side && f.role === 'cap'), 'cap inventory'));
  check(caps[0].key === ch.chamferFaceKey && caps.every(f => f.edges.length === 4), 'chamfer cap mismatch');
  bounded(split.capUses, 4, 4, 'cap correspondence count');
  check(new Set(split.capUses.map(c => c.sectionKey)).size === 4, 'unique cap correspondences');
  for (const c of split.capUses) {
    const edges = (['negative', 'positive'] as const).map((side, i) => {
      const cap = caps[i]; check(c[side].sourceId === cap.output!.sourceId, 'cap use source differs');
      return one(cap.edges.filter(e => e.useId === c[side].useId && e.origin.kind === 'section' && e.origin.sectionKey === c.sectionKey), 'cap use differs');
    });
    check(edges[0].nodeKeys[0] === edges[1].nodeKeys[1] && edges[0].nodeKeys[1] === edges[1].nodeKeys[0], 'cap uses not opposite');
  }
  check(ch.setbackBoundaryKeys.length === 2 && ch.setbackBoundaryKeys[0] !== ch.setbackBoundaryKeys[1] &&
    ch.setbackBoundaryKeys.every(k => split.capUses.some(c => c.sectionKey === k)), 'setback cap correspondence');
}
