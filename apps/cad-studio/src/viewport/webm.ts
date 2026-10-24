// A WebM file from encoded video frames (RS2's recorder): the EBML header, a Segment with its Info (1 ms timecodes, the
// duration), one video track and Clusters of SimpleBlocks, each frame at its own timestamp — so a video's timing is the
// motion's, however long each frame took to draw. Our own writer of the few elements a player needs; no Cues (players
// and ffprobe read it without them).

export interface EncodedFrame { /** µs */ timestamp: number; key: boolean; data: Uint8Array }
export interface WebmTrack { codec: 'V_VP9' | 'V_VP8'; width: number; height: number }

const ID = {
  EBML: [0x1a, 0x45, 0xdf, 0xa3], EBMLVersion: [0x42, 0x86], EBMLReadVersion: [0x42, 0xf7], EBMLMaxIDLength: [0x42, 0xf2],
  EBMLMaxSizeLength: [0x42, 0xf3], DocType: [0x42, 0x82], DocTypeVersion: [0x42, 0x87], DocTypeReadVersion: [0x42, 0x85],
  Segment: [0x18, 0x53, 0x80, 0x67], Info: [0x15, 0x49, 0xa9, 0x66], TimecodeScale: [0x2a, 0xd7, 0xb1], MuxingApp: [0x4d, 0x80],
  WritingApp: [0x57, 0x41], Duration: [0x44, 0x89], Tracks: [0x16, 0x54, 0xae, 0x6b], TrackEntry: [0xae], TrackNumber: [0xd7],
  TrackUID: [0x73, 0xc5], TrackType: [0x83], CodecID: [0x86], Video: [0xe0], PixelWidth: [0xb0], PixelHeight: [0xba],
  Cluster: [0x1f, 0x43, 0xb6, 0x75], Timecode: [0xe7], SimpleBlock: [0xa3],
};
/** A cluster spans at most this (ms): a block's timecode is a signed 16-bit offset from its cluster's. */
const CLUSTER_MS = 30_000;

/** An element's size as an EBML variable-length integer, in the fewest bytes. */
function vint(n: number): number[] {
  for (let len = 1; len <= 8; len++) {
    if (n < 2 ** (7 * len) - 1) {
      const out: number[] = new Array(len);
      let v = n;
      for (let i = len - 1; i >= 0; i--) { out[i] = v & 0xff; v = Math.floor(v / 256); }
      out[0] |= 1 << (8 - len);
      return out;
    }
  }
  throw new RangeError('WebM element too large');
}
function uint(n: number): number[] {
  const out: number[] = [];
  do { out.unshift(n & 0xff); n = Math.floor(n / 256); } while (n > 0);
  return out;
}
function el(id: number[], ...payload: (number[] | Uint8Array)[]): Uint8Array {
  const size = payload.reduce((s, p) => s + p.length, 0), head = [...id, ...vint(size)], out = new Uint8Array(head.length + size);
  out.set(head, 0);
  let at = head.length;
  for (const p of payload) { out.set(p, at); at += p.length; }
  return out;
}
const str = (s: string) => Array.from(new TextEncoder().encode(s));
function float64(v: number): number[] { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, v); return Array.from(new Uint8Array(b.buffer)); }

/** The WebM file of these frames (in timestamp order), `durationMs` long. */
export function webmFile(frames: readonly EncodedFrame[], track: WebmTrack, durationMs: number): Uint8Array {
  const header = el(ID.EBML, el(ID.EBMLVersion, [1]), el(ID.EBMLReadVersion, [1]), el(ID.EBMLMaxIDLength, [4]), el(ID.EBMLMaxSizeLength, [8]),
    el(ID.DocType, str('webm')), el(ID.DocTypeVersion, [4]), el(ID.DocTypeReadVersion, [2]));
  const info = el(ID.Info, el(ID.TimecodeScale, uint(1_000_000)), el(ID.MuxingApp, str('barocss')), el(ID.WritingApp, str('barocss studio')), el(ID.Duration, float64(durationMs)));
  const tracks = el(ID.Tracks, el(ID.TrackEntry, el(ID.TrackNumber, [1]), el(ID.TrackUID, [1]), el(ID.TrackType, [1]), el(ID.CodecID, str(track.codec)),
    el(ID.Video, el(ID.PixelWidth, uint(track.width)), el(ID.PixelHeight, uint(track.height)))));
  const clusters: Uint8Array[] = [];
  let k = 0;
  while (k < frames.length) {
    // (A cluster starts at a key frame, or every 30 s at the latest.)
    const start = Math.round(frames[k].timestamp / 1000), blocks: Uint8Array[] = [];
    while (k < frames.length) {
      const f = frames[k], ms = Math.round(f.timestamp / 1000) - start;
      if (blocks.length && (ms >= CLUSTER_MS || f.key)) break;
      blocks.push(el(ID.SimpleBlock, [0x81, (ms >> 8) & 0xff, ms & 0xff, f.key ? 0x80 : 0x00], f.data));
      k++;
    }
    clusters.push(el(ID.Cluster, el(ID.Timecode, uint(start)), ...blocks));
  }
  const segment = el(ID.Segment, info, tracks, ...clusters), out = new Uint8Array(header.length + segment.length);
  out.set(header, 0); out.set(segment, header.length);
  return out;
}
