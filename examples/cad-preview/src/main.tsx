import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {EditorApp} from './components/editor-app';
import {EditorController} from './editor-controller';
import './styles.css';
const controller=new EditorController();
Object.assign(window,{baroCadEditor:controller});
createRoot(document.getElementById('root')!).render(<StrictMode><EditorApp controller={controller}/></StrictMode>);
