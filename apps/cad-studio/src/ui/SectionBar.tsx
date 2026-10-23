// G19: the section bar — one plane (along X, Y or Z, or from a face), a box (six planes, a handle on each face), or two
// or three planes (each along an axis or from a face, its offset typed or dragged) — and the drag handles for each plane.
// The kept region is the intersection of the planes' kept sides — or, a cut-out (G20: two or three planes), their union:
// the corner where the planes' cut-away sides meet removed.
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { fmt } from '@barocss/cad-model/engine/doc';
import type { FeatureHandle } from '../viewport/gizmo';
import { axisPlane, boxSection, cutoutCorner, flipPlane, planeAxis, type Section, type SectionPlane } from '../viewport/sectionView';
import { Icon } from './atoms';

type Box = { min: Vec3; max: Vec3 };
type Axis = 'x' | 'y' | 'z';
const AXES = ['x', 'y', 'z'] as const;
const mid = (box: Box, k: number) => Math.round(box.min[k] + box.max[k]) / 2;
/** An axis plane through the middle of the box, kept on its positive side. */
export const middlePlane = (axis: Axis, box: Box): SectionPlane => axisPlane(axis, mid(box, 'xyz'.indexOf(axis)), 'positive');
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The plane's offsets over the box's corners: the range a drag keeps it in. */
function span(p: SectionPlane, box: Box): [number, number] {
  const ds = [0, 1, 2, 3, 4, 5, 6, 7].map(i => dot(p.normal, [i & 1 ? box.max[0] : box.min[0], i & 2 ? box.max[1] : box.min[1], i & 4 ? box.max[2] : box.min[2]]));
  return [Math.min(...ds), Math.max(...ds)];
}
const label = (p: SectionPlane) => { const a = planeAxis(p); return a ? `${'XYZ'[a.k]} ${a.keep === 'positive' ? '≥' : '≤'} ${fmt(a.at)}` : `Face ${p.face ?? ''}`.trim(); };

/**
 * The section's drag handles (G19): an arrow on each plane across it toward the side cut away, through the middle of
 * what is kept (a box's on each face); an axis plane's value its coordinate (as G2's handle), another's its offset.
 */
export function sectionHandles(section: Section, box: Box, set: (f: (s: Section | null) => Section | null, done: boolean) => void): FeatureHandle[] {
  // (The middle of what the axis planes keep of the box — of a cut-out, of the corner it takes out: the arrows on the
  // notch's faces.)
  const lo = [...box.min] as Vec3, hi = [...box.max] as Vec3, notch = section.mode === 'cutout';
  for (const p of section.planes) { const a = planeAxis(p); if (!a) continue; if ((a.keep === 'positive') !== notch) lo[a.k] = Math.max(lo[a.k], a.at); else hi[a.k] = Math.min(hi[a.k], a.at); }
  const centre = [0, 1, 2].map(k => (lo[k] + hi[k]) / 2) as Vec3;
  return section.planes.map((p, i) => {
    const a = planeAxis(p), dir = p.normal.map(v => -v || 0) as Vec3;
    const at = centre.map((c, k) => c - p.normal[k] * (dot(p.normal, centre) - p.offset)) as Vec3;
    // (`done`: the drag released — R1c (3c): the plane is committed then, the steps before it only shown.)
    const replace = (q: SectionPlane, done: boolean) => set(s => s && s.planes[i] && (s.planes[i].offset !== q.offset) ? { ...s, planes: s.planes.map((x, j) => j === i ? q : x) } : s, done);
    if (a) {
      const k = a.k, sg = a.keep === 'positive' ? 1 : -1;
      return { id: i ? `section${i}` : 'section', at, dir, label: section.mode === 'box' ? `Section box ${a.keep === 'positive' ? '−' : '+'}${'XYZ'[k]}` : `Section ${'XYZ'[k]}`, value: a.at,
        toValue: (start: number, mm: number) => Math.min(box.max[k] - 0.5, Math.max(box.min[k] + 0.5, Math.round((start + mm * dir[k]) * 2) / 2)),
        format: (v: number) => `${fmt(v)} mm`, onDrag: (v: number, done: boolean) => replace({ ...p, offset: sg * v }, done) };
    }
    const [dlo, dhi] = span(p, box);
    return { id: i ? `section${i}` : 'section', at, dir, label: `Section ${p.face ? `face ${p.face}` : `plane ${i + 1}`}`, value: p.offset,
      toValue: (start: number, mm: number) => Math.min(dhi - 0.5, Math.max(dlo + 0.5, Math.round((start - mm) * 2) / 2)),
      format: (v: number) => `${fmt(v)} mm`, onDrag: (v: number, done: boolean) => replace({ ...p, offset: v }, done) };
  });
}

/**
 * The bar. `box`: the part's and its placed parts' box; `facePick`: the plane a face click sets (its index) or null;
 * `onSketch`: Sketch the section (one plane only); `eye`: where the camera is (a cut-out's default corner faces it).
 */
