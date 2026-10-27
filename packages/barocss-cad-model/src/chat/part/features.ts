// The v2 `features` group's handlers (R3, moved verbatim from chat/tools.ts's runPartTool): the feature tree's
// commands, raw nodes, edits and deletes, materials, and the person's rows (stock, frame stock, sections, welds).
import { commandById, commands, givenValues, shownFields, type Ctx, type Values } from '../../app/commands';
import { editFields } from '../../app/editFields';
import { featureLabel, prefixDoc, withNode, type ModelNode, type StudioDoc } from '../../engine/doc';
import { loadPersonRows } from '../rows';
import { ROWS_NOT_FROM_PERSON } from '../../engine/rowFiles';
import type { RowKind } from '../../engine/rowDefinitions';
import { datumPlane, readReferences } from '../references';
import { checkNode, deleteFeature } from '../features';
import { withLook } from '../../app/bodies';
import { MATERIALS } from '../../library/materials';
import { resolveNames, resolveSelectors } from '../names';
import { rematchNames } from '../../engine/rematch';
import { editSections } from '../../frames/sections';
import { checkSkeletonEdit, SKELETON_CODES, solvedSkeleton, withFollowed } from '../../frames/skeleton';
import { weldList, type WeldRecord } from '../../frames/welds';
import { beadOwnershipError, type BeadOwnership } from '../../frames/beadOwnership';
import { bearingContextOf } from '../../engine/bearingContext';
import { type ChatState, type Evaluate, type ToolOutcome, type PartHandler, json, accept, fail, checkValues, strings, list, inRange } from '../toolKit';
import { isObj, isVec3 } from '../../util/guards';
import { mountRowsOf } from '../../engine/mountRows';
import { mountAxis } from '../../app/mounts';
import { firstProblem, isRefusal } from '../../engine/refusal';
import { REFERENCE_CODES } from '../../engine/schema/references';
import { addParameters, bindParameter, parameterUses, PARAMETER_CODES, removeParameter, renameParameter, withParameters, type Binding } from '../../engine/parameters';

/** Commands the chat can run (the ones that build; sketch-mode and measure UI actions are tools of their own). */
// (Loft takes sketches picked in the studio, Align a face clicked there; chat writes a loft node with
// add_features, and moves with move or rotate, instead.)
// (Not loft, align or a sweep along a curve: they need sketches, faces or curves picked in the viewport.)
export const CHAT_COMMANDS = commands.filter(c => c.build && c.id !== 'loft' && c.id !== 'align' && c.id !== 'sweep-curve').map(c => c.id);

