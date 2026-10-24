import { BarocssError, refusalText } from '../core/barocss-error.js';
import { engineUVTextureSamplingHelpers } from './material-texture-shader-body.js';

/** Bounded CPU material compiler. No DOM, WebGL, eval or caller GLSL. */
export type MeshMaterialCode='SYNTAX'|'TYPE'|'RANGE'|'BUDGET'|'INPUT'|'IR'|'UNIFORM';
export interface MeshMaterialDiagnostic {code:MeshMaterialCode;message:string;start:number;end:number}
export class MeshMaterialError extends BarocssError {
 constructor(readonly code:MeshMaterialCode,message:string,readonly start=0,readonly end=0){super(code, message);this.name='MeshMaterialError';}
}
export interface MeshMaterialUniform {name:string;type:'float';min:number;max:number;default:number}
type MaterialExpression<Input, ExtraCall extends string=never>=
 |{kind:'float';type:'float';value:number}
 |{kind:'color';type:'color';hex:string;linear:[number,number,number]}
 |{kind:'uniform';type:'float';name:string}
 |{kind:'unary';type:'float';operator:'+'|'-';value:MaterialExpression<Input,ExtraCall>}
 |{kind:'binary';type:'float';operator:'+'|'-'|'*';left:MaterialExpression<Input,ExtraCall>;right:MaterialExpression<Input,ExtraCall>}
 |{kind:'call';type:'float'|'color';name:'sin'|'cos'|'mix'|'clamp'|ExtraCall;args:MaterialExpression<Input,ExtraCall>[]}
 |Input;
export type MeshMaterialExpression=MaterialExpression<never>;
type UVInput={kind:'input';type:'float';name:'uv_u'|'uv_v'};
export type EngineUVMaterialExpression=MaterialExpression<UVInput>;
export type EngineUVRepeatingMaterialExpression=MaterialExpression<UVInput,'fract'>;
type NativeSurfaceUV01Input={kind:'input';type:'float';name:'surface_u01'|'surface_v01'};
export type NativeSurfaceUV01MaterialExpression=MaterialExpression<NativeSurfaceUV01Input>;
/** Opt-in recursive family. Existing profile unions remain unchanged. */
type DiscreteExpression<Input, ExtraCall extends string=never>=
 |Extract<MeshMaterialExpression,{kind:'float'|'color'|'uniform'}>
 |{kind:'unary';type:'float';operator:'+'|'-';value:DiscreteExpression<Input,ExtraCall>}
 |{kind:'binary';type:'float';operator:'+'|'-'|'*';left:DiscreteExpression<Input,ExtraCall>;right:DiscreteExpression<Input,ExtraCall>}
 |{kind:'call';type:'float'|'color';name:'sin'|'cos'|'mix'|'clamp'|ExtraCall;args:DiscreteExpression<Input,ExtraCall>[]}
 |{kind:'select';type:'float'|'color';value:DiscreteExpression<Input,ExtraCall>;threshold:Extract<MeshMaterialExpression,{kind:'float'}>;below:DiscreteExpression<Input,ExtraCall>;otherwise:DiscreteExpression<Input,ExtraCall>}
 |Input;
export type DiscreteMeshMaterialExpression=DiscreteExpression<never>;
export interface DiscreteMeshMaterialIR {format:'barocss-gpu-discrete-mesh-material';version:0;profile:'mesh-opaque-discrete-fragment-v0';source:string;shaderId:string;uniforms:MeshMaterialUniform[];expression:DiscreteMeshMaterialExpression}
export type LoweredDiscreteMeshMaterial = LoweredMeshMaterial;
/** Separate recursive family; existing public expression unions stay intact. */
type TextureExpression<Input,ExtraCall extends string=never,Extra=never>=
 |Extract<MeshMaterialExpression,{kind:'float'|'color'|'uniform'}>
 |{kind:'unary';type:'float';operator:'+'|'-';value:TextureExpression<Input,ExtraCall,Extra>}
 |{kind:'binary';type:'float';operator:'+'|'-'|'*';left:TextureExpression<Input,ExtraCall,Extra>;right:TextureExpression<Input,ExtraCall,Extra>}
 |{kind:'call';type:'float'|'color';name:'sin'|'cos'|'mix'|'clamp'|ExtraCall;args:TextureExpression<Input,ExtraCall,Extra>[]}
 |{kind:'sample';type:'color';sampler:string;u:TextureExpression<Input,ExtraCall,Extra>;v:TextureExpression<Input,ExtraCall,Extra>}
 |Input|Extra;
