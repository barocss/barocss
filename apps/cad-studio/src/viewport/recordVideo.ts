// RS2's second checkpoint (and the Render workspace's turntable): a video of the viewport. Each frame is drawn by the
// caller (a motion's pose at its time, a turntable's angle), shown, then taken and encoded with its own timestamp, i/fps
// — so a video plays at the motion's timing however long a frame took to draw (WebGL2 on a software renderer takes
// ~200 ms a frame). The browser's VideoEncoder (VP9, else VP8) and our WebM writer (webm.ts); no dependency.
import { webmFile, type EncodedFrame, type WebmTrack } from './webm';

/** The codecs tried, best first: the encoder's name and WebM's. */
const CODECS: readonly [string, WebmTrack['codec']][] = [['vp09.00.10.08', 'V_VP9'], ['vp8', 'V_VP8']];
/** A key frame every this many frames. */
const KEY_EVERY = 60;

/** The next animation frame (two of them: the frame drawn, then on the canvas). */
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** A WebM of `count` frames at `fps`: frame i drawn by `draw(i)` (then `request` for the viewport to draw it). `redraw`, if
 *  given, draws the frame again just before the canvas is read (WebGL2 keeps no buffer past a frame). */
export async function recordCanvas(canvas: HTMLCanvasElement, count: number, fps: number, draw: (i: number) => void, request: () => void, redraw?: () => void): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser has no video encoder (WebCodecs).');
  // (Even dimensions, as the encoders take them: the canvas drawn into a copy of that size.)
  const width = Math.max(2, canvas.width & ~1), height = Math.max(2, canvas.height & ~1);
  let codec: (typeof CODECS)[number] | undefined;
  for (const c of CODECS) if ((await VideoEncoder.isConfigSupported({ codec: c[0], width, height, bitrate: 8_000_000, framerate: fps })).supported) { codec = c; break; }
  if (!codec) throw new Error('This browser encodes neither VP9 nor VP8.');
  const frames: EncodedFrame[] = [];
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: chunk => { const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data); frames.push({ timestamp: chunk.timestamp, key: chunk.type === 'key', data }); },
    error: e => { failure = e; },
  });
  encoder.configure({ codec: codec[0], width, height, bitrate: 8_000_000, framerate: fps });
  const copy = new OffscreenCanvas(width, height), g = copy.getContext('2d')!;
  try {
    for (let i = 0; i < count && !failure; i++) {
      draw(i); request();
      await nextFrame(); await nextFrame();
      redraw?.(); g.drawImage(canvas, 0, 0, width, height);
      const frame = new VideoFrame(copy, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % KEY_EVERY === 0 }); frame.close();
    }
    await encoder.flush();
  } finally { if (encoder.state !== 'closed') encoder.close(); }
  if (failure) throw failure instanceof Error ? failure : new Error(String(failure));
  frames.sort((a, b) => a.timestamp - b.timestamp);
  return new Blob([webmFile(frames, { codec: codec[1], width, height }, (count * 1000) / fps) as BlobPart], { type: 'video/webm' });
}
