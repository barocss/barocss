// G19: the section bar — one plane (along X, Y or Z, or from a face), a box (six planes, a handle on each face), or two
// or three planes (each along an axis or from a face, its offset typed or dragged) — and the drag handles for each plane.
// The kept region is the intersection of the planes' kept sides — or, a cut-out (G20: two or three planes), their union:
// the corner where the planes' cut-away sides meet removed.
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { fmt } from '@barocss/cad-model/engine/doc';
import type { FeatureHandle } from '../viewport/gizmo';
import { boxSection, cutoutCorner, flipPlane, middlePlane, planeAxis, type Section, type SectionPlane } from '../viewport/sectionView';
import { SECTION_SPAN_UNAVAILABLE, projectedSectionSpan, sectionDragRange, sectionDragValue } from '../viewport/sectionSpan';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Icon } from './atoms';

type Box = { min: Vec3; max: Vec3 };
const AXES = ['x', 'y', 'z'] as const;
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function handleRange(p: SectionPlane, box: Box) {
  const span = projectedSectionSpan(box, p.normal);
  if (!span) return null;
  const [lo, hi] = span;
  return planeAxis(p)?.keep === 'negative' ? sectionDragRange(-hi, -lo) : sectionDragRange(lo, hi);
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
  return section.planes.flatMap((p, i): FeatureHandle[] => {
    const range = handleRange(p, box);
    if (!range) return [];
    const a = planeAxis(p), dir = p.normal.map(v => -v || 0) as Vec3;
    const at = centre.map((c, k) => c - p.normal[k] * (dot(p.normal, centre) - p.offset)) as Vec3;
    const name = a ? (section.mode === 'box' ? `box ${a.keep === 'positive' ? '−' : '+'}${'XYZ'[a.k]}` : 'XYZ'[a.k])
      : p.face ? `face ${p.face}` : `plane ${i + 1}`;
    return [{
      id: i ? `section${i}` : 'section',
      at, dir, label: `Section ${name}`, value: a?.at ?? p.offset,
      toValue: (start, mm) => sectionDragValue(range, start, a ? mm * dir[a.k] : -mm),
      format: v => `${fmt(v)} mm`,
      // The drag stores a live plane. Release commits only while the same plane still owns the handle.
      onDrag: (value, done) => {
        const offset = a?.keep === 'negative' ? -value : value;
        if (!Number.isFinite(offset)) return;
        set(s => {
          const plane = s?.planes[i];
          if (!s || s.mode !== section.mode || !plane || plane.face !== p.face
            || !plane.normal.every((n, k) => n === p.normal[k]) || plane.offset === offset) return s;
          return { ...s, planes: s.planes.map((current, j) => j === i ? { ...plane, offset } : current) };
        }, done);
      },
    }];
  });
}

/**
 * The bar. `box`: the part's and its placed parts' box; `facePick`: the plane a face click sets (its index) or null;
 * `onSketch`: Sketch the section (one plane only); `eye`: where the camera is (a cut-out's default corner faces it).
 */
