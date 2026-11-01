export const useRef = v => ({ current: v });
export const useMemo = f => f();
export const useSyncExternalStore = (s, g) => g();
