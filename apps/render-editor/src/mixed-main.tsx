import { createRoot } from 'react-dom/client';
import { MixedApp } from './mixed-app';
import '@barocss/render-editor/style.css';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('Mixed Editor root is missing');
createRoot(root).render(<MixedApp />);
