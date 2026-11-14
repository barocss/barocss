import type { KeyboardEvent } from 'react';

/** Step a focused select even when the browser opens a native popup for plain arrow keys. */
export function stepNativeSelect(event: KeyboardEvent<HTMLSelectElement>, choose: (value: string) => void): void {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  const list = event.currentTarget, step = event.key === 'ArrowUp' ? -1 : 1;
  for (let index = list.selectedIndex + step; index >= 0 && index < list.options.length; index += step) {
    const option = list.options[index];
    if (!option.disabled) {
      choose(option.value);
      return;
    }
  }
}
