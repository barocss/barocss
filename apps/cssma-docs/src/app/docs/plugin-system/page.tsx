import DocsLayout from '@/components/DocsLayout'
import CodeBlock from '@/components/CodeBlock'

export default function PluginSystem() {
  return (
    <DocsLayout>
        <div className="prose prose-lg max-w-none">
          <h1>Plugin System</h1>
          
          <p>
            CSSMA v4 features a powerful plugin system that allows you to extend the framework 
            with custom utilities, variants, and theme extensions. The plugin system is designed 
            for type safety, performance, and developer experience.
          </p>

          <h2>Plugin Types</h2>
          
          <p>CSSMA supports three main types of plugins:</p>
          
          <ul>
            <li><strong>Utility Plugins</strong> - Add custom CSS utilities</li>
            <li><strong>Variant Plugins</strong> - Create custom variants and modifiers</li>
            <li><strong>Theme Plugins</strong> - Extend theme with custom values</li>
          </ul>

          <h3 id="utility-plugins">Utility Plugins</h3>
          
          <p>Create custom utilities using AST functions:</p>
          
          <CodeBlock language="typescript" filename="utility-plugin.ts">
{`import { createUtilityPlugin, staticUtility, functionalUtility, decl, rule } from 'cssma'

const customUtilities = createUtilityPlugin({
  name: 'custom-utilities',
  version: '1.0.0',
  utilities: (ctx) => {
    // Static utility with exact class name
    staticUtility('custom-bg', [
      decl('background-color', 'var(--custom-color)'),
      decl('border-radius', '8px'),
    ])
    
    // Functional utility with dynamic values
    functionalUtility('custom-spacing', (value) => [
      decl('padding', \`\${value}rem\`),
      decl('margin', \`\${value}rem\`),
    ])
  },
})`}
          </CodeBlock>

          <h3 id="variant-plugins">Variant Plugins</h3>
          
          <p>Create custom variants and modifiers:</p>
          
          <CodeBlock language="typescript" filename="variant-plugin.ts">
{`import { createVariantPlugin, staticModifier, functionalModifier } from 'cssma'

const customVariants = createVariantPlugin({
  name: 'custom-variants',
  version: '1.0.0',
  variants: (ctx) => {
    // Static modifier
    staticModifier('custom-hover', '&:hover')
    
    // Functional modifier with custom logic
    functionalModifier('custom-responsive', (selector, breakpoint) => {
      return \`@media (min-width: \${breakpoint}px) { \${selector} }\`
    })
  },
})`}
          </CodeBlock>

          <h3 id="theme-plugins">Theme Plugins</h3>
          
          <p>Extend theme with custom values:</p>
          
          <CodeBlock language="typescript" filename="theme-plugin.ts">
{`import { createThemePlugin } from 'cssma'

const customTheme = createThemePlugin({
  name: 'custom-theme',
  version: '1.0.0',
  theme: (ctx) => ({
    colors: {
      brand: '#3b82f6',
      accent: '#f59e0b',
    },
    spacing: {
      'custom-sm': '0.25rem',
      'custom-md': '0.5rem',
      'custom-lg': '1rem',
    },
  }),
})`}
          </CodeBlock>

          <h2 id="ast-functions">AST Functions</h2>
          
          <p>CSSMA provides AST functions for building CSS:</p>
          
          <CodeBlock language="typescript" filename="ast-functions.ts">
{`import { decl, rule, atRule, atRoot } from 'cssma'

// Create CSS declarations
const declaration = decl('background-color', '#3b82f6')

// Create CSS rules
const cssRule = rule('.custom-class', [
  decl('background-color', '#3b82f6'),
  decl('border-radius', '8px'),
])

// Create at-rules
const mediaQuery = atRule('@media (min-width: 768px)', [
  rule('.responsive-class', [
    decl('font-size', '1.25rem'),
  ]),
])

// Create root-level CSS
const rootStyles = atRoot([
  rule(':root', [
    decl('--custom-color', '#3b82f6'),
  ]),
])`}
          </CodeBlock>

          <h2 id="plugin-configuration">Plugin Configuration</h2>
          
          <p>Plugins can access configuration and extend themes safely:</p>
          
          <CodeBlock language="typescript" filename="configurable-plugin.ts">
{`const configurablePlugin = createUtilityPlugin({
  name: 'configurable-plugin',
  version: '1.0.0',
  utilities: (ctx, config) => {
    // Access plugin-specific configuration
    const customValue = config?.customValue || 'default'
    
    // Safely extend theme
    ctx.extendTheme('colors', {
      custom: customValue,
    })
    
    // Register utilities
    staticUtility('custom-utility', [
      decl('background-color', customValue),
    ])
  },
})

const ctx = createContext({
  plugins: [configurablePlugin],
  // Plugin-specific configuration
  pluginConfig: {
    configurablePlugin: {
      customValue: '#3b82f6',
    },
  },
})`}
          </CodeBlock>

          <h2 id="best-practices">Best Practices</h2>
          
          <ul>
            <li>Use AST functions (<code>decl</code>, <code>rule</code>, <code>atRule</code>, <code>atRoot</code>) for CSS generation</li>
            <li>Use <code>ctx.extendTheme()</code> for safe theme extension</li>
            <li>Provide meaningful plugin names and versions</li>
            <li>Handle configuration gracefully with defaults</li>
            <li>Test plugins thoroughly before distribution</li>
          </ul>

          <h2>Advanced Examples</h2>
          
          <p>For more advanced plugin examples, see the <a href="/docs/examples">Examples</a> section.</p>
      </div>
    </DocsLayout>
  )
} 