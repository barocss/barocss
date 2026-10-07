export function createSurfaceNetEditor(controller,cad,{otherDraft,refreshFields,message}){
 const $=id=>document.getElementById(id),draft=new Map();let surface,sourceToken,selected=[0,0],lastEdit;
 const number=n=>Object.is(n,-0)?'-0':String(n);
 function eligible(a){const s=a?.model.objects[0];return a&&(a.sourceVersion??0)===0&&a.model.objects.length===1&&s.kind==='surface'&&s.id.length<=48&&s.degreeU<=3&&s.degreeV<=3&&s.controlPoints.length<=16&&s.controlPoints[0].length<=16?s:null;}
 function renderFields(){
  $('sn-fields').hidden=!surface;for(const id of ['sn-x','sn-y','sn-z','sn-weight'])$(id).disabled=!surface||!controller.available;
  if(!surface){$('sn-note').textContent='Direct pole editing requires one source0 Surface with degrees1–3 and at most16 poles per axis. Current source/objects remain unchanged.';return;}
  const [u,v]=selected,p=surface.controlPoints[u][v],staged=draft.get(u+':'+v)??{};
  for(const[field,id,n]of [['xMM','sn-x',p[0]],['yMM','sn-y',p[1]],['zMM','sn-z',p[2]],['weight','sn-weight',surface.weights[u][v]]])$(id).value=staged[field]??number(n);
  $('sn-note').textContent=surface.id+' · pole ('+u+', '+v+') · '+draft.size+' pending / maximum16';
  $('sn-applied').textContent='Applied XYZ ['+p.map(number).join(', ')+'] mm · weight '+number(surface.weights[u][v]);
 }
 function renderList(){
  document.getElementById('sn-poles')?.remove();if(!surface)return;
  const row=document.createElement('li');row.id='sn-poles';row.className='sn-pole-list';const title=document.createElement('p');title.textContent=surface.id+' · original U/V poles';row.append(title);const grid=document.createElement('div');grid.className='sn-pole-grid';row.append(grid);
  for(let u=0;u<surface.controlPoints.length;u++)for(let v=0;v<surface.controlPoints[u].length;v++){const button=document.createElement('button');button.type='button';button.dataset.netPole=u+':'+v;button.textContent=u+', '+v+(draft.has(u+':'+v)?' *':'');button.className=u===selected[0]&&v===selected[1]?'selected':'';button.disabled=!controller.available;button.addEventListener('click',()=>{selected=[u,v];renderList();renderFields();message('Selected original Surface pole ('+u+', '+v+').');});grid.append(button);}
  $('objects').append(row);
 }
 function sync(a){const next=eligible(a);if(a?.source!==sourceToken){draft.clear();if(!surface||!next||surface.id!==next.id||selected[0]>=next.controlPoints.length||selected[1]>=next.controlPoints[0].length)selected=[0,0];sourceToken=a?.source;}surface=next;renderList();renderFields();const primitive=$('primitive-kind').closest('.panel');primitive.hidden=Boolean(surface);}
 for(const[id,field]of [['sn-x','xMM'],['sn-y','yMM'],['sn-z','zMM'],['sn-weight','weight']])$(id).addEventListener('input',()=>{
  if(!surface)return;const key=selected.join(':');if(!draft.has(key)&&draft.size>=16){renderFields();message('At most16 unique pole pairs per Apply. Existing drafts retained.');return;}
  draft.set(key,{...draft.get(key),[field]:$(id).value});renderList();$('sn-note').textContent=surface.id+' · pole ('+selected.join(', ')+') · '+draft.size+' pending / maximum16';message('Surface pole edits pending. Apply all staged pairs or discard.');
 });
 function apply(){
  let result;try{if(!surface)throw Error('Direct Surface editing is unavailable for this accepted state.');if(otherDraft())throw Error('Apply or discard other source/control drafts before pole edits.');const poleEdits=[...draft].map(([key,fields])=>{const[uIndex,vIndex]=key.split(':').map(Number),edit={uIndex,vIndex};for(const[field,text]of Object.entries(fields)){if(text.trim()===''||!Number.isFinite(Number(text)))throw Error('Enter finite pole coordinates and positive weight.');edit[field]=Number(text);}return edit;});result=cad.editSurfaceControlNet(surface,{poleEdits});}catch(error){message('Native rejected: '+error.message+' Accepted Surface/frame and pole drafts retained.');return{ok:false,error:error.message};}
  const a=controller.snapshot(),applied=controller.apply(result.source,{sourceVersion:0,surfaceId:result.surface.id,...a.report.grid,options:a.options});
  if(!applied.ok){message('Display rejected: '+applied.error+' Native Surface remains valid; accepted frame/camera and drafts retained.');return applied;}
  lastEdit=result;draft.clear();refreshFields();sync(controller.snapshot());message('Direct native Surface pole transaction applied.');return applied;
 }
 function newDocument(){
  if(draft.size||otherDraft()){message('Apply or discard existing drafts before New.');return{ok:false};}
  const seed={kind:'surface',id:'direct_patch',degreeU:2,degreeV:2,knotsU:[-2,-2,-2,3,3,3],knotsV:[4,4,4,8,8,8],controlPoints:[[[-4,-0,-0],[-4,3,2],[-4,6,0]],[[0,-0,2],[0,3,5],[0,6,1]],[[4,-0,0],[4,3,-1],[4,6,0]]],weights:[[1,.8,1],[.7,1.6,.9],[1.2,.75,1]]};
  const result=cad.editSurfaceControlNet(seed,{poleEdits:[{uIndex:0,vIndex:0,zMM:-0}]}),a=controller.snapshot(),record={format:'barocss-cad-project',version:1,sourceVersion:0,source:result.source,surfaceId:seed.id,grid:{countU:17,countV:17},options:{mmToSceneUnit:.35,translate:[0,-1.05,-.35],color:[.32,.7,.73],background:[16/255,24/255,32/255],camera:{eye:[4,-5,6],target:[0,0,0],up:[0,0,1],fovYDegrees:45,near:.01,far:100}},primitive:null};
  const loaded=controller.loadProject(record,a.source);if(loaded.ok){lastEdit=undefined;draft.clear();selected=[0,0];refreshFields();sync(controller.snapshot());message('New directly authored weighted quadratic3×3 Surface.');}else message('New display rejected: '+loaded.error);return loaded;
 }
 return{sync,apply,newDocument,get pending(){return draft.size>0;},discard(){draft.clear();sync(controller.snapshot());},state:()=>({available:Boolean(surface),surface:surface&&structuredClone(surface),selected:selected.slice(),draft:[...draft].map(([key,fields])=>({indices:key.split(':').map(Number),fields:{...fields}})),lastEdit:lastEdit&&structuredClone(lastEdit)})};
}
