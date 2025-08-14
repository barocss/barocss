import DocsLayout from '@/components/DocsLayout'
import CodeBlock from '@/components/CodeBlock'

export default function Installation() {
  return (
    <DocsLayout>
      <div className="prose prose-lg max-w-none">
        <h1>Installation</h1>
        
        <h2>Package Manager</h2>
        
        <p>CSSMA v4 is available via npm, yarn, and pnpm:</p>
        
        <CodeBlock language="bash">
{`# Using pnpm (recommended)
pnpm add cssma@latest

# Using npm
npm install cssma@latest

# Using yarn
yarn add cssma@latest`}
        </CodeBlock>

        <h2>TypeScript Support</h2>
        
        <p>CSSMA v4 includes full TypeScript support out of the box. No additional type packages are required.</p>

        <h2>Basic Setup</h2>
        
        <p>After installation, you can start using CSSMA immediately:</p>
        
        <CodeBlock language="typescript" filename="setup.ts">
{`import { createContext, parseClassToAst, astToCss } from 'cssma'

// Create a context with your configuration
const ctx = createContext({
  theme: {
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
    },
    spacing: {
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
    },
  },
})

// Parse CSS classes to AST
const ast = parseClassToAst('bg-primary p-md text-white', ctx)

// Convert AST to CSS
const css = astToCss(ast)
console.log(css)`}
        </CodeBlock>

        <h2>Framework Integration</h2>
        
        <h3>React</h3>
        
        <p>For React applications, you can use CSSMA with CSS-in-JS libraries:</p>
        
        <CodeBlock language="typescript" filename="react-example.tsx">
{`import { createContext, parseClassToAst, astToCss } from 'cssma'

const ctx = createContext({
  theme: {
    colors: {
      primary: '#3b82f6',
    },
  },
})

function MyComponent() {
  const className = 'bg-primary p-4 text-white'
  const ast = parseClassToAst(className, ctx)
  const css = astToCss(ast)
  
  return (
    <div style={{ ...css }}>
      Hello CSSMA!
    </div>
  )
}`}
        </CodeBlock>

        <h3>Next.js</h3>
        
        <p>For Next.js applications, you can integrate CSSMA with your build process:</p>
        
        <CodeBlock language="javascript" filename="next.config.js">
{`// next.config.js
const { createContext, parseClassToAst, astToCss } = require('cssma')

const ctx = createContext({
  theme: {
    colors: {
      primary: '#3b82f6',
    },
  },
})

module.exports = {
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add CSSMA processing to your build
    config.module.rules.push({
      test: /\\.css$/,
      use: [
        {
          loader: 'css-loader',
          options: {
            // Process CSS with CSSMA
            process: (css) => {
              const ast = parseClassToAst(css, ctx)
              return astToCss(ast)
            },
          },
        },
      ],
    })
    
    return config
  },
}`}
        </CodeBlock>

        <h2>Plugin Installation</h2>
        
        <p>To use plugins, simply add them to your context configuration:</p>
        
        <CodeBlock language="typescript" filename="plugin-setup.ts">
{`import { createContext } from 'cssma'
import { createUtilityPlugin, staticUtility, decl } from 'cssma'

// Create a custom plugin
const customPlugin = createUtilityPlugin({
  name: 'custom-plugin',
  version: '1.0.0',
  utilities: (ctx) => {
    staticUtility('custom-bg', [
      decl('background-color', 'var(--custom-color)'),
    ])
  },
})

// Use the plugin in your context
const ctx = createContext({
  theme: {
    colors: {
      primary: '#3b82f6',
    },
  },
  plugins: [customPlugin],
})`}
        </CodeBlock>

        <h2>Development Tools</h2>
        
        <p>For better development experience, consider installing these additional tools:</p>
        
        <CodeBlock language="bash">
{`# For better IntelliSense support
pnpm add -D @types/node

# For testing
pnpm add -D vitest @vitest/ui

# For linting
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin`}
        </CodeBlock>

        <h2>Next Steps</h2>
        
        <ul>
          <li><a href="/docs/getting-started">Getting Started</a> - Learn the basics</li>
          <li><a href="/docs/core-concepts">Core Concepts</a> - Understand CSSMA fundamentals</li>
          <li><a href="/docs/plugin-system">Plugin System</a> - Extend CSSMA with plugins</li>
          <li><a href="/docs/examples">Examples</a> - See real-world usage</li>
        </ul>
      </div>
    </DocsLayout>
  )
} 