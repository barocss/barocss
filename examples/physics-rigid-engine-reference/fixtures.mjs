const dt = 1 / 120;
const material = { static: 1, dynamic: .7 };
const floor = () => ({ id: 'floor', kind: 'static', shape: { kind: 'box', halfExtentsM: [2, .1, 2] }, positionM: [0, -.1, 0], restitution: 0, friction: { ...material } });
const body = (id, shape, positionM, options = {}) => ({ id, kind: 'dynamic', shape, positionM, velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction: { ...material }, ...options });
const box = (id, positionM, options) => body(id, { kind: 'box', halfExtentsM: [.25, .25, .25] }, positionM, options);
const config = (bodies, options = {}) => ({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0], bodies, ...options });
const stack = (rotated = false) => Array.from({ length: 8 }, (_, i) => {
  const yaw = (-1) ** i * .05;
  return box(`b${i}`, [rotated ? i % 2 * .05 : 0, .25 + .5 * i, 0], rotated ? { orientation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] } : {});
});
function hingePair(i) {
  return {
    bodies: [body(`pairA${i}`, { kind: 'sphere', radiusM: .1 }, [-.1, 0, i]), body(`pairB${i}`, { kind: 'sphere', radiusM: .1 }, [.1, 0, i])],
    joint: { id: `hinge${i}`, kind: 'hinge', aId: `pairA${i}`, bId: `pairB${i}`, anchorALocalM: [.1, 0, 0], anchorBLocalM: [-.1, 0, 0], axisWorld: [0, 0, 1], limitRad: [-.8, .8], motor: { targetSpeedRadps: .5, maxImpulseNms: .0001, maxReactionNms: .01 } },
  };
}
export function fixtures() {
  const a = hingePair(0), b = hingePair(1);
  const thin = { id: 'floor', kind: 'static', shape: { kind: 'box', halfExtentsM: [.001, 1, 1] }, positionM: [0, 0, 0], restitution: 0, friction: { ...material } };
  return [
    { id: 'DROP16', input: config([...Array.from({ length: 16 }, (_, i) => box(`b${i}`, [(i % 4 - 1.5) * .75, 1.5, (Math.floor(i / 4) - 1.5) * .75])), floor()]) },
    { id: 'STACK2_CONTROL', input: config([box('b0', [0, .25, 0]), box('b1', [.05, .75, 0]), floor()], { contactMode: 'persistent-box-v1' }) },
    { id: 'STACK8_ALIGNED', input: config([...stack(), floor()], { contactMode: 'persistent-box-v1' }) },
    { id: 'STACK8_ROTATED', input: config([...stack(true), floor()], { contactMode: 'persistent-box-v1' }) },
    { id: 'STACK8_BASIC', input: config([...stack(), floor()]) },
    { id: 'LARGE_STACK8_PERSISTENT', input: config([...stack(), floor()], { sceneMode: 'large-v1', broadPhase: 'aabb', contactMode: 'persistent-box-v1' }) },
    { id: 'HINGE1_CONTROL', input: config(a.bodies, { gravityMps2: [0, 0, 0], joints: [a.joint] }) },
    { id: 'HINGE2', input: config([...a.bodies, ...b.bodies], { gravityMps2: [0, 0, 0], joints: [a.joint, b.joint] }) },
    { id: 'CAPSULE_THIN_CCD', input: config([body('b0', { kind: 'capsule', radiusM: .1, halfLengthM: .2 }, [-.4, 0, 0], { velocityMps: [100, 0, 0], ccd: true }), thin], { gravityMps2: [0, 0, 0] }) },
  ];
}
