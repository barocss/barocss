// A figure's stepper for the algorithm pages: a list of steps, each shown for `durations[i]` ms with `t` running 0 → 1
// through it (eased by the figure where it wants). Plays on its own once the figure is on screen; a reader can pause,
// step or jump, and a step chosen plays once and stops. With reduced motion, nothing moves: each step is shown at its
// end (t = 1).
import { onBeforeUnmount, onMounted, ref } from 'vue';

export function useSteps(count, durations, root) {
  const step = ref(0), t = ref(1), playing = ref(false);
  let raf = 0, last = 0, reduced = false, observer = null, seen = false, one = false;
  const length = i => (Array.isArray(durations) ? durations[i] : durations) ?? 1600;
  function frame(now) {
    if (!playing.value) return;
    const dt = last ? now - last : 0; last = now;
    t.value = Math.min(1, t.value + dt / length(step.value));
    if (t.value >= 1) {
      if (!one && step.value + 1 < count) { step.value++; t.value = 0; }
      else { playing.value = false; return; }
    }
    raf = requestAnimationFrame(frame);
  }
  function play() {
    if (reduced) { t.value = 1; return; }
    if (step.value === count - 1 && t.value >= 1) { step.value = 0; t.value = 0; }
    else if (t.value >= 1) { step.value++; t.value = 0; }
    one = false; playing.value = true; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function pause() { playing.value = false; cancelAnimationFrame(raf); }
  function go(i) {
    pause(); step.value = Math.max(0, Math.min(count - 1, i));
    if (reduced) { t.value = 1; return; }
    t.value = 0; one = true; playing.value = true; last = 0; raf = requestAnimationFrame(frame);
  }
  const next = () => go(step.value + 1), prev = () => go(step.value - 1);
  function toggle() { if (playing.value) pause(); else play(); }
  onMounted(() => {
    reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !root?.value || typeof IntersectionObserver !== 'function') return;
    step.value = 0; t.value = 0;
    observer = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting && !seen) { seen = true; play(); }
        else if (!e.isIntersecting && playing.value) pause();
      }
    }, { threshold: 0.35 });
    observer.observe(root.value);
  });
  onBeforeUnmount(() => { pause(); observer?.disconnect(); });
  return { step, t, playing, play, pause, toggle, go, next, prev };
}

/** Smooth start and end for a 0 → 1 progress. */
export const ease = t => t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
/** A number with at most `d` decimals, trailing zeros dropped. */
export const num = (x, d = 3) => (Math.abs(x) < 10 ** -d / 2 ? 0 : +x.toFixed(d)).toString();