export function SectionBar({ section, setSection, hatch, setHatch, box, facePick, setFacePick, onSketch, eye, onProblem }: {
  section: Section; setSection(f: (s: Section | null) => Section | null): void; hatch: boolean; setHatch(on: boolean): void; box: Box; facePick: number | null; setFacePick(i: number | null): void; onSketch(): void; eye(): Vec3 | null; onProblem(reason: string | null): void;
}) {
  const set = (planes: (SectionPlane | null)[], mode = section.mode) => {
    const valid = planes.filter(p => p !== null);
    if (!valid.length || valid.length !== planes.length || valid.some(p => {
      const span = projectedSectionSpan(box, p.normal);
      return !span || !(p.offset > span[0] && p.offset < span[1]);
    })) {
      onProblem(SECTION_SPAN_UNAVAILABLE);
      return;
    }
    onProblem(null);
    setFacePick(null);
    setSection(() => ({ mode, planes: valid }));
  };
  const mode = (m: Section['mode']) => {
    if (m === section.mode) return;
    if (m === 'box') return set(boxSection(box.min, box.max).planes, 'box');
    // (G20: the corner facing the camera taken out through the box's middle, along X and Y.)
    if (m === 'cutout') return set(cutoutCorner(box, eye()), 'cutout');
    const first = section.mode === 'box' ? middlePlane('y', box) : section.planes[0];
    if (m === 'plane') return set([first], 'plane');
    const firstAxis = first && planeAxis(first);
    const other = AXES.find(a => !firstAxis || 'xyz'[firstAxis.k] !== a) ?? 'x';
    set([first, middlePlane(other, box)], 'planes');
  };
  const one = (i: number, q: SectionPlane | null) => set(section.planes.map((p, j) => j === i ? q : p));
  const axisButtons = (i: number) => AXES.map(a => { const pa = planeAxis(section.planes[i]), on = !!pa && 'xyz'[pa.k] === a;
    return <Button size="sm" variant={on ? 'default' : 'ghost'} key={a} className={on ? 'on' : ''} aria-label={section.mode === 'plane' ? `Section across ${a.toUpperCase()}` : `Section plane ${i + 1} across ${a.toUpperCase()}`} onClick={() => one(i, middlePlane(a, box))}>{a.toUpperCase()}</Button>; });
  const faceButton = (i: number) => <Button size="sm" variant={facePick === i ? 'default' : 'ghost'} className={facePick === i ? 'on' : ''} aria-pressed={facePick === i} aria-label={section.mode === 'plane' ? 'Section from a face' : `Section plane ${i + 1} from a face`}
    data-tip="From a face" data-tip-desc="Click a flat face: the section plane on it, the material behind it kept" onClick={() => { onProblem(null); setFacePick(facePick === i ? null : i); }}><Icon name="ads_click" small /></Button>;
  const flip = (i: number) => <Button size="sm" variant="ghost" aria-label={section.mode === 'plane' ? 'Flip the section' : `Flip section plane ${i + 1}`} data-tip="Show the other side" onClick={() => one(i, flipPlane(section.planes[i]))}><Icon name="swap_horiz" small /></Button>;
  // (G12f: its buttons shadcn's — on, the primary fill; the mode a ToggleGroup, a click on the mode shown keeping it.)
  return <div className="card section-bar" role="group" aria-label="Section">
    <span className="muted">Section</span>
    <ToggleGroup type="single" className="seg" aria-label="Section mode" value={section.mode} onValueChange={v => { if (v) mode(v as Section['mode']); }}>{(['plane', 'box', 'planes', 'cutout'] as const).map(m =>
      <ToggleGroupItem key={m} value={m} className={section.mode === m ? 'on' : ''}
        {...(m === 'cutout' ? { 'data-tip': 'Cut-out', 'data-tip-desc': 'Take a corner out: a quarter (two planes) or an eighth (three), the rest kept' } : {})}>{m === 'plane' ? 'Plane' : m === 'box' ? 'Box' : m === 'planes' ? 'Planes' : 'Cut-out'}</ToggleGroupItem>)}</ToggleGroup>
    {section.mode === 'plane' && <>{axisButtons(0)}{faceButton(0)}{flip(0)}
      <Button size="sm" variant="ghost" aria-label="Sketch the section" data-tip="Sketch the section" data-tip-desc="Copy the visible cut outlines into an independent sketch" onClick={onSketch}><Icon name="cad-sketch" small /></Button></>}
    {section.mode === 'box' && <><span className="muted small">drag a face's arrow</span>
      <Button size="sm" variant="ghost" aria-label="Reset the section box" data-tip="Reset the box" data-tip-desc="The box round the part, a tenth in from each face" onClick={() => set(boxSection(box.min, box.max).planes, 'box')}><Icon name="restart_alt" small /></Button></>}
    {(section.mode === 'planes' || section.mode === 'cutout') && <>{section.planes.map((p, i) => <span key={i} className="section-plane" aria-label={`Section plane ${i + 1}`}>
      <span className="mono small" aria-label={`Section plane ${i + 1} is`}>{label(p)}</span>{axisButtons(i)}{faceButton(i)}{flip(i)}
      {section.planes.length > 2 && <Button size="sm" variant="ghost" aria-label={`Remove section plane ${i + 1}`} onClick={() => set(section.planes.filter((_, j) => j !== i))}><Icon name="close" small /></Button>}</span>)}
      {section.planes.length < 3 && <Button size="sm" variant="ghost" aria-label="Add a section plane" data-tip="Add a plane" data-tip-desc={section.mode === 'cutout' ? 'An eighth taken out, not a quarter' : undefined} onClick={() => set(section.mode === 'cutout' ? [...section.planes, cutoutCorner(box, eye(), 3)[2] ?? null] : [...section.planes, middlePlane(AXES.find(a => !section.planes.some(p => planeAxis(p) && 'xyz'[planeAxis(p)!.k] === a)) ?? 'z', box)])}><Icon name="add" small /></Button>}</>}
    <Button size="sm" variant={hatch ? 'default' : 'ghost'} className={hatch ? 'on' : ''} aria-pressed={hatch} aria-label="Hatch the cut" data-tip="Hatch" data-tip-desc="Lines on the cut, each part's at its own angle" onClick={() => setHatch(!hatch)}><Icon name="texture" small /></Button>
    {section.mode !== 'plane' && <Button size="sm" variant="ghost" aria-label="Sketch the section" disabled data-tip="Sketch the section" data-tip-desc="One plane only: a sketch lies on one plane"><Icon name="cad-sketch" small /></Button>}
    {facePick !== null && <span className="muted small" role="status">Click a flat face</span>}
    {facePick === null && section.planes.some(p => !handleRange(p, box)) && <span className="muted small" role="status">{SECTION_SPAN_UNAVAILABLE}</span>}
  </div>;
}
