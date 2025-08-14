import DocsLayout from '@/components/DocsLayout'

export default function Examples() {
  return (
    <DocsLayout>
        <div className="prose prose-lg max-w-none">
          <h1>Examples</h1>
          
          <p>
            Here are some practical examples of how to use CSSMA v4 in real-world scenarios.
          </p>

          <h2 id="basic-usage">Basic Usage</h2>
          
          <h3>Simple Component Styling</h3>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createContext, parseClassToAst, astToCss } from 'cssma'

const ctx = createContext({
  theme: {
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
      success: '#10b981',
      danger: '#ef4444',
    },
    spacing: {
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
    },
  },
})

function Button({ variant = 'primary', size = 'md', children }) {
  const baseClasses = 'rounded font-medium transition-colors'
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary/90',
    secondary: 'bg-secondary text-white hover:bg-secondary/90',
    success: 'bg-success text-white hover:bg-success/90',
    danger: 'bg-danger text-white hover:bg-danger/90',
  }
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  }
  
  const className = \`\${baseClasses} \${variantClasses[variant]} \${sizeClasses[size]}\`
  const ast = parseClassToAst(className, ctx)
  const css = astToCss(ast)
  
  return (
    <button style={{ ...css }}>
      {children}
    </button>
  )
}`}</code></pre>
          </div>

          <h2 id="plugin-examples">Plugin Examples</h2>
          
          <h3>Custom Animation Plugin</h3>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createUtilityPlugin, staticUtility, functionalUtility, decl, rule, atRule } from 'cssma'