export interface EngineMaterialSampler {name:string;type:'sampler2d'}
export type EngineUVTextureMaterialExpression=TextureExpression<UVInput>;
export interface EngineUVTextureMaterialIR {
 format:'barocss-gpu-engine-uv-texture-material';version:0;profile:'engine-opaque-uv-texture-fragment-v0';
 source:string;shaderId:string;uniforms:MeshMaterialUniform[];samplers:EngineMaterialSampler[];expression:EngineUVTextureMaterialExpression;
}
export interface LoweredEngineUVTextureMaterial extends LoweredEngineUVMaterial {
 samplerDeclarations:string;
 samplerLayout:(EngineMaterialSampler&{glslName:'mat_s_0';colorSpace:'srgb';rowOrigin:'bottom-left';filter:'nearest';wrapS:'clamp-to-edge';wrapT:'clamp-to-edge'})[];
 samplingHelpers:string;
}
type ParsedSelection={kind:'select';type:'float'|'color';value:ParsedMaterialExpression;threshold:Extract<MeshMaterialExpression,{kind:'float'}>;below:ParsedMaterialExpression;otherwise:ParsedMaterialExpression};
type ParsedMaterialExpression=TextureExpression<UVInput|NativeSurfaceUV01Input,'fract',ParsedSelection>;
export interface MeshMaterialIR {format:'barocss-gpu-mesh-material';version:0;profile:'mesh-opaque-fragment-v0';source:string;shaderId:string;uniforms:MeshMaterialUniform[];expression:MeshMaterialExpression}
export interface MeshMaterialBinding {material:MeshMaterialIR;uniforms:Record<string,number>}
export interface LoweredMeshMaterial {expression:string;uniformDeclarations:string;uniformLayout:(MeshMaterialUniform&{glslName:string})[]}
export interface EngineUVMaterialIR {format:'barocss-gpu-engine-uv-material';version:0;profile:'engine-opaque-uv-fragment-v0';source:string;shaderId:string;uniforms:MeshMaterialUniform[];expression:EngineUVMaterialExpression}
export interface EngineUVRepeatingMaterialIR {format:'barocss-gpu-engine-uv-repeating-material';version:0;profile:'engine-opaque-uv-repeating-fragment-v0';source:string;shaderId:string;uniforms:MeshMaterialUniform[];expression:EngineUVRepeatingMaterialExpression}
export interface EngineUVMaterialBinding {material:EngineUVMaterialIR;uniforms:Record<string,number>}
export interface EngineUVRepeatingMaterialBinding {material:EngineUVRepeatingMaterialIR;uniforms:Record<string,number>}
export interface LoweredEngineUVMaterial extends LoweredMeshMaterial {inputDeclarations:'in vec2 v_engine_uv;'}
export interface NativeSurfaceUV01MaterialIR {format:'barocss-gpu-native-surface-uv01-material';version:0;profile:'native-surface-opaque-uv01-fragment-v0';source:string;shaderId:string;uniforms:MeshMaterialUniform[];expression:NativeSurfaceUV01MaterialExpression}
export interface LoweredNativeSurfaceUV01Material extends LoweredMeshMaterial {inputDeclarations:'in vec2 v_native_surface_uv01;'}
type Token={text:string;start:number;end:number};
type ParsedMaterial={source:string;shaderId:string;uniforms:MeshMaterialUniform[];expression:ParsedMaterialExpression;samplers?:EngineMaterialSampler[]};
type Term={expression:ParsedMaterialExpression;type:'float'|'color';range:[number,number];depth:number;size:number};
type MaterialFunctionDefinition={parameter:string;min:number;max:number;bodyStart:number;bodyEnd:number};
type MaterialFunctionScope={name:string;parameter:string;value:Term};
function fail(code:MeshMaterialCode,message:string,token?:Token):never{throw new MeshMaterialError(code,message,token?.start??0,token?.end??0);}
const zero=(n:number)=>n===0?0:n;
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function tokens(source:string):Token[]{
 const result:Token[]=[];let i=0;
 while(i<source.length){const start=i,c=source[i];if(/\s/.test(c)){i++;continue;}
 // Keep original source offsets; line terminators remain ordinary whitespace.
 if(source.startsWith('//',i)){i+=2;while(i<source.length&&!/[\r\n\u2028\u2029]/.test(source[i]))i++;continue;}
 if(source.startsWith('/*',i)){const end=source.indexOf('*/',i+2);if(end<0)fail('SYNTAX','Unclosed comment',{text:c,start,end:i+2});i=end+2;continue;}
 let text:string;
 if(c==='#'){i++;while(i<source.length&&/[A-Za-z0-9_-]/.test(source[i]))i++;text=source.slice(start,i);}
 else if(/[A-Za-z_]/.test(c)){i++;while(i<source.length&&/[A-Za-z0-9_]/.test(source[i]))i++;text=source.slice(start,i);}
 else if(/\d/.test(c)||(c==='.'&&/\d/.test(source[i+1]??''))){const match=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/.exec(source.slice(i));text=match![0];i+=text.length;}
 else if('@{}():;,+-*/'.includes(c)){text=c;i++;}
 else fail('SYNTAX','Unsupported material token '+c,{text:c,start,end:i+1});
 result.push({text,start,end:i});if(result.length>4096)fail('BUDGET','Material exceeds4096 tokens',result.at(-1));
 }
 result.push({text:'<eof>',start:i,end:i});return result;
}
class Parser {
 private i=0;private nodes=0;private uniforms:MeshMaterialUniform[]=[];
 private samplers:EngineMaterialSampler[]=[];
 private locals=new Map<string,Term>();
 private functions=new Map<string,MaterialFunctionDefinition>();
 private functionScope:MaterialFunctionScope|null=null;
 constructor(private readonly source:string,private readonly list:Token[],private readonly uvInputs=false,private readonly repeatingUV=false,private readonly nativeSurfaceUV01=false,private readonly discrete=false,private readonly texture=false){}
 private inputName(name:string):name is UVInput['name']|NativeSurfaceUV01Input['name']{return this.nativeSurfaceUV01?(name==='surface_u01'||name==='surface_v01'):this.uvInputs&&(name==='uv_u'||name==='uv_v');}
 private current(){return this.list[this.i];}
 private take(text:string){const t=this.current();if(t.text!==text)fail('SYNTAX','Expected '+text,t);this.i++;return t;}
 private signedNumber(){let sign=1;if(this.current().text==='-'||this.current().text==='+'){sign=this.current().text==='-'?-1:1;this.i++;}const token=this.current();if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(token.text))fail('SYNTAX','Numeric literal required',token);this.i++;const n=zero(sign*Number(token.text));if(!Number.isFinite(n)||Math.abs(n)>1000)fail('RANGE','Literal must be finite within±1000',token);/* (Nonzero but zero as f32: GLSL would flush it to 0 and WGSL refuse it — refused here for both, G5.) */if(n!==0&&Math.fround(n)===0)fail('RANGE','Literal must not round to zero as f32',token);return n;}
 private term(expression:ParsedMaterialExpression,type:'float'|'color',range:[number,number],children:Term[],token:Token):Term{if(++this.nodes>256)fail('BUDGET','Material exceeds256 expression nodes',token);const depth=1+Math.max(0,...children.map(c=>c.depth));if(depth>16)fail('BUDGET','Material expression exceeds depth16',token);if(!range.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6))fail('RANGE','Intermediate bound exceeds±1e6',token);return{expression,type,range,depth,size:1+children.reduce((sum,child)=>sum+child.size,0)};}
 private float(term:Term,token:Token){if(term.type!=='float')fail('TYPE','Float expression required',token);}
 private color(hex:string,token:Token):Term{const linear=[1,3,5].map(i=>Math.pow(parseInt(hex.slice(i,i+2),16)/255,2.2)) as [number,number,number];return this.term({kind:'color',type:'color',hex,linear},'color',[0,1],[],token);}
 private functionReserved(name:string):boolean{return this.texture&&(name==='sample'||name==='sampler2d'||this.samplers.some(sampler=>sampler.name===name))||this.discrete&&name==='select'||this.inputName(name)||this.uniforms.some(uniform=>uniform.name===name)||this.functions.has(name)||['rgb','pow','sin','cos','mix','clamp','abs','min','max','smoothstep','radians','fract','float','color'].includes(name);}
 private copyExpression(expression:ParsedMaterialExpression):ParsedMaterialExpression{
  switch(expression.kind){
   case'float':case'uniform':case'input':return{...expression};
   case'color':return{...expression,linear:[...expression.linear]};
   case'unary':return{...expression,value:this.copyExpression(expression.value)};
   case'binary':return{...expression,left:this.copyExpression(expression.left),right:this.copyExpression(expression.right)};
   case'call':return{...expression,args:expression.args.map(argument=>this.copyExpression(argument))};
   case'sample':return{...expression,u:this.copyExpression(expression.u),v:this.copyExpression(expression.v)};
   case'select':return{...expression,value:this.copyExpression(expression.value),threshold:{...expression.threshold},below:this.copyExpression(expression.below),otherwise:this.copyExpression(expression.otherwise)};
  }
 }
 private substituteParameter(value:Term,token:Token):Term{
  // Argument parsing has already charged its work. Every body reference charges
  // the complete substituted tree again, before making its bounded own copy.
  if(this.nodes+value.size>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);
  this.nodes+=value.size;
  return{...value,range:[...value.range],expression:this.copyExpression(value.expression)};
 }
 private parseFunction():void{
  this.take('@');this.take('fn');const name=this.current();
  if(!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name.text))fail('SYNTAX','Function name requires ASCII1..32',name);
  if(this.functionReserved(name.text))fail('TYPE','Function name collides with an existing or reserved name',name);
  if(this.functions.size>=8)fail('BUDGET','Material exceeds8 function declarations',name);
  this.i++;this.take('(');const parameter=this.current();
  if(!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(parameter.text))fail('SYNTAX','Function parameter requires ASCII1..32',parameter);
  if(parameter.text===name.text||this.functionReserved(parameter.text))fail('TYPE','Function parameter collides with an existing or reserved name',parameter);
  this.i++;this.take(':');const parameterType=this.current();
  if(parameterType.text!=='float')fail('TYPE','Function parameter requires float',parameterType);
  this.i++;this.take('(');const min=this.signedNumber();this.take(',');const max=this.signedNumber();
  if(min>max)fail('RANGE','Function min/max are not ordered',name);
  this.take(')');this.take(')');this.take(':');const resultType=this.current();
  if(resultType.text!=='float'&&resultType.text!=='color')fail('TYPE','Function result requires float or color',resultType);
  this.i++;this.take('(');const bodyStart=this.i,previousScope=this.functionScope;
  // This private placeholder only checks definition intervals/work. Its tree is
  // discarded; definitions retain original token indices, never placeholder IR.
  const placeholder:Term={expression:{kind:'uniform',type:'float',name:parameter.text},type:'float',range:[min,max],depth:1,size:1};
  let bodyEnd:number;
  this.functionScope={name:name.text,parameter:parameter.text,value:placeholder};
  try{const body=this.expression();if(resultType.text==='float')this.float(body,resultType);else if(body.type!=='color')fail('TYPE','Color expression required',resultType);bodyEnd=this.i;this.take(')');this.take(';');}
  finally{this.functionScope=previousScope;}
  this.functions.set(name.text,{parameter:parameter.text,min,max,bodyStart,bodyEnd});
 }
 private callFunction(definition:MaterialFunctionDefinition,name:Token,nesting:number):Term{
  this.take('(');
  if(this.current().text===')')fail('TYPE','Authored function requires one float argument',name);
  const argument=this.expression(0,nesting+1);
  if(this.current().text!==')')fail('TYPE','Authored function requires exactly one argument',name);
  this.take(')');this.float(argument,name);
  if(argument.range[0]<definition.min||argument.range[1]>definition.max)fail('RANGE','Function argument is outside its declared float bounds',name);
  const callerIndex=this.i,previousScope=this.functionScope;
  this.i=definition.bodyStart;this.functionScope={name:name.text,parameter:definition.parameter,value:argument};
  try{
   const value=this.expression(0,nesting+1);
   if(this.i!==definition.bodyEnd)fail('SYNTAX','Function body did not reach its original boundary',this.current());
   return value;
  }finally{this.i=callerIndex;this.functionScope=previousScope;}
 }
 private primary(nesting:number):Term{
 if(nesting>16)fail('BUDGET','Material parse nesting exceeds16',this.current());const token=this.current();
 if(token.text==='('){this.i++;const value=this.expression(0,nesting+1);this.take(')');return value;}
 if(token.text==='+'||token.text==='-'){this.i++;const value=this.primary(nesting+1);this.float(value,token);const range: [number,number]=token.text==='-'?[-value.range[1],-value.range[0]]:value.range;return this.term({kind:'unary',type:'float',operator:token.text,value:value.expression},'float',range,[value],token);}
 if(/^\d|^\.\d/.test(token.text)){const value=this.signedNumber();return this.term({kind:'float',type:'float',value},'float',[value,value],[],token);}
 if(token.text.startsWith('#')){this.i++;if(!/^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(token.text))fail('SYNTAX','Color requires #RGB or #RRGGBB',token);const hex=(token.text.length===4?'#'+[...token.text.slice(1)].map(digit=>digit+digit).join(''):token.text).toUpperCase();return this.color(hex,token);}
 if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(token.text)){
 this.i++;if(this.current().text==='('){const name=token.text;
 const authored=this.functions.get(name);
 if(this.functionScope&&(authored||name===this.functionScope.name))fail('SYNTAX','Authored functions cannot call authored functions in a body',token);
 if(authored)return this.callFunction(authored,token,nesting);
 if(name==='sample'&&this.texture){
  if(this.functionScope)fail('TYPE','Pure function body cannot sample a resource',token);
  this.take('(');const alias=this.current();
  if(!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(alias.text)||!this.samplers.some(sampler=>sampler.name===alias.text))fail('TYPE','sample requires the declared sampler alias',alias);
  this.i++;this.take(',');const u=this.expression(0,nesting+1);this.take(',');const v=this.expression(0,nesting+1);this.take(')');
  this.float(u,token);this.float(v,token);
  if([...u.range,...v.range].some(n=>Math.abs(n)>1000))fail('RANGE','sample coordinates exceed±1000',token);
  return this.term({kind:'sample',type:'color',sampler:alias.text,u:u.expression,v:v.expression},'color',[0,1],[u,v],token);
 }
 if(name==='select'&&this.discrete){
  this.take('(');const value=this.expression(0,nesting+1);this.take(',');
  const literal=this.current(),number=this.signedNumber();
  const thresholdExpression:Extract<MeshMaterialExpression,{kind:'float'}>={kind:'float',type:'float',value:number};
  const threshold=this.term(thresholdExpression,'float',[number,number],[],literal);
  this.take(',');const below=this.expression(0,nesting+1);this.take(',');const otherwise=this.expression(0,nesting+1);this.take(')');
  this.float(value,token);if(below.type!==otherwise.type)fail('TYPE','select branches require matching float or color types',token);
  const range:[number,number]=below.type==='color'?[0,1]:[Math.min(below.range[0],otherwise.range[0]),Math.max(below.range[1],otherwise.range[1])];
  return this.term({kind:'select',type:below.type,value:value.expression,threshold:thresholdExpression,below:below.expression,otherwise:otherwise.expression},below.type,range,[value,threshold,below,otherwise],token);
 }
 if(name==='rgb'){
  this.take('(');const channels:number[]=[];
  for(let channel=0;channel<3;channel++){
   if(channel>0)this.take(',');
   const start=this.current(),value=this.signedNumber(),literal={text:this.source.slice(start.start,this.list[this.i-1].end),start:start.start,end:this.list[this.i-1].end};
   if(!Number.isInteger(value)||value<0||value>255)fail('RANGE','RGB channel requires an integer byte within0..255',literal);
   channels.push(value);
  }
  this.take(')');return this.color('#'+channels.map(value=>value.toString(16).padStart(2,'0')).join('').toUpperCase(),token);
 }
 if(name==='pow'){
  this.take('(');if(this.current().text===')')fail('TYPE','pow requires a float and unsigned integer literal2..8',token);
  const base=this.expression(0,nesting+1);if(this.current().text!==',')fail('TYPE','pow requires two arguments',token);this.take(',');
  if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(this.current().text))fail('TYPE','pow exponent requires an unsigned numeric literal',token);
  const exponent=this.primary(nesting+1);if(this.current().text!==')')fail('TYPE','pow exponent must be a single literal',token);this.take(')');this.float(base,token);
  const n=exponent.expression.kind==='float'?exponent.expression.value:NaN;
  if(!Number.isInteger(n)||n<2||n>8)fail('RANGE','pow exponent requires integer2..8',token);
  const copies=(n-1)*base.size;if(this.nodes+copies>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);this.nodes+=copies;
  let product=base;for(let i=1;i<n;i++){
   const[a,b]=product.range,[c,d]=base.range,values=[a*c,a*d,b*c,b*d];
   product=this.term({kind:'binary',type:'float',operator:'*',left:product.expression,right:base.expression},'float',[Math.min(...values),Math.max(...values)],[product,base],token);
  }return product;
 }
 if(!['sin','cos','mix','clamp','abs','min','max','smoothstep','radians'].includes(name)&&!(name==='fract'&&this.repeatingUV))fail('SYNTAX','Unsupported material function',token);this.take('(');const args:Term[]=[];if(this.current().text!==')'){for(;;){args.push(this.expression(0,nesting+1));if(this.current().text!==',')break;this.take(',');}}this.take(')');let type:'float'|'color'='float',range:[number,number];
 if(name==='fract'){
  if(args.length!==1)fail('TYPE','fract requires one float',token);
  this.float(args[0],token);
  if(args[0].range[0]<-1000||args[0].range[1]>1000)fail('RANGE','fract input bound exceeds±1000',token);
  return this.term({kind:'call',type:'float',name:'fract',args:[args[0].expression]},'float',[0,1],args,token);
 }
 if(name==='radians'){
  if(args.length!==1)fail('TYPE','radians requires one float',token);this.float(args[0],token);
  const value=args[0];if(value.range.some(n=>Math.abs(n)>1000))fail('RANGE','radians argument exceeds±1000 degrees',token);
  const factor=Math.PI/180,constant=this.term({kind:'float',type:'float',value:factor},'float',[factor,factor],[],token);
  return this.term({kind:'binary',type:'float',operator:'*',left:value.expression,right:constant.expression},'float',[value.range[0]*factor,value.range[1]*factor],[value,constant],token);
 }
 if(name==='smoothstep'){
  if(args.length!==3)fail('TYPE','smoothstep requires three floats',token);args.forEach(a=>this.float(a,token));
  const literalValue=(term:Term):number=>{
   const e=term.expression;if(e.kind==='float')return e.value;
   if(e.kind==='unary'&&e.value.kind==='float')return zero((e.operator==='-'?-1:1)*e.value.value);
   return fail('TYPE','smoothstep edges require signed literal constants',token);
  };
  const[edge0,edge1,x]=args,low=literalValue(edge0),high=literalValue(edge1),reciprocal=1/(high-low);
  if(!(low<high)||!Number.isFinite(reciprocal)||reciprocal>1000)fail('RANGE','smoothstep edges require ordered bounds and reciprocal≤1000',token);
  if(x.range.some(n=>Math.abs(n)>1000))fail('RANGE','smoothstep input exceeds±1000',token);
  const literal=(n:number)=>this.term({kind:'float',type:'float',value:n},'float',[n,n],[],token);
  const binary=(operator:'-'|'*',a:Term,b:Term,r:[number,number])=>this.term({kind:'binary',type:'float',operator,left:a.expression,right:b.expression},'float',r,[a,b],token);
  const shifted=binary('-',x,edge0,[x.range[0]-low,x.range[1]-low]),inverse=literal(reciprocal);
  const normalized=binary('*',shifted,inverse,[shifted.range[0]*reciprocal,shifted.range[1]*reciprocal]);
  const clipped=(n:number)=>Math.max(0,Math.min(1,n)),tArgs=[normalized,literal(0),literal(1)];
  const t=this.term({kind:'call',type:'float',name:'clamp',args:tArgs.map(a=>a.expression)},'float',[clipped(normalized.range[0]),clipped(normalized.range[1])],tArgs,token);
  // The polynomial contains three complete t trees; charge the other two.
  if(this.nodes+2*t.size>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);
  this.nodes+=2*t.size;
  const squared=binary('*',t,t,[t.range[0]*t.range[0],t.range[1]*t.range[1]]),two=literal(2);
  const twice=binary('*',two,t,[2*t.range[0],2*t.range[1]]),three=literal(3);
  const factor=binary('-',three,twice,[3-twice.range[1],3-twice.range[0]]);
  const polynomial=binary('*',squared,factor,[squared.range[0]*factor.range[0],squared.range[1]*factor.range[1]]),out=[polynomial,literal(0),literal(1)];
  return this.term({kind:'call',type:'float',name:'clamp',args:out.map(a=>a.expression)},'float',[0,1],out,token);
 }
 if(name==='min'||name==='max'){
  if(args.length!==2)fail('TYPE','min/max requires two floats',token);args.forEach(a=>this.float(a,token));
  if(args.some(a=>a.range.some(n=>Math.abs(n)>1000)))fail('RANGE','min/max argument exceeds±1000',token);
  const[a,b]=args,cap=this.term({kind:'float',type:'float',value:1000},'float',[1000,1000],[],token);
  const lower=name==='min'?this.term({kind:'unary',type:'float',operator:'-',value:cap.expression},'float',[-1000,-1000],[cap],token):b;
  const expanded=name==='min'?[a,lower,b]:[a,b,cap],extreme=name==='min'?Math.min:Math.max;
  return this.term({kind:'call',type:'float',name:'clamp',args:expanded.map(a=>a.expression)},'float',[extreme(a.range[0],b.range[0]),extreme(a.range[1],b.range[1])],expanded,token);
 }
 if(name==='abs'){
  if(args.length!==1)fail('TYPE','abs requires one float',token);this.float(args[0],token);
  const value=args[0],maximum=Math.max(...value.range.map(Math.abs));
  if(maximum>1000)fail('RANGE','abs argument exceeds±1000',token);
  // Reuse the existing clamp/unary/addition IR and charge the second value tree.
  if(this.nodes+value.size>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);
  this.nodes+=value.size;
  const literal=(n:number)=>this.term({kind:'float',type:'float',value:n},'float',[n,n],[],token);
  const positiveArgs=[value,literal(0),literal(1000)];
  const positive=this.term({kind:'call',type:'float',name:'clamp',args:positiveArgs.map(a=>a.expression)},'float',[0,1000],positiveArgs,token);
  const negative=this.term({kind:'unary',type:'float',operator:'-',value:value.expression},'float',[-value.range[1],-value.range[0]],[value],token);
  const negativeArgs=[negative,literal(0),literal(1000)];
  const magnitude=this.term({kind:'call',type:'float',name:'clamp',args:negativeArgs.map(a=>a.expression)},'float',[0,1000],negativeArgs,token);
  return this.term({kind:'binary',type:'float',operator:'+',left:positive.expression,right:magnitude.expression},'float',[0,maximum],[positive,magnitude],token);
 }
 if(name==='sin'||name==='cos'){if(args.length!==1)fail('TYPE','sin/cos requires one float',token);this.float(args[0],token);if(args[0].range.some(n=>Math.abs(n)>1000))fail('RANGE','sin/cos argument exceeds±1000',token);range=[-1,1];}
 else if(name==='mix'){
 if(args.length!==3||args[0].type!==args[1].type||args[2].type!=='float')fail('TYPE','mix requires color,color,float or float,float,float',token);
 if(args[2].range[0]<0||args[2].range[1]>1)fail('RANGE','mix ratio must be bounded within0..1',token);
 if(args[0].type==='float'){
  const[a,b,t]=args;
  // a appears twice in the expanded arithmetic; charge its full subtree again.
  if(this.nodes+a.size>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);
  this.nodes+=a.size;
  const difference=this.term({kind:'binary',type:'float',operator:'-',left:b.expression,right:a.expression},'float',[b.range[0]-a.range[1],b.range[1]-a.range[0]],[b,a],token);
  const[x,y]=difference.range,[u,v]=t.range;
  const product=this.term({kind:'binary',type:'float',operator:'*',left:difference.expression,right:t.expression},'float',[Math.min(x*u,x*v,y*u,y*v),Math.max(x*u,x*v,y*u,y*v)],[difference,t],token);
  return this.term({kind:'binary',type:'float',operator:'+',left:a.expression,right:product.expression},'float',[a.range[0]+product.range[0],a.range[1]+product.range[1]],[a,product],token);
 }
 type='color';range=[0,1];}
 else{if(args.length!==3)fail('TYPE','clamp requires three floats',token);args.forEach(arg=>this.float(arg,token));if(args[1].range[1]>args[2].range[0])fail('RANGE','clamp bounds are not ordered',token);range=[args[1].range[0],args[2].range[1]];}
 return this.term({kind:'call',type,name:name as 'sin'|'cos'|'mix'|'clamp',args:args.map(a=>a.expression)},type,range,args,token);
 }
 if(this.functionScope){if(token.text===this.functionScope.parameter)return this.substituteParameter(this.functionScope.value,token);fail('TYPE','Pure function body cannot capture '+token.text,token);}
 if(this.functions.has(token.text))fail('TYPE','Authored function requires an argument call',token);
 if(this.inputName(token.text))return this.term({kind:'input',type:'float',name:token.text},'float',this.nativeSurfaceUV01?[0,1]:[-1000,1000],[],token);
 const local=this.locals.get(token.text);if(local){if(this.nodes+local.size>256)fail('BUDGET','Material exceeds256 definition and expanded expression nodes',token);this.nodes+=local.size;return this.discrete||this.texture?{...local,range:[...local.range],expression:this.copyExpression(local.expression)}:local;}
 const uniform=this.uniforms.find(u=>u.name===token.text);if(!uniform)fail('TYPE','Undeclared material uniform '+token.text,token);return this.term({kind:'uniform',type:'float',name:token.text},'float',[uniform.min,uniform.max],[],token);
 }
 fail('SYNTAX','Material expression required',token);
 }
 private expression(min=0,nesting=0):Term{let left=this.primary(nesting);for(;;){const token=this.current(),precedence=token.text==='*'||token.text==='/'?2:token.text==='+'||token.text==='-'?1:0;if(precedence===0||precedence<min)break;this.i++;
 if(token.text==='/'){
  this.float(left,token);
  const start=this.current(),divisor=this.signedNumber(),literal={text:this.source.slice(start.start,this.list[this.i-1].end),start:start.start,end:this.list[this.i-1].end};
  if(divisor===0)fail('RANGE','Material divisor must be a nonzero numeric literal',literal);
  const reciprocal=zero(1/divisor);
  if(!Number.isFinite(reciprocal)||Math.abs(reciprocal)>1000)fail('RANGE','Material divisor reciprocal exceeds±1000',literal);
  // Lower only to the existing float/multiply IR, charging both generated nodes.
  const right=this.term({kind:'float',type:'float',value:reciprocal},'float',[reciprocal,reciprocal],[],literal),[a,b]=left.range;
  left=this.term({kind:'binary',type:'float',operator:'*',left:left.expression,right:right.expression},'float',[Math.min(a*reciprocal,b*reciprocal),Math.max(a*reciprocal,b*reciprocal)],[left,right],token);
  continue;
 }
 const right=this.expression(precedence+1,nesting+1);this.float(left,token);this.float(right,token);const[a,b]=left.range,[c,d]=right.range;const range: [number,number]=token.text==='+'?[a+c,b+d]:token.text==='-'?[a-d,b-c]:[Math.min(a*c,a*d,b*c,b*d),Math.max(a*c,a*d,b*c,b*d)];left=this.term({kind:'binary',type:'float',operator:token.text as '+'|'-'|'*',left:left.expression,right:right.expression},'float',range,[left,right],token);}return left;}
 parse():ParsedMaterial{
 this.take('@');this.take('shader');const id=this.current();if(!/^#[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(id.text))fail('SYNTAX','Shader ID requires ASCII1..64',id);this.i++;this.take('{');
 while(this.current().text==='@'&&this.list[this.i+1]?.text==='uniform'){
 this.take('@');this.take('uniform');const name=this.current();if(!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name.text))fail('SYNTAX','Uniform name requires ASCII1..32',name);if(this.discrete&&name.text==='select')fail('TYPE','Uniform name shadows reserved select',name);if(this.texture&&(name.text==='sample'||name.text==='sampler2d'))fail('TYPE','Uniform name shadows a reserved texture name',name);if(this.inputName(name.text))fail('TYPE',this.nativeSurfaceUV01?'Uniform name shadows reserved native Surface UV01 input':'Uniform name shadows reserved UV input',name);if(this.uniforms.some(u=>u.name===name.text))fail('TYPE','Duplicate uniform name',name);this.i++;this.take(':');this.take('float');this.take('(');const min=this.signedNumber();this.take(',');const max=this.signedNumber();this.take(',');const value=this.signedNumber();this.take(')');this.take(';');if(min>max||value<min||value>max)fail('RANGE','Uniform min/default/max are not ordered',name);this.uniforms.push({name:name.text,type:'float',min,max,default:value});if(this.uniforms.length>16)fail('BUDGET','Material exceeds16 uniforms',name);
 }
 if(this.texture){
  this.take('@');this.take('sampler');const name=this.current();
  if(!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name.text))fail('SYNTAX','Sampler name requires ASCII1..32',name);
  if(this.functionReserved(name.text))fail('TYPE','Sampler name collides with an existing or reserved name',name);
  this.i++;this.take(':');this.take('sampler2d');this.take(';');
  if(++this.nodes>256)fail('BUDGET','Material exceeds256 expression nodes',name);
  this.samplers.push({name:name.text,type:'sampler2d'});
  if(this.current().text==='@'&&this.list[this.i+1]?.text==='sampler')fail('BUDGET','Material exceeds1 sampler declaration',this.list[this.i+1]);
 }
 while(this.current().text==='@'&&this.list[this.i+1]?.text==='fn')this.parseFunction();
 while(this.current().text==='@'&&this.list[this.i+1]?.text==='let'){
 this.take('@');this.take('let');const name=this.current();if(!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(name.text))fail('SYNTAX','Local name requires ASCII1..32',name);if(this.discrete&&name.text==='select')fail('TYPE','Local name shadows reserved select',name);if(this.texture&&(name.text==='sample'||name.text==='sampler2d'||this.samplers.some(sampler=>sampler.name===name.text)))fail('TYPE','Local name shadows a reserved texture name',name);if(this.inputName(name.text))fail('TYPE',this.nativeSurfaceUV01?'Local name shadows reserved native Surface UV01 input':'Local name shadows reserved UV input',name);if(this.locals.has(name.text)||this.uniforms.some(u=>u.name===name.text)||this.functions.has(name.text)||['sin','cos','mix','clamp','float','color'].includes(name.text)||this.repeatingUV&&name.text==='fract')fail('TYPE','Local name collides with an existing or reserved name',name);if(this.locals.size>=16)fail('BUDGET','Material exceeds16 local declarations',name);this.i++;this.take(':');const type=this.current();if(type.text!=='float'&&type.text!=='color')fail('SYNTAX','Local type requires float or color',type);this.i++;this.take('(');const value=this.expression();this.take(')');this.take(';');if(value.type!==type.text)fail('TYPE','Local expression does not match its declared type',type);this.locals.set(name.text,value);
 }
 this.take('@');this.take('fragment');this.take('{');this.take('color');this.take(':');const expression=this.expression();if(expression.type!=='color')fail('TYPE','Opaque material output requires color',this.current());this.take(';');this.take('}');this.take('}');this.take('<eof>');
 const result={source:this.source,shaderId:id.text.slice(1),uniforms:this.uniforms,expression:expression.expression};
 return this.texture?{...result,samplers:this.samplers}:result;
 }
}
export function compileMeshMaterial(source:string):{ok:true;material:MeshMaterialIR}|{ok:false;diagnostics:MeshMaterialDiagnostic[]}{
 // Default parser mode cannot resolve input leaves; the legacy public type stays unchanged.
 try{const parsed=parseMaterialSource(source);return{ok:true,material:freeze({format:'barocss-gpu-mesh-material',version:0,profile:'mesh-opaque-fragment-v0',...parsed,expression:trustedMaterialExpression<MeshMaterialExpression>(parsed.expression,'mesh')})};}
 catch(error){const e=error instanceof MeshMaterialError?error:new MeshMaterialError('SYNTAX',error instanceof Error?refusalText(error):'Material compile failed');return{ok:false,diagnostics:[{code:e.code,message:refusalText(e),start:e.start,end:e.end}]};}
}
function parseMaterialSource(source:string,uvInputs=false,repeatingUV=false,nativeSurfaceUV01=false,discrete=false,texture=false):ParsedMaterial{
 if(typeof source!=='string')fail('INPUT','Material source must be text');
 if(new TextEncoder().encode(source).length>65536)fail('BUDGET','Material source exceeds64KiB');
 return new Parser(source,tokens(source),uvInputs,repeatingUV,nativeSurfaceUV01,discrete,texture).parse();
}
export function compileEngineUVMaterial(source:string):{ok:true;material:EngineUVMaterialIR}|{ok:false;diagnostics:MeshMaterialDiagnostic[]}{
 try{const parsed=parseMaterialSource(source,true);return{ok:true,material:freeze({format:'barocss-gpu-engine-uv-material',version:0,profile:'engine-opaque-uv-fragment-v0',...parsed,expression:trustedMaterialExpression<EngineUVMaterialExpression>(parsed.expression,'uv')})};}
 catch(error){const e=error instanceof MeshMaterialError?error:new MeshMaterialError('SYNTAX',error instanceof Error?refusalText(error):'Material compile failed');return{ok:false,diagnostics:[{code:e.code,message:refusalText(e).slice(0,1024),start:e.start,end:e.end}]};}
}
export function compileEngineUVRepeatingMaterial(source:string):{ok:true;material:EngineUVRepeatingMaterialIR}|{ok:false;diagnostics:MeshMaterialDiagnostic[]}{
 try{const parsed=parseMaterialSource(source,true,true);return{ok:true,material:freeze({format:'barocss-gpu-engine-uv-repeating-material',version:0,profile:'engine-opaque-uv-repeating-fragment-v0',...parsed,expression:trustedMaterialExpression<EngineUVRepeatingMaterialExpression>(parsed.expression,'repeating')})};}
 catch(error){const e=error instanceof MeshMaterialError?error:new MeshMaterialError('SYNTAX',error instanceof Error?refusalText(error):'Material compile failed');return{ok:false,diagnostics:[{code:e.code,message:refusalText(e).slice(0,1024),start:e.start,end:e.end}]};}
}
/** CPU grammar stage only. A future native producer must supply normalized original-domain inputs. */
export function compileNativeSurfaceUV01Material(source:string):{ok:true;material:NativeSurfaceUV01MaterialIR}|{ok:false;diagnostics:MeshMaterialDiagnostic[]}{
 try{const parsed=parseMaterialSource(source,false,false,true);return{ok:true,material:freeze({format:'barocss-gpu-native-surface-uv01-material',version:0,profile:'native-surface-opaque-uv01-fragment-v0',...parsed,expression:trustedMaterialExpression<NativeSurfaceUV01MaterialExpression>(parsed.expression,'native')})};}
 catch(error){const e=error instanceof MeshMaterialError?error:new MeshMaterialError('SYNTAX',error instanceof Error?refusalText(error):'Material compile failed');return{ok:false,diagnostics:[{code:e.code,message:refusalText(e).slice(0,1024),start:e.start,end:e.end}]};}
}
/** Only private parser-produced trees reach this bounded domain proof. */
function trustedMaterialExpression<E extends ParsedMaterialExpression>(expression:ParsedMaterialExpression,mode:'mesh'|'uv'|'repeating'|'native'|'discrete'|'texture'):E{
 let remaining=256;
 const visit=(e:ParsedMaterialExpression,depth:number):void=>{
  if(--remaining<0||depth>16)fail('BUDGET','Trusted material tree exceeds its admitted limit');
  switch(e.kind){
   case'float':case'color':case'uniform':return;
   case'input':if(mode==='native'?(e.name!=='surface_u01'&&e.name!=='surface_v01'):mode==='uv'||mode==='repeating'||mode==='texture'?(e.name!=='uv_u'&&e.name!=='uv_v'):true)fail('IR','Trusted material input domain mismatch');return;
   case'unary':visit(e.value,depth+1);return;
   case'binary':visit(e.left,depth+1);visit(e.right,depth+1);return;
   case'call':if(e.name==='fract'&&mode!=='repeating')fail('IR','Trusted material call domain mismatch');e.args.forEach(child=>visit(child,depth+1));return;
   case'sample':if(mode!=='texture')fail('IR','Trusted material sampling domain mismatch');visit(e.u,depth+1);visit(e.v,depth+1);return;
   case'select':if(mode!=='discrete')fail('IR','Trusted material selection domain mismatch');visit(e.value,depth+1);visit(e.threshold,depth+1);visit(e.below,depth+1);visit(e.otherwise,depth+1);return;
  }
 };
 visit(expression,1);
 // Narrow only after checking every recursive child of this trusted parser tree.
 return expression as E;
}
function discreteSize(value:unknown,maximum:number,message:string):void{
 const text=typeof value==='string'?value:JSON.stringify(value);
 if(text.length>maximum||new TextEncoder().encode(text).length>maximum)fail('BUDGET',message);
}
/** Source/text stage only. No evaluator, material binding or GL execution. */
export function compileDiscreteMeshMaterial(source:string):{ok:true;material:DiscreteMeshMaterialIR}|{ok:false;diagnostics:MeshMaterialDiagnostic[]}{
 try{
  const parsed=parseMaterialSource(source,false,false,false,true);
  const expression=trustedMaterialExpression<DiscreteMeshMaterialExpression>(parsed.expression,'discrete');
  const material:DiscreteMeshMaterialIR={format:'barocss-gpu-discrete-mesh-material',version:0,profile:'mesh-opaque-discrete-fragment-v0',...parsed,expression};
  discreteSize(material,2097152,'Discrete material IR exceeds2MiB');
  return{ok:true,material:freeze(ownSnapshot(material) as DiscreteMeshMaterialIR)};
 }catch(error){const e=error instanceof MeshMaterialError?error:new MeshMaterialError('SYNTAX','Discrete material compile failed');return{ok:false,diagnostics:freeze([{code:e.code,message:refusalText(e).slice(0,1024),start:e.start,end:e.end}])};}
}
export function validateDiscreteMeshMaterialIR(input:unknown):DiscreteMeshMaterialIR{
 const data=ownSnapshot(input,'discrete') as Partial<DiscreteMeshMaterialIR>;
 if(!data||typeof data!=='object'||typeof data.source!=='string')fail('IR','Discrete material IR source required');
 discreteSize(data,2097152,'Discrete material IR exceeds2MiB');
 const compiled=compileDiscreteMeshMaterial(data.source);
 if(!compiled.ok){const diagnostic=compiled.diagnostics[0];throw uvError('IR',diagnostic.message,diagnostic.start,diagnostic.end,diagnostic);}
 if(JSON.stringify(canonical(data))!==JSON.stringify(canonical(compiled.material)))fail('IR','Discrete material IR does not match its reconstructed source');
 return compiled.material;
}
export function lowerDiscreteMeshMaterial(input:unknown):LoweredDiscreteMeshMaterial{
 const result=lowerMaterial(validateDiscreteMeshMaterialIR(input));
 discreteSize(result.expression,65536,'Discrete material expression exceeds64KiB');
 discreteSize(result.uniformDeclarations,65536,'Discrete material declarations exceed64KiB');
 discreteSize(result,131072,'Discrete lowered material exceeds128KiB');
 return freeze(result);
}
/** Profile-specific reflection only. Local shape/work errors stay outside this catch. */
function reflectMaterialData(value:object,nativeReflection:boolean|'discrete'|'texture'):{array:boolean;proto:object|null;d:PropertyDescriptorMap;keys:(string|symbol)[]}{
 try{const array=Array.isArray(value),proto=Object.getPrototypeOf(value),d=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);return{array,proto,d,keys};}
 catch(cause){if(!nativeReflection)throw cause;if(nativeReflection==='discrete'||nativeReflection==='texture'){const error=uvError('INPUT',nativeReflection==='discrete'?'Discrete material own-data reflection refused':'Texture material own-data reflection refused');Object.defineProperty(error,'cause',{value:cause,writable:true,configurable:true});throw error;}throw uvError('INPUT','Native Surface material own-data reflection refused',0,0,cause);}
}
function ownSnapshot(input:unknown,nativeReflection:boolean|'discrete'|'texture'=false):unknown{let budget=8192;const active=new WeakSet<object>();const copy=(v:unknown,depth:number):unknown=>{if(--budget<0||depth>24)fail('BUDGET','Material own-data value/depth limit');if(typeof v==='number'){if(!Number.isFinite(v))fail('INPUT','Material data must be finite');return zero(v);}if(typeof v==='string'){if(v.length>65536)fail('BUDGET','Material string limit');return v;}if(typeof v==='boolean'||v===null)return v;if(!v||typeof v!=='object'||active.has(v))fail('INPUT','Material requires acyclic plain data');const{array,proto,d,keys}=reflectMaterialData(v,nativeReflection);if(array?proto!==Array.prototype:proto!==Object.prototype)fail('INPUT','Material foreign prototype');if(keys.length>(array?257:16)||keys.some(k=>typeof k!=='string'||nativeReflection==='texture'&&!Object.hasOwn(d,k)||!('value'in d[k])||(!array||k!=='length')&&!d[k].enumerable))fail('INPUT','Material getter/hidden/symbol/excess fields');active.add(v);let out:unknown;if(array){const n=d.length.value;if(!Number.isInteger(n)||n<0||n>256||keys.length!==n+1||Array.from({length:n},(_,i)=>!Object.hasOwn(d,String(i))).some(Boolean))fail('INPUT','Material requires dense bounded arrays');out=Array.from({length:n},(_,i)=>copy(d[String(i)].value,depth+1));}else out=Object.fromEntries((keys as string[]).map(k=>[k,copy(d[k].value,depth+1)]));active.delete(v);return out;};return copy(input,0);}
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
function sameCanonical(a:unknown,b:unknown,colorLinear=false):boolean{
 if(typeof a==='number'||typeof b==='number')return typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b)&&(colorLinear?Math.abs(a-b)<=1e-15:Object.is(a,b));
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>sameCanonical(value,b[index],colorLinear));
 if(a&&b&&typeof a==='object'&&typeof b==='object'){
  const ak=Object.keys(a).sort((x,y)=>x.localeCompare(y)),bk=Object.keys(b).sort((x,y)=>x.localeCompare(y));
  const ac=a as Record<string,unknown>,bc=b as Record<string,unknown>,linear=ac.kind==='color'&&bc.kind==='color';
  return ak.length===bk.length&&ak.every((key,index)=>key===bk[index]&&sameCanonical(ac[key],bc[key],linear&&key==='linear'));
 }
 return Object.is(a,b);
}
export function validateMeshMaterialIR(input:unknown):MeshMaterialIR{const data=ownSnapshot(input) as Partial<MeshMaterialIR>;if(!data||typeof data!=='object'||typeof data.source!=='string')fail('IR','Material IR source required');const compiled=compileMeshMaterial(data.source);if(!compiled.ok)throw new MeshMaterialError('IR',compiled.diagnostics[0].message);if(!sameCanonical(canonical(data),canonical(compiled.material)))fail('IR','Material IR does not match its reconstructed source');return compiled.material;}
function uvError(code:MeshMaterialCode,message:string,start=0,end=0,cause?:unknown):MeshMaterialError{
 const error=new MeshMaterialError(code,message.slice(0,1024),start,end);
 if(cause!==undefined)Object.defineProperty(error,'cause',{value:cause,writable:true,configurable:true});
 return error;
}
export function validateEngineUVMaterialIR(input:unknown):EngineUVMaterialIR{return validateUVSource(input,compileEngineUVMaterial);}
export function validateEngineUVRepeatingMaterialIR(input:unknown):EngineUVRepeatingMaterialIR{return validateUVSource(input,compileEngineUVRepeatingMaterial);}
export function validateNativeSurfaceUV01MaterialIR(input:unknown):NativeSurfaceUV01MaterialIR{return validateUVSource(input,compileNativeSurfaceUV01Material,true);}
function validateUVSource<M extends EngineUVMaterialIR|EngineUVRepeatingMaterialIR|NativeSurfaceUV01MaterialIR>(input:unknown,compile:(source:string)=>{ok:true;material:M}|{ok:false;diagnostics:MeshMaterialDiagnostic[]},nativeReflection=false):M{
 let data:Partial<M>;
 try{data=ownSnapshot(input,nativeReflection) as Partial<M>;}
 catch(cause){if(cause instanceof MeshMaterialError)throw cause;throw uvError('INPUT','UV material own-data reflection refused',0,0,cause);}
 if(!data||typeof data!=='object'||typeof data.source!=='string')throw uvError('IR','UV material IR source required');
 const compiled=compile(data.source);
 if(!compiled.ok){const diagnostic=freeze(compiled.diagnostics[0]);throw uvError('IR',diagnostic.message,diagnostic.start,diagnostic.end,diagnostic);}
 if(JSON.stringify(canonical(data))!==JSON.stringify(canonical(compiled.material)))throw uvError('IR','UV material IR does not match its reconstructed source');
 return compiled.material;
}
const glFloat=(n:number)=>n.toPrecision(17);
function lowerMaterial(material:ParsedMaterial):LoweredMeshMaterial{const uniformLayout=material.uniforms.map((u,i)=>({...u,glslName:'mat_u_'+i}));const expression=(e:ParsedMaterialExpression):string=>{switch(e.kind){case'float':return glFloat(e.value);case'color':return'vec3('+e.linear.map(glFloat).join(',')+')';case'uniform':return uniformLayout.find(u=>u.name===e.name)!.glslName;case'input':{switch(e.name){case'uv_u':return'v_engine_uv.x';case'uv_v':return'v_engine_uv.y';case'surface_u01':return'v_native_surface_uv01.x';case'surface_v01':return'v_native_surface_uv01.y';default:return fail('IR','Unsupported input name');}}case'sample':if(!material.samplers?.some(sampler=>sampler.name===e.sampler))fail('IR','Trusted sampler alias missing');return'decodeSRGB(texture(mat_s_0,clamp(vec2('+expression(e.u)+','+expression(e.v)+'),vec2(0.0),vec2(1.0))).rgb)';case'select':return'('+expression(e.value)+'<'+expression(e.threshold)+'?'+expression(e.below)+':'+expression(e.otherwise)+')';case'unary':return'('+e.operator+expression(e.value)+')';case'binary':return'('+expression(e.left)+e.operator+expression(e.right)+')';case'call':{const args=e.args.map(expression);if(e.name==='mix')args[2]='clamp('+args[2]+',0.0,1.0)';return e.name+'('+args.join(',')+')';}}};return{expression:'clamp('+expression(material.expression)+',vec3(0.0),vec3(1.0))',uniformDeclarations:uniformLayout.map(u=>'uniform float '+u.glslName+';').join('\n'),uniformLayout};}
export function lowerMeshMaterial(input:unknown):LoweredMeshMaterial{return lowerMaterial(validateMeshMaterialIR(input));}
export function lowerEngineUVMaterial(input:unknown):LoweredEngineUVMaterial{
 const result:LoweredEngineUVMaterial={...lowerMaterial(validateEngineUVMaterialIR(input)),inputDeclarations:'in vec2 v_engine_uv;'};
 return freeze(result);
}
export function lowerEngineUVRepeatingMaterial(input:unknown):LoweredEngineUVMaterial{
 const result:LoweredEngineUVMaterial={...lowerMaterial(validateEngineUVRepeatingMaterialIR(input)),inputDeclarations:'in vec2 v_engine_uv;'};
 return freeze(result);
}
export function lowerNativeSurfaceUV01Material(input:unknown):LoweredNativeSurfaceUV01Material{
 const result:LoweredNativeSurfaceUV01Material={...lowerMaterial(validateNativeSurfaceUV01MaterialIR(input)),inputDeclarations:'in vec2 v_native_surface_uv01;'};
 return freeze(result);
}
/** Internal catalog provider: distinct UV profile; no caller-supplied input values. */
export function validateEngineUVMaterialBinding(input:unknown):EngineUVMaterialBinding{return bindUVMaterial(input,validateEngineUVMaterialIR);}
export function validateEngineUVRepeatingMaterialBinding(input:unknown):EngineUVRepeatingMaterialBinding{return bindUVMaterial(input,validateEngineUVRepeatingMaterialIR);}
function bindUVMaterial<M extends EngineUVMaterialIR|EngineUVRepeatingMaterialIR>(input:unknown,validate:(input:unknown)=>M):{material:M;uniforms:Record<string,number>}{
 let data:Record<string,unknown>;
 try{data=ownSnapshot(input) as Record<string,unknown>;}
 catch(cause){if(cause instanceof MeshMaterialError)throw cause;throw uvError('INPUT','UV material binding own-data reflection refused',0,0,cause);}
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==2||!Object.hasOwn(data,'material')||!Object.hasOwn(data,'uniforms'))throw uvError('INPUT','UV material binding requires material/uniforms');
 const material=validate(data.material),values=data.uniforms;
 if(!values||typeof values!=='object'||Array.isArray(values))throw uvError('UNIFORM','Uniform values require own record');
 const entries=Object.entries(values);
 if(entries.length>16||entries.some(([name])=>!material.uniforms.some(u=>u.name===name)))throw uvError('UNIFORM','Unknown/excess uniform value');
 const uniforms=Object.fromEntries(material.uniforms.map(u=>{
  const n=Object.hasOwn(values,u.name)?(values as Record<string,unknown>)[u.name]:u.default;
  if(typeof n!=='number'||!Number.isFinite(n)||n<u.min||n>u.max)throw uvError('UNIFORM','Uniform '+u.name+' outside its finite declared range');
  return[u.name,zero(n)];
 }));
 return freeze({material,uniforms});
}
export function validateMeshMaterialBinding(input:unknown):MeshMaterialBinding{
 const data=ownSnapshot(input) as Record<string,unknown>;if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==2||!Object.hasOwn(data,'material')||!Object.hasOwn(data,'uniforms'))fail('INPUT','Material binding requires material/uniforms');const material=validateMeshMaterialIR(data.material),values=data.uniforms;if(!values||typeof values!=='object'||Array.isArray(values))fail('UNIFORM','Uniform values require own record');const entries=Object.entries(values);if(entries.length>16||entries.some(([name])=>!material.uniforms.some(u=>u.name===name)))fail('UNIFORM','Unknown/excess uniform value');const uniforms:Record<string,number>={};for(const u of material.uniforms){const n=Object.hasOwn(values,u.name)?(values as Record<string,unknown>)[u.name]:u.default;if(typeof n!=='number'||!Number.isFinite(n)||n<u.min||n>u.max)fail('UNIFORM','Uniform '+u.name+' outside its finite declared range');uniforms[u.name]=zero(n);}return freeze({material,uniforms});
}

