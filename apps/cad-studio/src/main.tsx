import { Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { onBlockRender } from './devRenders';
import './styles.css';

// (R1c: the whole App's render time beside its blocks', DEV only — see devRenders.)
createRoot(document.getElementById('root')!).render(<Profiler id="app" onRender={onBlockRender}><App /></Profiler>);
