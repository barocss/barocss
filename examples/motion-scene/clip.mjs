export const clipInput = {
  version: 0,
  contextId: 'sample-assembly',
  durationSeconds: 4,
  tracks: [
    { targetId: 'part-a', property: 'translation', interpolation: 'LINEAR', keys: [
      { timeSeconds: 0, value: [-75, 0, 0] },
      { timeSeconds: 4, value: [25, 20, 0] },
    ] },
    { targetId: 'part-a', property: 'rotation', interpolation: 'SLERP', keys: [
      { timeSeconds: 0, value: [0, 0, 0, 1] },
      { timeSeconds: 4, value: [0, 0, 1, 0] },
    ] },
    { targetId: 'part-a', property: 'scale', interpolation: 'LINEAR', keys: [
      { timeSeconds: 0, value: [1, 1, 1] },
      { timeSeconds: 4, value: [1.5, 0.75, 1] },
    ] },
    { targetId: 'part-b', property: 'translation', interpolation: 'LINEAR', keys: [
      { timeSeconds: 0, value: [75, 0, 0] },
      { timeSeconds: 4, value: [-15, 40, 0] },
    ] },
    { targetId: 'part-b', property: 'rotation', interpolation: 'SLERP', keys: [
      { timeSeconds: 0, value: [0, 0, 0, 1] },
      { timeSeconds: 4, value: [0, Math.SQRT1_2, 0, Math.SQRT1_2] },
    ] },
    { targetId: 'part-b', property: 'scale', interpolation: 'LINEAR', keys: [
      { timeSeconds: 0, value: [1, 1, 1] },
      { timeSeconds: 4, value: [0.65, 1.4, 0.65] },
    ] },
  ],
};
