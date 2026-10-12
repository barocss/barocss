import {act} from 'react';
import {createRoot} from 'react-dom/client';
import type {RenderNativeLightDocument} from '@barocss/render-editor';
import {NativeLightWorkbench} from './native-light-workbench';

/** Real React UI with a privately controlled Viewer in the runner. This does not prove GPU pixels. */
export async function mountLightWorkbenchFlow(container: HTMLElement, initial?: RenderNativeLightDocument) {
  const root = createRoot(container);
  await act(async () => {root.render(<NativeLightWorkbench initialDocument={initial}/>);});
  return {async dispose() {await act(async () => {root.unmount();});}};
}
