import { useEffect, useMemo, useState, type Dispatch, type SetStateAction, type RefObject } from 'react';
import { offsetsAt, type RenderCamera, type RenderSettings } from '@barocss/cad-model/engine/render';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import type { ViewportHandle } from './Viewport';
import { downloadBytes } from '../ui/files';
interface RenderPlaybackOptions {
  render: RenderSettings;
  rendering: boolean;
  state: { time: number; setTime: Dispatch<SetStateAction<number>>; playing: boolean; setPlaying: Dispatch<SetStateAction<boolean>>; turnFrom: RefObject<RenderCamera | null> };
  viewport: RefObject<ViewportHandle | null>;
  fileName: string;
  onNotice(notice: FriendlyError): void;
}
export function useRenderPlayback({ render, rendering, state, viewport, fileName, onNotice: setToast }: RenderPlaybackOptions) {
  const { time, setTime, playing, setPlaying, turnFrom } = state;
  // Playing: time runs (looping), the bodies follow their keys and a turntable turns the camera.
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setTime(t => (t + dt) % Math.max(0.1, render.animation.duration));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, render.animation.duration]);
  useEffect(() => {
    if (!rendering || !render.animation.turntable || !turnFrom.current) return;
    viewport.current?.setCamera({ ...turnFrom.current, yaw: turnFrom.current.yaw + (2 * Math.PI * time) / render.animation.duration });
  }, [time, rendering, render.animation.turntable, render.animation.duration]);
  const play = (on: boolean) => {
    if (on) turnFrom.current = viewport.current?.getCamera() ?? null;
    else if (turnFrom.current && render.animation.turntable) { viewport.current?.setCamera(turnFrom.current); }
    setPlaying(on);
  };
  // (By body key; put on the bodies shown — in a section the kept ones and the exact section's pieces, each moved as
  // its body is: G19.5 — further down.)
  const animatedAt = useMemo(() => !rendering || !Object.keys(render.animation.tracks).length ? null : offsetsAt(render.animation, time), [rendering, render.animation, time]);
  // (RS2's recorder: a video of the motion at its own timing, or of the Render workspace's animation over its duration.)
  const [videoBusy, setVideoBusy] = useState(false);
  const recordVideo = async (seconds: number, draw: (t: number) => void, name: string) => {
    if (!viewport.current || !(seconds > 0) || videoBusy) return;
    setVideoBusy(true);
    try {
      const FPS = 30, n = Math.ceil(seconds * FPS) + 1;
      const blob = await viewport.current.recordVideo(n, FPS, i => draw(Math.min(seconds, i / FPS)));
      downloadBytes(new Uint8Array(await blob.arrayBuffer()), name, 'video/webm');
    } catch (e) { setToast({ title: 'Could not record a video', hint: e instanceof Error ? e.message : String(e), detail: '' }); }
    finally { setVideoBusy(false); }
  };
  const exportImage = async () => {
    const png = await viewport.current?.capture();
    if (png) downloadBytes(new Uint8Array(await png.arrayBuffer()), `${fileName}.png`, 'image/png');
    else setToast({ title: 'Could not export an image', hint: 'Rendering needs a browser with WebGPU.', detail: '' });
  };

  return { play, animatedAt, videoBusy, recordVideo, exportImage };
}
