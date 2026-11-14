import { CadNumericPolicy } from '@barocss/cad';
import { revolveAxisReference } from '../engine/revolveAxis';
import { featureId } from '../engine/ids';
// The commands that make a solid from finished sketches, each on its own as CAD tools have them: Extrude
// (a picked profile pulled along its normal), Revolve (turned about a sketch axis), Pipe (carried along
// runs and bends) and Loft (through two or more picked sections). A profile drawn on a body's face joins
// that body by default; Operation can make a new body or cut it instead.
import { withNode, type BodyRef, type ModelNode, type SketchNode, type StudioDoc } from '../engine/doc';
import type { Vec3 } from '../engine/mesh';
import { toLocal, toWorld } from '../sketch/plane';
import { boundParameters, framedLoftSections, loftSections, pickedSketches, planeOf, profileMiddle } from './profiles';
import { copyLoftGuide } from './loftGuides';
import { faceProfile } from './faceProfile';
import { nativeExtrudeFace } from './nativeExtrudeFace';
import { resolveNativeOffsetFace, validateNativeOffsetDistance, validateNativeOffsetResult } from './nativeOffsetFace';
import { directNow } from '../engine/directModule';
import type { Command, Ctx, Field, Values } from './commands';

// (Only types from commands.ts: it lists these commands, so a value import would be a cycle.)
import { refOf } from './bodyRef';
import { refusal } from '../engine/refusal';
import { captureExtrudeRegion, resolveExtrudeRegion } from '../engine/regionExtrude';
import { isFaceEndExtrudeSketch } from '../engine/faceEndExtrude';
import { currentPocketSketch } from '../engine/part';
import { throughCutPlane, throughCutSide } from '../engine/throughCut';
import { extrudeEndFaceTarget, extrudeEndFaceValues } from './extrudeEndFacePick';

