import type {ModelHost,Owner} from '../../src/engine.js';
import type {ExistingViewerHost} from '../../src/viewer.js';
type Vec3=[number,number,number];
function observations(host:ModelHost,viewer:ExistingViewerHost){
 const read=host.read();
 if(read.currentDocument)read.currentDocument.parameters.observer=1;
 const submitted:{fingerprint:string;revision:number}[]=read.submitted;
 submitted.push({fingerprint:'local copy',revision:0});
 if(read.native){
  const centroid:Vec3|null=read.native.centroid;
  const min:Vec3=read.native.bounds.min,max:Vec3=read.native.bounds.max;
  min[0]=0;max[2]=1;if(centroid)centroid[1]=2;
  void [centroid,min,max];
 }
 const nativeOwner:Owner|null=read.nativeOwner,renderedOwner:Owner|null=read.renderedOwner;
 if(nativeOwner){
  // @ts-expect-error host ownership tokens remain readonly; observation copies do not create mutable tokens
  nativeOwner.fingerprint='changed';
 }
 if(read.adapter){
  read.adapter.freshNative=false;
  const extension:unknown=read.adapter.error;void extension;
 }
 const snapshot=viewer.snapshot();if(snapshot.pixels)snapshot.pixels.bytes=0;
 void [submitted,nativeOwner,renderedOwner];
}
void observations;
