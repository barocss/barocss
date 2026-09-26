import http from 'node:http';
import { ServerRuntime, ssrStyleTag } from '@barocss/server';

const PORT = 8280;
const runtime = new ServerRuntime({
  cssVarPrefix: 'tw',
  theme: {
    extend: {
      colors: { brand: '#2563eb' },
      spacing: { gutter: '1.5rem' }
    }
  }
});

const pricingCardHtml = `
<div class="max-w-sm mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
  <h2 class="text-2xl font-bold text-gray-900 mb-2">Pro Plan</h2>
  <p class="text-gray-600 text-sm mb-6">Perfect for growing teams</p>
  
  <div class="mb-6">
    <span class="text-4xl font-bold text-gray-900">$99</span>
    <span class="text-gray-500 ml-2">/month</span>
  </div>
  
  <ul class="space-y-3 mb-6">
    <li class="flex items-center">
      <span class="text-green-500 mr-3 font-bold">✓</span>
      <span class="text-gray-700">Unlimited projects</span>
    </li>
    <li class="flex items-center">
      <span class="text-green-500 mr-3 font-bold">✓</span>
      <span class="text-gray-700">Priority support</span>
    </li>
    <li class="flex items-center">
      <span class="text-green-500 mr-3 font-bold">✓</span>
      <span class="text-gray-700">Advanced analytics</span>
    </li>
  </ul>
  
  <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
    Get Started
  </button>
</div>
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pricing - Pro Plan</title>
  ${ssrStyleTag(runtime.generateCssForHtml(pricingCardHtml))}
</head>
<body class="bg-gray-50">
  ${pricingCardHtml}
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
