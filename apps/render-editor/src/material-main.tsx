import {createRoot} from 'react-dom/client';
import {lazy, Suspense} from 'react';
import {MaterialApp} from './material-app';
import '@barocss/render-editor/style.css';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Material Editor root is missing');
const DirectionalLights = lazy(() => import('./native-directional-light-workbench').then(module => ({default: module.NativeDirectionalLightWorkbench})));
const LightWorkbench = lazy(() => import('./native-light-workbench').then(module => ({default: module.NativeLightWorkbench})));
const route = new URLSearchParams(window.location.search).get('workbench');
const lights = route === 'directional-lights';
createRoot(root).render(route === 'lights' ? <Suspense fallback={<p>Opening light workbench…</p>}><LightWorkbench/></Suspense> : lights ? <Suspense fallback={<p>Opening directional lights…</p>}><DirectionalLights/></Suspense> : <MaterialApp />);
