import test from 'node:test';
import assert from 'node:assert/strict';
import type { BrepProjection } from '@barocss/cad';
import type { FaceThread } from '../src/app/threads';
import { buildSheet } from '../src/drawing/sheet';
import { threadMarks } from '../src/drawing/threads';
import { defaultDrawing, type DrawingSettings } from '../src/drawing/types';
import { layoutSheet, type ViewPlacement } from '../src/drawing/views';

const placement: ViewPlacement = { id: 'top', scale: 2, origin: [10, 20], box: [10, 4, 26, 20] };
const arc = (pen: 'thin' | 'hidden', radius: number, center = [14, 14]) =>
  ({ kind: 'arc', center, u: [radius, 0], v: [0, radius], t0: 0, t1: 1.5 * Math.PI, pen });

function rims(radius: number, visibility: readonly (boolean | null)[]): BrepProjection {
  return {
    right: [1, 0, 0], up: [0, 1, 0], toward: [0, 0, 1], min: [-2, -2], max: [6, 7],
    edges: visibility.map((visible, i) => ({
      kind: 'circle', name: `n2.side0|n1.rim${i}`, ends: null,
      circle: { center: [2, 3, 5 * i], radius, normal: [0, 0, i ? -1 : 1], full: true, sweep: 2 * Math.PI },
      pieces: visible === null ? [] : [{
        visible, curve: { kind: 'arc', center: [2, 3], u: [radius, 0], v: [0, radius], t0: 0, t1: 2 * Math.PI },
      }],
    })),
  };
}

function metadata(internal: boolean, radius: number) {
  return new Map<string, FaceThread>([['n2', { d: 6, pitch: 1, internal, radius }]]);
}

test('end-on cosmetics follow native rim visibility and the hidden-line setting', () => {
  for (const internal of [true, false]) {
    const drill = internal ? 2.5 : 3, radius = internal ? 6 : 4.773, threads = metadata(internal, drill);
    for (const hidden of [false, true]) {
      for (const visibility of [[false, false], [null, null], [true, true], [null, true]] as const) {
        const projection = rims(drill, visibility), visible = visibility.some(piece => piece === true);
        const expected = visible || hidden ? [arc(visible ? 'thin' : 'hidden', radius)] : [];
        const before = structuredClone({ projection, threads });
        assert.deepEqual(threadMarks(placement, projection, threads, hidden), expected, JSON.stringify({ internal, hidden, visibility }));
        assert.deepEqual(threadMarks({ ...placement, origin: [20, 24], scale: 1 }, {
          ...projection, right: [-1, 0, 0], toward: [0, 0, -1],
        }, threads, hidden), visible || hidden ? [arc(visible ? 'thin' : 'hidden', radius / 2, [18, 21])] : []);
        assert.deepEqual(threadMarks(placement, projection, threads, hidden), expected);
        assert.deepEqual({ projection, threads }, before);
      }
    }
  }
});

test('side, oblique and unthreaded circles keep their existing treatment', () => {
  for (const internal of [true, false]) {
    const radius = internal ? 2.5 : 3, threads = metadata(internal, radius);
    for (const visible of [false, true]) {
      const projection = rims(radius, [visible, visible]);
      const side: BrepProjection = { ...projection, up: [0, 0, 1], toward: [0, -1, 0] };
      const diagonal = Math.SQRT1_2;
      const oblique: BrepProjection = { ...projection, up: [0, diagonal, -diagonal], toward: [0, diagonal, diagonal] };
      const pen = internal || !visible ? 'hidden' : 'thin';
      for (const hidden of [false, true]) {
        const marks = threadMarks(placement, side, threads, hidden);
        assert.equal(marks.length, pen === 'thin' || hidden ? 2 : 0);
        assert.ok(marks.every(mark => mark.kind === 'line' && mark.pen === pen));
        assert.deepEqual(threadMarks(placement, oblique, threads, hidden), []);
        assert.deepEqual(threadMarks(placement, projection, new Map(), hidden), []);
      }
    }
  }
});

test('the sheet omits both hidden physical rims and the cosmetic arc when Hidden lines is off', () => {
  const projection = rims(2.5, [false, false]);
  const views = { front: projection, top: projection, right: projection, iso: projection };
  const threads = metadata(true, 2.5);
  for (const hidden of [false, true]) {
    const settings: DrawingSettings = { ...defaultDrawing(), views: ['front', 'top', 'iso'], scale: 1, centers: false, hidden };
    const sheet = buildSheet(views, layoutSheet(views, settings), settings, { title: 'Visibility', date: '', threads });
    const view = (id: string) => sheet.groups.find(group => group.role === 'view' && group.view === id);
    const marks = view('top')?.marks;
    assert.ok(marks);
    assert.deepEqual(marks.map(mark => mark.kind === 'arc' && [mark.u[0], mark.pen]),
      hidden ? [[2.5, 'hidden'], [2.5, 'hidden'], [3, 'hidden']] : []);
    assert.deepEqual(view('iso')?.marks, []);
    assert.equal(view('right'), undefined);
  }
});
