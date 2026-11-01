// First-party authored model data builders. No World creation, stepping or old-config conversion.
const identity = () => ({ positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] });
const material = (value = {}) => ({ restitution: value.restitution ?? 0,
  friction: value.friction ?? { static: 0, dynamic: 0 } });
function collider(id, geometry, options) {
  return { id: options.colliderId ?? `${id}.shape`, bodyId: id, geometry,
    local: identity(), material: material(options), sensor: options.sensor ?? false,
    ccd: options.ccd ?? false, filter: options.filter ?? { categoryBits: 1, maskBits: 65535 } };
}
export function dynamicPart(id, geometry, initial, massKg = 1, options = {}) {
  return { body: { id, kind: 'dynamic', massKg,
    inertia: options.inertia ?? { kind: 'primitive-com', about: 'com', frame: 'body-local' },
    initial: { positionM: initial.positionM, orientationXYZW: initial.orientationXYZW ?? [0, 0, 0, 1],
      velocityMps: initial.velocityMps ?? [0, 0, 0], angularVelocityRadps: initial.angularVelocityRadps ?? [0, 0, 0] } },
  collider: collider(id, geometry, options) };
}
export function staticPart(id, geometry, initial, options = {}) {
  return { body: { id, kind: 'static', initial: { positionM: initial.positionM,
    orientationXYZW: initial.orientationXYZW ?? [0, 0, 0, 1] } }, collider: collider(id, geometry, options) };
}
export function kinematicPart(id, geometry, initial, options = {}) {
  const part = staticPart(id, geometry, initial, options);
  part.body.kind = 'kinematic';
  return part;
}
export function makeModel({ revision = 'example1', gravityMps2 = [0, -9.81, 0], parts = [], joints = [], sourceBindings = [] }) {
  return { format: 'barocss-physics-model', version: 1, revision,
    frame: { id: 'world', basis: 'right-handed-xyz', rotation: 'local-to-world-xyzw' },
    units: { length: 'm', mass: 'kg', time: 's', angle: 'rad' }, gravityMps2,
    bodies: parts.map(part => part.body), colliders: parts.map(part => part.collider),
    joints, cloths: [], fluids: [], sourceBindings };
}
