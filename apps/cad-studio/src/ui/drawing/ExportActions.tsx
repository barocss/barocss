// The drawing's EXPORT (O16: split from DrawingWorkspace, on shadcn's components): SVG, PDF, DXF (2000 or R12), a section's DXF alone.
import type { DxfVersion } from '@barocss/cad';
import { VIEWS, scaleLabel } from '@barocss/cad-model/drawing/views';
import { VIEW_IDS, type DrawingSettings } from '@barocss/cad-model/drawing/types';
import type { useDrawingSheet } from '../useDrawingSheet';
import { Icon } from '../atoms';
import { CONTROL } from './sheetShared';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';

type Sheet = ReturnType<typeof useDrawingSheet>;
export function ExportActions({ sheet, layout, views, cuts, settings, dxfVersion, setDxfVersion, dxfCut, setDxfSection, exportSvg, exportPdf, exportDxf, exportSectionDxf }: {
  sheet: Sheet['sheet']; layout: Sheet['layout']; views: Sheet['views']; cuts: Sheet['cuts']; settings: DrawingSettings;
  dxfVersion: DxfVersion; setDxfVersion(v: DxfVersion): void; dxfCut: Sheet['cuts'][number] | undefined; setDxfSection(id: string): void;
  exportSvg(): void; exportPdf(): void; exportDxf(): void; exportSectionDxf(): void;
}) {
  return <>
        <div className="card-title" style={{ marginTop: 8 }}>EXPORT</div>
        <div className="dw-actions">
          <Button variant="default" disabled={!sheet} onClick={exportSvg} aria-label="Export SVG"><Icon name="download" small /> SVG</Button>
          <Button variant="ghost" disabled={!sheet} onClick={exportPdf} aria-label="Export PDF">PDF</Button>
          <Button variant="ghost" disabled={!sheet} onClick={exportDxf} aria-label="Export DXF" title="The sheet as DXF, at true size in mm, layers by line kind">DXF</Button>
          <NativeSelect className={CONTROL} aria-label="DXF version" value={dxfVersion} onChange={e => setDxfVersion(e.target.value as DxfVersion)} title="DXF 2000, or R12 for older programs (curves as polylines)">
            <option value="AC1015">2000</option><option value="AC1009">R12</option>
          </NativeSelect>
          {cuts.length > 1 && <NativeSelect className={CONTROL} aria-label="Section for DXF" value={dxfCut?.id} onChange={e => setDxfSection(e.target.value)} title="The section to export alone">{cuts.map(c => <option key={c.id} value={c.id}>{c.id}–{c.id}</option>)}</NativeSelect>}
          {dxfCut && <Button variant="ghost" onClick={exportSectionDxf} aria-label="Export section DXF" title={`Section ${dxfCut.id}–${dxfCut.id} alone, 1:1 in model mm`}>{dxfCut.id}–{dxfCut.id} DXF</Button>}
        </div>
        {sheet && <div className="empty">{scaleLabel(layout!.scale)} · {settings.sheet} · {VIEW_IDS.map(id => `${VIEWS[id].label.toLowerCase()} ${views![id].edges.length}`).join(', ')} edges</div>}
  </>;
}
