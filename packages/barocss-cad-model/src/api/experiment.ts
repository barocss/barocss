import type { StudioDoc } from '../engine/doc';
import { materialIdOf } from '../app/bodies';
import { MATERIALS } from '../library/materials';
import { bodiesOf } from './core';
import { BarocssError } from './refusal';
import { coreValues, gravityOf, inertiaOf, poseOf, treeOf } from './robotCore';
import { gravityExperimentBinding, gravityExperimentInput, type GravityExperimentOptions } from './experimentInput';

function unsupported(message: string): never { throw new BarocssError('ROBOT', message, 'evaluate'); }

function reportOf(doc: StudioDoc, options: GravityExperimentOptions) {
  const inputs = gravityExperimentInput(options), binding = gravityExperimentBinding(doc, inputs);
  const tree = treeOf(doc), joint = tree.joints[0];
  if (tree.joints.length !== 1 || !joint || !['revolute', 'continuous'].includes(joint.type)
    || tree.loops.length || tree.couplings.length || tree.cams?.length || joint.mimic || joint.cam
    || tree.problems.length || tree.links.length !== 2 || joint.parent !== tree.base
    || tree.links.some(link => link.part === null)
    || !tree.links.some(link => link.id === joint.child && link.id !== tree.base)) {
    unsupported('A static gravity experiment requires one connected open revolute or continuous joint without couplings.');
  }
  if (Object.keys(inputs.values)[0] !== joint.key) unsupported('The explicit angle must name the experiment’s one moving joint.');
  const values = coreValues(tree, inputs.values);
  if (poseOf(doc, values).out_of_limits.length) unsupported('The requested static pose is outside the joint limits.');

  const inertia = inertiaOf(doc), moving = inertia.links.find(link => link.link === joint.child);
  if (!moving || !Number.isFinite(moving.mass) || !(moving.mass > 0) || moving.issues.length
    || !moving.bodies.length || moving.bodies.some(body => body.assumed || !Number.isFinite(body.mass) || !(body.mass > 0))
    || moving.centroid.some(value => !Number.isFinite(value))
    || moving.inertia.some(row => row.some(value => !Number.isFinite(value)))) {
    unsupported('The moving link needs positive finite mass, explicit materials and resolved inertia without issues.');
  }
  const movingPart = tree.links.find(link => link.id === joint.child)!.part;
  const movingDoc = movingPart === 'base' ? doc : doc.instances?.find(instance => instance.id === movingPart)?.doc;
  if (!movingDoc) unsupported('The moving link must identify an existing part occurrence.');
  // The ordinary material reader falls back for unknown ids. This bounded experiment must not accept that fallback.
  const bodies = bodiesOf(movingDoc);
  for (const counted of moving.bodies) {
    const body = bodies.find(body => body.key === counted.key);
    const material = body ? materialIdOf(movingDoc, body) : undefined;
    if (!material || !MATERIALS.some(entry => entry.id === material)) unsupported('Each moving body needs an explicit known material.');
  }
  const result = gravityOf(doc, values, inputs.gravity);
  if (result.notReady || !Number.isFinite(result.gravity)
    || !Object.hasOwn(result.torques, joint.key) || !Object.hasOwn(result.generalized, joint.key)
    || Object.values(result.torques).some(value => !Number.isFinite(value))
    || Object.values(result.generalized).some(value => !Number.isFinite(value))) {
    unsupported('The static gravity result must be complete and finite for the moving joint.');
  }
  return {
    profile: 'static-gravity-v1' as const, binding, inputs,
    units: { angle: 'degree', length: 'mm', mass: 'g', inertia: 'g·mm²', gravity: 'mm/s²', torque: 'N·mm' } as const,
    inertia, result,
    scope: { joint: joint.key, occurrence: movingPart,
      axis: { point: [...joint.origin], direction: [...joint.axis] },
      coordinateFrame: 'Joint axis and gravity: document world XYZ; inertia: each reported link frame.' },
    assumptions: ['Prescribed stationary pose; reported torque holds against gravity.',
      'The existing Model link-inertia/gravity mass model and explicit catalogue materials are used, not a separate CAD BRep axis-inertia calculation.',
      'Catalogue material inputs are not measured material evidence or CAD BRep native-SI provenance.',
      'No contact, free-motion integration, actuator suitability or physical validation is established.'],
  };
}

/** A detached static holding-torque calculation and its full document/input staleness binding. */
export class GravityExperiment {
  readonly #report: ReturnType<typeof reportOf>;
  constructor(doc: StudioDoc, options: GravityExperimentOptions) {
    this.#report = reportOf(structuredClone(doc), options);
  }
  get report(): ReturnType<typeof reportOf> { return structuredClone(this.#report); }
  /** Equality of complete captured inputs, not a new evaluation or an integrity certificate. */
  matches(doc: StudioDoc, options: GravityExperimentOptions): boolean {
    const binding = gravityExperimentBinding(doc, gravityExperimentInput(options));
    return binding.document === this.#report.binding.document && binding.inputs === this.#report.binding.inputs;
  }
}
