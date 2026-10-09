import { CLOTH_FIXTURE } from './fixture.mjs';
import { runTrial } from './trial.mjs';

const button = document.querySelector('button');
const status = document.querySelector('pre');
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    const { finalPositionsM, ...trial } = runTrial(CLOTH_FIXTURE, 'xpbd', 2, false, 8);
    const digest = await crypto.subtle.digest('SHA-256', finalPositionsM);
    const sha256 = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    const report = { ...trial, sha256, userAgent: navigator.userAgent,
      publicApi: false, viewerAcceptance: false, gpuTimeMeasured: false };
    const response = await fetch('/result', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report) });
    if (!response.ok) throw new Error('Failed to save browser evidence');
    window.clothDiscoveryState = report;
    status.textContent = JSON.stringify(report, null, 2);
  } catch (error) { status.textContent = String(error); window.clothDiscoveryError = String(error); }
  finally { button.disabled = false; }
});
