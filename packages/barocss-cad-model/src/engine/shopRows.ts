// Read-only shop context. These views are evaluation inputs, never authored documents.
import { inheritRowSources, rowEntries, rowKey, validRowSupplies, type RowKind, type RowSupply } from './rowSources';
import type { StudioDoc } from './doc';
import { bearingAssemblyView, bearingPartView, withoutBearingContext } from './bearingContext';

export type ShopRowKind = 'machining-stock' | 'frame-stock' | 'section' | 'fit' | 'bearing' | 'oring' | 'ring' | 'drive' | 'connector' | 'fastener-size' | 'casting-rule' | 'mount';
export interface ShopRowProvenance { kind: ShopRowKind; id: string; origin: 'local' | 'inherited' | 'override'; fileSourceStatus?: 'matched' | 'changed' | 'not-recorded'; fileSources?: readonly RowSupply[] }
export interface ShopTreeProvenance { part: string; rows: readonly ShopRowProvenance[] }
const receivedOrigins = new WeakMap<StudioDoc, readonly ShopTreeProvenance[]>();
export interface ShopRowView { doc: StudioDoc; provenance: readonly ShopRowProvenance[] }
const roots = new WeakMap<StudioDoc, ShopRowView>();
const authored = new WeakMap<StudioDoc, StudioDoc>();
const pairs = new WeakMap<StudioDoc, WeakMap<StudioDoc, ShopRowView>>();