/** Original-source compiler only; resource joining and actual sampling are separate. */
export function compileEngineUVTextureMaterial(source:string):{ok:true;material:EngineUVTextureMaterialIR}|{ok:false;diagnostics:MeshMaterialDiagnostic[]}{
 try{
  const parsed=parseMaterialSource(source,true,false,false,false,true);
  const material:EngineUVTextureMaterialIR={format:'barocss-gpu-engine-uv-texture-material',version:0,profile:'engine-opaque-uv-texture-fragment-v0',
   source:parsed.source,shaderId:parsed.shaderId,uniforms:parsed.uniforms,samplers:parsed.samplers!,
   expression:trustedMaterialExpression<EngineUVTextureMaterialExpression>(parsed.expression,'texture')};
  discreteSize(material,2097152,'Texture material IR exceeds2MiB');
  return{ok:true,material:freeze(ownSnapshot(material,'texture') as EngineUVTextureMaterialIR)};
 }catch(error){const e=error instanceof MeshMaterialError?error:new MeshMaterialError('SYNTAX','Texture material compile failed');return{ok:false,diagnostics:freeze([{code:e.code,message:refusalText(e).slice(0,1024),start:e.start,end:e.end}])};}
}
export function validateEngineUVTextureMaterialIR(input:unknown):EngineUVTextureMaterialIR{
 const data=ownSnapshot(input,'texture') as Partial<EngineUVTextureMaterialIR>;
 if(!data||typeof data!=='object'||typeof data.source!=='string')fail('IR','Texture material IR source required');
 discreteSize(data,2097152,'Texture material IR exceeds2MiB');
 const compiled=compileEngineUVTextureMaterial(data.source);
 if(!compiled.ok){const diagnostic=compiled.diagnostics[0];throw uvError('IR',diagnostic.message,diagnostic.start,diagnostic.end,diagnostic);}
 if(JSON.stringify(canonical(data))!==JSON.stringify(canonical(compiled.material)))fail('IR','Texture material IR does not match its reconstructed source');
 return compiled.material;
}
export function lowerEngineUVTextureMaterial(input:unknown):LoweredEngineUVTextureMaterial{
 const material=validateEngineUVTextureMaterialIR(input);
 const result:LoweredEngineUVTextureMaterial={...lowerMaterial(material),inputDeclarations:'in vec2 v_engine_uv;',
  samplerDeclarations:'uniform highp sampler2D mat_s_0;',
  samplerLayout:material.samplers.map(sampler=>({...sampler,glslName:'mat_s_0',colorSpace:'srgb',rowOrigin:'bottom-left',filter:'nearest',wrapS:'clamp-to-edge',wrapT:'clamp-to-edge'})),
  samplingHelpers:engineUVTextureSamplingHelpers};
 for(const field of [result.expression,result.uniformDeclarations,result.samplerDeclarations,result.samplingHelpers])discreteSize(field,65536,'Texture material text field exceeds64KiB');
 discreteSize(result,131072,'Texture lowered material exceeds128KiB');
 return freeze(result);
}
