const material = { static: 1, dynamic: .7 };
export function fixture(scene, dt = 1 / 120) {
  if (!['ALIGNED', 'OFFSET', 'YAW'].includes(scene)) throw new Error('Unknown frozen scene');
  const bodies = Array.from({ length: 8 }, (_, i) => {
    const yaw = (-1) ** i * .05;
    return { id: `b${i}`, kind: 'dynamic', shape: { kind: 'box', halfExtentsM: [.25, .25, .25] },
      positionM: [scene === 'ALIGNED' ? 0 : i % 2 * .05, .25 + .5 * i, 0],
      velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction: { ...material },
      orientation: scene === 'YAW' ? [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] : [0, 0, 0, 1] };
  });
  bodies.push({ id: 'floor', kind: 'static', shape: { kind: 'box', halfExtentsM: [2, .1, 2] }, positionM: [0, -.1, 0], restitution: 0, friction: { ...material } });
  return { fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0], bodies, contactMode: 'persistent-box-v1' };
}