/** Parent rows are available by id; a local row with the same id wins. No input is changed. */
export function resolveShopRows(child: StudioDoc, parent?: StudioDoc): ShopRowView {
  // Re-resolving a view uses its authored local rows, never the previous parent's effective rows as overrides.
  if (parent) child = authored.get(child) ?? child;
  const saved = parent ? pairs.get(child)?.get(parent) : roots.get(child);
  if (saved) return saved;
  const provenance: ShopRowProvenance[] = [];
  const rows = <T extends { id: string }>(kind: ShopRowKind, local: T[] | undefined, inherited: T[] | undefined): T[] | undefined => {
    const own = new Map((local ?? []).map(r => [r.id, r]));
    const above = new Map((inherited ?? []).map(r => [r.id, r]));
    const merged = new Map([...above, ...own]);
    for (const id of merged.keys()) provenance.push({ kind, id, origin: own.has(id) ? above.has(id) ? 'override' : 'local' : 'inherited' });
    return (inherited ?? []).some(r => !own.has(r.id)) ? [...merged.values()] : local;
  };
  const stock = rows('machining-stock', child.machining?.stock, parent?.machining?.stock);
  const frameStock = rows('frame-stock', child.frames?.stock, parent?.frames?.stock);
  const sections = rows('section', child.frames?.sections, parent?.frames?.sections);
  const tables = rows('fit', child.fits?.tables, parent?.fits?.tables);
  const bearings = rows('bearing', child.bearings?.rows, parent?.bearings?.rows);
  const orings = rows('oring', child.orings?.rows, parent?.orings?.rows);
  const rings = rows('ring', child.rings?.rows, parent?.rings?.rows);
  const drives = rows('drive', child.drives?.rows, parent?.drives?.rows);
  const connectors = rows('connector', child.connectors?.rows, parent?.connectors?.rows);
  const fastenerSizes = rows('fastener-size', child.fastenerSizes?.rows, parent?.fastenerSizes?.rows);
  const castingRules = rows('casting-rule', child.castingRules?.rows, parent?.castingRules?.rows);
  const mounts = rows('mount', child.mounts?.rows, parent?.mounts?.rows);
  const changed = stock !== child.machining?.stock || frameStock !== child.frames?.stock || sections !== child.frames?.sections || tables !== child.fits?.tables || bearings !== child.bearings?.rows || orings !== child.orings?.rows || rings !== child.rings?.rows || drives !== child.drives?.rows || connectors !== child.connectors?.rows || fastenerSizes !== child.fastenerSizes?.rows || castingRules !== child.castingRules?.rows || mounts !== child.mounts?.rows;
  const contextual = !!parent && provenance.some(r => r.origin !== 'local');
  let doc: StudioDoc = changed || contextual ? { ...child,
    ...(stock ? { machining: { ...child.machining, version: 1, stock } } : {}),
    ...(frameStock || sections ? { frames: { ...child.frames, version: 1, ...(frameStock ? { stock: frameStock } : {}), ...(sections ? { sections } : {}) } } : {}),
    ...(tables ? { fits: { ...child.fits, version: 1, tables } } : {}),
    ...(bearings ? { bearings: { version: 1, rows: bearings } } : {}),
    ...(orings ? { orings: { version: 1, rows: orings } } : {}),
    ...(rings ? { rings: { version: 1, rows: rings } } : {}),
    ...(drives ? { drives: { version: 1, rows: drives } } : {}),
    ...(connectors ? { connectors: { version: 1, rows: connectors } } : {}),
    ...(fastenerSizes ? { fastenerSizes: { version: 1, rows: fastenerSizes } } : {}),
    ...(castingRules ? { castingRules: { version: 1, rows: castingRules } } : {}),
    ...(mounts ? { mounts: { version: 1, rows: mounts } } : {}),
  } : child;
  doc = inheritRowSources(doc, child, parent);
  const kinds: Record<ShopRowKind, RowKind> = { 'machining-stock': 'stock', 'frame-stock': 'frame-stock', section: 'sections', fit: 'fits', bearing: 'bearings', oring: 'orings', ring: 'rings', drive: 'drives', connector: 'connectors', 'fastener-size': 'fastener-sizes', 'casting-rule': 'casting-rules', mount: 'mounts' };
  const receipts = validRowSupplies(doc);
  for (const origin of provenance) {
    const kind = kinds[origin.kind], entry = rowEntries(doc).find(e => e.kind === kind && e.value.id === origin.id);
    const matched = entry ? receipts.filter(r => r.fingerprint === rowKey(kind, entry.value)) : [];
    const sourceDoc = origin.origin === 'inherited' ? parent : child;
    const past = sourceDoc?.rowSources?.rows.some(r => r.kind === kind && r.id === origin.id);
    origin.fileSourceStatus = matched.length ? 'matched' : past ? 'changed' : 'not-recorded';
    if (matched.length) origin.fileSources = matched;
  }
  const result = { doc, provenance };
  if (doc !== child || !parent) roots.set(doc, result);
  authored.set(doc, authored.get(child) ?? child);
  if (parent) { let map = pairs.get(child); if (!map) { map = new WeakMap(); pairs.set(child, map); } map.set(parent, result); }
  else roots.set(child, result);
  return result;
}
const trees = new WeakMap<StudioDoc, StudioDoc>();
/** Context copies retain the same authored-row and provenance identity as the row view they wrap. */
function registerContextView(before: StudioDoc, after: StudioDoc): StudioDoc {
  if (before === after) return after;
  trees.set(after, after);
  authored.set(after, authored.get(before) ?? before);
  const origin = roots.get(before); if (origin) roots.set(after, { ...origin, doc: after });
  const received = receivedOrigins.get(before); if (received) receivedOrigins.set(after, received);
  for (const [i, inst] of (before.instances ?? []).entries()) {
    const next = after.instances?.[i]; if (next && next.id === inst.id) registerContextView(inst.doc, next.doc);
  }
  return after;
}
/** Resolve each level against its immediate effective parent, without changing authored instance documents. */
export function resolveShopTree(doc: StudioDoc, parent?: StudioDoc, ownerPart?: string): StudioDoc {
  const effective = resolveShopRows(doc, parent).doc;
  const bind = (view: StudioDoc) => registerContextView(view, !parent ? bearingAssemblyView(view) : ownerPart === undefined ? view : bearingPartView(view, resolveShopTree(parent), ownerPart));
  const have = trees.get(effective); if (have) return bind(have);
  const instances = effective.instances?.map(i => { const child = resolveShopTree(i.doc, effective); return child === i.doc ? i : { ...i, doc: child }; });
  const changed = instances?.some((i, index) => i !== effective.instances![index]);
  const out = changed ? { ...effective, instances } : effective;
  trees.set(effective, out); trees.set(out, out);
  if (out !== doc || !parent) roots.set(out, { doc: out, provenance: resolveShopRows(effective).provenance });
  authored.set(out, authored.get(effective) ?? doc);
  return bind(out);
}

