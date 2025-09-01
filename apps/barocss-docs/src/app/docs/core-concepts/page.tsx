import DocsLayout from '@/components/DocsLayout'

export default function CoreConcepts() {
  return (
    <DocsLayout>
        <div className="prose prose-lg max-w-none">
          <h1>Core Concepts</h1>
          
          <p>
            Barocss is built around several core concepts that work together to provide 
            a powerful and flexible CSS-in-JS solution.
          </p>

          <h2 id="context">Context</h2>
          
          <p>
            The <code>createContext</code> function creates a context that holds your theme, 
            configuration, and plugin system. This context is used throughout BAROCSS for 
            theme resolution and plugin execution.
          </p>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createContext } from 'barocss'

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
  plugins: [/* your plugins */],
})`}</code></pre>
          </div>

          <h2>Theme System</h2>
          
                      <p>
              BAROCSS&apos;s theme system provides a centralized way to manage design tokens. 
              Themes can be extended with plugins and accessed via the <code>themeGetter</code> function.
            </p>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`// Access theme values
const primaryColor = ctx.theme('colors', 'primary')
const spacingMd = ctx.theme('spacing', 'md')

// Dynamic theme access
const customColor = ctx.theme('colors', 'custom-blue')
const fontSize = ctx.theme('fontSize', 'lg')`}</code></pre>
          </div>

          <h2 id="ast">AST (Abstract Syntax Tree)</h2>
          
          <p>
            BAROCSS uses AST nodes to represent CSS. This allows for precise control over 
            CSS generation and enables advanced features like optimization and transformation.
          </p>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { decl, rule, atRule, atRoot } from 'barocss'

// CSS Declaration
const declaration = decl('background-color', '#3b82f6')

// CSS Rule
const cssRule = rule('.my-class', [
  decl('background-color', '#3b82f6'),
  decl('border-radius', '8px'),
])

// At-Rule (media query)
const mediaQuery = atRule('@media (min-width: 768px)', [
  rule('.responsive-class', [
    decl('font-size', '1.25rem'),
  ]),
])

// Root-level CSS
const rootStyles = atRoot([
  rule(':root', [
    decl('--primary-color', '#3b82f6'),
  ]),
])`}</code></pre>
          </div>

          <h2>Plugin System</h2>
          
          <p>
            The plugin system allows you to extend BAROCSS with custom utilities, variants, 
            and theme extensions. Plugins are executed during context creation and can 
            register new functionality.
          </p>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createUtilityPlugin, staticUtility, decl } from 'barocss'

const customPlugin = createUtilityPlugin({
  name: 'custom-plugin',
  version: '1.0.0',
  utilities: (ctx) => {
    staticUtility('custom-bg', [
      decl('background-color', 'var(--custom-color)'),
      decl('border-radius', '8px'),
    ])
  },
})

const ctx = createContext({
  plugins: [customPlugin],
})`}</code></pre>
          </div>

          <h2 id="parsing">Parsing and Generation</h2>
          
          <p>
            BAROCSS parses CSS class names into AST nodes and then generates CSS from those nodes. 
            This two-step process allows for optimization and transformation.
          </p>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { parseClassToAst, astToCss } from 'barocss'

// Parse class names to AST
const ast = parseClassToAst('bg-primary p-md text-white', ctx)

// Generate CSS from AST
const css = astToCss(ast)

// Result: CSS string with resolved theme values
console.log(css)`}</code></pre>
          </div>

          <h2>Type Safety</h2>
          
          <p>
            BAROCSS provides comprehensive TypeScript support with detailed type definitions 
            for all APIs, including plugin interfaces and AST nodes.
          </p>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import type { BarocssContext, BarocssPlugin, UtilityPlugin } from 'barocss'

// Type-safe context creation
const ctx: BarocssContext = createContext({
  theme: {
    colors: {
      primary: '#3b82f6',
    },
  },
})

// Type-safe plugin creation
const plugin: UtilityPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  utilities: (ctx: BarocssContext) => {
    // TypeScript will provide IntelliSense here
  },
}`}</code></pre>
          </div>

          <h2>Performance</h2>
          
          <p>
            BAROCSS is designed for performance with intelligent caching, AST optimization, 
            and efficient theme resolution. The framework minimizes runtime overhead while 
            providing powerful features.
          </p>

          <h2>Next Steps</h2>
          
          <ul>
            <li><a href="/docs/plugin-system">Plugin System</a> - Learn how to extend BAROCSS</li>
            <li><a href="/docs/api-reference">API Reference</a> - Complete API documentation</li>
            <li><a href="/docs/examples">Examples</a> - See these concepts in action</li>
          </ul>
      </div>
    </DocsLayout>
  )
} 