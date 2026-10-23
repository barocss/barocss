// The drawing's ISSUES (R14.2; O16, split from DrawingWorkspace): what is wrong on the sheet, then what is missing; fixes.
import type { DrawingIssue } from '@barocss/cad-model/drawing/issues';
import type { useDrawingSheet } from '../useDrawingSheet';
import { Icon } from '../atoms';
import { Button } from '@/components/ui/button';

type Sheet = ReturnType<typeof useDrawingSheet>;
export function IssuesList({ issues, scope, views, fixIssue, fixEvery, onSelectDimension }: {
  issues: readonly DrawingIssue[]; scope: Sheet['scope']; views: Sheet['views']; fixIssue(x: DrawingIssue): void; fixEvery(): void; onSelectDimension(id: string): void;
}) {
  return <>
        <div className="card-title" style={{ marginTop: 8 }}>ISSUES <span className="muted" aria-label="Issue count">{issues.length}</span>
          {issues.some(x => x.fix) && <Button variant="ghost" disabled={!issues.some(x => x.fix && (scope.kind !== 'assembly' || x.fix.kind !== 'auto-dimension'))} onClick={fixEvery} aria-label="Fix all issues" data-tip="Fix all" data-tip-desc="Available fixes, one at a time; assembly scope excludes automatic part dimensions">Fix all</Button>}</div>
        <div className="dw-issues" aria-label="Drawing issues">
          {issues.map((x, k) => <div key={k} className={'dw-issue ' + x.severity} role="button" tabIndex={0} title={x.code}
            onClick={() => { const d = x.dims?.[0]; if (d) onSelectDimension(d); }}>
            <Icon name={x.severity === 'error' ? 'error' : 'warning'} small /><span>{x.message}</span>
            {x.fix && <Button variant="ghost" size="xs" disabled={scope.kind === 'assembly' && x.fix.kind === 'auto-dimension'} aria-label={`Fix: ${x.message}`} onClick={e => { e.stopPropagation(); fixIssue(x); }}>{x.fix.kind === 'auto-dimension' ? 'Auto' : x.fix.kind === 'add-section' ? `Add ${x.fix.id}–${x.fix.id}` : x.fix.kind === 'remove' ? 'Remove' : x.fix.kind === 'accept' ? 'Accept' : x.fix.kind === 'scale' ? (x.fix.sheet ? 'A3' : x.fix.scale !== undefined ? (x.fix.scale >= 1 ? `${x.fix.scale}:1` : `1:${Math.round(1 / x.fix.scale)}`) : 'Auto scale') : 'Move'}</Button>}
          </div>)}
          {!issues.length && views && <div className="empty">No issues: nothing overlaps or is lost, and every hole, step and overall size is given.</div>}
        </div>
  </>;
}
