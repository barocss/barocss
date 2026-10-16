import { CAD_ICONS, CadIcon } from './cadIcons';
import type { ReactNode } from 'react';

/** A Material Symbols icon by name, or one of the CAD line icons (`cad-…`, ui/cadIcons.tsx). */
export function Icon({ name, small, className }: { name: string; small?: boolean; className?: string }) {
  if (name.startsWith('cad-') && CAD_ICONS[name]) return <CadIcon name={name} small={small} />;
  return <span className={'ms' + (small ? ' sm' : '') + (className ? ' ' + className : '')} aria-hidden="true">{name}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