/** What each command needs selected and what its values mean. */
export const COMMAND_DOCS: Record<string, { selection: string; values: Record<string, string> }> = {
  extrude: { selection: 'none: the newest finished sketch no feature uses yet', values: { h: 'distance along the sketch normal', draft: 'wall draft degrees (0: straight)', op: 'join | new | cut (only for a sketch drawn on a body face)', depth: 'distance | through (a cut only)' } },
  revolve: { selection: 'none: the newest finished sketch no feature uses yet', values: { axis: 'y | x: the sketch axis to turn about', deg: 'angle, up to 360', op: 'join | new | cut (sketch on a body face)' } },
  pipe: { selection: 'none: the newest finished sketch no feature uses yet', values: { h: 'straight run before and after the bend', bend: 'bend radius', bendAngle: 'bend angle', toward: 'x | -x | y | -y', op: 'join | new | cut (sketch on a body face)' } },
  'offset-face': { selection: 'faces: [one flat face of a body]', values: { d: 'distance along the face normal: + out (material added), − in (taken off)' } },
  box: { selection: 'none (or a top face to stack on)', values: { w: 'width along X', d: 'depth along Y', h: 'height along Z', x: 'min corner X', y: 'min corner Y', z: 'base Z' } },
  cylinder: { selection: 'none', values: { r: 'radius', h: 'height', x: 'centre X', y: 'centre Y', z: 'base Z' } },
  sphere: { selection: 'none', values: { r: 'radius', x: 'centre X', y: 'centre Y', z: 'Z it stands on (its bottom)' } },
  cone: { selection: 'none', values: { r: 'base radius', rt: 'top radius (0: a point)', h: 'height', x: 'centre X', y: 'centre Y', z: 'base Z' } },
  torus: { selection: 'none', values: { R: 'ring radius (axis to tube centre)', r: 'tube radius', x: 'centre X', y: 'centre Y', z: 'Z it lies on' } },
  // (R12.1, D116: sheet metal; the prefilled rules are estimates — ask for the shop's K-factor, or say it is one.)
  'sheet-plate': { selection: 'none: the newest finished sketch no feature uses yet', values: { t: 'sheet thickness', r: 'bend radius (inner)', k: 'K-factor 0–1 (the neutral layer at R + K·T; 0.5 is an estimate, not material data)', side: 'up | down: along the sketch normal or against it' } },
  'sheet-corner-relief': { selection: 'edges: [the edge of a sheet plate\u2019s square corner, between its two thickness faces] (before flanging its two edges)', values: { shape: 'square | round', size: 'side or radius (mm): at least the bend\u2019s setback R + T for square flanges on both edges (round: √2 that)' } },
  'sheet-flange': { selection: 'edges: [one straight edge on the skin of a sheet-metal body]', values: { length: 'flange length, to the outer virtual sharp by default', angle: 'bend angle, 1–179 (90: square)', position: 'material-inside | material-outside | bend-outside', measure: 'outer | inner | tangent: where the length is measured to', r: 'bend radius (0: the sheet\u2019s)', o0: 'offset from the edge\u2019s start (part width)', o1: 'offset from its end', relief: 'rectangular | obround | none (at an end inside the edge)', rw: 'relief width (0: T, an estimate)', rd: 'relief depth past the bend (0: T, an estimate)' } },
  'sheet-profile': { selection: 'none', values: { shape: 'l | u | z | hat', a: 'base length to the outside of the first bend (a Z\u2019s second bend and a hat\u2019s brims measure to their inside)', b: 'leg height (a hat: crown height), outside', c: 'lip (z and hat)', angle: 'bend angle of an L (90: square)', w: 'width along Y', t: 'sheet thickness', r: 'bend radius (inner)', k: 'K-factor 0–1 (0.5 is an estimate)', x: 'X of the base\u2019s left outer corner (a hat: the crown\u2019s)', y: 'min Y', z: 'Z of that corner' } },
  // (FR1, D123: a structural member; the prefilled radii and the T-slot's slot sizes are estimates — say so, or ask for the stock's.)
  // (FR2, D124: a frame on a preset skeleton or the picked straight edges.)
  frame: { selection: 'none for a preset skeleton; straight edges for "edges" (their ends become the points, shared where they meet)', values: { skeleton: 'table | box | rectangle | edges | l | tee', W: 'width along X', D: 'depth along Y', H: 'height along Z (table, box)', x: 'X of the corner', y: 'Y of the corner', z: 'Z of the corner', section: 'rect-tube | round-tube | angle | channel | i-beam | tslot', w: 'width (rect-tube, channel flanges)', h: 'height (rect-tube, channel)', t: 'wall (tubes)', ro: 'outer corner radius (rect-tube; the prefill is an estimate)', d: 'diameter (round-tube)', a: 'leg along the section x (angle)', b: 'leg along the section y (angle)', th: 'thickness (angle)', tw: 'web (channel)', tf: 'flanges (channel)', r1: 'root radius (angle, channel; an estimate if left)', r2: 'toe radius (angle; an estimate if left)', toe: 'toe radius (channel, i-beam; prefill 0 is an estimate)', slope: 'flange slope rise/run (channel, i-beam); flange thickness is at overhang midpoint', cells: '1 (20 × 20) | 2 (20 × 40) for tslot (its slot sizes are the tslot-20 library\u2019s estimates)', anchor: 'the section point on every line', roll: 'degrees about each line', corners: 'mitre | butt | none: how two members meeting at a point are finished (a butt: the larger section runs through)', multi: 'order | none: three or more members ending at a point (an ordered trim: the first runs through)', tee: 'butt | cope | none: a member ending on another\u2019s length', gap: 'nonnegative joint clearance mm; mitre halves plane setback, butt/tee holds branch off; unsupported with notch', branchOffset: 'T layout only: branch endpoint Z eccentricity mm', notch: 'none | holesaw | v; replaces cope at one joint', notchPoint: '1-based joint point; 0 selects L point2 or T point4 automatically', notchDiameter: 'hole saw diameter mm, must cover branch', notchOffset: 'signed mm along unit cross(through axis, branch inward), measured from through skeleton line', notchDepth: 'V depth mm from joint endpoint towards the branch other end', notchAngle: 'V included angle degrees, strictly between0 and180' } },
  'frame-member': { selection: 'none', values: { path: 'straight | centerarc | througharc | tangentbend; circular arcs and one tangent bend only; curved butt/cope/direct trim are refused', cx: 'arc center X (centerarc)', cy: 'arc center Y (centerarc)', cz: 'arc center Z (centerarc)', vx: 'point on arc X (througharc)', vy: 'point on arc Y (througharc)', vz: 'point on arc Z (througharc)', bx: 'virtual bend corner X (tangentbend)', by: 'virtual bend corner Y (tangentbend)', bz: 'virtual bend corner Z (tangentbend)', radius: 'centerline bend radius (tangentbend); each leg must extend past its tangent point', section: 'rect-tube | round-tube | angle | channel | i-beam | tslot', w: 'width (rect-tube, channel flanges)', h: 'height (rect-tube, channel)', t: 'wall (tubes)', ro: 'outer corner radius (rect-tube; the prefill is an estimate)', d: 'diameter (round-tube)', a: 'leg along the section x (angle)', b: 'leg along the section y (angle)', th: 'thickness (angle)', tw: 'web (channel)', tf: 'flanges (channel)', r1: 'root radius (angle, channel; an estimate if left)', r2: 'toe radius (angle; an estimate if left)', toe: 'toe radius (channel, i-beam; prefill 0 is an estimate)', slope: 'flange slope rise/run (channel, i-beam); flange thickness is at overhang midpoint', cells: '1 (20 × 20) | 2 (20 × 40) for tslot (its slot sizes are the tslot-20 library\u2019s estimates)', x0: 'start X', y0: 'start Y', z0: 'start Z', x1: 'end X', y1: 'end Y', z1: 'end Z', anchor: 'the section point on the line: centroid | origin | bottom-left | bottom | bottom-right | left | center | right | top-left | top | top-right', roll: 'degrees about the line' } },
  gear: { selection: 'none', values: { m: 'module (mm): the pitch diameter is m × teeth', teeth: 'teeth, 6–200 (under 18 undercut without a profile shift: the refusal gives the least x)', b: 'face width (mm)', shift: 'profile shift coefficient x, −0.5 to 1 (0: none; + thickens the tooth, moves tip and root out by x·m)', helix: 'helix angle β in degrees, 0 (spur) to 45; helical: m is the normal module', hand: 'right | left (helical only; a meshing gear takes the opposite hand itself)', bore: 'bore diameter (0: none), leaving a rim of at least one module below the root', x: 'centre X', y: 'centre Y', z: 'Z it stands on' } },
  'gear-mesh': { selection: 'bodies: [one spur gear, as made] — or [one internal gear]: the new gear then meshes inside it (ratio +z1/z2, the same way) — or [one bevel gear]: its mate (teeth the selected one\'s mate teeth, the same apex; dir and bore only)', values: { shift: 'profile shift x of the new gear, −0.5 to 1 (the centre distance becomes the working one)', teeth: 'teeth of the new gear, 6–200 (ratio −z1/z2 to the selected one; inside a ring, fewer than its teeth — about 2/5 clears the interference conditions)', dir: 'direction from the selected gear\'s axis to the new one\'s, degrees from +X (a bevel mate: the way its axis leans, about the selected gear\'s axis)', bore: 'bore diameter (0: none)' } },
  // (R12b.2a, D132: an internal gear.)
  'oring-gland': { selection: 'faces: [one face: a shaft\'s outside (piston), a bore (rod) or a flat face]; the user\'s O-ring rows loaded (none built in: if none, say so)', values: { ring: 'an O-ring row\'s id from the user\'s rows', seal: 'radial glands: the bore\'s Ø (piston) or the rod\'s Ø (rod) it seals on', dg: 'the groove\'s bottom Ø (radial) or inner Ø (face); the prefill from 20 % squeeze is an estimate: say so', w: 'groove width (prefill from 80 % fill, an estimate)', at: 'radial: the groove\'s start along the face', h: 'face: the groove\'s depth' } },
  bearing: { selection: 'bodies: [the shaft]; the user\'s bearing rows loaded (none built in: if none, say so)', values: { row: 'a bearing row\'s id from the user\'s rows', step: 'the shaft\'s step it sits on (its Ø the row\'s bore)', against: 'start | end: the shoulder it stands against', housing: 'none | a body node\'s index whose bore takes it', sc: 'none | the shaft seat\'s class from the user\'s fit tables', hc: 'none | the housing seat\'s class' } },
  key: { selection: 'bodies: [the shaft] (a shaft with a keyseat)', values: { seat: 'its keyseat, from 1', h: 'the key\'s height (the user\'s key data, else say the prefill is an estimate)', b: 'width (0: the seat\'s)', l: 'length (0: the seat\'s)', ends: 'auto (the seat\'s) | round | square', hub: 'none | a keyway node\'s index (its clearance over the key is checked)' } },
  keyway: { selection: 'faces: [one bore: a cylindrical hole\'s face of the hub]', values: { b: 'width (the key\'s data, else an estimate)', t2: 'depth t2 from the bore\'s surface (the same)', angle: 'degrees about the bore from its reference direction (+X projected); over the key\'s seat' } },
  'retaining-ring': { selection: 'bodies: [the shaft] (a shaft with a ring groove)', values: { groove: 'its groove, from 1', s: 'ring thickness (the ring\'s row, else an estimate)', D: 'outer diameter of its envelope (the same)', row: 'the id of the person\'s ring row it is checked against (Library panel, RINGS; O139), or none: an estimate' } },
  pin: { selection: 'bodies: [the shaft] (a shaft with a cross hole)', values: { hole: 'its cross hole, from 1', d: 'diameter (0: the hole\'s; larger needs fit classes)', L: 'length (0: flush with the step)' } },
  shaft: { selection: 'none', values: { n: 'steps, 1–5', d1: 'step 1 diameter (mm)', l1: 'step 1 length (mm)', d2: 'step 2 diameter', l2: 'step 2 length', d3: 'step 3 diameter', l3: 'step 3 length', d4: 'step 4 diameter (n ≥ 4)', l4: 'step 4 length', d5: 'step 5 diameter (n 5)', l5: 'step 5 length', r: 'shoulder fillet radius (0: none)', c: 'end chamfers (0: none)', ks: 'the step with a keyseat (0: none)', kb: 'keyseat width — the key\'s from the user\'s own data, else say the prefill is an estimate', kt: 'keyseat depth t1 (the same)', kl: 'keyseat length', ko: 'keyseat start from its step\'s start', ke: 'end-mill (default) | square | disc', kr: 'disc cutter radius (ke disc)', gs: 'the step with a ring groove (0: none)', gd: 'groove bottom diameter (the ring\'s data, else an estimate)', gw: 'groove width', ga: 'groove start from its step\'s start', x: 'axis X', y: 'axis Y', z: 'Z it starts at' } },
  'fit-class': { selection: 'faces: [one cylindrical face — a bore or a shaft]', values: { class: 'a tolerance class from the loaded fit tables (a hole\'s capital letter H7, a shaft\'s small g6), or none to clear it; the user loads the tables (none built in): if none is loaded, say so' } },
  'fit-pair': { selection: 'faces: [the bore, the shaft], both with fit classes', values: { op: 'declare (default) | remove; the clearance and the pair at its limit sizes go into the shaft body\'s notes; a clearance fit the geometry contradicts is refused' } },
  // (FRk1, D165: weldment plates on a frame's members.)
  gusset: { selection: 'bodies: [two members of one frame that meet: a corner, or one ending on the other]', values: { l1: 'leg along the first member (mm)', l2: 'leg along the second (mm)', t: 'thickness (mm)', clip: 'corner clip along each leg (mm, 0: none)', offset: 'off the members\' plane (mm)', along: 'at a T only: 1 or -1, which way the leg runs on the member passing through' } },
  'end-cap': { selection: 'bodies: [one frame member with a square end]', values: { end: 'end | start', fit: 'over (the end\'s outline) | inset (a plug in its bore)', t: 'thickness (mm)' } },
  // (R12c.7, D162: a connector opening from the user's rows; envelopes only.)
  connector: { selection: 'faces: [one flat face]; the user\'s connector rows loaded (none built in: if none, say so)', values: { row: 'a connector row\'s id (its opening, its body, its keep-out)', u: 'off the face\'s centre along its width (mm)', v: 'off the face\'s centre across it (mm)', rot: 'rotation of its width about the face\'s normal (degrees)' } },
  // (R12c.6b, D161: drive elements from the user's drive rows — none built in: if none, say so.)
  sprocket: { selection: 'none; the user\'s chain rows loaded (none built in: if none, say so)', values: { row: 'a chain row\'s id', teeth: 'teeth, 6–200', tip: 'tip Ø (mm): between where the flanks leave the seats and where they meet (the refusal gives both)', w: 'tooth width across the chain (mm)', seat: 'seat Ø, at least the roller\'s', bore: 'bore Ø (0: none)', x: 'centre X', y: 'centre Y', z: 'Z it stands on' } },
  pulley: { selection: 'none; the user\'s belt rows loaded (none built in)', values: { row: 'a belt row\'s id (its kind — timing, v, flat — makes the pulley)', teeth: 'timing: grooves', d: 'V: the datum Ø; flat: the face Ø (mm)', n: 'V: grooves', w: 'timing and flat: face width (mm)', crown: 'flat: crown height (mm, 0 flat)', bore: 'bore Ø (mm)', x: 'centre X', y: 'centre Y', z: 'Z it stands on' } },
  'belt-drive': { selection: 'bodies: [two sprockets, or two pulleys, made for one chain or belt row, in one plane]', values: { links: 'a chain: whole | even', snap: 'a chain: move (the second sprocket to the whole links\' distance) | stay (a warning)' } },
  coupling: { selection: 'none; the user\'s coupling rows loaded (none built in)', values: { row: 'a coupling row\'s id (its envelope; a bought item)', x: 'centre X', y: 'centre Y', z: 'Z it starts at', rot: 'rotation (degrees)' } },
  // (R12c.6a, D160: a disc cam; the pressure-angle limits are rules of thumb, estimates — say so.)
  cam: { selection: 'none', values: { follower: 'roller | flat', motion: 'translating (default) | oscillating', rb: 'base circle radius (mm)', rr: 'roller radius (mm; a roller)', e: 'translating: the follower\'s line off the centre (mm)', a: 'oscillating: the pivot\'s distance from the centre (mm)', l: 'oscillating roller: pivot to roller centre (mm)', c: 'oscillating flat face: its distance from the pivot toward the cam (mm)', h: 'lift (mm), or the arm\'s swing (degrees) when oscillating', br: 'rise angle (degrees)', lr: 'rise law: cycloidal | polynomial-345 | modified-trapezoid | harmonic (uniform is refused: its velocity steps at a dwell)', d1: 'dwell after the rise (degrees; the rest of 360° is the dwell before it)', bf: 'return angle (degrees)', lf: 'return law (the same)', t: 'thickness (mm)', bore: 'bore Ø (0: none)', x: 'centre X', y: 'centre Y', z: 'Z it stands on' } },
  spring: { selection: 'none', values: { type: 'compression (default) | extension | torsion', d: 'wire diameter (mm)', D: 'mean coil diameter (mm; above d; outer = D + d, inner = D − d)', n: 'active coils (may be fractional; a torsion spring\'s fraction sets the angle between its legs)', p: 'compression: the body\'s pitch (mm); below the geometric solid pitch (a hair above d) is refused as overlapping coils', pw: 'extension and torsion: the pitch, 0 close-wound (the default)', ends: 'compression: closed-ground (the default: a dead coil each end at the solid pitch, cut flat) | closed | open', hooks: 'extension: machine-loop (default) | crossover', Fi: 'extension: initial tension (N), the user\'s figure only', L0: 'torsion: start leg length (mm)', L1: 'torsion: end leg length (mm)', hand: 'right | left', G: 'compression and extension: shear modulus G (MPa) for the rate; the default is steel\'s, an estimate (say so); 0: no rate', E: 'torsion: Young\'s modulus E (MPa); the default is steel\'s, an estimate (say so)', F: 'compression and extension: working load (N); 0: none', M: 'torsion: working moment (N·mm); 0: none', x: 'axis X', y: 'axis Y', z: 'Z it stands on (its lowest point, or the ground plane)' } },
  'worm-pair': { selection: 'none', values: { m: 'axial module m_x (mm; the wheel\'s transverse module)', starts: 'worm threads, 1–4', d1: 'worm reference diameter (mm; q = d1 / m_x; the lead angle γ = atan(starts m_x / d1), at most 45°)', hand: 'right | left (worm and wheel of one hand)', wheel: 'cylindrical (a helical gear, the default) | throated (enveloping the worm, cut by a hob of its thread; the worm is then ZA)', form: 'ZI (involute helicoid, the default) | ZA (straight axial sides); ZN, ZK and ZC are refused; a throated wheel takes ZA', z2: 'wheel teeth, 10–200 (ratio z2 : starts)', b: 'wheel face width (mm)', bore: 'wheel bore (0: none)', wbore: 'worm bore (0: none)', x: 'wheel centre X', y: 'wheel centre Y', z: 'Z the wheel stands on (the worm lies in its mid-plane, along +Y of the line of centres, long enough for the mesh zone)' } },
  'bevel-gear': { selection: 'none', values: { m: 'module at the heel (mm): the reference diameter there is m × teeth', teeth: 'teeth, 5–200 (too few for its mate are undercut and refused, naming Tredgold\'s virtual teeth)', mate: 'the mating gear\'s teeth: with the shaft angle they fix its pitch cone', sigma: 'shaft angle Σ between the two axes, degrees (90 a right-angle pair; a pitch cone of 90° or more — crown or internal bevel — is refused)', b: 'face width along the cone (mm; over a third of the cone distance is warned of)', bore: 'bore diameter (0: none)', spiral: 'mean spiral angle β_m, 0–45° (0: straight). A spiral bevel gear is an IDEAL MODEL — the conjugate of its mate on every sphere, line contact, not a face-milled or face-hobbed tooth (no crowning, no machine settings): its body carries ideal_model; say so to the user', hand: 'left | right (spiral only; seen from its apex the tooth turns clockwise toward the heel for right; its mate takes the other)', rc: 'the tooth trace\'s cutter radius, mm (spiral only; 0: the mean cone distance, an estimate — ask for the shop\'s)', x: 'apex X', y: 'apex Y', z: 'Z its toe stands on' } },
  'internal-gear': { selection: 'none', values: { m: 'module (mm): the pitch diameter is m × teeth', teeth: 'teeth, 8–200 (unshifted under 34 its tip falls inside its base circle: the refusal gives the least x)', b: 'face width (mm)', rim: 'the rim\'s outer diameter (mm): at least the root circle plus a module', shift: 'profile shift coefficient x2, −0.5 to 0.75 (its tip at r − (1 − x2) m)', helix: 'helix angle β, 0–45° (0: straight); its pinion takes the same hand', hand: 'right | left (helical only)', cutter: 'teeth of the pinion-type cutter that cuts its root (24 by default, an estimate: ask for the shop\'s; 0 the schematic root; a helical ring\'s is schematic). Too many cutter teeth for the ring is refused, naming why (K1\'s Table 4.8 limit)', x: 'centre X', y: 'centre Y', z: 'Z it stands on' } },
  'gear-rack': { selection: 'none (a rack on its own; with one spur gear selected it meshes with it: then teeth, h and dir only)', values: { m: 'module (mm)', teeth: 'teeth along it, 1–500 (its length teeth × π m)', b: 'face width (mm)', h: 'height from the pitch line to the back (at least 2.25 m)', x: 'start of the pitch line X', y: 'pitch line Y', z: 'Z it stands on' } },
  'subd-box': { selection: 'none', values: { w: 'width X', d: 'depth Y', h: 'height Z', n: 'quads along each side (1–12; fewer, rounder)', x: 'centre X', y: 'centre Y', z: 'Z it stands on' } },
  'subd-torus': { selection: 'none', values: { R: 'ring radius (axis to tube centre)', r: 'tube radius', nu: 'quads round the ring (4–64)', nv: 'quads round the tube (4–32)', x: 'centre X', y: 'centre Y', z: 'Z it lies on' } },
  'subd-tube': { selection: 'none', values: { r: 'outer radius', ri: 'inner radius', h: 'length along Z', nu: 'quads round (6–64; the first column centred on +X)', nh: 'quads along each wall (1–24)', x: 'axis X', y: 'axis Y', z: 'Z it starts at' } },
  tube: { selection: 'none', values: { r: 'outer radius', ri: 'inner radius', h: 'length', x: 'centre X', y: 'centre Y', z: 'base Z' } },
  wedge: { selection: 'none', values: { w: 'width X (high end at x)', d: 'depth Y', h: 'height Z', x: 'corner X', y: 'corner Y', z: 'base Z' } },
  prism: { selection: 'none', values: { n: 'sides (3–12)', s: 'size across the flats', h: 'height', x: 'centre X', y: 'centre Y', z: 'base Z' } },
  hole: { selection: 'faces: [one flat face facing ±X/±Y/±Z]', values: { type: 'through | blind | counterbore | countersink (90°) | tapped', d: 'diameter (tapped: the tap drill, set from thread)', depth: 'blind depth (also tapped with tend blind)', cd: 'counterbore diameter', ch: 'counterbore depth', csd: 'countersink diameter at the face', thread: 'tapped: M3 | M4 | M5 | M6 | M8 | M10 | M12 (coarse, cosmetic thread)', tend: 'tapped: through | blind', pat: 'one | row | circle (copies on the face, the first at x, y)', pn: 'copies in all (2–64)', pa: 'row: step along the first axis', pb: 'row: step along the second axis', qa: 'circle: its centre, first axis', qb: 'circle: its centre, second axis', x: 'centre, first axis of the face plane (Z face: X; X face: Y; Y face: X)', y: 'centre, second axis (Z face: Y; X face: Z; Y face: Z)' } },
  chamfer: { selection: 'edges: [edges of one body]', values: { distance: 'chamfer distance' } },
  draft: { selection: 'faces: [side faces of one body, square to Z, not touching each other — or every side of an extruded body]', values: { deg: 'draft angle in degrees (positive: the top leans in), below 45' } },
  'full-round': { selection: 'faces: [flat tops of one body facing +Z, each an axis-aligned rectangle: a rib or wall top]', values: { along: 'auto (each face\'s longer side) | x | y' } },
  fillet: { selection: 'edges: [edges of one body]', values: { radius: 'fillet radius (with endRadius: at the chain\'s start)', endRadius: 'optional: the radius at the other end of one open chain (0: the same); the radius varies along it', shape: 'optional section: circular (default) | conic | g2 (curving as the faces do at the contacts)', rho: 'conic: 0–1 exclusive (0.5 a parabola; smaller flatter, larger fuller)', tension: 'g2: 0–1 exclusive (default 0.5)' } },
  decimate: { selection: 'bodies: [one mesh body] (an imported STL, OBJ or scan: facet faces)', values: { keep: 'per cent of the triangles to keep (1–99)', maxError: 'mm: no collapse past it (0: none)', crease: 'degrees: also keep edges sharper than this (0: only the regions\u2019 boundaries and open edges)' } },
  shell: { selection: 'faces to open (all of one body), or bodies: [one body] for a closed hollow', values: { t: 'wall thickness' } },
  move: { selection: 'bodies: [one body]', values: { x: 'ΔX', y: 'ΔY', z: 'ΔZ', ax: 'to X (the box corner; the HUD keeps it with ΔX — give one of the two)', ay: 'to Y', az: 'to Z' } },
  rotate: { selection: 'bodies: [one body]', values: { axis: 'x | y | z', angle: 'degrees', px: 'pivot x mm (default: the body\'s centre)', py: 'pivot y mm', pz: 'pivot z mm' } },
  scale: { selection: 'bodies: [one body]', values: { factor: 'uniform factor (1 = unchanged)', px: 'pivot x mm (default: the body\'s centre)', py: 'pivot y mm', pz: 'pivot z mm' } },
  mount: { selection: 'faces: [one flat face facing ±X/±Y/±Z]', values: { row: 'a mount row\'s id (the person\'s datasheet rows, loaded with features.load_rows kind mounts)', x: 'the output axis on the face, first axis (as hole)', y: 'the output axis, second axis', turn: '0 | 90 | 180 | 270 (degrees about the face\'s normal)', pilot: 'through | recess (the pilot its depth, the shaft through), for a row with a pilot depth' } },
  fastener: { selection: 'none', values: { kind: 'hex-bolt (ISO 4017) | socket-screw (ISO 4762) | csk-screw (ISO 10642, countersunk: the head sinks below z, its top flush) | hex-nut (ISO 4032) | washer (ISO 7089)', size: 'M3 | M4 | M5 | M6 | M8 | M10 | M12 (coarse pitch)', length: 'bolt/screw length in mm, from the size\'s standard lengths (ISO 4017 for hex bolts, ISO 4762 for cap screws, ISO 10642 for countersunk screws, overall; as text, e.g. "20")', joint: 'free (on its own) | nut (through a clearance hole: washer + nut under the far face, `grip` below the seat) | tapped (into a tapped hole)', grip: 'with joint nut: the clamped thickness in mm below the seat (the bolt must reach grip + washer + nut + 2 pitches)', x: 'axis X', y: 'axis Y', z: 'seat Z: heads, nuts and washers sit on it, a shank goes down from it (a hole\'s rim)', insert: 'part (its features join this part) | instance (a part of its own placed in the assembly: in the bill of materials, mated like any part)', model: 'hex-bolt and hex-nut: cosmetic (a plain cylinder, the thread drawn) | modelled (the ISO 68-1 thread as helical B-spline faces: true shape and mass)' } },
  duplicate: { selection: 'bodies: [one body]', values: { dx: 'copy offset X', dy: 'copy offset Y', dz: 'copy offset Z' } },
  mirror: { selection: 'bodies: [one body]', values: { plane: 'yz | xz | xy; keeps the original', at: 'where the plane crosses its axis (yz: X; 0: through the origin)' } },
  'linear-pattern': { selection: 'bodies: [one body]', values: { axis: 'x | y | z', spacing: 'mm between copies', count: 'copies including the original', result: 'one (joined) | separate (each its own body)' } },
  'linear-feature-pattern': { selection: 'bodies: [one current unsuppressed subtract result]', values: { axis: 'x | y | z', spacing: 'positive mm between cuts (at most 10000)', count: 'whole number 2–64, including the original cut' } },
  'circular-pattern': { selection: 'bodies: [one body]', values: { axis: 'z | x | y (quarter turns)', count: 'copies including the original', span: 'degrees the copies spread over about Z (360: an even full turn)', px: 'Z axis position X (default 0)', py: 'Z axis position Y (default 0)', result: 'one (joined) | separate (each its own body)' } },
  hollow: { selection: 'none: the part (one body): the kernel\u2019s exact closed shell first, else (planar faces) a voxel cavity; the print direction (axis-aligned) decides its bottom, where the drains go', values: { t: 'wall thickness', h: 'voxel size of the depth field: the drains\u2019 placement, and the cavity when the shell refuses (at most t/2)', drain: 'drain hole diameter, one into each cavity from the bottom' } },
  lattice: { selection: 'none: the part (one body) hollowed by hollow (its exact closed shell); the lattice is a separate mesh body inside it, in the mass and 3MF', values: { cell: 'the gyroid\u2019s period L', thickness: 'the band k: the lattice is |G| \u2264 k, 0 < k < 1.5 (k 0.6: about 39% solid)', h: 'voxel size of the field (at most cell/4)' } },
  'split-bed': { selection: 'none: the part (one body); the document\u2019s printer and print direction (axis-aligned) decide the bed', values: { connector: 'dowel (a separate pin, a bore in both pieces) | plug (a pin made one with the lower piece)', d: 'pin diameter', length: 'pin length (half in each piece)', count: 'connectors per cut, 1–8', fit: 'radial clearance of each bore over its pin (default: the printing process\u2019s fit gap)', wall: 'least material round a bore' } },
  split: { selection: 'bodies: [one body]', values: { axis: 'normal of the cutting plane: x | y | z | n (any direction: nx, ny, nz)', at: 'plane position (axis n: the value of nx·x + ny·y + nz·z on the plane — x + y = at for 1, 1, 0, a mitre)', nx: 'axis n: the normal\'s X', ny: 'its Y', nz: 'its Z' } },
  union: { selection: 'bodies: [two bodies]', values: {} },
  difference: { selection: 'bodies: [body to cut, tool body]', values: {} },
  intersect: { selection: 'bodies: [two bodies]', values: {} },
};

