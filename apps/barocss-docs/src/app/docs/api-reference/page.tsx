import DocsLayout from '@/components/DocsLayout'

export default function ApiReference() {
  return (
    <DocsLayout>
        <div className="prose prose-lg max-w-none">
          <h1>API Reference</h1>
          
          <h2 id="core-functions">Core Functions</h2>
          
          <h3>createContext(config)</h3>
          <p>Creates a BAROCSS context with the provided configuration.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createContext } from 'barocss'

const ctx = createContext({
  theme: {
    colors: { primary: '#3b82f6' },
    spacing: { sm: '0.5rem' },
  },
  plugins: [/* your plugins */],
})`}</code></pre>
          </div>

          <h3>parseClassToAst(classes, ctx)</h3>
          <p>Parses CSS class names into AST nodes.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { parseClassToAst } from 'barocss'

const ast = parseClassToAst('bg-primary p-sm', ctx)`}</code></pre>
          </div>

          <h3>astToCss(ast)</h3>
          <p>Converts AST nodes to CSS string.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { astToCss } from 'barocss'

const css = astToCss(ast)`}</code></pre>
          </div>

          <h2 id="ast-functions">AST Functions</h2>
          
          <h3>decl(property, value)</h3>
          <p>Creates a CSS declaration node.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { decl } from 'barocss'

const declaration = decl('background-color', '#3b82f6')`}</code></pre>
          </div>

          <h3>rule(selector, declarations)</h3>
          <p>Creates a CSS rule node.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { rule, decl } from 'barocss'

const cssRule = rule('.my-class', [
  decl('background-color', '#3b82f6'),
  decl('border-radius', '8px'),
])`}</code></pre>
          </div>

          <h3>atRule(name, content)</h3>
          <p>Creates an at-rule node (e.g., @media, @keyframes).</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { atRule, rule, decl } from 'barocss'

const mediaQuery = atRule('@media (min-width: 768px)', [
  rule('.responsive-class', [
    decl('font-size', '1.25rem'),
  ]),
])`}</code></pre>
          </div>

          <h3>atRoot(content)</h3>
          <p>Creates a root-level CSS node.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { atRoot, rule, decl } from 'barocss'

const rootStyles = atRoot([
  rule(':root', [
    decl('--primary-color', '#3b82f6'),
  ]),
])`}</code></pre>
          </div>

          <h2 id="plugin-system">Plugin System</h2>
          
          <h3>createUtilityPlugin(plugin)</h3>
          <p>Creates a utility plugin for registering custom CSS utilities.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createUtilityPlugin, staticUtility, decl } from 'barocss'

const plugin = createUtilityPlugin({
  name: 'my-plugin',
  version: '1.0.0',
  utilities: (ctx) => {
    staticUtility('custom-bg', [
      decl('background-color', 'var(--custom-color)'),
    ])
  },
})`}</code></pre>
          </div>

          <h3>createVariantPlugin(plugin)</h3>
          <p>Creates a variant plugin for registering custom variants and modifiers.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createVariantPlugin, staticModifier } from 'barocss'

const plugin = createVariantPlugin({
  name: 'my-variants',
  version: '1.0.0',
  variants: (ctx) => {
    staticModifier('custom-hover', '&:hover')
  },
})`}</code></pre>
          </div>

          <h3>createThemePlugin(plugin)</h3>
          <p>Creates a theme plugin for extending the theme with custom values.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { createThemePlugin } from 'barocss'

const plugin = createThemePlugin({
  name: 'my-theme',
  version: '1.0.0',
  theme: (ctx) => ({
    colors: {
      brand: '#3b82f6',
    },
  }),
})`}</code></pre>
          </div>

          <h2 id="registry-functions">Registry Functions</h2>
          
          <h3>staticUtility(name, declarations)</h3>
          <p>Registers a static utility with exact class name matching.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { staticUtility, decl } from 'barocss'

staticUtility('custom-bg', [
  decl('background-color', 'var(--custom-color)'),
  decl('border-radius', '8px'),
])`}</code></pre>
          </div>

          <h3>functionalUtility(prefix, generator)</h3>
          <p>Registers a functional utility with dynamic value processing.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { functionalUtility, decl } from 'barocss'

functionalUtility('custom-spacing', (value) => [
  decl('padding', \`\${value}rem\`),
  decl('margin', \`\${value}rem\`),
])`}</code></pre>
          </div>

          <h3>staticModifier(name, selector)</h3>
          <p>Registers a static CSS modifier.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { staticModifier } from 'barocss'

staticModifier('custom-hover', '&:hover')`}</code></pre>
          </div>

          <h3>functionalModifier(name, generator)</h3>
          <p>Registers a functional CSS modifier with custom logic.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import { functionalModifier } from 'barocss'

functionalModifier('custom-responsive', (selector, breakpoint) => {
  return \`@media (min-width: \${breakpoint}px) { \${selector} }\`
})`}</code></pre>
          </div>

          <h2 id="context-api">Context API</h2>
          
          <h3>ctx.theme(category, key?)</h3>
          <p>Accesses theme values with dot-path support.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`// Get specific value
const color = ctx.theme('colors', 'primary')

// Get entire category
const colors = ctx.theme('colors')

// Dynamic access
const customColor = ctx.theme('colors', 'custom-blue')`}</code></pre>
          </div>

          <h3>ctx.extendTheme(category, values)</h3>
          <p>Safely extends theme categories with new values.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`// Extend with object
ctx.extendTheme('colors', {
  brand: '#3b82f6',
  accent: '#f59e0b',
})

// Extend with function
ctx.extendTheme('spacing', (theme) => ({
  'custom-sm': '0.25rem',
  'custom-md': '0.5rem',
}))`}</code></pre>
          </div>

          <h3>ctx.config(key?)</h3>
          <p>Accesses configuration values.</p>
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`// Get specific config
const value = ctx.config('customValue')

// Get entire config
const config = ctx.config()`}</code></pre>
          </div>

          <h2 id="types">Types</h2>
          
          <div className="bg-gray-900 text-white p-4 rounded-lg overflow-x-auto">
            <pre><code>{`import type {
  BarocssContext,
  BarocssPlugin,
  UtilityPlugin,
  VariantPlugin,
  ThemePlugin,
  BarocssConfig,
  ThemeGetter,
} from 'barocss'`}</code></pre>
          </div>

          <h2>Next Steps</h2>
          
          <ul>
            <li><a href="/docs/examples">Examples</a> - See these APIs in action</li>
            <li><a href="/docs/plugin-system">Plugin System</a> - Learn plugin development</li>
            <li><a href="/docs/core-concepts">Core Concepts</a> - Understand the fundamentals</li>
          </ul>
      </div>
    </DocsLayout>
  )
} 