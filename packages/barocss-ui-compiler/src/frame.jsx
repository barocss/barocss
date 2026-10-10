import React from 'react';
import { createRoot } from 'react-dom/client';
import GeneratedUi from '@barocss/ui-compiler/generated';

const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content;
const hostOrigin = meta('host-origin');
const instanceId = meta('instance-id');
const bundleDigest = meta('bundle-digest');
if (!hostOrigin || new URL(hostOrigin).origin !== hostOrigin
  || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(instanceId ?? '')
  || !/^[0-9a-f]{64}$/.test(bundleDigest ?? '')) throw new Error('Invalid frame identity');
const app = document.getElementById('app');
if (!app) throw new Error('Missing frame root');
const root = createRoot(app);
let initialized = false;
let canSave = false;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const validState = (state) => exact(state, ['name', 'count']) && typeof state.name === 'string'
  && state.name.length <= 80 && Number.isInteger(state.count) && state.count >= 0 && state.count <= 1000;
const send = (type, state) => window.parent.postMessage({ type, instanceId, bundleDigest,
  ...(state ? { state: { name: state.name, count: state.count } } : {}) }, hostOrigin);
const onState = (state) => { if (initialized && validState(state)) send('state', state); };
const onSave = (state) => { if (initialized && canSave && validState(state)) send('save', state); };
window.addEventListener('message', (event) => {
  const message = event.data;
  if (event.source !== window.parent || event.origin !== hostOrigin
    || !exact(message, ['type', 'instanceId', 'bundleDigest', 'initialState', 'canSave'])
    || message.type !== 'init' || message.instanceId !== instanceId || message.bundleDigest !== bundleDigest
    || typeof message.canSave !== 'boolean' || !validState(message.initialState)) return;
  initialized = true;
  canSave = message.canSave;
  root.render(<GeneratedUi initialState={{ ...message.initialState }} canSave={canSave} onState={onState} onSave={onSave} />);
});
send('ready');
