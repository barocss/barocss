import type {WorkspacePanelDividerProps} from './workspace-layout';

/** An overlay separator changes local CSS width; it never edits native geometry. */
export function WorkspacePanelDivider(props:WorkspacePanelDividerProps){
  if(!props.visible)return null;
  const name=props.panel==='objects'?'Objects':'Properties';
  return <div className={'workspace-panel-divider workspace-panel-divider-'+props.panel+(props.resizing?' resizing':'')}
    data-testid={props.panel==='objects'?'resize-object-panel':'resize-property-panel'}
    role="separator" aria-orientation="vertical" aria-label={name+' panel width'}
    aria-valuemin={props.min} aria-valuemax={props.max} aria-valuenow={props.value}
    aria-valuetext={Math.round(props.value)+' pixels'} aria-disabled={props.disabled}
    tabIndex={props.disabled?-1:0}
    onPointerDown={props.onPointerDown} onPointerMove={props.onPointerMove} onPointerUp={props.onPointerUp}
    onPointerCancel={props.onPointerCancel} onLostPointerCapture={props.onLostPointerCapture} onKeyDown={props.onKeyDown}/>
}
