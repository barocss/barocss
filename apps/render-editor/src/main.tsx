import { createRoot } from 'react-dom/client';
import { App } from './app';
import '@barocss/render-editor/style.css';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Render Editor root is missing');
createRoot(root).render(<App />);
