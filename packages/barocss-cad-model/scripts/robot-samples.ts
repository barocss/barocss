// The sample robots (RS1): ready-to-open documents for the studio's Samples list, written to samples/robots/<id>.bcad
// (plain JSON: they carry no mesh data) with samples/robots/index.json. Geometry and joints only — no rows (rows rule
// b) — each with one demo motion (robot.motions, RS2: degrees for a turning joint, mm for a slide). Four start from
// the kernel's RM conformance robots (a 2R chain, the 6R arm, the four-bar, the gear pair); the rest are built here
// from blocks with holes, joined by mates as the studio joins them (a turning joint: a hole concentric and a face
// coincident; a slide: two square faces coincident). Run: `node scripts/robot-samples.mjs` (writes the files);
// test/rs1-samples.test.ts checks what they are.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { emptyDoc, type ModelNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import type { Mate } from '../src/assembly/mates';
import type { Motion } from '../src/robot/motion';
import type { RobotSettings } from '../src/robot/joints';
import type { FrameSettings } from '../src/robot/frames';

type Axis = 'x' | 'y' | 'z';
interface Hole { axis: Axis; center: [number, number]; radius: number }
/** A w × d × h block from the origin, with holes through it (each one's cylinder is `n<k>.side0`, k = 2, 3, …). */
export function block(w: number, d: number, h: number, holes: readonly Hole[] = []): StudioDoc {
  const nodes: ModelNode[] = [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] } as ModelNode, { kind: 'extrude', sketch: 0, height: h } as ModelNode];
  for (const h of holes) nodes.push({ kind: 'hole', parent: { node: nodes.length - 1, side: 'solid' }, center: h.center, radius: h.radius, ...(h.axis !== 'z' ? { axis: h.axis } : {}) } as ModelNode);
  return { ...emptyDoc(), nodes };
}
const part = (id: string, name: string, doc: StudioDoc, position: [number, number, number]): PartInstance => ({ id, name, doc, position, rotation: [0, 0, 0] });
/** A turning joint: hole `ha` of a concentric with hole `hb` of b, and face fa of a coincident with fb of b. */
const turning = (id: string, a: string, ha: string, fa: string, b: string, hb: string, fb: string): Mate[] => [
  { id: `${id}c`, kind: 'concentric', a: { part: a, face: ha }, b: { part: b, face: hb } },
  { id: `${id}f`, kind: 'coincident', a: { part: a, face: fa }, b: { part: b, face: fb } },
];
/** A slide: two square face pairs coincident (the second flipped: they face each other), leaving the line they share. */
const sliding = (id: string, a: string, fa1: string, fb1: string, b: string, fa2: string, fb2: string): Mate[] => [
  { id: `${id}1`, kind: 'coincident', a: { part: a, face: fa1 }, b: { part: b, face: fb1 } },
  { id: `${id}2`, kind: 'coincident', a: { part: a, face: fa2 }, b: { part: b, face: fb2 }, flip: true },
];
const motion = (name: string, waypoints: Record<string, number>[], limits: Motion['path']['limits']): Motion => ({ name, path: { waypoints, profile: 'trapezoid', limits } });
/** The settings: each moving joint rated (`turning` keys: 2 N·m and 180°/s; slides: 50 N and 100 mm/s — an estimate the
 *  exports need, a person's own to set), its limits where given; the frames; the motions. */
function robot(keys: { turning?: string[]; sliding?: string[] }, limits: Record<string, { lower: number; upper: number }>, motions: Motion[], frames?: Record<string, FrameSettings>): RobotSettings {
  const joints: NonNullable<RobotSettings['joints']> = {};
  for (const k of keys.turning ?? []) joints[k] = { ...limits[k], effort: 2, velocity: Math.PI };
  for (const k of keys.sliding ?? []) joints[k] = { ...limits[k], effort: 50, velocity: 100 };
  return { version: 1, joints, ...(frames ? { frames } : {}), motions };
}
const rad = (deg: number) => deg * Math.PI / 180, within = (deg: number) => ({ lower: rad(-deg), upper: rad(deg) });

const RM = resolve(import.meta.dirname, '../../barocss-cad/conformance/rm');
const conformance = (name: string, file = 'robot.bcad'): StudioDoc => {
  const raw = JSON.parse(readFileSync(join(RM, name, file), 'utf8'));
  return (raw.input?.document ?? raw) as StudioDoc;
};
const DEG_LIMITS = { default: { velocity: 90, acceleration: 180 } };
const MM_LIMITS = { default: { velocity: 100, acceleration: 200 } };

export interface Sample { id: string; title: string; about: string; doc: StudioDoc }