/**
 * The person-row actions' first steps (set_stock, set_frame_stock, set_frame_sections; R3b): rows written by the agent
 * refused (rows rule b); something to do — a file, ids to remove, or the action's own setting (`other`) — else said.
 */
function rowsAsked(args: Record<string, unknown>, other: string | null): { remove: string[] } | { error: string } {
  if (args.rows !== undefined) return { error: ROWS_NOT_FROM_PERSON };
  const remove = strings(args.remove);
  if (args.file === undefined && (other === null || args[other] === undefined) && !remove.length) return { error: other ? `Give file, remove, ${other} or any of them.` : 'Give file, remove or both.' };
  return { remove };
}
/** The document with the person's file of rows loaded, when the call gives one (as it is, when not). */
const fileRows = (state: ChatState, args: Record<string, unknown>, kind: RowKind): { doc: StudioDoc } | { error: string } =>
  args.file === undefined ? { doc: state.doc } : loadPersonRows(state.doc, kind, args.file, undefined, state.rowFiles);
/** The rows less the named ids; an id the list does not have is refused with the list (O155). */
function removeRows<T extends { id: string }>(rows: readonly T[] | undefined, remove: readonly string[], code: string): { rows: T[] } | { error: string } {
  const was = rows ?? [], unknown = remove.filter(id => !was.some(r => r.id === id));
  if (unknown.length) return { error: `[${code}] no row ${unknown.map(x => `"${x}"`).join(', ')} to remove (rows: ${was.map(r => r.id).join(', ') || 'none'}).` };
  return { rows: was.filter(r => !remove.includes(r.id)) };
}

