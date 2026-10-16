import {createViewer} from '@barocss/viewer';
import authored from './authored-sources.json';
import {CASES} from './fixture.mjs';
import {createCapsulePacket} from './capsule-mesh.mjs';
import {createTerrain} from './terrain.mjs';
import {createHostController} from './host-controller.mjs';
import {createPlaybackClock} from './clock.mjs';
import {copyData,BASIS} from './frame.mjs';
import {numbers,encode,hex} from './binary.mjs';
import {CAMERA} from './views.mjs';
const el=id=>document.getElementById(id),canvas=el('view'),buttons=Object.fromEntries(['play','pause','one-step','reset'].map(id=>[id,el(id)])),select=el('scene');
const LABELS=['정지','평지 이동','10 cm 계단','15° 경사면','낮은 천장','15 cm 계단','벽을 따라 이동','겹친 시작 위치'];CASES.forEach((f,i)=>select.add(new Option(LABELS[i],f.name)));
let viewer=null,controller=null,clock=null,fixture=null,terrain=null,packets=null,disposed=false,busy=false,lastError=null,journal=[],recording=false;
window.characterHostReady=false;
function status(t){el('status').textContent=t;}
function controls(){const s=disposed?null:controller?.getSnapshot(),playing=clock?.getStats().playing??false;for(const [id,b]of Object.entries(buttons))b.disabled=disposed||busy||(id!=='reset'&&(!s||s.needsReset||(id==='pause'?!playing:id==='play'?playing||s.state.stepIndex>=240:playing||s.state.stepIndex>=240)));select.disabled=busy||disposed||playing;}
function render(){if(disposed)return;const s=controller?.getSnapshot();el('step').textContent=s?s.state.stepIndex+' / 240':'받은 상태 없음';el('display-step').textContent=s?.displayStep===null?'표시 확인 필요':s?String(s.displayStep):'—';el('time').textContent=s?s.state.timeSeconds.toFixed(3)+' s':'—';el('position').textContent=s?s.state.positionM.map(x=>x.toFixed(4)).join(', '):'—';el('grounded').textContent=s?(s.state.grounded?'지지됨':'공중'):'—';el('tilt').textContent=s?(Math.acos(Math.max(-1,Math.min(1,1-2*(s.state.orientationXYZW[0]**2+s.state.orientationXYZW[2]**2))))*180/Math.PI).toFixed(3)+'°':'—';const speed=fixture?Math.hypot(...fixture.requestMps):0;el('progress').textContent=s?(speed?s.state.positionM.reduce((sum,v,i)=>sum+(v-fixture.positionM[i])*fixture.requestMps[i]/speed,0):0).toFixed(4)+' m':'—';el('support').textContent=s?.state.support?.bodyId??'—';el('blocked').textContent=s?(s.state.blocked?'제한됨':'제한 없음'):'—';controls();}
function error(e){lastError={name:e.name,code:e.code??null,message:e.message};const s=controller?.getSnapshot();status(s?.needsReset?'계산과 화면의 단계가 다릅니다. 초기화하세요.':'단계를 유지했습니다: '+e.message);render();}
function stop({reason}){if(reason==='complete')status('240단계 완료 · 초기화하면 다시 재생할 수 있습니다.');else if(reason==='paused')status('일시 정지');else if(reason==='debt-overflow'||reason==='raf-step-limit')status('재생 지연이 한도를 넘었습니다. 일시 정지했습니다.');render();}
function makeViewer(){return createViewer(canvas,{mmToSceneUnit:.001,background:[.025,.04,.06],lighting:{ambientStrength:.4,directionalStrength:.6,direction:[.3,1,.4]}});}
async function reset(name=select.value){
 if(busy||disposed)return;
 busy=true;window.characterHostReady=false;clock?.pause();controls();
 const oldController=controller,oldViewer=viewer;let nextViewer=null,nextController=null,presentationAttempted=false,committed=false;
 try{
 const nextFixture=CASES.find(f=>f.name===name);if(!nextFixture)throw new Error('Unknown fixture');
 const nextTerrain=createTerrain(nextFixture);if(nextTerrain.sources.some((source,i)=>source.source!==authored[nextFixture.name][i].source))throw new Error('Authored source changed');const nextPackets=[createCapsulePacket(),...nextTerrain.packets];
 nextViewer=viewer??await makeViewer();
 try{nextController=createHostController(nextViewer,nextFixture,nextPackets,{onPresent:()=>{presentationAttempted=true;}});}
 catch(e){if(!nextFixture.expectedError||e.code!==nextFixture.expectedError)throw e;
 presentationAttempted=true;nextViewer.setPackets(copyData(nextTerrain.packets));nextViewer.setView(CAMERA);
 oldController?.dispose();clock?.dispose();if(nextViewer!==oldViewer)oldViewer?.dispose();
 controller=null;clock=null;viewer=nextViewer;fixture=nextFixture;terrain=nextTerrain;packets=copyData(nextTerrain.packets);lastError={code:e.code,message:e.message};select.value=name;committed=true;
 status('시작 위치가 바닥과 겹칩니다. 캡슐의 시작을 거부했습니다.');window.characterHostReady=true;return;
 }
 nextViewer.setView(CAMERA);
 oldController?.dispose();clock?.dispose();if(nextViewer!==oldViewer)oldViewer?.dispose();
 viewer=nextViewer;controller=nextController;fixture=nextFixture;terrain=nextTerrain;packets=copyData(nextPackets);committed=true;
 clock=createPlaybackClock({step:()=>controller.step(),onProgress:({result})=>{if(recording)journal.push(copyData(result.state));render();},onError:error,onStop:stop});journal=[copyData(controller.getSnapshot().state)];lastError=null;select.value=name;
 status('초기 상태 · 재생할 준비가 됐습니다.');window.characterHostReady=true;
 }catch(e){if(!committed){nextController?.dispose();if(nextViewer&&nextViewer!==oldViewer)nextViewer.dispose();if(presentationAttempted)oldController?.markDisplayUncertain();}error(e);}
 finally{busy=false;render();}
}
function oneStep(){if(!controller||busy||disposed)throw new Error('Host unavailable');clock.pause();try{const result=controller.step();if(recording)journal.push(copyData(result.state));clock.reset(result.stepIndex);status('한 단계 진행');render();return result;}catch(e){error(e);throw e;}}
async function seek(n){if(!Number.isInteger(n)||n<0||n>240)throw new Error('Invalid cursor');if(controller.getSnapshot().state.stepIndex>n)await reset(fixture.name);while(controller.getSnapshot().state.stepIndex<n)oneStep();render();}
function controlFrame(group){const frame=copyData(controller.getSnapshot().frame);for(const pose of frame.poses)if(group==='actor-only'?pose.targetId!=='capsule':group==='terrain-only'?pose.targetId==='capsule':false)pose.translation=[10000,0,0];viewer.applyMotionFrame(frame,copyData(controller.getSnapshot().bindings),BASIS);}
function dispose(){if(disposed)return;clock?.dispose();controller?.dispose();viewer?.dispose();disposed=true;window.characterHostReady=false;status('데모를 종료했습니다.');controls();}
buttons.play.onclick=()=>{if(controller&&!controller.getSnapshot().needsReset){status('재생 중');clock.play();controls();}};buttons.pause.onclick=()=>clock?.pause();buttons['one-step'].onclick=()=>{try{oneStep();}catch{}};buttons.reset.onclick=()=>void reset();select.onchange=()=>void reset(select.value);window.addEventListener('beforeunload',dispose);
window.characterHostProof={reset,oneStep,seek,dispose,controlFrame,get viewer(){return viewer;},get controller(){return controller;},get clock(){return clock;},get canvas(){return canvas;},get fixture(){return copyData(fixture);},get terrain(){return copyData(terrain);},get packets(){return copyData(packets);},get lastError(){return copyData(lastError);},get disposed(){return disposed;},setRecording(v){recording=!!v;journal=controller?[copyData(controller.getSnapshot().state)]:[];},getJournal(){return copyData(journal);},getJournalBits(){return hex(encode(numbers(journal)));},refresh:render};
try{await reset(new URLSearchParams(location.search).get('scene')??'STEP10');if(controller){const n=Number(new URLSearchParams(location.search).get('step')??0);await seek(n);}}catch(e){window.characterHostStartupError=String(e.stack??e);error(e);}
