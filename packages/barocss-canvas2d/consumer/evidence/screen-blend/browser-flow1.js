async page=>{
await page.evaluate(()=>{
const stages=window.__screenStages=[];
window.__record=name=>{const value=screenBlend.observe();stages.push({name,value});return value};
const b=[.25*.4,.5*.4,.75*.4,.4],opaque=[.3,.2,.6,1],colors=[[180/255,70/255,140/255,128/255],[60/255,200/255,90/255,1],[220/255,80/255,10/255,0]];
function blend(c,d,mode){const a=c[3],s=c.slice(0,3).map(v=>v*a);return [...s.map((v,i)=>mode==='screen'?v+d[i]-v*d[i]:mode==='add'?Math.min(1,v+d[i]):v+d[i]*(1-a)),mode==='add'?Math.min(1,a+d[3]):a+d[3]*(1-a)].map(v=>Math.round(v*255))}
const expected={};for(let i=0;i<3;i++)for(const[name,d]of [['opaque',opaque],['translucent',b]])for(let t=0;t<3;t++)expected[`${name}${i}_${t}`]=blend(colors[t],d,['normal','add','screen'][i]);
const c=colors[0];expected.effect=blend([(c[2]+.1)*.5,c[1],c[0]*.75,c[3]*.6*.8],b,'screen');expected.maskOutside=b.map(v=>Math.round(v*255));expected.frameOutside=expected.maskOutside;expected.following=blend(c,b,'normal');expected.path=blend([.8,.1,.3,.5],b,'normal');expected.editInk=blend(c,[.1,.6,.2,1],'screen');expected.editTransparent=[.1,.6,.2,1].map(v=>Math.round(v*255));
const observation=__record('initial28');const results=Object.entries(expected).map(([name,rgba])=>{const actual=observation.samples[name].rgba;const delta=actual.map((v,i)=>Math.abs(v-rgba[i]));if(Math.max(...delta)>2)throw Error(`oracle ${name} ${actual} vs ${rgba}`);return{name,expected:rgba,actual,delta}});window.__oracle=results;
if(observation.samples.editTransparent.hit!=='HitBack'||observation.samples.following.hit!=='Following'||observation.samples.path.hit!=='FollowingPath')throw Error('hit mismatch');
});
const box=await page.locator('#scene').boundingBox();for(const[x,y]of [[20,144],[68,144],[220,100],[20,100]])await page.mouse.click(box.x+x,box.y+y);
await page.getByRole('button',{name:'Normal',exact:true}).click();await page.evaluate(()=>__record('editNormal'));
await page.getByRole('button',{name:'Add',exact:true}).click();await page.evaluate(()=>__record('editAdd'));
await page.getByRole('button',{name:'Screen',exact:true}).click();await page.evaluate(()=>__record('editScreen'));
await page.getByRole('button',{name:'Invalid mode',exact:true}).click();await page.evaluate(()=>{const o=__record('invalidRetained');if(o.failure.code!=='INVALID_SCENE'||!o.failure.retained)throw Error('invalid retention')});
await page.evaluate(()=>{
const s=screenBlend.session(),gl=s.canvas.getContext('webgl2');const original=gl.drawArrays;let thrown=false;const error=new Error('Controlled screen draw failure');gl.drawArrays=function(...args){if(!thrown&&gl.getParameter(gl.BLEND_SRC_RGB)===gl.ONE_MINUS_DST_COLOR){thrown=true;throw error}return original.apply(this,args)};
let caught=false;try{s.renderer.render()}catch(e){caught=e===error}finally{gl.drawArrays=original}
const factors=[gl.BLEND_SRC_RGB,gl.BLEND_DST_RGB,gl.BLEND_SRC_ALPHA,gl.BLEND_DST_ALPHA].map(k=>gl.getParameter(k));if(!caught||!thrown||JSON.stringify(factors)!==JSON.stringify([gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA]))throw Error('failure factors');
s.renderer.render();window.__failureRestore={caughtOriginal: caught,factors};__record('injectedDrawFailureRestored');
});
const downloadWait=page.waitForEvent('download');await page.getByRole('button',{name:'Save',exact:true}).click();const download=await downloadWait;await download.saveAs('/tmp/c2d1167-saved.json');await page.evaluate(()=>{window.__beforeOpen={scene:screenBlend.scene(),bytes:screenBlend.bytes(),samples:screenBlend.observe().samples};__record('saved28')});
console.log(JSON.stringify({stages:await page.evaluate(()=>__screenStages),oracle:await page.evaluate(()=>__oracle),failureRestore:await page.evaluate(()=>__failureRestore)}));
}