/** Resolve section references before existing flattening drops each child's row registry. */
export function flattenShopView(doc: StudioDoc): StudioDoc {
  const section = (s: import('./doc').MemberSection): import('./doc').MemberSection => {
    if (s.kind !== 'library') return s;
    const row = doc.frames?.sections?.find(r => r.id === s.id);
    if (!row) throw new Error(`[FRAME_SECTION_UNKNOWN] no section row ${s.id}`);
    return row.section;
  };
  const nodes = doc.nodes.map(n => n.kind === 'frame' ? { ...n, section: section(n.section), ...(n.overrides ? { overrides: n.overrides.map(o => o.section ? { ...o, section: section(o.section) } : o) } : {}) } : n.kind === 'frame-member' ? { ...n, section: section(n.section) } : n);
  const parentRows = { fits: doc.fits?.tables, bearings: doc.bearings?.rows, orings: doc.orings?.rows, rings: doc.rings?.rows, drives: doc.drives?.rows, connectors: doc.connectors?.rows, fastenerSizes: doc.fastenerSizes?.rows, mounts: doc.mounts?.rows };
  const instances = doc.instances?.map(inst => {
    const child = inst.doc;
    const check = (kind: keyof typeof parentRows, id: string) => {
      const own = kind === 'fits' ? child.fits?.tables : child[kind]?.rows;
      const row = own?.find(r => r.id === id), above = parentRows[kind]?.find(r => r.id === id);
      if (row && (!above || JSON.stringify(row) !== JSON.stringify(above))) throw new Error(`[SHOP_ROWS_FLATTEN_SCOPE] nested part ${inst.id} references distinct ${kind} row ${id}; flattening must retain its row context`);
    };
    for (const n of child.nodes) {
      if (n.kind === 'bearing') check('bearings', n.row);
      if (n.kind === 'oring-gland') check('orings', n.ring);
      // (O7: a fastener made in the part, and a tapped hole, are drawn by their size's row.)
      if ('made' in n && n.made?.command === 'fastener' && typeof n.made.values.size === 'string') check('fastenerSizes', n.made.values.size);
      // (O14: a mount's holes are cut from its row.)
      if ('made' in n && n.made?.command === 'mount' && typeof n.made.values.row === 'string') check('mounts', n.made.values.row);
      if (n.kind === 'hole' && n.thread) { const m = /^M([\d.]+)×/.exec(n.thread); if (m) check('fastenerSizes', `M${m[1]}`); }
      // Other row-backed nodes keep their existing field names; inspect only actual row references.
      for (const [kind, field] of [['rings', 'row'], ['drives', 'row'], ['connectors', 'row']] as const) {
        if ((kind === 'rings' && n.kind === 'retaining-ring') || (kind === 'drives' && ['sprocket', 'pulley', 'belt', 'coupling'].includes(n.kind)) || (kind === 'connectors' && n.kind === 'connector-opening')) {
          const id = (n as unknown as Record<string, unknown>)[field]; if (typeof id === 'string') check(kind, id);
        }
      }
    }
    const classes = new Set((child.fits?.faces ?? []).map(f => f.class));
    for (const n of child.nodes) for (const [key, value] of Object.entries(n)) if (key.endsWith('Class') && typeof value === 'string') classes.add(value);
    for (const t of child.fits?.tables ?? []) if (t.rows.some(r => classes.has(r.class))) check('fits', t.id);
    return { ...inst, doc: flattenShopView(child) };
  });
  return { ...doc, nodes, ...(instances ? { instances } : {}) };
}

