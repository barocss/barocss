const at = (timeSeconds, value) => ({ timeSeconds, value });
const move = (targetId, points) => ({
  targetId, property: 'translation', interpolation: 'LINEAR',
  keys: points.map(([timeSeconds, x, y, z = 0]) => at(timeSeconds, [x, y, z])),
});
const turn = (points) => ({
  targetId: 'parcel', property: 'rotation', interpolation: 'SLERP',
  keys: points.map(([timeSeconds, value]) => at(timeSeconds, value)),
});
const closed = 8;
const open = 20;
const quarterTurn = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const halfTurn = [0, 1, 0, 0];
const identity = [0, 0, 0, 1];

export const showcaseScenarios = [
  {
    id: 'transfer', name: '부품 옮기기', note: '집기 → 이동 → 놓기',
    durationSeconds: 8,
    phases: [
      { timeSeconds: 0, label: '접근' },
      { timeSeconds: 1.8, label: '집기' },
      { timeSeconds: 2.4, label: '이동' },
      { timeSeconds: 4.6, label: '놓기' },
      { timeSeconds: 6, label: '복귀' },
    ],
    markers: [
      { contextId: 'motion-cell', id: 'grip', timeSeconds: 1.8, label: '부품 집음', targetId: 'parcel' },
      { contextId: 'motion-cell', id: 'lift', timeSeconds: 2.4, label: '들어 올림', targetId: 'parcel' },
      { contextId: 'motion-cell', id: 'arrive', timeSeconds: 4.6, label: '목적지 도착', targetId: 'carriage' },
      { contextId: 'motion-cell', id: 'release', timeSeconds: 6, label: '부품 놓음', targetId: 'parcel' },
    ],
    clipInput: {
      version: 0, contextId: 'motion-cell', durationSeconds: 8,
      tracks: [
        move('carriage', [[0, -105, 145], [2.4, -105, 145], [4.6, 105, 145], [6, 105, 145], [8, -105, 145]]),
        move('lift', [[0, 0, -50], [1.2, 0, -96], [1.8, 0, -96], [2.4, 0, -50],
          [4.6, 0, -50], [5.3, 0, -96], [6, 0, -96], [6.6, 0, -50], [8, 0, -50]]),
        move('jaw-left', [[0, -open, 0], [1.2, -open, 0], [1.8, -closed, 0],
          [5.3, -closed, 0], [6, -open, 0], [8, -open, 0]]),
        move('jaw-right', [[0, open, 0], [1.2, open, 0], [1.8, closed, 0],
          [5.3, closed, 0], [6, open, 0], [8, open, 0]]),
        move('parcel', [[0, -105, 24], [1.8, -105, 24], [2.4, -105, 70],
          [4.6, 105, 70], [5.3, 105, 24], [8, 105, 24]]),
        turn([[0, identity], [2.4, identity], [4.6, quarterTurn], [8, quarterTurn]]),
      ],
    },
  },
  {
    id: 'inspection', name: '검사 후 복귀', note: '집기 → 검사 → 제자리',
    durationSeconds: 7,
    phases: [
      { timeSeconds: 0, label: '접근' },
      { timeSeconds: 1.5, label: '집기' },
      { timeSeconds: 2.7, label: '검사' },
      { timeSeconds: 4.2, label: '복귀' },
      { timeSeconds: 6, label: '놓기' },
    ],
    markers: [
      { contextId: 'motion-cell', id: 'grip', timeSeconds: 1.5, label: '부품 집음', targetId: 'parcel' },
      { contextId: 'motion-cell', id: 'scan', timeSeconds: 3.5, label: '검사 완료', targetId: 'parcel' },
      { contextId: 'motion-cell', id: 'home', timeSeconds: 5.5, label: '시작 위치 도착', targetId: 'carriage' },
      { contextId: 'motion-cell', id: 'release', timeSeconds: 6.4, label: '부품 놓음', targetId: 'parcel' },
    ],
    clipInput: {
      version: 0, contextId: 'motion-cell', durationSeconds: 7,
      tracks: [
        move('carriage', [[0, -105, 145], [2, -105, 145], [2.7, 0, 145],
          [4.2, 0, 145], [5.5, -105, 145], [7, -105, 145]]),
        move('lift', [[0, 0, -50], [1.1, 0, -96], [1.5, 0, -96], [2, 0, -50],
          [5.5, 0, -50], [6, 0, -96], [6.4, 0, -96], [7, 0, -50]]),
        move('jaw-left', [[0, -open, 0], [1.1, -open, 0], [1.5, -closed, 0],
          [6, -closed, 0], [6.4, -open, 0], [7, -open, 0]]),
        move('jaw-right', [[0, open, 0], [1.1, open, 0], [1.5, closed, 0],
          [6, closed, 0], [6.4, open, 0], [7, open, 0]]),
        move('parcel', [[0, -105, 24], [1.5, -105, 24], [2, -105, 70],
          [2.7, 0, 70], [4.2, 0, 70], [5.5, -105, 70], [6, -105, 24], [7, -105, 24]]),
        turn([[0, identity], [2.7, identity], [3.5, halfTurn], [7, halfTurn]]),
      ],
    },
  },
];
