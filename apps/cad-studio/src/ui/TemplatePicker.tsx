import type { Dispatch, SetStateAction } from 'react';
import { prefixDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from './atoms';
import { BUILT_IN, fontTemplateProblem, removeTemplate, saveTemplate, savedTemplates } from '../app/templates';
import { ROBOT_SAMPLES, robotSampleFile } from '../app/samples';
interface TemplatePickerProps {
  doc: StudioDoc;
  state: { templatesOpen: boolean; setTemplatesOpen: Dispatch<SetStateAction<boolean>>; templateName: string; setTemplateName: Dispatch<SetStateAction<string>> };
  onTemplate(doc: StudioDoc): void;
  fitLater(): void;
  open(file: File): Promise<void>;
  onNotice(notice: FriendlyError): void;
}
export function TemplatePicker({ doc, state, onTemplate, fitLater, open, onNotice: setToast }: TemplatePickerProps) {
  const { templatesOpen, setTemplatesOpen, templateName, setTemplateName } = state;
  return           <span className="tpl-anchor"><ToolIconButton state={templatesOpen ? 'on' : 'idle'} aria-label="New from a template" data-tip="Templates" data-tip-desc="Start a part from a template, or keep this one as a template" onClick={() => setTemplatesOpen(v => !v)}><Icon name="library_add" /></ToolIconButton>
          {templatesOpen && <div className="card templates" role="menu" aria-label="Templates">
            <div className="card-title">NEW FROM A TEMPLATE</div>
            {[...BUILT_IN.map(t => ({ name: t.name, doc: t.doc(), own: false })), ...savedTemplates().map(t => ({ ...t, own: true }))].map(t => <div key={(t.own ? 'own:' : '') + t.name} className="tpl-row">
              <Button variant="ghost" size="sm" className="justify-start" role="menuitem" aria-label={`New from ${t.name}`} onClick={() => { onTemplate({ ...t.doc, outputs: prefixDoc(t.doc, t.doc.nodes.length).outputs }); setTemplatesOpen(false); fitLater(); }}>{t.name}</Button>
              {t.own && <ToolIconButton size="tiny" aria-label={`Remove template ${t.name}`} onClick={() => { removeTemplate(t.name); setTemplatesOpen(false); }}><Icon name="close" small /></ToolIconButton>}
            </div>)}
            {/* (RS1: the robot samples, each with a demo motion in its Joints card; opened as Open opens a file.) */}
            {ROBOT_SAMPLES.length > 0 && <div className="card-title mt-1" aria-label="Samples">SAMPLES · ROBOTS</div>}
            {ROBOT_SAMPLES.map(r => <div key={'sample:' + r.id} className="tpl-row">
              <Button variant="ghost" size="sm" className="justify-start" role="menuitem" aria-label={`Open sample ${r.title}`} title={r.about}
                onClick={() => { setTemplatesOpen(false); void robotSampleFile(r).then(open, e => setToast({ title: 'Could not open the sample', hint: e instanceof Error ? e.message : String(e), detail: '' })); }}>{r.title}</Button>
            </div>)}
            <div className="tpl-row add"><Input className="kv-input" aria-label="Template name" placeholder="Keep this part as…" value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => e.stopPropagation()} />
              <Button variant="ghost" size="sm" aria-label="Save as a template" disabled={!templateName.trim()} onClick={() => { if (saveTemplate(templateName.trim(), doc)) setToast({ title: 'Template saved', hint: `“${templateName.trim()}” is in Templates, in this browser.`, detail: '' }); else setToast({ title: 'Could not save the template', hint: fontTemplateProblem(doc) ?? 'This browser would not keep it (private mode or no room).', detail: '' }); setTemplateName(''); setTemplatesOpen(false); }}>Save</Button></div>
          </div>}</span>;
}
