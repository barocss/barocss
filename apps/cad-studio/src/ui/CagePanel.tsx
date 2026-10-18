// R8.2 (D81): the cage editor's panel — mode, Box/Smooth, the operations on the selection, the mirror, what the
// validation flags, the session's undo, and Done / Cancel.
import type { CageEditor } from '../subd/useCageEditor';
import { validationOf, type CageMode, type CageOp } from '../subd/cageEdit';

const OPS: { op: CageOp; label: string; key?: string; tip: string }[] = [
  { op: 'extrude', label: 'Extrude', key: 'E', tip: 'The picked faces (or boundary edges) out as a new region; drag the gizmo to move it — or hold Shift as you drag' },
  { op: 'insert-loop', label: 'Insert loop', key: 'L', tip: 'An edge loop across the ring through the picked edge, at its middle' },
  { op: 'select-loop', label: 'Loop', tip: 'The picked edge’s whole loop (double-click an edge)' },
  { op: 'select-ring', label: 'Ring', tip: 'The picked edge’s ring (Alt-double-click an edge)' },
  { op: 'bridge', label: 'Bridge', key: 'B', tip: 'Quads between two picked boundary loops (or chains) of as many edges' },
  { op: 'fill', label: 'Fill', key: 'F', tip: 'One face over the hole the picked boundary edges go round' },
  { op: 'weld', label: 'Weld', key: 'W', tip: 'The picked vertices merged at their middle' },
  { op: 'weld-near', label: 'Weld near', tip: 'Picked vertices within 0.01 mm of each other merged' },
  { op: 'crease', label: 'Crease', key: 'C', tip: 'The picked edges (or the picked faces’ sides) made sharp' },
  { op: 'uncrease', label: 'Smooth edges', tip: 'Creases off on the picked edges' },
  { op: 'delete', label: 'Delete', key: '⌫', tip: 'The picked faces removed (a hole; Fill closes it)' },
];

export function CagePanel({ editor, name }: { editor: CageEditor; name: string }) {
  const s = editor.session; if (!s) return null;
  const v = validationOf(s), n = s.sel.vertices.length + s.sel.edges.length + s.sel.faces.length;
  const what = s.sel.faces.length ? `${s.sel.faces.length} face${s.sel.faces.length === 1 ? '' : 's'}` : s.sel.edges.length ? `${s.sel.edges.length} edge${s.sel.edges.length === 1 ? '' : 's'}` : s.sel.vertices.length ? `${s.sel.vertices.length} vertex${s.sel.vertices.length === 1 ? '' : 'es'}` : 'nothing';
  return <aside className="card props cage-panel" aria-label="Cage editor">
    <div className="card-title">CAGE · {name}</div>
    <div className="seg" role="group" aria-label="Pick">{(['vertex', 'edge', 'face'] as CageMode[]).map((m, i) =>
      <button key={m} className={s.mode === m ? 'on' : ''} aria-pressed={s.mode === m} data-tip={`${m[0].toUpperCase()}${m.slice(1)}s`} data-tip-desc={`Key ${i + 1}`} onClick={() => editor.setMode(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}</div>
    <div className="seg" role="group" aria-label="Show">
      <button className={!s.smooth ? 'on' : ''} aria-pressed={!s.smooth} data-tip="Box" data-tip-desc="The cage as it is (Tab)" onClick={() => s.smooth && editor.toggleSmooth()}>Box</button>
      <button className={s.smooth ? 'on' : ''} aria-pressed={s.smooth} data-tip="Smooth" data-tip-desc="The limit surface (Tab)" onClick={() => !s.smooth && editor.toggleSmooth()}>Smooth</button></div>
    <div className="kv">Picked <b aria-label="Picked">{what}</b></div>
    <div className="cage-ops">{OPS.map(o => <button key={o.op} className="ghost small" aria-label={o.label} data-tip={o.label + (o.key ? ` (${o.key})` : '')} data-tip-desc={o.tip} onClick={() => editor.op(o.op)} disabled={!n && o.op !== 'weld-near'}>{o.label}</button>)}</div>
    <label className="kv"><span>Mirror</span><select aria-label="Mirror" value={s.mirror ?? ''} onChange={e => editor.op(e.target.value ? `mirror-${e.target.value}` as CageOp : 'mirror-off')}>
      <option value="">None</option><option value="x">Across X</option><option value="y">Across Y</option><option value="z">Across Z</option></select></label>
    <div className="cage-checks" aria-label="Cage checks">
      {!v.valid && <div className="warn">Not a manifold: {v.nonManifoldEdges.length} edges, {v.nonManifoldVertices.length} vertices (red)</div>}
      <div className="muted small">{v.poles.length} poles (ringed: G1 caps there) · {v.ngons.length} n-gons (tinted) · {v.boundaryEdges.length} open edges{v.darts.length ? ` · ${v.darts.length} darts` : ''} · {s.cage.faces.length} faces</div>
      {editor.previewMs !== null && <div className="muted small" aria-label="Preview time">Preview {editor.previewMs.toFixed(1)} ms</div>}
    </div>
    <div className="row-buttons">
      <button className="ghost small" aria-label="Undo cage step" disabled={!s.undo.length} onClick={editor.undo}>Undo</button>
      <button className="ghost small" aria-label="Redo cage step" disabled={!s.redo.length} onClick={editor.redo}>Redo</button>
      <span className="grow" />
      <button className="ghost small" aria-label="Cancel cage edit" onClick={editor.cancel}>Cancel</button>
      <button className="primary small" aria-label="Done editing cage" onClick={editor.done}>Done</button>
    </div>
  </aside>;
}