export function SectionBar({ section, setSection, hatch, setHatch, box, facePick, setFacePick, onSketch, eye }: {
  section: Section; setSection(f: (s: Section | null) => Section | null): void; hatch: boolean; setHatch(on: boolean): void; box: Box; facePick: number | null; setFacePick(i: number | null): void; onSketch(): void; eye(): Vec3 | null;
}) {
  const set = (planes: SectionPlane[], mode = section.mode) => setSection(() => ({ mode, planes }));
  const mode = (m: Section['mode']) => {
    setFacePick(null);
    if (m === section.mode) return;
    if (m === 'box') return set(boxSection(box.min, box.max).planes, 'box');
    // (G20: the corner facing the camera taken out through the box's middle, along X and Y.)
    if (m === 'cutout') return set(cutoutCorner(box, eye()), 'cutout');
    const first = section.mode === 'box' ? middlePlane('y', box) : section.planes[0];
    if (m === 'plane') return set([first], 'plane');
    const other = AXES.find(a => !planeAxis(first) || 'xyz'[planeAxis(first)!.k] !== a) ?? 'x';
    set([first, middlePlane(other, box)], 'planes');
  };
  const one = (i: number, q: SectionPlane) => set(section.planes.map((p, j) => j === i ? q : p));
  const axisButtons = (i: number) => AXES.map(a => { const pa = planeAxis(section.planes[i]), on = !!pa && 'xyz'[pa.k] === a;
    return <button key={a} className={on ? 'on' : ''} aria-label={section.mode === 'plane' ? `Section across ${a.toUpperCase()}` : `Section plane ${i + 1} across ${a.toUpperCase()}`} onClick={() => { setFacePick(null); one(i, middlePlane(a, box)); }}>{a.toUpperCase()}</button>; });
  const faceButton = (i: number) => <button className={facePick === i ? 'on' : ''} aria-pressed={facePick === i} aria-label={section.mode === 'plane' ? 'Section from a face' : `Section plane ${i + 1} from a face`}
    data-tip="From a face" data-tip-desc="Click a flat face: the section plane on it, the material behind it kept" onClick={() => setFacePick(facePick === i ? null : i)}><Icon name="ads_click" small /></button>;
  const flip = (i: number) => <button aria-label={section.mode === 'plane' ? 'Flip the section' : `Flip section plane ${i + 1}`} data-tip="Show the other side" onClick={() => one(i, flipPlane(section.planes[i]))}><Icon name="swap_horiz" small /></button>;
  return <div className="card section-bar" role="group" aria-label="Section">
    <span className="muted">Section</span>
    <div className="seg" role="group" aria-label="Section mode">{(['plane', 'box', 'planes', 'cutout'] as const).map(m =>
      <button key={m} className={section.mode === m ? 'on' : ''} aria-pressed={section.mode === m} onClick={() => mode(m)}
        {...(m === 'cutout' ? { 'data-tip': 'Cut-out', 'data-tip-desc': 'Take a corner out: a quarter (two planes) or an eighth (three), the rest kept' } : {})}>{m === 'plane' ? 'Plane' : m === 'box' ? 'Box' : m === 'planes' ? 'Planes' : 'Cut-out'}</button>)}</div>
    {section.mode === 'plane' && <>{axisButtons(0)}{faceButton(0)}{flip(0)}
      <button aria-label="Sketch the section" data-tip="Sketch the section" data-tip-desc="A sketch on the section plane with the cut's outlines in it (to extrude, revolve or dimension)" onClick={onSketch}><Icon name="cad-sketch" small /></button></>}
    {section.mode === 'box' && <><span className="muted small">drag a face's arrow</span>
      <button aria-label="Reset the section box" data-tip="Reset the box" data-tip-desc="The box round the part, a tenth in from each face" onClick={() => set(boxSection(box.min, box.max).planes, 'box')}><Icon name="restart_alt" small /></button></>}
    {(section.mode === 'planes' || section.mode === 'cutout') && <>{section.planes.map((p, i) => <span key={i} className="section-plane" aria-label={`Section plane ${i + 1}`}>
      <span className="mono small" aria-label={`Section plane ${i + 1} is`}>{label(p)}</span>{axisButtons(i)}{faceButton(i)}{flip(i)}
      {section.planes.length > 2 && <button aria-label={`Remove section plane ${i + 1}`} onClick={() => set(section.planes.filter((_, j) => j !== i))}><Icon name="close" small /></button>}</span>)}
      {section.planes.length < 3 && <button aria-label="Add a section plane" data-tip="Add a plane" data-tip-desc={section.mode === 'cutout' ? 'An eighth taken out, not a quarter' : undefined} onClick={() => set(section.mode === 'cutout' ? [...section.planes, cutoutCorner(box, eye(), 3)[2]] : [...section.planes, middlePlane(AXES.find(a => !section.planes.some(p => planeAxis(p) && 'xyz'[planeAxis(p)!.k] === a)) ?? 'z', box)])}><Icon name="add" small /></button>}</>}
    <button className={hatch ? 'on' : ''} aria-pressed={hatch} aria-label="Hatch the cut" data-tip="Hatch" data-tip-desc="Lines on the cut, each part's at its own angle" onClick={() => setHatch(!hatch)}><Icon name="texture" small /></button>
    {section.mode !== 'plane' && <button aria-label="Sketch the section" disabled data-tip="Sketch the section" data-tip-desc="One plane only: a sketch lies on one plane"><Icon name="cad-sketch" small /></button>}
    {facePick !== null && <span className="muted small" role="status">Click a flat face</span>}
  </div>;
}
