import { CadEditorError, type CadEditorSession, type CadEditorFeatureSession, type CadEditorLoftSession, type CadEditorAssemblySession, type CadEditorExportResult } from '@barocss/cad-editor';

export const MAXIMUM_FILE_BYTES = 2097152;
export async function readCadEditorFile(file: File): Promise<string> {
  if (file.size > MAXIMUM_FILE_BYTES) throw new CadEditorError('BUDGET', 'File exceeds 2097152 bytes.');
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    if (text.length > MAXIMUM_FILE_BYTES || new TextEncoder().encode(text).length > MAXIMUM_FILE_BYTES) throw new CadEditorError('BUDGET', 'File exceeds the text limit.');
    return text;
  } catch (cause) {
    if (cause instanceof CadEditorError) throw cause;
    throw new CadEditorError('FILE', 'Cannot read this UTF-8 file.', {}, cause);
  }
}
export function downloadAccepted(session: CadEditorSession | CadEditorFeatureSession | CadEditorLoftSession | CadEditorAssemblySession): void {
  const captured = session.serializeAccepted();
  const url = URL.createObjectURL(new Blob([captured.text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = captured.suggestedFilename;
  document.body.append(anchor);
  try { anchor.click(); session.markDownloaded(captured.token); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
/** Download already reviewed exchange data without changing native save/capture state. */
export function downloadReviewedExport(result:CadEditorExportResult,kind:'iges'|'report'):void {
  try {
    const captured=structuredClone(result);
    const text=kind==='iges'?captured.iges:JSON.stringify(captured.report,null,2)+'\n';
    const filename=captured.options.exportModelId+(kind==='iges'?'.igs':'.iges-loss-report.json');
    const url=URL.createObjectURL(new Blob([text],{type:kind==='iges'?'model/iges':'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);
    try{anchor.click();}finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  } catch(cause){throw cause instanceof CadEditorError?cause:new CadEditorError('FILE','Reviewed export download failed.',{field:'export-download'},cause);}
}
