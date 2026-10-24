// Independent inputs for the confirmed R7 public contract at 77d5ac1bca0042c0a086f83f26ad602ad14e3af8.
// Prepared, NOT runtime-verified. No production conversion helper supplies these expected values.
export const jointCase = {
  sample: 'scara',
  joints: {
    'base~arm1': { lower: -90, upper: 90, velocity: 180, effort: 250 }, // degrees, deg/s, N·mm
    'arm2~quill': { lower: -40, upper: 40, velocity: 25, effort: 7 },   // mm, mm/s, N
  },
  pose: { 'base~arm1': 90, 'arm2~quill': -30 },
};

// follower = multiplier × leader + offset. Offsets always use the follower's unit.
export const couplingCases = [
  { leaderType: 'revolute', followerType: 'revolute', multiplier: -2 / 3, offset: 5, leader: 30, follower: -15 },
  { leaderType: 'revolute', followerType: 'prismatic', multiplier: 0.1, offset: 2, leader: 90, follower: 11 },
  { leaderType: 'prismatic', followerType: 'revolute', multiplier: 10, offset: 5, leader: 3, follower: 35 },
  { leaderType: 'prismatic', followerType: 'prismatic', multiplier: -2, offset: 1, leader: 3, follower: -5 },
];

// A solid cube, Ixx = Iyy = Izz = mass × (side² + side²) / 12; products of inertia are zero.
export const cubeCase = {
  side: 10, density: 2.7,
  volume: 1000, mass: 2.7, centroid: [5, 5, 5],
  inertia: [[45, 0, 0], [0, 45, 0], [0, 0, 45]], moments: [45, 45, 45],
  gravity: [0, 0, -9810],
  // F = (2.7 / 1000) × (9810 / 1000); |torque| = F × 5 mm, perpendicular lever.
  force: 0.026487, lever: 5, torque: 0.132435,
  native: { mass: 0.0027, centroid: [0.005, 0.005, 0.005], moments: [4.5e-8, 4.5e-8, 4.5e-8], torque: 0.000132435 },
};

export const timeCases = [
  { from: 'evaluationMs', to: 'evaluationTime', input: 1250, expected: 1.25 },
  { from: 'builtMs', to: 'builtTime', input: 2500, expected: 2.5 },
  { from: 'wallMs', to: 'wallTime', input: 500, expected: 0.5 },
  { from: 'life_h', to: 'serviceLife', input: 2, expected: 7200 },
  { from: 'duration_s', to: 'duration', input: 1.25, expected: 1.25 },
  { from: 'dwell_s', to: 'dwell', input: 0.5, expected: 0.5 },
];