async function runCommandTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const cmd = commandById(String(args.command));
  if (!cmd?.build) return fail(state, `Unknown command "${String(args.command)}". Commands: ${CHAT_COMMANDS.join(', ')}.`);
  // (Faces and edges by name or by selector, A1.2: each selector resolves to its name, reported back.)
  const sel = resolveSelectors(state.doc.nodes, state.bodies, { faces: list(args.faces), edges: list(args.edges), bodies: list(args.bodies) });
  if (sel.error) return fail(state, sel.error);
  const { selection, unknown } = resolveNames(state.bodies, sel.names);
  if (unknown.length) return fail(state, `No face, edge or body named ${unknown.map(n => `"${n}"`).join(', ')} on the current part. Use the names from the last result or get_part_summary.`);
  const point = Array.isArray(args.point) && args.point.length === 3 ? args.point.map(Number) as [number, number, number] : undefined;
  const ctx: Ctx = { doc: state.doc, bodies: state.bodies, selection, pick: point };
  const avail = cmd.available(ctx);
  if (!avail.ok) return fail(state, `${cmd.label} can’t run: ${avail.reason}`);
  const fields = cmd.fields?.(ctx) ?? [];
  const given = isObj(args.values) ? args.values : {};
  const bad = Object.keys(given).filter(k => !fields.some(f => f.key === k));
  if (bad.length) return fail(state, `${cmd.label} has no value ${bad.map(k => `"${k}"`).join(', ')}; its values are ${fields.map(f => `${f.key} (${f.label})`).join(', ') || 'none'}.`);
  const values: Values = givenValues(cmd, ctx, cmd.defaults?.(ctx) ?? {}, Object.fromEntries(Object.entries(given).map(([k, v]) => [k, typeof v === 'number' ? v : String(v)])));
  const why = checkValues(fields, values);
  if (why) return fail(state, `${cmd.label}: ${why}`);
  // (A command's own refusal — its build throws it — comes back as the tool's, the part unchanged; O14's typed ones among them.)
  let next: StudioDoc;
  try { next = cmd.build(ctx, values); } catch (e) { return fail(state, `${cmd.label}: ${e instanceof Error ? e.message : String(e)}`); }
  const shown = Object.fromEntries(shownFields(fields, values).map(f => [f.key, values[f.key]]));
  // (O14: a mount reports its row's source and its output axis — for a concentric mate, or set_frames as it is.)
  if (cmd.id === 'mount') {
    const row = mountRowsOf(state.doc).get(String(values.row))!, f = selection.faces[0], face = state.bodies[f.body].mesh.faces[f.face], k = [0, 1, 2].find(i => Math.abs(Math.abs(face.normal[i]) - 1) < 1e-6)!;
    const mount = { row: row.id, ...(row.designation ? { designation: row.designation } : {}), type: row.type, ...(row.source ? { source: row.source } : { estimate: true }), ...(row.unchecked?.length ? { unchecked: row.unchecked } : {}),
      axis: mountAxis(row, face, face.centroid[k], Number(values.x), Number(values.y), Number(values.turn ?? 0)), shaft: row.shaft };
    return accept(state, next, evaluate, `${cmd.label} ${json(shown)}`, { ...(sel.resolved.length ? { resolved: sel.resolved } : {}), mount, added: next.nodes.slice(state.doc.nodes.length).map((n, k) => `${state.doc.nodes.length + k}: ${featureLabel(n, state.doc.nodes.length + k, next.nodes)}`) });
  }
  return accept(state, next, evaluate, `${cmd.label} ${json(shown)}`, { ...(sel.resolved.length ? { resolved: sel.resolved } : {}), added: next.nodes.slice(state.doc.nodes.length).map((n, k) => `${state.doc.nodes.length + k}: ${featureLabel(n, state.doc.nodes.length + k, next.nodes)}`) });
}
async function addFeaturesTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const list = Array.isArray(args.features) ? args.features : null;
  if (!list?.length) return fail(state, '"features" is a non-empty list of feature nodes.');
  let doc = state.doc;
  // (A sketch on a datum plane, A6.3: "plane": {"datum": id} is that plane, in the part's coordinates.)
  for (const [k, node] of list.entries()) {
    const pl = isObj(node) ? (node as Record<string, unknown>).plane : undefined;
    if (isObj(pl) && typeof pl.datum === 'string') { try { list[k] = { ...(node as object), plane: datumPlane(readReferences(doc.references), pl.datum) }; } catch (e) { return fail(state, isRefusal(e, ...REFERENCE_CODES) ? e.message : String(e)); } }
  }
  const solves: Record<string, unknown>[] = [];
  for (const [k, node] of list.entries()) {
    const why = checkNode(node, doc.nodes, doc.parameters, doc.frames?.sections, state.partOf ? null : doc.instances ?? []);
    if (why) return fail(state, `Feature ${k + 1} of ${list.length} (would be index ${doc.nodes.length}): ${why}`, { kept: 'nothing was added' });
    // (A new feature takes the next stable id: one the call brings is not used, ids are never handed out twice.)
    let solved: ReturnType<typeof solvedSkeleton>;
    try { solved = solvedSkeleton(node as ModelNode, doc.parameters); }
    catch (e) { if (isRefusal(e, ...SKELETON_CODES)) return fail(state, `Feature ${k + 1} of ${list.length}: ${e.message}`, { kept: 'nothing was added' }); throw e; }
    if (solved.solve) solves.push({ feature: doc.nodes.length, ...solved.solve });
    doc = withNode(doc, { ...withFollowed(doc, solved.node), id: undefined });
  }
  return accept(state, doc, evaluate, `added ${list.length} feature${list.length > 1 ? 's' : ''}`, { added: doc.nodes.slice(state.doc.nodes.length).map((n, k) => `${state.doc.nodes.length + k}: ${featureLabel(n, state.doc.nodes.length + k, doc.nodes)}`), ...(solves.length ? { skeletons: solves } : {}) });
}
async function editFeatureTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const index = Number(args.index), nodes = state.doc.nodes;
  if (!Number.isInteger(index) || !nodes[index]) return fail(state, `There is no feature ${String(args.index)} (features 0–${nodes.length - 1}).`);
  let next: ModelNode[];
  if (args.feature !== undefined) {
    const why = checkNode(args.feature, nodes.slice(0, index), state.doc.parameters, state.doc.frames?.sections, state.partOf ? null : state.doc.instances ?? []);
    if (why) return fail(state, `Feature ${index}: ${why}`);
    // (The replacement is the same feature: it keeps its id, so the names of its faces stay.)
    next = nodes.map((n, i) => i === index ? { ...withFollowed(state.doc, args.feature as ModelNode), id: n.id } : n);
  } else {
    // (O167, F6: a part-scoped edit offers what the bearing command offers — the draft's context and its fit tables.)
    const fields = editFields(nodes, index, undefined, undefined, { context: bearingContextOf(state.doc), fits: state.doc.fits }), given = isObj(args.values) ? args.values : {};
    if (!Object.keys(given).length) return fail(state, `Pass "values" or a whole "feature". Feature ${index}'s values: ${fields.map(f => `${f.key} (${f.label} = ${String(f.get(nodes))})`).join(', ') || 'none — replace it with "feature"'}.`);
    next = [...nodes];
    for (const [key, v] of Object.entries(given)) {
      const f = fields.find(x => x.key === key);
      if (!f) return fail(state, `Feature ${index} has no value "${key}"; its values are ${fields.map(x => `${x.key} (${x.label})`).join(', ') || 'none'}.`);
      if (f.kind === 'number') { if (typeof v !== 'number' || !Number.isFinite(v)) return fail(state, `"${key}" must be a number.`); next = f.set(next, v); }
      else if (f.kind === 'choice') { if (!f.options.some(o => o.value === v)) return fail(state, `"${key}" is one of ${f.options.map(o => o.value).join(', ')}.`); next = f.set(next, String(v)); }
      else next = f.set(next, Boolean(v));
    }
  }
  // (FRg, O122: a skeleton with constraints solved again from its edit.)
  let solved: ReturnType<typeof solvedSkeleton>;
  try { solved = solvedSkeleton(next[index], state.doc.parameters); }
  catch (e) { if (isRefusal(e, ...SKELETON_CODES)) return fail(state, `Feature ${index}: ${e.message}`, { kept: 'the part is unchanged' }); throw e; }
  next = next.map((n, k) => k === index ? solved.node : n);
  // (FRf, O121: a skeleton frames follow keeps every point and segment they use.)
  const held = firstProblem(checkSkeletonEdit(nodes, index, next[index]));
  if (held) return fail(state, held);
  // (Names later features store, renumbered by this edit, matched again by their geometry: engine/rematch.ts.)
  const rm = await rematchNames(state.doc, prefixDoc({ ...state.doc, nodes: next }, next.length), evaluate);
  if ('error' in rm) return fail(state, rm.error, { kept: 'the part is unchanged' });
  return accept(state, rm.doc, evaluate, `edited ${index}: ${featureLabel(rm.doc.nodes[index], index, rm.doc.nodes)}`,
    rm.changes.length ? { rematched: rm.changes.map(c => ({ feature: c.node, was: c.from, now: c.to })), note_rematched: 'these stored names were renumbered by the edit and matched again by their geometry; check them' } : {}, true);
}
async function deleteFeatureTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const r = deleteFeature(state.doc, Number(args.index));
  if ('error' in r) return fail(state, r.error);
  return accept(state, r.doc, evaluate, `deleted feature${r.removed.length > 1 ? 's' : ''} ${r.removed.join(', ')}`, { note_indices: 'later features moved down; face and edge names (by feature id) stayed as they were' });
}
async function setMaterialTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  // (O73: the body's material, on its look — what its mass, the BOM and a library part's checks read before the brief's.
  // A placed part's own bodies through "part", as every part tool.)
  const id = typeof args.material === 'string' ? args.material : '', keys = strings(args.bodies), picked = keys.length ? state.bodies.filter(b => keys.includes(b.key)) : state.bodies;
  if (!MATERIALS.some(m => m.id === id)) return fail(state, `[MATERIAL_UNKNOWN] "${id}" is not a material here; materials: ${MATERIALS.map(m => m.id).join(', ')}.`);
  if (!picked.length || (keys.length && picked.length !== keys.length)) return fail(state, `No body ${keys.filter(k => !state.bodies.some(b => b.key === k)).join(', ') || 'to set'} (bodies: ${state.bodies.map(b => b.key).join(', ') || 'none'}).`);
  let doc = state.doc;
  for (const b of picked) doc = withLook(doc, b, { material: id });
  return { state: { ...state, doc }, content: json({ ok: true, bodies: picked.map(b => b.key), material: id }), isError: false, changed: true, summary: `${picked.map(b => b.key).join(', ')}: ${id}` };
}
async function loadRowsTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const loaded = loadPersonRows(state.doc, args.kind, args.file, args.feature, state.rowFiles);
  return 'error' in loaded ? fail(state, loaded.error) : accept(state, loaded.doc, evaluate, `Loaded ${loaded.rows} ${String(args.kind)} rows`, { source: loaded.source });
}
async function setStockTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const asked = rowsAsked(args, 'allowance');
  if ('error' in asked) return fail(state, asked.error);
  const { remove } = asked;
  if (args.allowance !== undefined && !inRange(args.allowance, 0, 100)) return fail(state, '[STOCK_ALLOWANCE] allowance is mm a face, 0 to 100.');
  const loaded = fileRows(state, args, 'stock');
  if ('error' in loaded) return fail(state, loaded.error);
  // (O155: rows merge by id (O150), so a row leaves only by name; an id not on the list is refused, listing the list.)
  const kept = removeRows(loaded.doc.machining?.stock, remove, 'STOCK_ROW_UNKNOWN');
  if ('error' in kept) return fail(state, kept.error);
  const machining = { ...loaded.doc.machining, version: 1 as const, ...(remove.length ? { stock: kept.rows } : {}), ...(args.allowance !== undefined ? { allowance: args.allowance as number } : {}) };
  const doc = args.allowance === undefined && !remove.length ? loaded.doc : { ...loaded.doc, machining };
  return accept(state, doc, evaluate, 'Stock and machining allowance');
}
async function setCastingTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  // (IM8b, O108: the casting pattern's — the faces machined after casting, by name, and the user's own allowance and shrinkage.)
  const machined = args.machined, allowance = args.allowance, shrink = args.shrink, gate = args.gate;
  if (machined === undefined && allowance === undefined && shrink === undefined && gate === undefined) return fail(state, 'Give machined, allowance, shrink, gate or any of them.');
  if (gate !== undefined && !isVec3(gate)) return fail(state, '[CASTING_GATE] gate is a point [x, y, z] (mm) on the part, where the metal comes in.');
  if (machined !== undefined && !(Array.isArray(machined) && machined.every(x => typeof x === 'string' && x))) return fail(state, '[CASTING_FACE] machined is a list of face names ("n1.top").');
  const faces = new Set(state.bodies.flatMap(b => b.mesh.faces.map(f => f.name))), missing = ((machined ?? []) as string[]).filter(n => !faces.has(n));
  if (missing.length) return fail(state, `[CASTING_FACE] not a face of the part: ${missing.join(', ')}. Use the names from the last result or query.summary.`);
  if (allowance !== undefined && !inRange(allowance, 0, 100)) return fail(state, `[CASTING_ALLOWANCE] allowance is mm a machined face, 0 to 100: ${JSON.stringify(allowance)}.`);
  if (shrink !== undefined && !inRange(shrink, 0, 0.1)) return fail(state, `[CASTING_SHRINK] shrink is a ratio (mm/mm), 0 to 0.1 (0.013 is 1.3 %): ${JSON.stringify(shrink)}.`);
  const was = state.doc.casting ?? { version: 1 as const }, casting = { ...was, version: 1 as const, ...(machined !== undefined ? { machined: [...new Set(machined as string[])] } : {}), ...(allowance !== undefined ? { machiningAllowance: allowance as number } : {}), ...(shrink !== undefined ? { shrink: shrink as number } : {}), ...(gate !== undefined ? { gate: [...(gate as number[])] as [number, number, number] } : {}) };
  const doc = { ...state.doc, casting };
  return { state: { ...state, doc }, content: json({ ok: true, machined: casting.machined ?? [], allowance: casting.machiningAllowance ?? null, shrink: casting.shrink ?? null, gate: casting.gate ?? null }), isError: false, changed: true, summary: `casting: ${casting.machined?.length ?? 0} machined face${casting.machined?.length === 1 ? '' : 's'}` };
}
/**
 * O21: the part's named parameters, all or nothing — added, given values, renamed, bound to a feature's value, removed
 * (engine/parameters.ts, in that order) — then evaluated: a value that does not build is refused, the part unchanged.
 */
