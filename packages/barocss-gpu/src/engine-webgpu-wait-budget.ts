/** One private operation deadline, shared across device waits; no GPU cancellation. */
export class EngineWebGPUWaitBudget {
  private readonly deadline = performance.now() + 10000;
  private terminal: { cause: unknown } | undefined;
  private readonly pending = new Set<(cause: unknown) => void>();

  private expired(): boolean { return !!this.terminal || performance.now() >= this.deadline; }
  private refusal(label: string): unknown {
    if (!this.terminal) {
      const error = new Error('Engine WebGPU operation exceeded10s: ' + label.slice(0, 96));
      error.name = 'EngineWebGPUTimeoutError';
      this.cancel(error);
    }
    return this.terminal!.cause;
  }
  cancel(cause: unknown): void {
    if (this.terminal) return;
    this.terminal = { cause };
    for (const refuse of Array.from(this.pending)) refuse(cause);
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
      let settled = false;
      const retire = (): void => { clearTimeout(timer); this.pending.delete(refuse); };
      const refuse = (cause: unknown): void => {
        if (settled) return;
        settled = true; retire(); reject(cause);
      };
      const timer = setTimeout(() => refuse(this.refusal(label)),
        Math.max(0, this.deadline - performance.now()));
      this.pending.add(refuse);
      void observed.then(value => {
        if (settled) return;
        if (this.expired()) refuse(this.refusal(label));
        else { settled = true; retire(); resolve(value); }
      }, cause => {
        if (settled) return;
        refuse(this.expired() ? this.refusal(label) : cause);
      });
    });
  }
}