/** Recover the authored input. Never persist a derived shop view as the edit target. */
export function authoredShopDocument(doc: StudioDoc): StudioDoc { return authored.get(doc) ?? doc; }
/** Effective row origins at each part path, retaining origins when a resolved tree is passed again. */
export function provenanceOfTree(doc: StudioDoc): readonly ShopTreeProvenance[] {
  const received = receivedOrigins.get(doc); if (received) return received;
  const resolved = resolveShopTree(doc), out: { part: string; rows: readonly ShopRowProvenance[] }[] = [];
  const walk = (d: StudioDoc, part: string, parent?: StudioDoc) => { out.push({ part, rows: parent ? resolveShopRows(authoredShopDocument(d), parent).provenance : resolveShopRows(d).provenance }); for (const i of d.instances ?? []) walk(i.doc, part === 'base' ? i.id : `${part}/${i.id}`, d); };
  walk(resolved, 'base'); return out;
}

/** Remove unchanged inherited rows from a command result before it becomes authored state. */
export function restoreAuthoredShopRows(edited: StudioDoc, view: StudioDoc): { doc: StudioDoc } | { error: string } {
  const original = authoredShopDocument(view);
  if (edited === view) return { doc: original };
  const paths = [
    ['machining', 'stock'], ['frames', 'stock'], ['frames', 'sections'], ['fits', 'tables'],
    ['bearings', 'rows'], ['orings', 'rows'], ['rings', 'rows'], ['drives', 'rows'], ['connectors', 'rows'], ['fastenerSizes', 'rows'], ['castingRules', 'rows'], ['mounts', 'rows'],
  ] as const;
  const result = withoutBearingContext(edited);
  if (edited.rowSources === view.rowSources) { if (original.rowSources) result.rowSources = original.rowSources; else delete result.rowSources; }
  const record = (d: StudioDoc, key: typeof paths[number][0]) => d[key] as unknown as Record<string, unknown> | undefined;
  type Row = { id: string };
  for (const [container, field] of paths) {
    const ownContainer = record(original, container), viewContainer = record(view, container), editedContainer = record(result, container);
    const own = ownContainer?.[field] as Row[] | undefined, effective = viewContainer?.[field] as Row[] | undefined, changed = editedContainer?.[field] as Row[] | undefined;
    const ownIds = new Set((own ?? []).map(r => r.id));
    const inherited = (effective ?? []).filter(r => !ownIds.has(r.id));
    if (!inherited.length) continue;
    const changedById = new Map((changed ?? []).map(r => [r.id, r]));
    const removed = inherited.filter(r => !changedById.has(r.id));
    if (removed.length) return { error: `[SHOP_ROW_INHERITED_REMOVE] cannot remove inherited ${container}.${field} rows ${removed.map(r => r.id).join(', ')} from this part; change the parent rows` };
    const inheritedObjects = new Set(inherited);
    const authoredRows = (changed ?? []).filter(r => !inheritedObjects.has(r));
    const next = { ...editedContainer };
    if (authoredRows.length || own !== undefined) next[field] = authoredRows;
    else delete next[field];
    if (!ownContainer && Object.keys(next).every(k => k === 'version')) delete result[container];
    else (result as unknown as Record<string, unknown>)[container] = next;
  }
  if (result.rowSources) result.rowSources = { version: 1, rows: validRowSupplies(result) };
  return { doc: result };
}


/** Register wire-only origin metadata. It never becomes an authored StudioDoc field. */
export function registerShopRowProvenance(doc: StudioDoc, origins: readonly ShopTreeProvenance[]): void {
  receivedOrigins.set(doc, origins);
  for (const i of doc.instances ?? []) {
    const children = origins.filter(p => p.part === i.id || p.part.startsWith(`${i.id}/`)).map(p => ({ ...p, part: p.part === i.id ? 'base' : p.part.slice(i.id.length + 1) }));
    registerShopRowProvenance(i.doc, children);
  }
}
