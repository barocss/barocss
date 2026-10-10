import {createRoot} from 'react-dom/client';
import {MaterialApp} from './material-app';
import '@barocss/render-editor/style.css';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Material Editor root is missing');
createRoot(root).render(<MaterialApp />);
