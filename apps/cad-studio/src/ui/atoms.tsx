import type { ReactNode } from 'react';

export function Icon({ name, small, className }: { name: string; small?: boolean; className?: string }) {
  return <span className={'ms' + (small ? ' sm' : '') + (className ? ' ' + className : '')} aria-hidden="true">{name}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