const animationPlugin = createUtilityPlugin({
  name: 'animation-plugin',
  version: '1.0.0',
  utilities: (ctx) => {
    // Static animation utilities
    staticUtility('animate-fade-in', [
      decl('animation', 'fadeIn 0.5s ease-in-out'),
    ])
    
    staticUtility('animate-slide-up', [
      decl('animation', 'slideUp 0.3s ease-out'),
    ])
    
    // Functional animation utilities
    functionalUtility('animate-duration', (duration) => [
      decl('animation-duration', \`\${duration}ms\`),
    ])
    
    functionalUtility('animate-delay', (delay) => [
      decl('animation-delay', \`\${delay}ms\`),
    ])
  },
  theme: (ctx) => ({
    keyframes: {
      fadeIn: {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
      slideUp: {
        '0%': { transform: 'translateY(20px)', opacity: '0' },
        '100%': { transform: 'translateY(0)', opacity: '1' },
      },
    },
  }),
})

const ctx = createContext({
  plugins: [animationPlugin],
})`}</code></pre>
          </div>

          <h3>Responsive Grid Plugin</h3>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createUtilityPlugin, functionalUtility, decl, rule, atRule } from 'cssma'

const gridPlugin = createUtilityPlugin({
  name: 'grid-plugin',
  version: '1.0.0',
  utilities: (ctx) => {
    // Grid columns utility
    functionalUtility('grid-cols', (cols) => [
      decl('display', 'grid'),
      decl('grid-template-columns', \`repeat(\${cols}, minmax(0, 1fr))\`),
    ])
    
    // Grid gap utility
    functionalUtility('gap', (size) => [
      decl('gap', \`\${size}rem\`),
    ])
    
    // Responsive grid utilities
    functionalUtility('sm:grid-cols', (cols) => [
      atRule('@media (min-width: 640px)', [
        rule('&', [
          decl('grid-template-columns', \`repeat(\${cols}, minmax(0, 1fr))\`),
        ]),
      ]),
    ])
  },
})

const ctx = createContext({
  plugins: [gridPlugin],
})`}</code></pre>
          </div>

          <h2 id="advanced-examples">Advanced Examples</h2>
          
          <h3>Theme-Aware Component</h3>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createContext, parseClassToAst, astToCss } from 'cssma'

const ctx = createContext({
  theme: {
    colors: {
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        500: '#3b82f6',
        600: '#2563eb',
        900: '#1e3a8a',
      },
      gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        500: '#6b7280',
        900: '#111827',
      },
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
    borderRadius: {
      sm: '0.25rem',
      md: '0.375rem',
      lg: '0.5rem',
      full: '9999px',
    },
  },
})

function Card({ variant = 'default', padding = 'md', children }) {
  const variants = {
    default: 'bg-white border border-gray-200 shadow-sm',
    elevated: 'bg-white shadow-lg border-0',
    primary: 'bg-primary-50 border border-primary-200',
  }
  
  const paddings = {
    sm: 'p-sm',
    md: 'p-md',
    lg: 'p-lg',
    xl: 'p-xl',
  }
  
  const className = \`rounded-lg \${variants[variant]} \${paddings[padding]}\`
  const ast = parseClassToAst(className, ctx)
  const css = astToCss(ast)
  
  return (
    <div style={{ ...css }}>
      {children}
    </div>
  )
}`}</code></pre>
          </div>

          <h3>Complex Layout System</h3>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createContext, parseClassToAst, astToCss } from 'cssma'

const layoutPlugin = createUtilityPlugin({
  name: 'layout-plugin',
  version: '1.0.0',
  utilities: (ctx) => {
    // Flexbox utilities
    staticUtility('flex', [decl('display', 'flex')])
    staticUtility('flex-col', [
      decl('display', 'flex'),
      decl('flex-direction', 'column'),
    ])
    staticUtility('items-center', [decl('align-items', 'center')])
    staticUtility('justify-center', [decl('justify-content', 'center')])
    staticUtility('justify-between', [decl('justify-content', 'space-between')])
    
    // Spacing utilities
    functionalUtility('space-x', (size) => [
      rule('& > * + *', [
        decl('margin-left', \`\${size}rem\`),
      ]),
    ])
    
    functionalUtility('space-y', (size) => [
      rule('& > * + *', [
        decl('margin-top', \`\${size}rem\`),
      ]),
    ])
  },
})

const ctx = createContext({
  plugins: [layoutPlugin],
  theme: {
    spacing: {
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
    },
  },
})

function Layout({ children }) {
  const className = 'flex flex-col items-center justify-center space-y-lg p-lg'
  const ast = parseClassToAst(className, ctx)
  const css = astToCss(ast)
  
  return (
    <div style={{ ...css }}>
      {children}
    </div>
  )
}`}</code></pre>
          </div>

          <h2 id="integration-examples">Integration Examples</h2>
          
          <h3>React Hook</h3>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { useMemo } from 'react'
import { createContext, parseClassToAst, astToCss } from 'cssma'

// Create a React hook for CSSMA
function useCssma(config) {
  const ctx = useMemo(() => createContext(config), [config])
  
  const css = useMemo((className) => {
    const ast = parseClassToAst(className, ctx)
    return astToCss(ast)
  }, [ctx])
  
  return { css, ctx }
}

// Usage in component
function MyComponent() {
  const { css } = useCssma({
    theme: {
      colors: {
        primary: '#3b82f6',
      },
    },
  })
  
  const buttonStyles = css('bg-primary text-white px-4 py-2 rounded')
  
  return (
    <button style={{ ...buttonStyles }}>
      Click me
    </button>
  )
}`}</code></pre>
          </div>

          <h3>Next.js Integration</h3>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`// pages/_app.js
import { createContext } from 'cssma'

const ctx = createContext({
  theme: {
    colors: {
      primary: '#3b82f6',
    },
  },
})

// Make context available globally
if (typeof window !== 'undefined') {
  window.__CSSMA_CTX__ = ctx
}

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />
}

export default MyApp

// Usage in any component
function MyPage() {
  const ctx = typeof window !== 'undefined' ? window.__CSSMA_CTX__ : null
  
  if (!ctx) return <div>Loading...</div>
  
  const ast = parseClassToAst('bg-primary text-white p-4', ctx)
  const css = astToCss(ast)
  
  return (
    <div style={{ ...css }}>
      Hello CSSMA!
    </div>
  )
}`}</code></pre>
          </div>

          <h2>Next Steps</h2>
          
          <ul>
            <li><a href="/docs/plugin-system">Plugin System</a> - Learn to create custom plugins</li>
            <li><a href="/docs/api-reference">API Reference</a> - Complete API documentation</li>
            <li><a href="/docs/core-concepts">Core Concepts</a> - Understand the fundamentals</li>
          </ul>
      </div>
    </DocsLayout>
  )
} 