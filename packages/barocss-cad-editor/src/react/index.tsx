import { useCallback, useState } from 'react';
import type { CadEditorError } from '../types.js';
import { cn } from '../lib/utils.js';
import { CadEditorViewport } from './viewport.js';
import { CadEditorInspector } from './inspector.js';
import type { CadEditorProps } from './types.js';

export function CadEditor({ className, ...props }: CadEditorProps) {
  const [displayReadRequest, setDisplayReadRequest] = useState(0);
  const onError = useCallback((error: CadEditorError) => {
    // A failed diagnostic read must not cause an endless read/error cycle.
    if (error.context.field !== 'pixel-read' && error.context.field !== 'display-callback') {
      setDisplayReadRequest(value => value + 1);
    }
    props.onError?.(error);
  }, [props.onError]);
  return <div className={cn('cad-editor', className)}>
    <CadEditorViewport {...props} onError={onError} readRequest={displayReadRequest + (props.readRequest ?? 0)} />
    <CadEditorInspector session={props.session} onError={onError} />
  </div>;
}

export { CadEditorViewport } from './viewport.js';
export { CadEditorInspector } from './inspector.js';
export { useCadEditorSnapshot } from './use-session.js';
export type { CadEditorDisplayOptions, CadEditorDisplayReceipt, CadEditorViewportProps,
  CadEditorInspectorProps, CadEditorProps } from './types.js';
