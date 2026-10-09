import { createRoot } from 'react-dom/client';
import { App } from './app';
import '@barocss/cad-editor/styles.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