export function samples(): Sample[] {
  const out: Sample[] = [];
  // 2R planar arm: the kernel's chain (two 60 mm links, 60 mm between their holes), its joints ±150°.
  {
    const d = conformance('chain-2r', 'case.json');
    out.push({ id: 'arm-2r', title: '2R planar arm', about: 'Two links turning about parallel vertical axes, 40 mm apart: the plane arm of every textbook.',
      doc: { ...d, robot: robot({ turning: ['base~a', 'a~b'] }, { 'base~a': within(150), 'a~b': within(150) },
        [motion('wave', [{}, { 'base~a': 60, 'a~b': -90 }, { 'base~a': -45, 'a~b': 90 }, {}], DEG_LIMITS)]) } });
  }
  // SCARA (R R P R): two arms about vertical axes, a quill sliding down the second arm's end, a tool turning on it.
  {
    const base = block(80, 80, 10, [{ axis: 'z', center: [40, 40], radius: 5 }]);
    const arm1 = block(120, 30, 10, [{ axis: 'z', center: [15, 15], radius: 5 }, { axis: 'z', center: [105, 15], radius: 5 }]);
    const arm2 = block(110, 30, 10, [{ axis: 'z', center: [15, 15], radius: 5 }]);
    const quill = block(20, 20, 80, [{ axis: 'z', center: [10, 10], radius: 4 }]);
    const tool = block(30, 30, 8, [{ axis: 'z', center: [15, 15], radius: 4 }]);
    const doc: StudioDoc = { ...base,
      instances: [part('arm1', 'arm 1', arm1, [25, 25, 10]), part('arm2', 'arm 2', arm2, [115, 25, 20]), part('quill', 'quill', quill, [210, 30, -30]), part('tool', 'tool', tool, [205, 25, -38])],
      mates: [...turning('j1', 'base', 'n2.side0', 'n1.top', 'arm1', 'n2.side0', 'n1.bottom'), ...turning('j2', 'arm1', 'n3.side0', 'n1.top', 'arm2', 'n2.side0', 'n1.bottom'),
        ...sliding('j3', 'arm2', 'n1.side1', 'n1.side3', 'quill', 'n1.side0', 'n1.side0'), ...turning('j4', 'quill', 'n2.side0', 'n1.bottom', 'tool', 'n2.side0', 'n1.top')] };
    out.push({ id: 'scara', title: 'SCARA arm', about: 'Turn, turn, slide, turn: two arms about vertical axes, a quill sliding up and down at the second arm\'s end, a tool turning on it.',
      doc: { ...doc, robot: robot({ turning: ['base~arm1', 'arm1~arm2', 'quill~tool'], sliding: ['arm2~quill'] }, { 'arm2~quill': { lower: -40, upper: 40 } }, [motion('pick', [{}, { 'base~arm1': 45, 'arm1~arm2': -60 }, { 'base~arm1': 45, 'arm1~arm2': -60, 'arm2~quill': -30 }, { 'base~arm1': 45, 'arm1~arm2': -60, 'arm2~quill': -30, 'quill~tool': 90 }, {}], { default: { velocity: 90, acceleration: 180 }, 'arm2~quill': { velocity: 60, acceleration: 120 } })]) } });
  }
  // 6R arm: the kernel's (RM conformance arm-6r).
  {
    const d = conformance('arm-6r');
    out.push({ id: 'arm-6r', title: '6R arm', about: 'Six turning joints, the industrial arm\'s chain: waist, shoulder, elbow and a three-axis wrist.', doc: { ...d, robot: robot({ turning: ['base~l1', 'l1~l2', 'l2~l3', 'l3~l4', 'l4~l5', 'l5~l6'] }, {}, [motion('reach', [{}, { 'base~l1': 90, 'l1~l2': -30, 'l2~l3': 60 }, { 'base~l1': 90, 'l1~l2': -30, 'l2~l3': 60, 'l3~l4': 90, 'l4~l5': 45, 'l5~l6': 180 }, {}], DEG_LIMITS)]) } });
  }
  // Cartesian gantry (P P P): a carriage along X on the bed, a slide along Y on it, a ram along Z on that.
  {
    const bed = block(300, 200, 10), cx = block(60, 200, 10), cy = block(60, 60, 10), ram = block(20, 20, 100);
    const doc: StudioDoc = { ...bed,
      instances: [part('x', 'X carriage', cx, [20, 0, 10]), part('y', 'Y slide', cy, [20, 20, 20]), part('z', 'Z ram', ram, [40, 40, 30])],
      mates: [...sliding('px', 'base', 'n1.top', 'n1.bottom', 'x', 'n1.side0', 'n1.side0'), ...sliding('py', 'x', 'n1.top', 'n1.bottom', 'y', 'n1.side3', 'n1.side3'), ...sliding('pz', 'y', 'n1.side1', 'n1.side3', 'z', 'n1.side0', 'n1.side0')] };
    out.push({ id: 'gantry-ppp', title: 'Cartesian gantry', about: 'Three slides square to each other — X, Y and Z — as on a 3-axis router or a 3D printer.',
      doc: { ...doc, robot: robot({ sliding: ['base~x', 'x~y', 'y~z'] }, { 'base~x': { lower: 0, upper: 200 }, 'x~y': { lower: 0, upper: 120 }, 'y~z': { lower: -40, upper: 40 } }, [motion('box', [{}, { 'base~x': 150 }, { 'base~x': 150, 'x~y': 100 }, { 'base~x': 150, 'x~y': 100, 'y~z': 30 }, {}], MM_LIMITS)]) } });
  }
  // Pan-tilt head: a block turning about Z on the base (pan), a head turning about X on its side (tilt), a camera frame.
  {
    const base = block(80, 80, 10, [{ axis: 'z', center: [40, 40], radius: 5 }]);
    const pan = block(30, 30, 50, [{ axis: 'z', center: [15, 15], radius: 5 }, { axis: 'x', center: [15, 40], radius: 4 }]);
    const head = block(20, 40, 30, [{ axis: 'x', center: [20, 15], radius: 4 }]);
    const doc: StudioDoc = { ...base,
      instances: [part('pan', 'pan', pan, [25, 25, 10]), part('tilt', 'head', head, [55, 20, 35])],
      mates: [...turning('pan', 'base', 'n2.side0', 'n1.top', 'pan', 'n2.side0', 'n1.bottom'), ...turning('tilt', 'pan', 'n3.side0', 'n1.side1', 'tilt', 'n2.side0', 'n1.side3')] };
    out.push({ id: 'pan-tilt', title: 'Pan-tilt camera head', about: 'Pan about the vertical, tilt about a horizontal axis on its side, and a camera (sensor) frame on the head.',
      doc: { ...doc, robot: robot({ turning: ['base~pan', 'pan~tilt'] }, { 'base~pan': within(170), 'pan~tilt': within(60) },
        [motion('look around', [{}, { 'base~pan': 90 }, { 'base~pan': 90, 'pan~tilt': 30 }, { 'base~pan': -90, 'pan~tilt': -30 }, {}], DEG_LIMITS)],
        { camera: { link: 'tilt', position: [20, 20, 15], rotation: [0, 0, 0], kind: 'sensor' } }) } });
  }
  // Parallel gripper: two fingers on equal spur gears that mesh (20 teeth, module 2, 40 mm apart), so they turn together, opposite ways.
  {
    const base = block(100, 40, 10, [{ axis: 'z', center: [30, 20], radius: 4 }, { axis: 'z', center: [70, 20], radius: 4 }]);
    const finger = (): StudioDoc => ({ ...emptyDoc(), nodes: [{ kind: 'gear', module: 2, teeth: 20, faceWidth: 8, bore: 8, center: [0, 0], generator: 'spur-gear@0' } as ModelNode] });
    const doc: StudioDoc = { ...base,
      instances: [part('left', 'left finger', finger(), [0, 0, 30]), part('right', 'right finger', finger(), [100, 0, 30])],
      mates: [...turning('l', 'base', 'n2.side0', 'n1.top', 'left', 'n0.bore', 'n0.face0'), ...turning('r', 'base', 'n3.side0', 'n1.top', 'right', 'n0.bore', 'n0.face0')] };
    out.push({ id: 'gripper', title: 'Gear-coupled gripper', about: 'Two fingers on meshing gears of 20 teeth: the right one follows the left one, the other way round (1 : −1).',
      doc: { ...doc, robot: robot({ turning: ['base~left', 'base~right'] }, { 'base~left': within(30) }, [motion('grip', [{}, { 'base~left': 25 }, {}], DEG_LIMITS)]) } });
  }
  // Four-bar linkage: the kernel's (a crank, a coupler, a rocker, the base the fourth bar; one loop closed).
  {
    const d = conformance('four-bar');
    out.push({ id: 'four-bar', title: 'Four-bar linkage', about: 'A closed loop: turn the crank and the coupler and the rocker follow (one degree of freedom).', doc: { ...d, robot: robot({ turning: ['base~crank', 'crank~coupler', 'base~rocker'] }, {}, [motion('crank', [{}, { 'base~crank': 60 }, { 'base~crank': -60 }, {}], DEG_LIMITS)]) } });
  }
  // Gear-driven joint: the kernel's 20 : 30 pair.
  {
    const d = conformance('urdf-gears');
    out.push({ id: 'gear-joint', title: 'Gear-driven joint', about: 'A 20-tooth gear driving a 30-tooth one: the driven joint turns two thirds as far, the other way.', doc: { ...d, robot: robot({ turning: ['base~g1', 'base~g2'] }, {}, [motion('turn', [{}, { 'base~g1': 180 }, {}], DEG_LIMITS)]) } });
  }
  return out;
}

// (Written when run as a script.)
if (process.argv[2] === 'write') {
  const dir = resolve(import.meta.dirname, '../samples/robots'), list = samples();
  mkdirSync(dir, { recursive: true });
  for (const s of list) writeFileSync(join(dir, `${s.id}.bcad`), JSON.stringify(s.doc) + '\n');
  writeFileSync(join(dir, 'index.json'), JSON.stringify(list.map(s => ({ id: s.id, title: s.title, about: s.about, file: `${s.id}.bcad` })), null, 1) + '\n');
  console.log(`${list.length} samples written to ${dir}`);
}
