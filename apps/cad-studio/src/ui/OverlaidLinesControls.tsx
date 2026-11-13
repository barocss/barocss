import { Button } from '@/components/ui/button';
import { OVERLAID_LINE_RESULT_LIMIT, OVERLAID_LINE_SCAN_LIMIT } from '../sketch/overlaidLines';
import type { useOverlaidLines } from '../sketch/useOverlaidLines';

const notices = {
  'scan-limit': `Scan stopped at the ${OVERLAID_LINE_SCAN_LIMIT}-item limit.`,
  'result-limit': `More than ${OVERLAID_LINE_RESULT_LIMIT} matching segments. Reduce the sketch before scanning again.`,
  unfinished: 'Finish the current stroke before scanning.',
};
const countOf = (count: number, label: string) => `${count} ${label}${count === 1 ? '' : 's'}`;

export function OverlaidLinesControls({ scan }: { scan: ReturnType<typeof useOverlaidLines> }) {
  if (!scan.enabled) return null;
  const { report, selection } = scan;
  const selectedGroup = report?.status === 'complete' && selection ? report.groups[selection.group] : undefined;
  const skipped = report?.status === 'complete' ? [
    report.excludedShapes ? countOf(report.excludedShapes, 'shape') : '',
    report.excludedSegments ? countOf(report.excludedSegments, 'segment') : '',
  ].filter(Boolean).join(' and ') : '';
  return <section aria-label="Overlaid lines"
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}>
    <div className="flex flex-wrap items-center gap-1.5">
      <Button type="button" variant="outline" size="sm" disabled={scan.dragging} onClick={scan.start}>Find overlaid lines</Button>
      {report ? <Button type="button" variant="ghost" size="sm" onClick={scan.close}>Close scan</Button> : null}
    </div>
    {report?.status === 'complete' ? <>
      <p role="status" className="muted small">
        Checked {countOf(report.checked, 'straight segment')}. Found {countOf(report.groups.length, 'exact group')}.
        {skipped ? ` Skipped ${skipped}.` : ''}
      </p>
      <div className="grid max-h-28 gap-1 overflow-y-auto">
        {report.groups.map((group, index) => <Button key={index} type="button" variant="ghost" size="sm"
          aria-pressed={selection?.group === index} onClick={() => scan.choose(index)}>
          Group {index + 1} · {group.length} segments
        </Button>)}
      </div>
      {selectedGroup && selection ? <div className="grid max-h-40 gap-1 overflow-y-auto">
        {selectedGroup.map((line, index) => <Button key={line.shape + ':' + line.side} type="button" variant="ghost" size="sm"
          className="h-auto! flex-col items-start! whitespace-normal! py-1! text-left"
          aria-pressed={selection.occurrence === index} onClick={() => scan.choose(selection.group, index)}>
          <span>Shape {line.shape + 1} · segment {line.side + 1}{line.id ? ` · ID ${line.id}` : ''}</span>
          <span>({line.start.join(', ')}) → ({line.end.join(', ')})</span>
        </Button>)}
      </div> : null}
      {scan.canSelect ? <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={scan.selectEdge}>Select highlighted edge</Button>
        <Button type="button" variant="outline" size="sm" onClick={scan.trimEdge}>Trim highlighted edge</Button>
      </div> : null}
    </> : report ? <p role="status" className="muted small">{notices[report.status]}</p> : null}
  </section>;
}
