import { Button } from '@/components/ui/button';
import type { Active } from '../app/commandState';

type Edge = Active['ctx']['selection']['edges'][number];

export function FilletPickedEdges({ active, onRemove }: { active: Active; onRemove(owner: Active, edge: Edge): void }) {
  return <details>
    <summary className="cursor-pointer" onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}>Edit picked edges</summary>
    <ul className="m-0 mt-1 grid list-none gap-1 p-0">
      {active.ctx.selection.edges.map(edge => {
        const names = active.ctx.bodies[edge.body]?.mesh.edges[edge.edge]?.names.join(', ');
        if (!names) return null;
        return <li key={`${edge.body}:${edge.edge}`} className="flex items-center justify-between gap-1">
          <span className="min-w-0 truncate" title={names}>{names}</span>
          <Button type="button" variant="ghost" size="xs" aria-label={`Remove ${names}`}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}
            onClick={() => onRemove(active, edge)}>Remove</Button>
        </li>;
      })}
    </ul>
  </details>;
}
