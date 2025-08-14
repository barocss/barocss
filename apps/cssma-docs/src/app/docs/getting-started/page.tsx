import DocsLayout from '@/components/DocsLayout'
import CodeBlock from '@/components/CodeBlock'

export default function GettingStarted() {
  return (
    <DocsLayout>
      <div className="prose prose-lg max-w-none">
        <h1>Getting Started</h1>
        
        <p>
          CSSMA v4 is a revolutionary real-time CSS utility engine that generates styles instantly when DOM classes are detected. 
          Unlike traditional CSS frameworks that require build steps, CSSMA works at runtime - 
          just add classes to your DOM and watch the magic happen.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>🚀 Key Difference:</strong> While Tailwind CSS requires build-time compilation, 
                CSSMA generates CSS in real-time as your DOM changes. Arbitrary values like <code>w-[423px]</code> 
                and <code>bg-[#ff6b6b]</code> work instantly without any build step.
              </p>
            </div>
          </div>
        </div>

        <h2>Quick Start</h2>
        
        <p>Install CSSMA v4 in your project:</p>
        
        <CodeBlock language="bash">
{`pnpm add cssma@latest`}
        </CodeBlock>

        <h3>Initialize Real-time Engine</h3>
        
        <p>Initialize CSSMA to start real-time DOM monitoring:</p>
        
        <CodeBlock language="javascript" filename="main.js">
{`import { initCSSMA } from 'cssma'

// Initialize CSSMA with your theme
initCSSMA({
  theme: {
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
      danger: '#ef4444'
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem'
    }
  },
  // Optional: Configure real-time scanning
  scanInterval: 16, // 60fps DOM scanning (default)
  instantArbitrary: true // Enable instant arbitrary values (default)
})

// That's it! CSSMA is now watching your DOM for class changes`}
        </CodeBlock>

        <h3>Real-time Styling in Action</h3>
        
        <p>Now just add classes to your HTML - CSS generates automatically:</p>
        
        <CodeBlock language="html" filename="index.html">
{`<!-- Standard utilities work instantly -->
<div class="bg-primary p-lg rounded-lg shadow-md text-white">
  Real-time styling!
</div>

<!-- Arbitrary values work immediately - no build step! -->
<div class="w-[347px] h-[200px] bg-[#ff6b6b] text-[18px] p-[2.5rem]">
  Custom dimensions & colors
</div>

<!-- Complex layouts with arbitrary values -->
<div class="grid grid-cols-[200px_1fr_150px] gap-[clamp(1rem,3vw,2rem)]">
  <aside class="bg-[#f8fafc] border-r-[3px] border-[#e2e8f0]">
    Sidebar
  </aside>
  <main class="p-[1.5rem] bg-white">
    Content Area
  </main>
  <nav class="bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] text-white p-[1rem]">
    Navigation
  </nav>
</div>

<!-- Dynamic state changes -->
<button class="bg-primary hover:bg-[#2563eb] active:scale-[0.98] 
               transition-all duration-[200ms] px-[1.5rem] py-[0.75rem] 
               rounded-[8px] font-medium text-white shadow-lg 
               hover:shadow-[0_10px_25px_rgba(59,130,246,0.3)]">
  Interactive Button
</button>`}
        </CodeBlock>

        <div className="bg-green-50 border-l-4 border-green-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">
                <strong>⚡️ Performance:</strong> CSSMA generates CSS in under 1ms per class. 
                The DOM scanner runs at 60fps, detecting new classes instantly. 
                Styles are injected directly into the document head for immediate application.
              </p>
            </div>
          </div>
        </div>

        <h3>Real-time Plugin System</h3>
        
        <p>Extend CSSMA with custom utilities that work in real-time:</p>
        
        <CodeBlock language="javascript" filename="custom-plugin.js">
{`import { createUtilityPlugin, staticUtility, functionalUtility, decl } from 'cssma'

const customPlugin = createUtilityPlugin({
  name: 'custom-utilities',
  version: '1.0.0',
  utilities: (ctx) => {
    // Static utility - works instantly when class is detected
    staticUtility('glass-effect', [
      decl('background', 'rgba(255, 255, 255, 0.1)'),
      decl('backdrop-filter', 'blur(10px)'),
      decl('border', '1px solid rgba(255, 255, 255, 0.2)'),
      decl('border-radius', '12px'),
    ])
    
    // Functional utility - supports arbitrary values in real-time  
    functionalUtility('glow', (value) => [
      decl('box-shadow', \`0 0 \${value} currentColor\`),
      decl('filter', \`drop-shadow(0 0 \${value} currentColor)\`),
    ])
  },
})

// Initialize with custom plugin
initCSSMA({
  plugins: [customPlugin],
  theme: { /* your theme */ }
})

// Now use your custom utilities in real-time:
// <div class="glass-effect glow-[20px]">Custom styling!</div>`}
        </CodeBlock>

        <h2>Next Steps</h2>
        
        <ul>
          <li><a href="/docs/installation">Installation Guide</a> - Detailed setup instructions</li>
          <li><a href="/docs/core-concepts">Core Concepts</a> - Understanding real-time CSS generation</li>
          <li><a href="/docs/plugin-system">Plugin System</a> - Building real-time custom utilities</li>
          <li><a href="/docs/api-reference">API Reference</a> - Complete real-time API documentation</li>
          <li><a href="/docs/examples">Examples</a> - Real-world real-time styling examples</li>
        </ul>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>💡 Pro Tip:</strong> Try opening your browser's developer tools and watch the <code>&lt;style&gt;</code> 
                tags in the document head. As you add classes to DOM elements (even dynamically via JavaScript), 
                you'll see new CSS rules appear instantly - that's CSSMA's real-time engine at work!
              </p>
            </div>
          </div>
        </div>
      </div>
    </DocsLayout>
  )
} 