async function setParametersTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const { add, set, rename, bind, remove } = args;
  if (add === undefined && set === undefined && rename === undefined && bind === undefined && remove === undefined) return fail(state, 'Give add, set, rename, bind, remove or any of them.');
  const numbers = (v: unknown): v is Record<string, number> => isObj(v) && Object.values(v).every(x => typeof x === 'number');
  if ((add !== undefined && !numbers(add)) || (set !== undefined && !numbers(set))) return fail(state, '[VALUE] add and set are {name: value} with numbers.');
  if (rename !== undefined && !(isObj(rename) && Object.values(rename).every(x => typeof x === 'string'))) return fail(state, '[VALUE] rename is {from: to}.');
  if (remove !== undefined && !(Array.isArray(remove) && remove.every(x => typeof x === 'string'))) return fail(state, '[VALUE] remove is a list of names.');
  if (bind !== undefined && !(Array.isArray(bind) && bind.every(b => isObj(b) && (typeof b.feature === 'number' || typeof b.feature === 'string') && typeof b.value === 'string' && typeof b.parameter === 'string'))) return fail(state, '[VALUE] bind is [{feature: index or id, value: the value\'s key as edit_feature names it, parameter}].');
  let doc = state.doc;
  try {
    if (add) doc = addParameters(doc, add as Record<string, number>);
    if (set) doc = withParameters(doc, set as Record<string, number>);
    for (const [from, to] of Object.entries((rename ?? {}) as Record<string, string>)) doc = renameParameter(doc, from, to);
    for (const b of (bind ?? []) as Binding[]) doc = bindParameter(doc, b);
    for (const name of (remove ?? []) as string[]) doc = removeParameter(doc, name);
  } catch (e) { if (isRefusal(e, ...PARAMETER_CODES)) return fail(state, e.message, { kept: 'the part is unchanged' }); throw e; }
  const parameters = Object.entries(doc.parameters).map(([name, value]) => ({ name, value, uses: parameterUses(doc.nodes, name) }));
  return accept(state, doc, evaluate, `parameters: ${[add && `${Object.keys(add).length} added`, set && `${Object.keys(set).length} set`, rename && `${Object.keys(rename).length} renamed`, bind && `${(bind as unknown[]).length} bound`, remove && `${(remove as unknown[]).length} removed`].filter(Boolean).join(', ')}`, { parameters });
}
async function setFrameStockTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const asked = rowsAsked(args, 'kerf');
  if ('error' in asked) return fail(state, asked.error);
  const { remove } = asked;
  if (args.kerf !== undefined && !inRange(args.kerf, 0, 20)) return fail(state, '[FRAME_KERF] kerf is mm, 0 to 20.');
  const loaded = fileRows(state, args, 'frame-stock');
  if ('error' in loaded) return fail(state, loaded.error);
  const kept = removeRows(loaded.doc.frames?.stock, remove, 'FRAME_STOCK_UNKNOWN');
  if ('error' in kept) return fail(state, kept.error);
  const frames = { ...loaded.doc.frames, version: 1 as const, ...(remove.length ? { stock: kept.rows } : {}), ...(args.kerf !== undefined ? { kerf: args.kerf as number } : {}) };
  const doc = args.kerf === undefined && !remove.length ? loaded.doc : { ...loaded.doc, frames };
  return accept(state, doc, evaluate, 'Frame stock and saw kerf');
}
async function setFrameSectionsTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const asked = rowsAsked(args, null);
  if ('error' in asked) return fail(state, asked.error);
  const { remove } = asked;
  const loaded = fileRows(state, args, 'sections');
  if ('error' in loaded) return fail(state, loaded.error);
  const result = editSections(loaded.doc, [], remove);
  if ('error' in result) return fail(state, result.error);
  // (FRc, O117: the report names the rows the file added or replaced, and the ids removed.)
  const was = new Map((state.doc.frames?.sections ?? []).map(r => [r.id, r])), now = result.doc.frames?.sections ?? [];
  const added = now.filter(r => !was.has(r.id)).map(r => r.id), replaced = now.filter(r => was.has(r.id) && was.get(r.id) !== r).map(r => r.id);
  return accept(state, result.doc, evaluate, `section library: ${[added.length ? `added ${added.join(', ')}` : '', replaced.length ? `changed ${replaced.join(', ')}` : '', result.removed.length ? `removed ${result.removed.join(', ')}` : ''].filter(Boolean).join('; ')}`,
    { added, replaced, removed: result.removed, rows: now.map(x => ({ id: x.id, ...(x.name ? { name: x.name } : {}), section: x.section, ...(x.source ? { source: x.source } : { estimate: true }) })) });
}
async function setWeldsTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  // (FRd1, O118: the person's welds by joint — kind, size, all round, notes — over the rule's; a joint the part does not have refused, listing them.)
  const given = Array.isArray(args.welds) ? args.welds : [], remove = strings(args.remove);
  const policyEdit = Object.hasOwn(args, 'beadOwnership');
  if (!given.length && !remove.length && !policyEdit) return fail(state, 'Give welds, remove or beadOwnership.');
  if (policyEdit && args.beadOwnership === undefined) return fail(state, '[BEAD_SHARED_CONTEXT] frames.beadOwnership: expected {version:1, policy:"equal-length"} or null to remove it');
  const ownershipError = args.beadOwnership === null ? null : beadOwnershipError(args.beadOwnership);
  if (ownershipError) return fail(state, ownershipError);
  const joints = weldList(state.doc, state.bodies).joints, ids = new Set(joints.map(j => j.id)), was = state.doc.frames?.welds ?? [];
  if (!joints.length && (given.length || remove.length)) return fail(state, '[WELD_NO_JOINTS] the part has no weld joints: frame members meeting at a corner, a butt or a face.');
  const good: WeldRecord[] = [];
  for (const [k, w] of given.entries()) {
    const o = (isObj(w) ? w : {}) as Record<string, unknown>, joint = typeof o.joint === 'string' ? o.joint : '';
    if (!ids.has(joint)) return fail(state, `[WELD_JOINT_UNKNOWN] weld ${k}: no joint "${joint}" (joints: ${[...ids].join(', ')}). Use weld_list's ids.`);
    const extra = Object.keys(o).find(x => !['joint', 'kind', 'size', 'allRound', 'inner', 'notes'].includes(x));
    if (extra) return fail(state, `[WELD_FIELD] weld ${k} (${joint}): no field "${extra}" (joint, kind, size, allRound, inner, notes).`);
    if (o.inner !== undefined && typeof o.inner !== 'boolean') return fail(state, `[WELD_FIELD] weld ${k} (${joint}): inner (whether the end's inner loop, a tube's bore, is welded) is true or false.`);
    if (o.kind !== undefined && o.kind !== 'fillet' && o.kind !== 'butt') return fail(state, `[WELD_FIELD] weld ${k} (${joint}): kind is fillet or butt.`);
    if (o.size !== undefined && !inRange(o.size, 0, 50, true)) return fail(state, `[WELD_FIELD] weld ${k} (${joint}): size is mm, above 0 and below 50.`);
    if (o.allRound !== undefined && typeof o.allRound !== 'boolean') return fail(state, `[WELD_FIELD] weld ${k} (${joint}): allRound is true or false.`);
    if (o.notes !== undefined && typeof o.notes !== 'string') return fail(state, `[WELD_FIELD] weld ${k} (${joint}): notes is text.`);
    good.push({ joint, ...(o.kind ? { kind: o.kind as WeldRecord['kind'] } : {}), ...(o.size !== undefined ? { size: o.size as number } : {}), ...(o.allRound !== undefined ? { allRound: o.allRound as boolean } : {}), ...(o.inner !== undefined ? { inner: o.inner as boolean } : {}), ...(typeof o.notes === 'string' && o.notes.trim() ? { notes: o.notes.trim() } : {}) });
  }
  if (new Set(good.map(r => r.joint)).size !== good.length) return fail(state, '[WELD_FIELD] two welds for one joint.');
  const welds = [...was.filter(r => !remove.includes(r.joint) && !good.some(g => g.joint === r.joint)), ...good];
  const frames = { version: 1 as const, ...state.doc.frames, ...(given.length || remove.length ? { welds } : {}) };
  if (policyEdit) {
    if (args.beadOwnership === null) delete frames.beadOwnership;
    else if (args.beadOwnership !== undefined) frames.beadOwnership = args.beadOwnership as BeadOwnership;
  }
  const doc = { ...state.doc, frames };
  // (FRk2: a record is a bead — the part built again, so the bodies and the weld list show the beads, or why not.)
  return accept(state, doc, evaluate, `welds: ${good.length} set${remove.length ? `, ${remove.length} removed` : ''}${policyEdit ? ', ownership policy edited' : ''}`, { set: good.map(r => r.joint), removed: remove.filter(id => was.some(r => r.joint === id)), welds: welds.length, beadOwnership: frames.beadOwnership ?? null });
}

/** The feature group's handlers, by v1 tool name (R3). */
export const FEATURE_HANDLERS: Readonly<Record<string, PartHandler>> = { run_command: runCommandTool, add_features: addFeaturesTool, edit_feature: editFeatureTool, delete_feature: deleteFeatureTool, set_material: setMaterialTool, load_rows: loadRowsTool, set_stock: setStockTool, set_casting: setCastingTool, set_frame_stock: setFrameStockTool, set_parameters: setParametersTool, set_frame_sections: setFrameSectionsTool, set_welds: setWeldsTool };
