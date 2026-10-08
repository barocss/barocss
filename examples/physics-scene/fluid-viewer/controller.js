import { fixedStepSeconds } from './scene.js';

export function createFluidController(world, present) {
  let running = false;
  let lastTime = 0;
  let accumulator = 0;
  let disposed = false;
  let frameId = 0;
  const current = () => world.getState();
  const show = () => present(current(), running);
  const pause = () => { running = false; accumulator = 0; lastTime = 0; show(); };
  const play = () => { running = true; accumulator = 0; lastTime = 0; show(); };
  const step = () => {
    pause();
    if (current().stepIndex < 3600) present(world.step(fixedStepSeconds), running);
  };
  const reset = () => { pause(); present(world.reset(), running, true); };
  const tick = now => {
    if (disposed) return;
    if (running) {
      if (lastTime) accumulator += Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      let advanced = false;
      for (let i = 0; i < 6 && accumulator >= fixedStepSeconds; i++) {
        if (current().stepIndex >= 3600) { pause(); break; }
        world.step(fixedStepSeconds);
        accumulator -= fixedStepSeconds;
        advanced = true;
      }
      if (advanced) show();
    }
    frameId = requestAnimationFrame(tick);
  };
  show();
  frameId = requestAnimationFrame(tick);
  return { play, pause, step, reset, current,
    isRunning: () => running,
    dispose: () => { disposed = true; cancelAnimationFrame(frameId); world.dispose(); } };
}
