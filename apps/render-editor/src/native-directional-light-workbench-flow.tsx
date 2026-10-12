import {act} from 'react';
import {createRoot} from 'react-dom/client';
import type {RenderNativeDirectionalLightDocumentV1} from '@barocss/render-editor';
import {NativeDirectionalLightWorkbench} from './native-directional-light-workbench';

/** Real React UI with a privately controlled Viewer in the runner. This does not prove GPU pixels. */
export async function mountDirectionalLightWorkbenchFlow(container: HTMLElement, initial: RenderNativeDirectionalLightDocumentV1) {
  const root = createRoot(container);
  await act(async () => {root.render(<NativeDirectionalLightWorkbench initialDocument={initial}/>);});
  return {async dispose() {await act(async () => {root.unmount();});}};
}
