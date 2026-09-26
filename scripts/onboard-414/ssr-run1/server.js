import http from 'node:http';
import { ServerRuntime, ssrStyleTag } from '@barocss/server';

const PORT = 8241;

const serverRuntime = new ServerRuntime();

const cardClasses = 'bg-white rounded-lg shadow-md p-6 max-w-sm mx-auto mt-10';
const headingClasses = 'text-xl font-bold text-gray-900 mb-2';
const paraClasses = 'text-gray-600 mb-4';
const buttonClasses = 'bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded';

const allClasses = [cardClasses, headingClasses, paraClasses, buttonClasses].join(' ');
const css = serverRuntime.generateCss(allClasses);

function renderPage() {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>BaroCSS SSR Demo</title>
    ${ssrStyleTag(css)}
  </head>
  <body>
    <div class="${cardClasses}" id="card">
      <h1 class="${headingClasses}" id="heading">Welcome to BaroCSS</h1>
      <p class="${paraClasses}" id="para">This card is fully styled on first paint via SSR-inlined CSS.</p>
      <button class="${buttonClasses}" id="btn">Click me</button>
    </div>
  </body>
</html>`;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(renderPage());
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
