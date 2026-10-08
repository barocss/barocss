export function createTimingRecorder() {
  let samples = [];
  return {
    run(action) {
      const started = performance.now();
      const result = action();
      samples.push(performance.now() - started);
      return result;
    },
    clear() { samples = []; },
    summary() {
      const warm = samples.slice(30);
      if (warm.length === 0) return { count: 0, p95Ms: null };
      const sorted = warm.sort((a, b) => a - b);
      return { count: warm.length, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
    },
  };
}
