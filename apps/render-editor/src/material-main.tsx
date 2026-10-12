import {createRoot} from 'react-dom/client';
import {lazy, Suspense} from 'react';
import {MaterialApp} from './material-app';
import '@barocss/render-editor/style.css';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Material Editor root is missing');
const DirectionalLights = lazy(() => import('./native-directional-light-workbench').then(module => ({default: module.NativeDirectionalLightWorkbench})));
const lights = new URLSearchParams(window.location.search).get('workbench') === 'directional-lights';
createRoot(root).render(lights ? <Suspense fallback={<p>Opening directional lights…</p>}><DirectionalLights/></Suspense> : <MaterialApp />);
