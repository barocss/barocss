import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui's class joiner: clsx's conditions, then Tailwind's conflicts merged (the later wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
