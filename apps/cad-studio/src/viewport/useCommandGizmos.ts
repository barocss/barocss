import { useMemo, useRef, type Dispatch, type SetStateAction, type RefObject } from 'react';
import { fmt, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { patchValues, refOf, selectedBodies, type Ctx, type Selection, type Values } from '@barocss/cad-model/app/commands';
import { editCommand, featureOfPick } from '@barocss/cad-model/app/editCommand';
import type { Active } from '../app/commandState';
import type { FeatureHandle, TransformGizmo } from './Viewport';
import { alignMove, previewMatrix } from '@barocss/cad-model/assembly/drag';
type BodyDrag = { matrix: Float64Array; settling: boolean } | null;
interface CommandGizmoOptions {
  model: { doc: StudioDoc; evaluated: StudioDoc; bodies: BodyResult[]; selection: Selection; marker: number | null; editNode: number | null };
  command: { active: Active | null; ctx: Ctx; setActive: Dispatch<SetStateAction<Active | null>>; handleDrag: RefObject<{ key: string; lastOk: number; wall: number; bad: number | null; want: number; step: number; dragging: boolean } | null>; previewFor: RefObject<string | null> };
  context: { sketch: object | null; rendering: boolean; drawing: boolean; measure: readonly unknown[] | null; assemblyDraft: object | null; instanceCount: number; snapStep: number };
  drag: { bodyDrag: BodyDrag; setBodyDrag: Dispatch<SetStateAction<BodyDrag>> };
}
/** Command gizmos and dimension handles share the original drag refs and central command store. */
export function useCommandGizmos({ model, command, context, drag }: CommandGizmoOptions) {
  const { doc, evaluated, bodies, selection, marker, editNode } = model;
  const { active, ctx, setActive, handleDrag, previewFor } = command;
  const { sketch, rendering, drawing, measure, assemblyDraft, instanceCount, snapStep } = context;
  const { bodyDrag, setBodyDrag } = drag;
  // Move and Rotate gizmos on the selected body: while dragged it follows at once (a renderer transform
  // of the evaluated body); let go, the kernel preview of the values runs.
  const dragFrom = useRef<Values | null>(null);
  const cmdBody = active && (active.cmd.id === 'move' || active.cmd.id === 'rotate' || active.cmd.id === 'scale') && selectedBodies(active.ctx.selection).length === 1 ? selectedBodies(active.ctx.selection)[0] : undefined;
  const gizmo: TransformGizmo | null = active && cmdBody !== undefined && bodies[cmdBody] ? (() => {
    const { min, max } = bodies[cmdBody].mesh.bounds, values = active.values;
    const begin = () => dragFrom.current ?? (dragFrom.current = values);
    const show = (next: Values, matrix: Float64Array, done: boolean) => {
      setBodyDrag({ matrix, settling: done });
      setActive(a => a && { ...a, values: patchValues(a.cmd, a.ctx, a.values, next), preview: 'busy' });
      if (done) dragFrom.current = null;
    };
    if (active.cmd.id === 'move') {
      const v: Vec3 = [Number(values.x), Number(values.y), Number(values.z)];
      return { origin: [(min[0] + max[0]) / 2 + v[0], (min[1] + max[1]) / 2 + v[1], max[2] + v[2]], move: [0, 1, 2],
        onMove: (delta, done) => {
          const from = begin(), raw: Vec3 = [Number(from.x) + delta[0], Number(from.y) + delta[1], Number(from.z) + delta[2]];
          // Lined up with the other bodies' sides and middles when it comes close (2 % of its size, at least 1 mm).
          const size = Math.max(...[0, 1, 2].map(k => max[k] - min[k])), others = bodies.filter((_, i) => i !== cmdBody).map(b => b.mesh.bounds);
          const next = alignMove({ min, max }, others, raw, delta.map(v => v !== 0), Math.max(1, size * 0.02)).move;
          show({ x: next[0], y: next[1], z: next[2] }, previewMatrix({ kind: 'move', delta: next }), done);
        } };
    }
    if (active.cmd.id === 'scale') {
      // Scale: the cubes grow or shrink the body about the pivot (its centre by default).
      const pivot: Vec3 = [Number(values.px), Number(values.py), Number(values.pz)];
      return { origin: pivot, scale: true,
        onScale: (factor, done) => {
          const from = begin(), k = Math.round(Number(from.factor) * factor * 100) / 100, m = new Float64Array(16);
          m[0] = m[5] = m[10] = k; m[15] = 1; m[12] = pivot[0] * (1 - k); m[13] = pivot[1] * (1 - k); m[14] = pivot[2] * (1 - k);
          show({ factor: k }, m, done);
        } };
    }
    // Rotate: about the pivot, in 15° steps (Shift: 1°).
    const pivot: Vec3 = [Number(values.px), Number(values.py), Number(values.pz)];
    return { origin: pivot, turn: [0, 1, 2],
      onTurn: (axis, degrees, done) => {
        const from = begin(), name = 'xyz'[axis], angle = from.axis === name ? Number(from.angle) + degrees : degrees;
        show({ axis: name, angle }, previewMatrix({ kind: 'turn', axis, degrees: angle, centre: pivot }), done);
      } };
  })() : null;
  // The active command's dimension handles: dragging one sets that value (the preview follows).
  // With nothing running, the selected body's feature (or the one open in the feature editor) offers its
  // dimensions as handles: dragging one starts editing that feature.
  const idleEdit = useMemo(() => {
    if (active || sketch || rendering || drawing || measure || assemblyDraft || instanceCount) return null;
    // The feature open in the editor, else the one the picked face or edge comes from, else the body's last.
    const one = selectedBodies(selection), index = editNode ?? featureOfPick(selection, bodies, evaluated.nodes) ?? (one.length === 1 && bodies[one[0]] ? refOf(bodies[one[0]]).node : null);
    return index === null || (marker !== null && index >= marker) ? null : editCommand(index, evaluated.nodes, doc);
  }, [active, sketch, rendering, drawing, measure, assemblyDraft, instanceCount, selection, editNode, bodies, evaluated.nodes, doc.fastenerSizes, marker]);
  const handleCmd = active?.cmd ?? idleEdit, handleValues = active ? active.values : idleEdit?.defaults?.(ctx) ?? {}, handleCtx = active?.ctx ?? ctx;
  // (None while a new shape is still being placed: the click that places it must not grab one.)
  const handles: FeatureHandle[] = handleCmd?.handles && !sketch && !active?.placing ? handleCmd.handles(handleCtx, handleValues).flatMap(h => {
    const fields = handleCmd.fields?.(handleCtx, handleValues) ?? [], field = fields.find(f => f.key === h.key), value = Number(handleValues[h.key]);
    if (!field || !Number.isFinite(value)) return [];
    // (Lengths follow the grid step: half of it for half-step arrows; angles and counts keep their own.)
    const step = h.arc || h.unit !== undefined ? h.step ?? 1 : Math.max(0.001, (h.step ?? 1) * (snapStep || 0.01)), snap = (start: number, mm: number) => Math.min(h.max ?? Infinity, Math.max(h.min ?? -Infinity, Math.round((start + mm * (h.scale ?? 1)) / step) * step));
    const pair = h.pair, value2 = pair ? Number(handleValues[pair.key]) : NaN;
    if (pair && !Number.isFinite(value2)) return [];
    return [{ id: pair ? `${h.key}+${pair.key}` : h.key, at: h.at, dir: h.dir, label: pair ? field.label.replace(/ \w$/, '') : field.label, value, ...(h.arc ? { arc: h.arc } : {}),
      ...(pair ? { plane: { dir2: pair.dir, value2, toValue2: snap } } : {}),
      toValue: snap,
      format: (v: number) => h.arc ? `${fmt(v)}°` : h.unit !== undefined ? `${fmt(v)}${h.unit ? ' ' + h.unit : ''}` : `${fmt(v)} mm`,
      unit: h.arc ? '°' : h.unit ?? 'mm', owner: handleCmd, editing: !!active,
      // (A typed value, as the HUD's: no drag bound, the preview follows.)
      onType: (v: number) => { handleDrag.current = null; setActive(a => a ? { ...a, values: patchValues(a.cmd, a.ctx, a.values, { [h.key]: v }), preview: 'busy' } : a); },
      onDrag: (v: number, done: boolean, v2?: number) => {
        if (pair) {
          // (Both coordinates at once; a refused spot shows as the preview's error, no wall.)
          handleDrag.current = null;
          const patch = { [h.key]: v, [pair.key]: v2 ?? value2 };
          setActive(a => a ? (a.values[h.key] === patch[h.key] && a.values[pair.key] === patch[pair.key] ? a : { ...a, values: patchValues(a.cmd, a.ctx, a.values, patch), preview: 'busy' }) : { cmd: handleCmd, values: patchValues(handleCmd, handleCtx, handleValues, patch), preview: 'busy', ctx: { ...handleCtx } });
          return;
        }
        let hd = handleDrag.current;
        if (!hd || hd.key !== h.key || !hd.dragging) hd = handleDrag.current = { key: h.key, lastOk: value, wall: 0, bad: null, want: v, step, dragging: true };
        hd.want = v;
        // At or past the nearest value that failed: held at the last good one (those between are still tried).
        // A value strictly between them is a bisect step in flight: it stays shown until its answer arrives.
        if (hd.bad !== null && (v - hd.bad) * hd.wall >= 0) {
          const cur = Number(active?.values[h.key]);
          v = Number.isFinite(cur) && (cur - hd.lastOk) * hd.wall > 0 && (hd.bad - cur) * hd.wall > 0 ? cur : hd.lastOk;
        }
        if (done) hd.dragging = false;
        // An idle handle opens its feature's edit as the drag starts.
        setActive(a => a ? (a.values[h.key] !== v ? { ...a, values: patchValues(a.cmd, a.ctx, a.values, { [h.key]: v }), preview: 'busy' } : a)
          : { cmd: handleCmd, values: patchValues(handleCmd, handleCtx, handleValues, { [h.key]: v }), preview: 'busy', ctx: { ...handleCtx } });
      } }];
  }) : [];
  const settleDrag = () => { if (bodyDrag?.settling && active && previewFor.current === JSON.stringify(active.values)) setBodyDrag(null); };
  const resetDrag = () => { setBodyDrag(null); dragFrom.current = null; handleDrag.current = null; };
  return { gizmo, handles, cmdBody, settleDrag, resetDrag };
}