const ok = { ok: true as const }, no = (reason: string) => ({ ok: false as const, reason });
/** The sketch a single-profile command works on, or why there is none. */
export function oneProfile(ctx: Ctx): { index: number; node: SketchNode } | null {
  const [i, ...rest] = pickedSketches(ctx.doc.nodes, ctx.selection.sketches);
  if (i === undefined || rest.length) return null;
  const node = ctx.doc.nodes[i] as SketchNode;
  try { return { index: i, node: node.pocketFloor ? currentPocketSketch(ctx.doc, i) : node }; }
  catch { return null; }
}
const needProfile = (ctx: Ctx) => oneProfile(ctx) ? ok : no('Finish a sketch first, or pick one sketch (in the viewport or the History).');
const faceSketches = new WeakMap<object, Map<number, SketchNode | null>>();
/** One face picked on its own (no sketch picked): its outline as a profile drawn on its body, or null for a curved face. */
function faceSketch(ctx: Ctx): SketchNode | null | undefined {
  const { faces, edges, sketches } = ctx.selection;
  if (sketches?.length || edges.length || faces.length !== 1) return undefined;
  const body = ctx.bodies[faces[0].body]; if (!body) return undefined;
  let byFace = faceSketches.get(body.mesh); if (!byFace) faceSketches.set(body.mesh, byFace = new Map());
  if (!byFace.has(faces[0].face)) { const node = faceProfile(body.mesh, faces[0].face); byFace.set(faces[0].face, node && { ...node, on: refOf(body) }); }
  return byFace.get(faces[0].face);
}
/** Extrude's profile: a picked face (its sketch added as a node when built), else the picked or newest sketch. */
export function extrudeProfile(ctx: Ctx): { index: number; node: SketchNode; fresh: boolean } | null {
  const face = faceSketch(ctx);
  if (face) return { index: ctx.doc.nodes.length, node: face, fresh: true };
  if (face === null) return null;
  const p = oneProfile(ctx); return p && { ...p, fresh: false };
}
/** The body the sketch was drawn on, while it is still a body of the part. */
function baseOf(ctx: Ctx, node: SketchNode): { ref: BodyRef; index: number } | null {
  if (!node.on) return null;
  const index = ctx.bodies.findIndex(b => { const r = refOf(b); return r.node === node.on!.node && r.side === node.on!.side; });
  return index >= 0 ? { ref: node.on, index } : null;
}
const opFields = (base: boolean): Field[] => base ? [{ key: 'op', label: 'Operation', kind: 'choice', options: [{ value: 'join', label: 'Join to body' }, { value: 'new', label: 'New body' }, { value: 'cut', label: 'Cut from body' }] }] : [];
/** The new solid (the last node) joined to, or cut from, the base body as Operation says. */
function combine(doc: StudioDoc, base: BodyRef | null, op: unknown): StudioDoc {
  const tool = { node: doc.nodes.length - 1, side: 'solid' as const };
  if (base && op === 'join') return withNode(doc, { kind: 'union', left: base, right: tool });
  if (base && op === 'cut') return withNode(doc, { kind: 'difference', parent: base, tool });
  return doc;
}
/** How deep a cut must go to leave the base body on the far side: its farthest corner behind the sketch plane, and a millimetre more. */
function throughDepth(ctx: Ctx, node: SketchNode): number {
  const base = baseOf(ctx, node); if (!base) return 0;
  const { min, max } = ctx.bodies[base.index].mesh.bounds, p = planeOf(node), n = p.normal, o = p.origin;
  let deepest = 0;
  for (let i = 0; i < 8; i++) {
    const c = [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
    deepest = Math.max(deepest, (o[0] - c[0]) * n[0] + (o[1] - c[1]) * n[1] + (o[2] - c[2]) * n[2]);
  }
  return Math.ceil(deepest) + 1;
}

/** Historical one-sided cuts remain available when the persistent rule cannot prove the stock extent. */
function persistThroughCut(ctx: Ctx, sketch: SketchNode, draft: number): boolean {
  const base = baseOf(ctx, sketch);
  if (!base || base.ref.side !== 'solid' || draft || sketch.association || !throughCutPlane(sketch.plane)) return false;
  const target = ctx.bodies[base.index];
  if (target.family !== 'upright' || target.pieces) return false;
  const { origin, normal } = planeOf(sketch), { min, max } = target.mesh.bounds;
  const closest = normal[2] === 1 ? max[2] : min[2];
  return throughCutSide((origin[2] - closest) * normal[2]);
}

function canExtrudeToFace(ctx: Ctx, p: ReturnType<typeof extrudeProfile>): boolean {
  return ctx.viewportEndFace === true && !!p && !p.fresh && isFaceEndExtrudeSketch(p.node)
    && ctx.bodies.some(body => body.ref?.side === 'solid' && body.family !== 'faceted' && !body.band && !body.role);
}

const fixedExtrudeDepth = (v: Values) => v.depth !== 'to-face' && !(v.op === 'cut' && v.depth === 'through');

const regionValue = (v: Values) => v.region === undefined || v.region === 'all' ? null
  : /^(0|[1-9]\d*)$/.test(String(v.region)) ? Number(v.region) : NaN;

const hasRegionExtrude = (ctx: Ctx, sketch: number) => ctx.doc.nodes.some(node => node.kind === 'region-extrude' && node.sketch === sketch);

export const extrudeCommand: Command = {
  id: 'extrude', label: 'Extrude', icon: 'cad-extrude', shortcut: 'E', group: 'create', keywords: 'pull push pad boss cut pocket press',
  hint: 'Pull a flat face or a finished sketch along its normal: drag the arrow or type the distance',
  available: ctx => {
    if ((ctx.selection.profileRegions?.indices.length ?? 0) > 1) return no('Select one sketch region to extrude, or select the whole sketch in the Browser.');
    if (extrudeProfile(ctx)) return ok;
    if ((ctx.selection.sketches?.length ?? 0) > 1) return no('Select one finished sketch to extrude.');
    if (faceSketch(ctx) === null) return no('Pick a flat face: a curved one has no plane to pull along.');
    return no('Pick a flat face or a finished sketch (in the viewport or the History).');
  },
  fields: ctx => {
    const p = extrudeProfile(ctx), base = !!(p && baseOf(ctx, p.node));
    const fields: Field[] = [
      { key: 'h', label: 'Distance', kind: 'mm', min: 0.1, when: fixedExtrudeDepth },
      { key: 'draft', label: 'Draft', kind: 'deg', min: -60, max: 60, step: 1, when: v => v.depth !== 'to-face' && regionValue(v) === null },
      ...opFields(base).map(field => ({ ...field, when: (v: Values) => regionValue(v) === null })),
    ];
    if (p && !p.fresh && p.node.regions?.length) fields.unshift({ key: 'region', label: 'Region', kind: 'choice',
      options: [
        ...(hasRegionExtrude(ctx, p.index) ? [{ value: '', label: 'Choose a region' }] : []),
        { value: 'all', label: 'All regions' },
        ...Array.from({ length: p.node.regions.length + 1 }, (_, i) => ({ value: String(i), label: `Region ${i + 1}` }))] });
    const distance = { value: 'distance', label: 'Distance' };
    if (base) fields.push({ key: 'depth', label: 'Depth', kind: 'choice', options: [distance, { value: 'through', label: 'Through all' }], when: v => v.op === 'cut' && regionValue(v) === null });
    else if (canExtrudeToFace(ctx, p)) fields.push({ key: 'depth', label: 'Depth', kind: 'choice', options: [distance, { value: 'to-face', label: 'To face' }] });
    return fields;
  },
  defaults: ctx => {
    const p = extrudeProfile(ctx), picked = ctx.selection.profileRegions;
    const region = p && picked?.sketch === p.index && picked.indices.length === 1 ? String(picked.indices[0]) : p && hasRegionExtrude(ctx, p.index) ? '' : 'all';
    return { h: 8, draft: 0, ...(p && !p.fresh && p.node.regions?.length ? { region } : {}), ...(canExtrudeToFace(ctx, p) ? { depth: 'distance' } : {}),
      ...(p && baseOf(ctx, p.node) ? { op: 'join', depth: 'distance' } : {}) };
  },
  derive: (_ctx, v, changed) => {
    const regionChanged = changed.includes('region');
    if (!regionChanged && (!changed.includes('depth') || (v.endBody === undefined && v.endFace === undefined))) return v;
    const next = { ...v };
    if (regionChanged && regionValue(next) !== null && next.depth !== undefined) next.depth = 'distance';
    delete next.endBody;
    delete next.endFace;
    return next;
  },
  steps: (ctx, v) => {
    const p = extrudeProfile(ctx);
    let text = 'pick a flat face or a finished sketch';
    if (p?.fresh) text = 'the picked face';
    else if (p) {
      text = `Sketch ${p.index + 1}`;
      const selected = regionValue(v);
      if (Number.isFinite(selected)) text += ` · Region ${Number(selected) + 1}`;
      else if (selected !== null) text += ' · Choose a region';
      else if (p.node.regions?.length) text += ` · all ${p.node.regions.length + 1} regions`;
    }
    const steps = [{ label: 'Profile', text, done: !!p }];
    if (p && v.op === 'cut' && v.depth === 'through' && !persistThroughCut(ctx, p.node, Number(v.draft))) {
      steps.push({ label: 'Depth', text: 'Fixed at this depth after Apply', done: false });
    }
    if (v.depth === 'to-face') {
      const target = extrudeEndFaceTarget(ctx, v);
      steps.push({ label: 'End face', text: target?.face ?? 'Pick a planar end face', done: !!target });
    }
    return steps;
  },
  onPick: (ctx, v, hit) => {
    if (v.depth !== 'to-face' || !canExtrudeToFace(ctx, extrudeProfile(ctx))) return null;
    const next = hit.face && extrudeEndFaceValues(ctx, v, hit.face);
    return next ?? { error: 'Pick one original planar face of a current solid.' };
  },
  build: (ctx, v) => {
    if ((ctx.selection.profileRegions?.indices.length ?? 0) > 1) throw refusal('BAD_REFERENCE', 'Select one sketch region to extrude, or select the whole sketch in the Browser.');
    const region = regionValue(v);
    if (region !== null) {
      const p = extrudeProfile(ctx);
      if (!p || p.fresh || !Number.isSafeInteger(region)) throw refusal('BAD_REFERENCE', 'Select one region of a finished sketch.');
      return withNode(ctx.doc, captureExtrudeRegion(ctx.doc.nodes, p.index, region, ctx.doc.parameters, Number(v.h)));
    }
    if (v.depth === 'to-face') {
      const profile = extrudeProfile(ctx);
      if (!profile || !canExtrudeToFace(ctx, profile) || (v.op !== undefined && v.op !== 'new')) throw refusal('VALUE', 'Extrude to face requires a finished XY rectangle and a new body.');
      const target = extrudeEndFaceTarget(ctx, v);
      if (!target) throw refusal('BAD_REFERENCE', 'Pick one original planar face of a current solid.');
      return withNode(ctx.doc, { kind: 'face-end-extrude', sketch: profile.index, target });
    }
    const selected = extrudeProfile(ctx)!, p = selected.fresh ? { ...selected, node: nativeExtrudeFace(ctx, selected.node) } : selected;
    const cut = v.op === 'cut', through = cut && v.depth === 'through';
    const base = baseOf(ctx, p.node), height = through ? throughDepth(ctx, p.node) : Number(v.h), draft = Number(v.draft);
    if (cut && (!Number.isFinite(height) || height <= 0)) throw refusal('VALUE', 'Cut Distance must be greater than 0 mm.');
    const persistentThrough = through && persistThroughCut(ctx, p.node, draft);
    const doc = p.fresh ? withNode(ctx.doc, p.node) : ctx.doc;
    // A cut goes down from the face (with a draft its walls lean in away from the opening); join/new go up.
    const node: ModelNode = cut ? (draft ? { kind: 'extrude', sketch: p.index, height: -height, draft }
      : { kind: 'extrude', sketch: p.index, height, from: -height, ...(persistentThrough ? { cutDepth: 'through' } : {}) })
      : { kind: 'extrude', sketch: p.index, height, ...(draft ? { draft } : {}) };
    return combine(withNode(doc, node), base?.ref ?? null, v.op);
  },
  // The distance: an arrow from the profile's middle along the normal (into the body for a cut).
  handles: (ctx, v) => {
    const p = extrudeProfile(ctx); if (!p || !fixedExtrudeDepth(v)) return [];
    const region = regionValue(v), h = Number(v.h);
    let profile = p.node, c: Vec3;
    try {
      if (region !== null) {
        const recipe = captureExtrudeRegion(ctx.doc.nodes, p.index, region, ctx.doc.parameters, h);
        profile = resolveExtrudeRegion(recipe, ctx.doc.nodes, ctx.doc.parameters);
      }
      c = toWorld(planeOf(profile), profileMiddle(profile, ctx.doc.parameters));
    } catch { return []; }
    const n = planeOf(profile).normal, sign = region === null && v.op === 'cut' ? -1 : 1;
    return [{ key: 'h', at: [c[0] + n[0] * sign * h, c[1] + n[1] * sign * h, c[2] + n[2] * sign * h], dir: [n[0] * sign, n[1] * sign, n[2] * sign], min: 0.1 }];
  },
};

/** Move an admitted native right-prism cap along its signed normal. */
export const offsetFaceCommand: Command = {
  id: 'offset-face', label: 'Offset face', icon: 'cad-extrude', group: 'modify', keywords: 'move face push pull offset direct edit press',
  hint: 'Move a cap of a straight right prism or cylinder: out adds material, in removes it. Drag the arrow or type the distance.',
  available: ctx => {
    const selection = ctx.selection;
    if (selection.faces.length !== 1 || selection.edges.length || selection.bodies.length || selection.sketches?.length || selection.vertices?.length || ctx.direct?.length) return no('Pick one flat cap of a straight right prism or cylinder.');
    const picked = selection.faces[0], body = ctx.bodies[picked.body], face = body?.mesh.faces[picked.face];
    if (!Number.isInteger(picked.body) || !Number.isInteger(picked.face) || !body || !face || face.kind !== 'plane' || face.facet || !face.name) return no('Pick one flat cap of a straight right prism or cylinder.');
    let matches = 0;
    for (const candidate of ctx.bodies) if (candidate.key === body.key) matches++;
    return matches === 1 ? ok : no('Pick one flat cap of a straight right prism or cylinder.');
  },
  fields: () => [{ key: 'd', label: 'Offset', kind: 'mm' }],
  defaults: () => ({ d: 2 }),
  steps: (_ctx, v) => [{ label: 'Move', text: Number(v.d) > 0 ? `${v.d} mm out (material added)` : Number(v.d) < 0 ? `${-Number(v.d)} mm in (material taken off)` : 'give it a distance (out +, in −)', done: Number(v.d) !== 0 }],
  build: (ctx, v) => {
    const d = Number(v.d), profile = resolveNativeOffsetFace(ctx);
    validateNativeOffsetDistance(profile, d);
    const doc = withNode(ctx.doc, structuredClone(profile.sketch)), index = doc.nodes.length - 1;
    const candidate = extrudeCommand.build!({ ...ctx, doc, selection: { sketches: [index], faces: [], edges: [], bodies: [], vertices: [] }, direct: [] },
      { h: Math.abs(d), draft: 0, op: d > 0 ? 'join' : 'cut', depth: 'distance' });
    validateNativeOffsetResult(ctx, candidate, profile, d);
    return candidate;
  },
  handles: ctx => {
    try {
      const profile = resolveNativeOffsetFace(ctx), plane = planeOf(profile.sketch), c = toWorld(plane, profileMiddle(profile.sketch, ctx.doc.parameters));
      return [{ key: 'd', at: [...c] as [number, number, number], dir: [...plane.normal] as [number, number, number], step: 0.5 }];
    } catch { return []; }
  },
};

/** A revolve's axis in the sketch's plane coordinates: through `o` along `d` (unit). */
export function revolveAxis(v: Values): { o: [number, number]; d: [number, number] } {
  if (v.axis === 'edge') { const d: [number, number] = [Number(v.dx), Number(v.dy)], l = Math.hypot(d[0], d[1]) || 1; return { o: [Number(v.ox), Number(v.oy)], d: [d[0] / l, d[1] / l] }; }
  return { o: [0, 0], d: v.axis === 'x' ? [1, 0] : [0, 1] };
}
export function pickedRevolveAxisReference(doc: StudioDoc, sketch: number, values: Values, before = doc.nodes.length) {
  if (values.axis !== 'edge' || typeof values.sourceFeature !== 'string' || typeof values.edgeName !== 'string') return;
  const source = doc.nodes.findIndex((_, i) => featureId(doc.nodes, i) === values.sourceFeature);
  return source >= 0 && source < before ? revolveAxisReference(doc, source, sketch, values.edgeName) : undefined;
}

export const revolveCommand: Command = {
  id: 'revolve', label: 'Revolve', icon: 'cad-revolve', group: 'create', keywords: 'lathe turn torus ring',
  hint: 'Turn a finished sketch about an axis: a sketch axis or a straight edge you click',
  available: needProfile,
  fields: (ctx, v?: Values) => { const p = oneProfile(ctx); return [{ key: 'axis', label: 'Axis', kind: 'choice', options: [{ value: 'y', label: 'Sketch Y' }, { value: 'x', label: 'Sketch X' }, ...(v?.dx !== undefined ? [{ value: 'edge', label: 'Picked edge' }] : [])] },
    { key: 'deg', label: 'Angle', kind: 'deg', min: 1, max: 360, step: 15 }, ...opFields(!!(p && baseOf(ctx, p.node)))]; },
  defaults: ctx => { const p = oneProfile(ctx); return { axis: 'y', deg: 360, ...(p && baseOf(ctx, p.node) ? { op: 'new' } : {}) }; },
  steps: (ctx, v) => {
    const p = oneProfile(ctx);
    return [{ label: 'Profile', text: p ? `Sketch ${p.index + 1}` : 'pick a finished sketch', done: !!p },
      { label: 'Axis', text: v.axis === 'edge' ? `edge ${String(v.edgeName ?? '')} · ${v.sourceFeature ? 'linked' : 'fixed'}` : `sketch ${String(v.axis).toUpperCase()} — or click a straight edge in the sketch plane`, done: true }];
  },
  // A straight edge in the sketch's plane becomes the axis.
  onPick: (ctx, v, hit) => {
    const p = oneProfile(ctx); if (!p || !hit.edge) return null;
    const e = ctx.bodies[hit.edge.body]?.mesh.edges[hit.edge.edge]; if (!e) return null;
    if (!e.straight) return { error: 'Pick a straight edge for the axis.' };
    const plane = planeOf(p.node), off = (q: readonly number[]) => (q[0] - plane.origin[0]) * plane.normal[0] + (q[1] - plane.origin[1]) * plane.normal[1] + (q[2] - plane.origin[2]) * plane.normal[2];
    if (Math.abs(off(e.a)) > 1e-6 || Math.abs(off(e.b)) > 1e-6) return { error: 'The axis must lie in the sketch’s plane: pick an edge on it.' };
    const a = toLocal(plane, [...e.a] as [number, number, number]), b = toLocal(plane, [...e.b] as [number, number, number]), r = (x: number) => Math.round(x * 1e6) / 1e6;
    const next: Values = { ...v, axis: 'edge', ox: r(a[0]), oy: r(a[1]), dx: r(b[0] - a[0]), dy: r(b[1] - a[1]), edgeName: e.names[0] ?? '' };
    const source = ctx.bodies[hit.edge.body].ref;
    const link = e.nativeLine && e.names.length === 1 && source?.side === 'solid'
      ? revolveAxisReference(ctx.doc, source.node, p.index, e.names[0]) : undefined;
    delete next.sourceFeature;
    if (link && (a[0] === b[0] || a[1] === b[1]) && [e.a, e.b].every(p => Math.abs(off(p)) <= CadNumericPolicy.linearTolerance)) {
      Object.assign(next, { sourceFeature: link.sourceFeature, ox: a[0], oy: a[1], dx: b[0] - a[0], dy: b[1] - a[1] });
    }
    return next;
  },
  build: (ctx, v) => {
    const p = oneProfile(ctx)!, ax = revolveAxis(v);
    const node: ModelNode = v.axis === 'edge' ? { kind: 'revolve', sketch: p.index, axis: 'x', origin: ax.o, dir: ax.d, angle: Number(v.deg) } : { kind: 'revolve', sketch: p.index, axis: v.axis === 'x' ? 'x' : 'y', angle: Number(v.deg) };
    if (node.kind === 'revolve' && v.axis === 'edge' && typeof v.sourceFeature === 'string' && typeof v.edgeName === 'string') {
      const link = pickedRevolveAxisReference(ctx.doc, p.index, v);
      if (!link) throw refusal('BAD_REFERENCE', 'The linked Revolve axis is unavailable.');
      node.axisRef = link;
    }
    return combine(withNode(ctx.doc, node), baseOf(ctx, p.node)?.ref ?? null, v.op);
  },
  // The angle: an arc about the axis, from the profile's middle.
  handles: (ctx, v) => {
    const p = oneProfile(ctx); if (!p) return [];
    const plane = planeOf(p.node), ax = revolveAxis(v);
    let m: [number, number]; try { m = profileMiddle(p.node, ctx.doc.parameters); } catch { return []; }
    const t = (m[0] - ax.o[0]) * ax.d[0] + (m[1] - ax.o[1]) * ax.d[1], foot: [number, number] = [ax.o[0] + ax.d[0] * t, ax.o[1] + ax.d[1] * t];
    const centre = toWorld(plane, foot), from = toWorld(plane, m), tip = toWorld(plane, [foot[0] + ax.d[0], foot[1] + ax.d[1]]);
    const axis: [number, number, number] = [tip[0] - centre[0], tip[1] - centre[1], tip[2] - centre[2]];
    if (Math.hypot(from[0] - centre[0], from[1] - centre[1], from[2] - centre[2]) < 1e-6) return [];
    return [{ key: 'deg', at: from, dir: axis, min: 1, max: 360, step: 15, arc: { centre, axis, from } }];
  },
};

export const pipeCommand: Command = {
  id: 'pipe', label: 'Pipe', icon: 'cad-sweep', group: 'create', keywords: 'sweep tube bend path rail handle',
  hint: 'Carry a finished sketch along a run, a bend and a run',
  available: needProfile,
  fields: ctx => { const p = oneProfile(ctx); return [{ key: 'h', label: 'Run', kind: 'mm', min: 0.1 }, { key: 'bend', label: 'Bend radius', kind: 'mm', min: 0.1 },
    { key: 'bendAngle', label: 'Bend angle', kind: 'deg', min: 1, max: 270, step: 15 },
    { key: 'toward', label: 'Bends toward', kind: 'choice', options: [{ value: 'x', label: '+X' }, { value: '-x', label: '−X' }, { value: 'y', label: '+Y' }, { value: '-y', label: '−Y' }] },
    ...opFields(!!(p && baseOf(ctx, p.node)))]; },
  defaults: ctx => { const p = oneProfile(ctx); return { h: 8, bend: 20, bendAngle: 90, toward: 'x', ...(p && baseOf(ctx, p.node) ? { op: 'join' } : {}) }; },
  build: (ctx, v) => {
    const p = oneProfile(ctx)!, run = Number(v.h);
    return combine(withNode(ctx.doc, { kind: 'sweep', sketch: p.index, path: [{ kind: 'straight', length: run }, { kind: 'bend', radius: Number(v.bend), angle: Number(v.bendAngle), toward: v.toward as 'x' }, { kind: 'straight', length: run }] }), baseOf(ctx, p.node)?.ref ?? null, v.op);
  },
};

/** A section helper's result, or its refusal (a sketch bound to a missing parameter) as the helpers' own `{ error }`. */
// (The "[CODE] " prefix is for the agent's text; the person's reason reads without it.)
function attempt<T>(f: () => T): T | { error: string } { try { return f(); } catch (e) { return { error: (e instanceof Error ? e.message : String(e)).replace(/^\[\w+\] /, '') }; } }

/** The step saying a bound sketch's sizes are copied at today's parameter values, or none. */
function boundStep(ctx: Ctx): { label: string; text: string; done: boolean }[] {
  const bound = boundParameters(ctx.doc.nodes, ctx.selection.sketches ?? [], ctx.doc.parameters);
  return bound.length ? [{ label: 'Sizes', text: `Copied at ${bound.map(([name, value]) => `${name} = ${value}`).join(', ')}: later parameter changes do not update this loft.`, done: true }] : [];
}

function loftSourceNodes(ctx: Ctx): readonly ModelNode[] {
  const picked = ctx.selection.sketches ?? [];
  return ctx.doc.nodes.map((node, index) => {
    if (node.kind !== 'sketch' || !node.pocketFloor || !picked.includes(index)) return node;
    const placed = { ...currentPocketSketch(ctx.doc, index) };
    delete placed.pocketFloor;
    return placed;
  });
}

export const loftCommand: Command = {
  id: 'loft', label: 'Loft', icon: 'cad-loft', group: 'create', keywords: 'taper transition blend sections ruled',
  hint: 'A solid through two or more sketches on parallel planes (Shift-click to pick them)',
  available: ctx => { const picked = ctx.selection.sketches ?? []; if (picked.length < 2) return no('Pick two or more finished sketches on parallel planes (Shift-click).'); const s = attempt(() => loftSections(loftSourceNodes(ctx), picked, ctx.doc.parameters)); return 'error' in s ? no(s.error) : ok; },
  fields: (ctx, values) => [{ key: 'guide', label: 'Guide (copied)', kind: 'choice', options: [
    { value: '', label: 'None' },
    ...(ctx.doc.direct?.objects ?? []).flatMap(object => { const guide = copyLoftGuide(ctx.doc, object.id); return guide.ok ? [{ value: object.id, label: guide.name }] : []; }),
  ], unknown: value => { const guide = copyLoftGuide(ctx.doc, value); return guide.ok ? 'Choose an available guide or None.' : guide.reason; } },
  ...(!values?.guide ? [{ key: 'smooth', label: 'Smooth (through the middle sections)', kind: 'choice' as const, options: [{ value: 'no', label: 'Ruled' }, { value: 'yes', label: 'Smooth' }] }] : [])],
  defaults: () => ({ smooth: 'no', guide: '' }),
  steps: (ctx, values) => {
    if (values.guide !== undefined && values.guide !== '') {
      const guide = typeof values.guide === 'string' ? copyLoftGuide(ctx.doc, values.guide) : { ok: false as const, reason: 'Choose an available guide or None.' };
      const general = guide.ok && guide.guide.kind === 'nurbs';
      const sections = attempt(() => general ? loftSections(loftSourceNodes(ctx), ctx.selection.sketches ?? [], ctx.doc.parameters) : framedLoftSections(loftSourceNodes(ctx), ctx.selection.sketches ?? [], ctx.doc.parameters));
      return [
        ...boundStep(ctx),
        { label: 'Sections', text: 'error' in sections ? sections.error : sections.sections.map(section => `Sketch ${section.source + 1}`).join(' → ') + (general ? ' (height order)' : ' (picked order)'), done: !('error' in sections) },
        { label: 'Guide', text: guide.ok ? `${guide.name}. Copied world-mm values; later curve edits do not update this loft.${general ? ' The guide must pass through a vertex of each section.' : ''}` : guide.reason, done: guide.ok },
      ];
    }
    return [
      ...boundStep(ctx),
      { label: 'Guide', text: 'None. Use the existing section heights.', done: true },
      ...(ctx.doc.direct?.objects ?? []).flatMap((object, index) => { const guide = copyLoftGuide(ctx.doc, object.id); return guide.ok ? [] : [{ label: `Unavailable guide ${index + 1}`, text: `${object.name}: ${guide.reason}`, done: false }]; }),
    ];
  },
  build: (ctx, v) => {
    if (v.guide !== undefined && v.guide !== '') {
      if (typeof v.guide !== 'string') throw refusal('DIRECT_PICK', 'Choose an available guide or None.');
      const guide = copyLoftGuide(ctx.doc, v.guide);
      if (!guide.ok) throw refusal('DIRECT_PICK', guide.reason);
      if (guide.guide.kind === 'nurbs') {
        const sections = loftSections(loftSourceNodes(ctx), ctx.selection.sketches ?? [], ctx.doc.parameters);
        if ('error' in sections) throw refusal('LOFT_SECTIONS', sections.error);
        let doc = ctx.doc; const at: number[] = [];
        for (const section of sections.sections) { doc = withNode(doc, section.node); at.push(doc.nodes.length - 1); }
        return withNode(doc, { kind: 'loft', sections: sections.sections.map((section, index) => ({ sketch: at[index], z: section.z })), from: sections.sections.map(section => section.source), guide: guide.guide });
      }
      const sections = framedLoftSections(loftSourceNodes(ctx), ctx.selection.sketches ?? [], ctx.doc.parameters);
      if ('error' in sections) throw refusal('LOFT_SECTIONS', sections.error);
      let doc = ctx.doc; const at: number[] = [];
      for (const section of sections.sections) { doc = withNode(doc, section.node); at.push(doc.nodes.length - 1); }
      return withNode(doc, { kind: 'loft', sections: sections.sections.map((section, index) => ({ sketch: at[index], frame: section.frame })), from: sections.sections.map(section => section.source), guide: guide.guide });
    }
    const s = loftSections(loftSourceNodes(ctx), ctx.selection.sketches ?? [], ctx.doc.parameters);
    if ('error' in s) throw refusal('LOFT_SECTIONS', s.error);
    // Each section on the first one's plane (the picked sketches stay as they are, used by the loft).
    let doc = ctx.doc; const at: number[] = [];
    for (const sec of s.sections) { doc = withNode(doc, sec.node); at.push(doc.nodes.length - 1); }
    return withNode(doc, { kind: 'loft', sections: s.sections.map((sec, k) => ({ sketch: at[k], z: sec.z })), from: s.sections.map(sec => sec.source), ...(v.smooth === 'yes' && s.sections.length > 2 ? { smooth: true } : {}) });
  },
};

/** The one direct curve picked, as a path (its NURBS data), or why there is none. */
export function sweepPath(doc: StudioDoc, ids: readonly string[]): { name: string; path: { degree: number; knots: number[]; controlPoints: [number, number, number][]; weights: number[] } } | string {
  const d = doc.direct;
  if (ids.length !== 1 || !d) return 'Pick one curve as the path (in the Browser, under Curves and surfaces): draw it in a sketch and Make curves, or take a model edge as a curve.';
  const objects = d.objects.filter(object => object.id === ids[0]);
  if (objects.length !== 1 || objects[0].hidden) return 'Pick one visible and unambiguous curve for the path.';
  const [o] = objects;
  // (The direct tools load with the document's direct geometry; a moment after it opens they are there.)
  const direct = directNow(); if (!direct) return 'The curve tools are still loading: try again in a moment.';
  let g;
  try { g = direct.geometryOf(d, o); }
  catch { return 'The selected path could not be read. Pick another curve.'; }
  if (g.kind !== 'curve') return 'The path must be a curve, not a surface.';
  return { name: o.name, path: { degree: g.degree, knots: [...g.knots], controlPoints: g.controlPoints.map(p => [p[0], p[1], p[2]] as [number, number, number]), weights: [...g.weights] } };
}

const pickedPath = (ctx: Ctx) => sweepPath(ctx.doc, ctx.direct ?? []);

export const sweepCurveCommand: Command = {
  id: 'sweep-curve', label: 'Sweep', icon: 'cad-sweep', group: 'create', keywords: 'sweep path rail curve along tube wire spring pipe route',
  hint: 'Carry a finished sketch along a curve: its middle starts at the curve’s start, square to it, and follows it without twisting',
  available: ctx => { if (!oneProfile(ctx)) return needProfile(ctx); const p = pickedPath(ctx); return typeof p === 'string' ? no(p) : ok; },
  fields: ctx => { const p = oneProfile(ctx); return [...opFields(!!(p && baseOf(ctx, p.node)))]; },
  defaults: (ctx): Values => { const p = oneProfile(ctx); return p && baseOf(ctx, p.node) ? { op: 'new' } : {}; },
  steps: ctx => {
    const profile = oneProfile(ctx), path = pickedPath(ctx);
    return [
      { label: 'Profile', text: profile ? `Sketch ${profile.index + 1}` : 'Pick a finished sketch', done: !!profile },
      { label: 'Path', text: typeof path === 'string' ? path : `${path.name} · Faceted`, done: typeof path !== 'string' },
    ];
  },
  build: (ctx, v) => {
    const p = oneProfile(ctx)!, path = pickedPath(ctx);
    if (typeof path === 'string') throw refusal('SWEEP_PATH', path);
    return combine(withNode(ctx.doc, { kind: 'sweep-curve', sketch: p.index, name: path.name, path: path.path }), baseOf(ctx, p.node)?.ref ?? null, v.op);
  },
};

export const profileCommands = [extrudeCommand, offsetFaceCommand, revolveCommand, pipeCommand, sweepCurveCommand, loftCommand];
