import {createCanvas2DApplication,type Canvas2DApplicationOptions,type SceneV25} from '../../../dist/index.js';
const scene:SceneV25={version:25,unit:'logical-px',contextId:'Initial',nodes:[]};
const options:Canvas2DApplicationOptions={contextId:'Initial',renderer:{logicalSize:{width:40,height:40},dpr:2},initialScene:scene};
const build=(canvas:HTMLCanvasElement)=>createCanvas2DApplication(canvas,options);
void build;
