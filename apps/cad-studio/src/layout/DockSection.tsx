import { useState, type ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Icon } from '../ui/atoms';

/**
 * A section of the dock (G12c): a header — its title, a one-line summary chip, a chevron — that folds its content away;
 * the open state kept per viewer under `id`.
 */
export function DockSection({ id, title, summary, children }: { id: string; title: string; summary?: ReactNode; children: ReactNode }) {
  const key = 'studio.dock.' + id;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) !== 'closed'; } catch { return true; } });
  const change = (v: boolean) => { setOpen(v); try { localStorage.setItem(key, v ? 'open' : 'closed'); } catch { /* private mode */ } };
  return <Collapsible open={open} onOpenChange={change} className="dock-section" aria-label={title}>
    <CollapsibleTrigger className="dock-section-head" aria-label={(open ? 'Collapse ' : 'Expand ') + title}>
      <span className="card-title">{title.toUpperCase()}</span>
      {summary !== undefined && <Badge variant="secondary">{summary}</Badge>}
      <span className="grow" />
      <Icon name={open ? 'expand_less' : 'expand_more'} small />
    </CollapsibleTrigger>
    <CollapsibleContent className="dock-section-body">{children}</CollapsibleContent>
  </Collapsible>;
}
