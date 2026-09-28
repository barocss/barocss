const frames = () => [document.getElementById('prototype'), document.getElementById('official')];
const output = document.getElementById('errors');
const editor = document.getElementById('spec');
function apply() {
  let spec;
  try { spec = JSON.parse(editor.value); }
  catch (error) { output.textContent = `JSON: ${error.message}`; return; }
  const results = frames().map((frame) => frame.contentWindow.COMPARE.update(spec));
  output.textContent = results.every((result) => result.ok) ? 'Both screens updated.'
    : results.map((result, index) => result.errors.map((error) =>
      `${index ? 'json-render' : 'prototype'} ${error.path}: ${error.message}`).join('\n')).filter(Boolean).join('\n');
}
window.addEventListener('load', () => {
  editor.value = JSON.stringify(frames()[0].contentWindow.COMPARE.initialSpec(), null, 2);
  document.getElementById('edit').onclick = () => {
    editor.value = JSON.stringify(frames()[0].contentWindow.COMPARE.editedSpec(), null, 2);
    apply();
  };
  document.getElementById('reset').onclick = () => {
    editor.value = JSON.stringify(frames()[0].contentWindow.COMPARE.initialSpec(), null, 2);
    apply();
  };
  document.getElementById('apply').onclick = apply;
  fetch('/capture.json').then(async (response) => {
    if (!response.ok) return;
    const capture = await response.json();
    document.getElementById('capture').hidden = false;
    document.getElementById('capture').onclick = () => {
      editor.value = JSON.stringify(capture, null, 2);
      apply();
    };
  }).catch(() => {});
});
