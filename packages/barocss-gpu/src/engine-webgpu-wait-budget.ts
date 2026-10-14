/** One private operation deadline, shared across device waits; no GPU cancellation. */
export class EngineWebGPUWaitBudget {
  private readonly deadline = performance.now() + 10000;
  private failure: Error | undefined;

  private expired(): boolean { return !!this.failure || performance.now() >= this.deadline; }
  private refusal(label: string): Error {
    if (!this.failure) {
      this.failure = new Error('Engine WebGPU operation exceeded10s: ' + label.slice(0, 96));
      this.failure.name = 'EngineWebGPUTimeoutError';
    }
    return this.failure;
  }
  check(label: string): void {
    if (this.expired()) throw this.refusal(label);
  }
  wait<T>(promise: Promise<T>, label: string): Promise<T> {
    const observed = Promise.resolve(promise);
    if (this.expired()) {
      // A previously popped scope/native operation may settle after the deadline.
      void observed.then(() => {}, () => {});
      return Promise.reject(this.refusal(label));
    }
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(this.refusal(label)),
        Math.max(0, this.deadline - performance.now()));
      void observed.then(value => {
        clearTimeout(timer);
        if (this.expired()) reject(this.refusal(label));
        else resolve(value);
      }, cause => {
        clearTimeout(timer);
        if (this.expired()) reject(this.refusal(label));
        else reject(cause);
      });
    });
  }
}
