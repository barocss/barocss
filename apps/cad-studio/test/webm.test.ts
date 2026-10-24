import test from 'node:test';
import assert from 'node:assert/strict';
import { webmFile } from '../src/viewport/webm';

// RS2's WebM writer: the EBML header, one video track, and each frame a SimpleBlock at its own time in a cluster that
// starts at a key frame. (The flow's ffprobe reads the whole file the recorder writes; this checks the layout alone.)
const find = (b: Uint8Array, id: number[], from = 0) => { for (let i = from; i + id.length <= b.length; i++) if (id.every((x, k) => b[i + k] === x)) return i; return -1; };

test('webm: header, track and blocks at their own timecodes, a cluster per key frame', () => {
  const frame = (ms: number, key: boolean) => ({ timestamp: ms * 1000, key, data: new Uint8Array([0xaa, 0xbb, ms & 0xff]) });
  const f = webmFile([frame(0, true), frame(33, false), frame(67, false), frame(2000, true), frame(2033, false)], { codec: 'V_VP9', width: 640, height: 480 }, 2066);
  assert.deepEqual([...f.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3], 'the EBML header');
  assert.ok(find(f, [...new TextEncoder().encode('webm')]) > 0, 'DocType webm');
  assert.ok(find(f, [0x86, 0x85, ...new TextEncoder().encode('V_VP9')]) > 0, 'CodecID V_VP9, its size a one-byte vint');
  assert.ok(find(f, [0xb0, 0x82, 0x02, 0x80]) > 0 && find(f, [0xba, 0x82, 0x01, 0xe0]) > 0, 'PixelWidth 640, PixelHeight 480');
  // (Two clusters: at 0 and at 2000 ms; blocks' timecodes relative to them, key frames flagged.)
  const c1 = find(f, [0x1f, 0x43, 0xb6, 0x75]), c2 = find(f, [0x1f, 0x43, 0xb6, 0x75], c1 + 4);
  assert.ok(c1 > 0 && c2 > c1 && find(f, [0x1f, 0x43, 0xb6, 0x75], c2 + 4) < 0, 'two clusters');
  assert.ok(find(f, [0xe7, 0x82, 0x07, 0xd0], c2) > 0, 'the second cluster at 2000 ms');
  assert.ok(find(f, [0xa3, 0x87, 0x81, 0x00, 0x21, 0x00, 0xaa, 0xbb, 33]) > 0, 'the 33 ms block, not a key frame');
  assert.ok(find(f, [0xa3, 0x87, 0x81, 0x00, 0x00, 0x80, 0xaa, 0xbb, 2000 & 0xff], c2) > 0, 'the 2000 ms key frame at offset 0 in its cluster');
});
