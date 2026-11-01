import { CAD_ICONS, CadIcon } from './cadIcons';
import { commandIconName } from './commandIcons';
import { UI_ICONS } from './uiIcons';
import type { ReactNode } from 'react';

/** A bundled generic SVG, or one of the CAD line icons (`cad-…`, ui/cadIcons.tsx). */
export function Icon({ name, small, className }: { name: string; small?: boolean; className?: string }) {
  const resolved = name.startsWith('cad-') ? commandIconName(name.slice(4), name) : name;
  if (resolved.startsWith('cad-') && CAD_ICONS[resolved]) return <CadIcon name={resolved} small={small} />;
  const Glyph = Object.hasOwn(UI_ICONS, resolved) ? UI_ICONS[resolved] : undefined, classes = 'ui-icon' + (small ? ' sm' : '') + (className ? ' ' + className : '');
  if (!Glyph) return <span className={classes + ' ui-icon-missing'} data-ui-icon-missing={resolved} aria-hidden="true" />;
  const size = small ? 16 : 19;
  return <Glyph className={classes} data-ui-icon={resolved} size={size} style={{ width: size, height: size }} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
