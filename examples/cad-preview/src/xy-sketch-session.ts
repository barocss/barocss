import {parseXYSketchDocument,serializeXYSketchDocument,updateXYSketchDocument} from '@barocss/cad';
import type {XYSketchDocumentV0,XYSketchDocumentResult,XYSketchDocumentEdit} from '@barocss/cad';
import type {PrimitiveViewport,PrimitiveSceneOptions} from '@barocss/gpu';
import {admitXYSketchHost,xySketchPrimitiveInput} from './xy-sketch-display';
/** Accepted intent and display commit together; UI staging stays outside native schema. */
export class XYSketchSession {
 private accepted:XYSketchDocumentResult;
 private history:string[];private cursor=0;private revision=0;
 constructor(document:XYSketchDocumentV0,private readonly viewport:PrimitiveViewport,private options:PrimitiveSceneOptions){this.accepted=admitXYSketchHost(document);this.history=[serializeXYSketchDocument(this.accepted.document)];this.present(this.accepted);}
 private present(result:XYSketchDocumentResult,options=this.options){const changed=result.profiles.length?this.viewport.update(xySketchPrimitiveInput(result),options):this.viewport.clear(options);if(!changed.ok)throw changed.error;}
 private accept(result:XYSketchDocumentResult,track=true,options=this.options){const text=serializeXYSketchDocument(result.document);this.present(result,options);this.options=options;this.accepted=result;this.revision++;if(track){this.history=this.history.slice(0,this.cursor+1);this.history.push(text);while(this.history.length>20||this.history.reduce((n,s)=>n+new TextEncoder().encode(s).length,0)>1048576)this.history.shift();this.cursor=this.history.length-1;}return this.snapshot();}
 snapshot(){return{native:structuredClone(this.accepted),revision:this.revision,history:{count:this.history.length,cursor:this.cursor},canUndo:this.cursor>0,canRedo:this.cursor<this.history.length-1};}
 edit(edits:XYSketchDocumentEdit[],options=this.options){const candidate=updateXYSketchDocument(this.accepted.document,edits);return this.accept(admitXYSketchHost(candidate.document),true,options);}
 open(text:string,options=this.options){return this.accept(admitXYSketchHost(parseXYSketchDocument(text)),true,options);}
 setOptions(options:PrimitiveSceneOptions){this.present(this.accepted,options);this.options=options;return this.snapshot();}
 save(){return serializeXYSketchDocument(this.accepted.document);}
 restore(cursor:number){if(cursor<0||cursor>=this.history.length)throw Error('History cursor is unavailable');const result=admitXYSketchHost(parseXYSketchDocument(this.history[cursor]));this.accept(result,false);this.cursor=cursor;return this.snapshot();}
 undo(){return this.restore(this.cursor-1);}redo(){return this.restore(this.cursor+1);}
}
