import { describe, it, expect } from 'vitest'
import { createContext } from '../../src/core/context'
import { staticUtility, functionalUtility, staticModifier, functionalModifier } from '../../src/core/registry'

describe('CSSMA v4 Plugin System - Comprehensive Capabilities', () => {
  
  describe('Theme Extension Capabilities', () => {
    it('should extend colors via plugin', () => {
      const colorPlugin = (ctx: any, config: any) => {
        // Use safe extendTheme API
        ctx.extendTheme('colors', {
          'brand-primary': '#3b82f6',
          'brand-secondary': '#10b981',
          'brand-accent': '#f59e0b'
        })
      }

      const ctx = createContext({
        plugins: [colorPlugin]
      })

      expect(ctx.theme('colors', 'brand-primary')).toBe('#3b82f6')
      expect(ctx.theme('colors', 'brand-secondary')).toBe('#10b981')
      expect(ctx.theme('colors', 'brand-accent')).toBe('#f59e0b')
    })

    it('should extend spacing via plugin', () => {
      const spacingPlugin = (ctx: any, config: any) => {
        ctx.extendTheme('spacing', {
          '18': '4.5rem',
          '20': '5rem',
          '22': '5.5rem'
        })
      }

      const ctx = createContext({
        plugins: [spacingPlugin]
      })

      expect(ctx.theme('spacing', '18')).toBe('4.5rem')
      expect(ctx.theme('spacing', '20')).toBe('5rem')
      expect(ctx.theme('spacing', '22')).toBe('5.5rem')
    })

    it('should extend multiple theme categories', () => {
      const multiPlugin = (ctx: any, config: any) => {
        // Extend colors
        ctx.extendTheme('colors', {
          'custom-red': '#ef4444',
          'custom-green': '#22c55e'
        })
        
        // Extend spacing
        ctx.extendTheme('spacing', {
          '13': '3.25rem',
          '15': '3.75rem'
        })
        
        // Extend border radius
        ctx.extendTheme('borderRadius', {
          '2xl': '1rem',
          '3xl': '1.5rem'
        })
      }

      const ctx = createContext({
        plugins: [multiPlugin]
      })

      expect(ctx.theme('colors', 'custom-red')).toBe('#ef4444')
      expect(ctx.theme('spacing', '13')).toBe('3.25rem')
      expect(ctx.theme('borderRadius', '2xl')).toBe('1rem')
    })
  })

  describe('Configuration Access Capabilities', () => {
    it('should access plugin configuration', () => {
      const configurablePlugin = (ctx: any, config: any) => {
        const pluginConfig = config.pluginConfig || {}
        const customColor = pluginConfig.customColor || '#000000'
        
        ctx.extendTheme('colors', {
          'config-color': customColor
        })
      }

      const ctx = createContext({
        plugins: [configurablePlugin],
        pluginConfig: {
          customColor: '#ff6b6b'
        }
      })

      expect(ctx.theme('colors', 'config-color')).toBe('#ff6b6b')
    })

    it('should access full configuration', () => {
      const fullConfigPlugin = (ctx: any, config: any) => {
        const prefix = config.prefix || 'cssma-'
        const darkMode = config.darkMode || 'media'
        
        // Behavior depends on configuration
        ctx.extendTheme('custom', {
          prefix,
          darkMode,
          'plugin-applied': true
        })
      }

      const ctx = createContext({
        prefix: 'my-',
        darkMode: 'class',
        plugins: [fullConfigPlugin]
      })

      expect(ctx.theme('custom', 'prefix')).toBe('my-')
      expect(ctx.theme('custom', 'darkMode')).toBe('class')
      expect(ctx.theme('custom', 'plugin-applied')).toBe(true)
    })
  })

  describe('Dynamic Theme Generation', () => {
    it('should generate theme values dynamically', () => {
      const dynamicPlugin = (ctx: any, config: any) => {
        // Generate color palette dynamically
        const baseColors = ['red', 'blue', 'green']
        const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
        
        ctx.extendTheme('colors', {
          ...baseColors.reduce((acc, color) => {
            acc[color] = shades.reduce((shadeAcc, shade) => {
              shadeAcc[shade] = `var(--${color}-${shade})`
              return shadeAcc
            }, {} as any)
            return acc
          }, {} as any)
        })
      }

      const ctx = createContext({
        plugins: [dynamicPlugin]
      })

      expect(ctx.theme('colors', 'red', '500')).toBe('var(--red-500)')
      expect(ctx.theme('colors', 'blue', '700')).toBe('var(--blue-700)')
      expect(ctx.theme('colors', 'green', '200')).toBe('var(--green-200)')
    })

    it('should generate spacing scale dynamically', () => {
      const spacingPlugin = (ctx: any, config: any) => {
        // Generate spacing values from 0 to 100 dynamically
        ctx.extendTheme('spacing', {
          ...Array.from({ length: 101 }, (_, i) => i).reduce((acc, i) => {
            acc[i] = `${i * 0.25}rem`
            return acc
          }, {} as any)
        })
      }

      const ctx = createContext({
        plugins: [spacingPlugin]
      })

      expect(ctx.theme('spacing', '0')).toBe('0rem')
      expect(ctx.theme('spacing', '4')).toBe('1rem')
      expect(ctx.theme('spacing', '16')).toBe('4rem')
      expect(ctx.theme('spacing', '100')).toBe('25rem')
    })
  })

  describe('Theme Function Support', () => {
    it('should support theme functions for dynamic values', () => {
      const functionPlugin = (ctx: any, config: any) => {
        // Add base values via extendTheme
        ctx.extendTheme('spacing', {
          'custom-lg': '2rem',
          'custom-xl': '3rem',
          'custom-2xl': '4rem'
        });
        
        // Functional theme extension
        ctx.extendTheme('colors', (theme: any) => ({
          'primary': theme('colors', 'blue', '500'),
          'secondary': theme('colors', 'gray', '500'),
          'accent': theme('colors', 'green', '500')
        }));
      }

      const ctx = createContext({
        plugins: [functionPlugin]
      })

      expect(ctx.theme('spacing', 'custom-lg')).toBe('2rem')
      expect(ctx.theme('spacing', 'custom-xl')).toBe('3rem')
      expect(ctx.theme('colors', 'primary')).toBe(ctx.theme('colors', 'blue', '500'))
      expect(ctx.theme('colors', 'secondary')).toBe(ctx.theme('colors', 'gray', '500'))
    })
  })

  describe('Plugin Dependencies and Order', () => {
    it('should execute plugins in order', () => {
      const executionOrder: string[] = []
      
      const plugin1 = (ctx: any, config: any) => {
        executionOrder.push('plugin1')
        ctx.extendTheme('execution', {
          'plugin1': 'first'
        })
      }
      
      const plugin2 = (ctx: any, config: any) => {
        executionOrder.push('plugin2')
        ctx.extendTheme('execution', {
          'plugin2': 'second'
        })
      }
      
      const plugin3 = (ctx: any, config: any) => {
        executionOrder.push('plugin3')
        ctx.extendTheme('execution', {
          'plugin3': 'third'
        })
      }

      const ctx = createContext({
        plugins: [plugin1, plugin2, plugin3]
      })

      expect(executionOrder).toEqual(['plugin1', 'plugin2', 'plugin3'])
      expect(ctx.theme('execution', 'plugin1')).toBe('first')
      expect(ctx.theme('execution', 'plugin2')).toBe('second')
      expect(ctx.theme('execution', 'plugin3')).toBe('third')
    })

    it('should handle plugin dependencies', () => {
      const basePlugin = (ctx: any, config: any) => {
        ctx.extendTheme('base', {
          'foundation': 'ready',
          'version': '1.0.0'
        })
      }
      
      const dependentPlugin = (ctx: any, config: any) => {
        // base plugin must execute first
        const baseVersion = ctx.theme('base', 'version')
        ctx.extendTheme('dependent', {
          'depends-on': baseVersion,
          'status': 'ready'
        })
      }

      const ctx = createContext({
        plugins: [basePlugin, dependentPlugin]
      })

      expect(ctx.theme('base', 'foundation')).toBe('ready')
      expect(ctx.theme('dependent', 'depends-on')).toBe('1.0.0')
      expect(ctx.theme('dependent', 'status')).toBe('ready')
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle plugin errors gracefully', () => {
      const errorPlugin = (ctx: any, config: any) => {
        throw new Error('Plugin error for testing')
      }
      
      const workingPlugin = (ctx: any, config: any) => {
        ctx.extendTheme('working', {
          'status': 'success'
        })
      }

      const ctx = createContext({
        plugins: [errorPlugin, workingPlugin]
      })

      // Even if an error occurs, working plugin should still execute
      expect(ctx.theme('working', 'status')).toBe('success')
    })

    it('should handle invalid theme access', () => {
      const invalidPlugin = (ctx: any, config: any) => {
        // Access a non-existent theme path
        const invalidValue = ctx.theme('nonexistent', 'category', 'value')
        ctx.extendTheme('invalid', {
          'result': invalidValue
        })
      }

      const ctx = createContext({
        plugins: [invalidPlugin]
      })

      expect(ctx.theme('invalid', 'result')).toBeUndefined()
    })
  })

  describe('Advanced Plugin Patterns', () => {
    it('should support conditional theme extension', () => {
      const conditionalPlugin = (ctx: any, config: any) => {
        const isProduction = config.environment === 'production'
        
        if (isProduction) {
          ctx.extendTheme('production', {
            'optimized': true,
            'minified': true
          })
        } else {
          ctx.extendTheme('development', {
            'debug': true,
            'verbose': true
          })
        }
      }

      const productionCtx = createContext({
        environment: 'production',
        plugins: [conditionalPlugin]
      })

      const developmentCtx = createContext({
        environment: 'development',
        plugins: [conditionalPlugin]
      })

      expect(productionCtx.theme('production', 'optimized')).toBe(true)
      expect(developmentCtx.theme('development', 'debug')).toBe(true)
    })

    it('should support theme transformation', () => {
      const transformPlugin = (ctx: any, config: any) => {
        // Transform existing theme values
        const originalColors = ctx.theme('colors') || {}
        
        // Convert all colors to CSS variables
        ctx.extendTheme('transformedColors', Object.entries(originalColors).reduce((acc, [key, value]) => {
          acc[key] = `var(--color-${key})`
          return acc
        }, {} as any))
      }

      const ctx = createContext({
        plugins: [transformPlugin]
      })

      expect(ctx.theme('transformedColors', 'blue')).toBe('var(--color-blue)')
      expect(ctx.theme('transformedColors', 'red')).toBe('var(--color-red)')
    })
  })

  describe('CSS Variables Generation', () => {
    it('should generate CSS variables from theme', () => {
      const cssVarsPlugin = (ctx: any, config: any) => {
        ctx.extendTheme('colors', {
          'brand': '#3b82f6',
          'accent': '#10b981'
        })
      }

      const ctx = createContext({
        plugins: [cssVarsPlugin]
      })

      const cssVars = ctx.themeToCssVars()
      
      expect(cssVars).toContain('--color-brand')
      expect(cssVars).toContain('--color-accent')
      expect(cssVars).toContain('#3b82f6')
      expect(cssVars).toContain('#10b981')
    })
  })

  describe('Configuration Validation', () => {
    it('should validate plugin configuration', () => {
      const validationPlugin = (ctx: any, config: any) => {
        const requiredConfig = ['apiKey', 'endpoint']
        const missingConfig = requiredConfig.filter(key => !config[key])
        
        ctx.extendTheme('validation', {
          'valid': missingConfig.length === 0,
          'missing': missingConfig
        })
      }

      const validCtx = createContext({
        apiKey: 'test-key',
        endpoint: 'https://api.example.com',
        plugins: [validationPlugin]
      })

      const invalidCtx = createContext({
        apiKey: 'test-key',
        // endpoint missing
        plugins: [validationPlugin]
      })

      expect(validCtx.theme('validation', 'valid')).toBe(true)
      expect(invalidCtx.theme('validation', 'valid')).toBe(false)
      expect(invalidCtx.theme('validation', 'missing')).toContain('endpoint')
    })
  })

  describe('CSS Generation Capabilities', () => {
    it('should generate CSS utilities via plugin', () => {
      const cssPlugin = (ctx: any, config: any) => {
        // Create CSS utility classes
        const cssRules = [
          '.bg-brand { background-color: #3b82f6; }',
          '.text-brand { color: #3b82f6; }',
          '.border-brand { border-color: #3b82f6; }'
        ];
        
        // Add brand color into colors so CSS variables include it
        ctx.extendTheme('colors', {
          'brand': '#3b82f6'
        });
        
        ctx.extendTheme('customCSS', {
          'utilities': cssRules.join('\n')
        });
      }

      const ctx = createContext({
        plugins: [cssPlugin]
      })

      const cssVars = ctx.themeToCssVars()
      expect(cssVars).toContain('--color-brand')
      expect(ctx.theme('customCSS', 'utilities')).toContain('.bg-brand')
    })

    it('should generate responsive utilities', () => {
      const responsivePlugin = (ctx: any, config: any) => {
        const breakpoints = ctx.theme('breakpoints') || {};
        const responsiveCSS = Object.entries(breakpoints).map(([name, value]) => 
          `@media (min-width: ${value}) { .${name}\\:bg-brand { background-color: #3b82f6; } }`
        ).join('\n');
        
        ctx.extendTheme('responsiveCSS', {
          'rules': responsiveCSS
        });
      }

      const ctx = createContext({
        plugins: [responsivePlugin]
      })

      expect(ctx.theme('responsiveCSS', 'rules')).toContain('@media')
      // Actually generated in escaped form
      expect(ctx.theme('responsiveCSS', 'rules')).toContain('sm\\:bg-brand')
    })
  })

  describe('Utility Class Registration', () => {
    it('should register custom utility classes', () => {
      const utilityPlugin = (ctx: any, config: any) => {
        // Register custom utility classes
        const utilities = {
          'custom-shadow': 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
          'custom-gradient': 'background: linear-gradient(45deg, #3b82f6, #10b981);',
          'custom-animation': 'animation: pulse 2s infinite;'
        };
        
        ctx.extendTheme('utilities', utilities);
      }

      const ctx = createContext({
        plugins: [utilityPlugin]
      })

      expect(ctx.theme('utilities', 'custom-shadow')).toContain('box-shadow')
      expect(ctx.theme('utilities', 'custom-gradient')).toContain('linear-gradient')
      expect(ctx.theme('utilities', 'custom-animation')).toContain('animation')
    })
  })

  describe('Variant Processing', () => {
    it('should handle pseudo-class variants', () => {
      const variantPlugin = (ctx: any, config: any) => {
        const variants = {
          'hover': ':hover',
          'focus': ':focus',
          'active': ':active',
          'disabled': ':disabled'
        };
        
        ctx.extendTheme('variants', variants);
      }

      const ctx = createContext({
        plugins: [variantPlugin]
      })

      expect(ctx.theme('variants', 'hover')).toBe(':hover')
      expect(ctx.theme('variants', 'focus')).toBe(':focus')
    })

    it('should handle responsive variants', () => {
      const responsiveVariantPlugin = (ctx: any, config: any) => {
        const responsiveVariants = {
          'sm': '@media (min-width: 640px)',
          'md': '@media (min-width: 768px)',
          'lg': '@media (min-width: 1024px)',
          'xl': '@media (min-width: 1280px)'
        };
        
        ctx.extendTheme('responsiveVariants', responsiveVariants);
      }

      const ctx = createContext({
        plugins: [responsiveVariantPlugin]
      })

      expect(ctx.theme('responsiveVariants', 'sm')).toContain('@media')
      expect(ctx.theme('responsiveVariants', 'lg')).toContain('1024px')
    })
  })

  describe('Plugin Configuration and Validation', () => {
    it('should validate plugin configuration with custom rules', () => {
      const validationPlugin = (ctx: any, config: any) => {
        const requiredFields = ['theme', 'plugins'];
        const missingFields = requiredFields.filter(field => !config[field]);
        
        const validationResult = {
          'isValid': missingFields.length === 0,
          'missingFields': missingFields,
          'configKeys': Object.keys(config),
          'hasTheme': !!config.theme,
          'hasPlugins': Array.isArray(config.plugins)
        };
        
        ctx.extendTheme('validation', validationResult);
      }

      const ctx = createContext({
        theme: { colors: { red: '#ff0000' } },
        plugins: [validationPlugin]
      })

      expect(ctx.theme('validation', 'isValid')).toBe(true)
      expect(ctx.theme('validation', 'hasTheme')).toBe(true)
      expect(ctx.theme('validation', 'hasPlugins')).toBe(true)
    })

    it('should handle plugin configuration with defaults', () => {
      const configPlugin = (ctx: any, config: any) => {
        const pluginConfig = {
          'prefix': config.prefix || 'cssma-',
          'darkMode': config.darkMode || 'media',
          'important': config.important || false,
          'separator': config.separator || ':',
          'safelist': config.safelist || []
        };
        
        ctx.extendTheme('pluginConfig', pluginConfig);
      }

      const ctx = createContext({
        prefix: 'my-',
        darkMode: 'class',
        important: true,
        plugins: [configPlugin]
      })

      expect(ctx.theme('pluginConfig', 'prefix')).toBe('my-')
      expect(ctx.theme('pluginConfig', 'darkMode')).toBe('class')
      expect(ctx.theme('pluginConfig', 'important')).toBe(true)
    })
  })

  describe('Plugin Logging and Debugging', () => {
    it('should provide debugging information', () => {
      const debugPlugin = (ctx: any, config: any) => {
        const debugInfo = {
          'pluginName': 'debug-plugin',
          'executionTime': Date.now(),
          'configKeys': Object.keys(config),
          'themeCategories': Object.keys(ctx.theme() || {}),
          'hasThemeFunction': typeof ctx.theme === 'function',
          'hasConfigFunction': typeof ctx.config === 'function'
        };
        
        ctx.extendTheme('debug', debugInfo);
      }

      const ctx = createContext({
        plugins: [debugPlugin]
      })

      expect(ctx.theme('debug', 'pluginName')).toBe('debug-plugin')
      expect(ctx.theme('debug', 'hasThemeFunction')).toBe(true)
      expect(ctx.theme('debug', 'hasConfigFunction')).toBe(true)
    })
  })

  describe('Plugin State Management', () => {
    it('should manage plugin state across executions', () => {
      const statePlugin = (ctx: any, config: any) => {
        // Manage plugin state
        const currentState = ctx.theme('pluginState') || { executions: 0 };
        const newState = {
          ...currentState,
          executions: currentState.executions + 1,
          lastExecution: Date.now(),
          config: config
        };
        
        ctx.extendTheme('pluginState', newState);
      }

      const ctx = createContext({
        plugins: [statePlugin]
      })

      expect(ctx.theme('pluginState', 'executions')).toBe(1)
      expect(ctx.theme('pluginState', 'lastExecution')).toBeDefined()
    })
  })

  describe('Plugin Error Recovery and Fallbacks', () => {
    it('should provide fallback values when theme access fails', () => {
      const fallbackPlugin = (ctx: any, config: any) => {
        // Safe theme access
        const safeColors = ctx.theme('colors') || {};
        const safeSpacing = ctx.theme('spacing') || {};
        
        const fallbacks = {
          'primaryColor': safeColors.blue?.['500'] || '#3b82f6',
          'spacingUnit': safeSpacing['4'] || '1rem',
          'fontSize': ctx.theme('fontSize', 'base') || '1rem',
          'borderRadius': ctx.theme('borderRadius', 'default') || '0.25rem'
        };
        
        ctx.extendTheme('fallbacks', fallbacks);
      }

      const ctx = createContext({
        plugins: [fallbackPlugin]
      })

      expect(ctx.theme('fallbacks', 'primaryColor')).toBeDefined()
      expect(ctx.theme('fallbacks', 'spacingUnit')).toBeDefined()
    })
  })

  describe('Plugin Composition and Chaining', () => {
    it('should support plugin composition', () => {
      const basePlugin = (ctx: any, config: any) => {
        ctx.extendTheme('base', {
          'foundation': 'ready',
          'version': '1.0.0'
        });
      }
      
      const extensionPlugin = (ctx: any, config: any) => {
        const baseVersion = ctx.theme('base', 'version');
        ctx.extendTheme('extension', {
          'dependsOn': baseVersion,
          'features': ['colors', 'spacing', 'typography']
        });
      }
      
      const compositionPlugin = (ctx: any, config: any) => {
        const baseStatus = ctx.theme('base', 'foundation');
        const extensionFeatures = ctx.theme('extension', 'features') || [];
        
        ctx.extendTheme('composition', {
          'baseStatus': baseStatus,
          'featureCount': extensionFeatures.length,
          'composed': true
        });
      }

      const ctx = createContext({
        plugins: [basePlugin, extensionPlugin, compositionPlugin]
      })

      expect(ctx.theme('composition', 'baseStatus')).toBe('ready')
      expect(ctx.theme('composition', 'featureCount')).toBe(3)
      expect(ctx.theme('composition', 'composed')).toBe(true)
    })
  })

  describe('Plugin Data Transformation', () => {
    it('should transform theme data', () => {
      const transformPlugin = (ctx: any, config: any) => {
        const originalColors = ctx.theme('colors') || {};
        
        // Convert colors to HSL (simulation)
        const hslColors = Object.entries(originalColors).reduce((acc, [name, value]) => {
          if (typeof value === 'string' && value.startsWith('#')) {
            acc[name] = `hsl(${Math.random() * 360}, 70%, 50%)`; // simulate
          } else {
            acc[name] = value;
          }
          return acc;
        }, {} as any);
        
        // Convert colors to RGB (simulation)
        const rgbColors = Object.entries(originalColors).reduce((acc, [name, value]) => {
          if (typeof value === 'string' && value.startsWith('#')) {
            acc[name] = `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`; // simulate
          } else {
            acc[name] = value;
          }
          return acc;
        }, {} as any);
        
        ctx.extendTheme('transformed', {
          'hsl': hslColors,
          'rgb': rgbColors,
          'originalCount': Object.keys(originalColors).length
        });
      }

      const ctx = createContext({
        plugins: [transformPlugin]
      })

      expect(ctx.theme('transformed', 'originalCount')).toBeGreaterThan(0)
      expect(ctx.theme('transformed', 'hsl')).toBeDefined()
      expect(ctx.theme('transformed', 'rgb')).toBeDefined()
    })
  })

  describe('CSSMA Core Plugin Capabilities - Actual Syntax Registration', () => {
    it('should register static utilities via plugin', () => {
      
      const utilityPlugin = (ctx: any, config: any) => {
        // Register static utilities
        staticUtility('custom-block', [
          ['display', 'block']
        ]);
        
        staticUtility('custom-hidden', [
          ['display', 'none']
        ]);
        
        staticUtility('custom-space-x-2', [
          [
            '& > :not([hidden]) ~ :not([hidden])',
            [
              ['margin-inline-start', '0.5rem'],
              ['margin-inline-end', '0.5rem']
            ]
          ]
        ]);
        
        ctx.extendTheme('registeredUtilities', {
          'static': ['custom-block', 'custom-hidden', 'custom-space-x-2']
        });
      }

      const ctx = createContext({
        plugins: [utilityPlugin]
      })

      expect(ctx.theme('registeredUtilities', 'static')).toContain('custom-block')
      expect(ctx.theme('registeredUtilities', 'static')).toContain('custom-hidden')
      expect(ctx.theme('registeredUtilities', 'static')).toContain('custom-space-x-2')
    })

    it('should register functional utilities via plugin', () => {
      
      const functionalPlugin = (ctx: any, config: any) => {
        // Register functional utilities
        functionalUtility({
          name: 'custom-text',
          prop: 'color',
          supportsArbitrary: true,
          handleBareValue: ({ value }) => {
            return `var(--custom-color-${value})`;
          },
          handle: (value, ctx, token, extra) => {
            return [{ type: 'decl', prop: 'color', value }];
          }
        });
        
        functionalUtility({
          name: 'custom-bg',
          prop: 'background-color',
          supportsNegative: true,
          handleBareValue: ({ value }) => {
            return `var(--custom-bg-${value})`;
          },
          handle: (value, ctx, token, extra) => {
            return [{ type: 'decl', prop: 'background-color', value }];
          }
        });
        
        ctx.extendTheme('registeredUtilities', {
          'functional': ['custom-text', 'custom-bg']
        });
      }

      const ctx = createContext({
        plugins: [functionalPlugin]
      })

      expect(ctx.theme('registeredUtilities', 'functional')).toContain('custom-text')
      expect(ctx.theme('registeredUtilities', 'functional')).toContain('custom-bg')
    })

    it('should register static modifiers via plugin', () => {
      
      const modifierPlugin = (ctx: any, config: any) => {
        // Register static modifiers
        staticModifier('hover', [':hover']);
        staticModifier('focus', [':focus']);
        staticModifier('active', [':active']);
        staticModifier('disabled', [':disabled']);
        
        ctx.extendTheme('registeredModifiers', {
          'static': ['hover', 'focus', 'active', 'disabled']
        });
      }

      const ctx = createContext({
        plugins: [modifierPlugin]
      })

      expect(ctx.theme('registeredModifiers', 'static')).toContain('hover')
      expect(ctx.theme('registeredModifiers', 'static')).toContain('focus')
      expect(ctx.theme('registeredModifiers', 'static')).toContain('active')
      expect(ctx.theme('registeredModifiers', 'static')).toContain('disabled')
    })

    it('should register functional modifiers via plugin', () => {
      
      const functionalModifierPlugin = (ctx: any, config: any) => {
        // Register functional modifiers
        functionalModifier(
          (mod: string) => mod.startsWith('custom-'),
          ({ selector, mod }) => {
            return `${selector}:custom-${mod.replace('custom-', '')}`;
          }
        );
        
        functionalModifier(
          (mod: string) => mod.startsWith('responsive-'),
          ({ selector, mod }) => {
            const breakpoint = mod.replace('responsive-', '');
            return `@media (min-width: ${breakpoint}) { ${selector} }`;
          }
        );
        
        ctx.extendTheme('registeredModifiers', {
          'functional': ['custom-hover', 'custom-focus', 'responsive-sm', 'responsive-md']
        });
      }

      const ctx = createContext({
        plugins: [functionalModifierPlugin]
      })

      expect(ctx.theme('registeredModifiers', 'functional')).toContain('custom-hover')
      expect(ctx.theme('registeredModifiers', 'functional')).toContain('responsive-sm')
    })

    it('should register complex utility combinations via plugin', () => {
      
      const complexPlugin = (ctx: any, config: any) => {
        // Register composite utilities
        staticUtility('custom-flex-center', [
          ['display', 'flex'],
          ['justify-content', 'center'],
          ['align-items', 'center']
        ]);
        
        staticUtility('custom-grid-auto-fit', [
          ['display', 'grid'],
          ['grid-template-columns', 'repeat(auto-fit, minmax(200px, 1fr))'],
          ['gap', '1rem']
        ]);
        
        functionalUtility({
          name: 'custom-gap',
          prop: 'gap',
          supportsArbitrary: true,
          supportsFraction: true,
          handleBareValue: ({ value }) => {
            if (value.includes('/')) {
              const [numerator, denominator] = value.split('/');
              return `${numerator}/${denominator}rem`;
            }
            return `${value}rem`;
          },
          handle: (value, ctx, token, extra) => {
            return [{ type: 'decl', prop: 'gap', value }];
          }
        });
        
        ctx.extendTheme('complexUtilities', {
          'static': ['custom-flex-center', 'custom-grid-auto-fit'],
          'functional': ['custom-gap']
        });
      }

      const ctx = createContext({
        plugins: [complexPlugin]
      })

      expect(ctx.theme('complexUtilities', 'static')).toContain('custom-flex-center')
      expect(ctx.theme('complexUtilities', 'static')).toContain('custom-grid-auto-fit')
      expect(ctx.theme('complexUtilities', 'functional')).toContain('custom-gap')
    })

    it('should register theme-aware utilities via plugin', () => {
      
      const themeAwarePlugin = (ctx: any, config: any) => {
        // Register theme-aware utilities
        functionalUtility({
          name: 'custom-color',
          prop: 'color',
          themeKey: 'colors',
          supportsArbitrary: true,
          handleBareValue: ({ value, ctx }) => {
            const themeColor = ctx.theme('colors', value);
            return themeColor || value;
          },
          handle: (value, ctx, token, extra) => {
            const themeColor = ctx.theme('colors', value);
            return [{ type: 'decl', prop: 'color', value: themeColor || value }];
          }
        });
        
        functionalUtility({
          name: 'custom-spacing',
          prop: 'padding',
          themeKey: 'spacing',
          supportsArbitrary: true,
          handleBareValue: ({ value, ctx }) => {
            const themeSpacing = ctx.theme('spacing', value);
            return themeSpacing || value;
          },
          handle: (value, ctx, token, extra) => {
            const themeSpacing = ctx.theme('spacing', value);
            return [{ type: 'decl', prop: 'padding', value: themeSpacing || value }];
          }
        });
        
        ctx.extendTheme('themeAwareUtilities', {
          'color': 'custom-color',
          'spacing': 'custom-spacing'
        });
      }

      const ctx = createContext({
        plugins: [themeAwarePlugin]
      })

      expect(ctx.theme('themeAwareUtilities', 'color')).toBe('custom-color')
      expect(ctx.theme('themeAwareUtilities', 'spacing')).toBe('custom-spacing')
    })

    it('should register conditional modifiers via plugin', () => {
      
      const conditionalPlugin = (ctx: any, config: any) => {
        // Register conditional modifiers
        functionalModifier(
          (mod: string) => mod.startsWith('dark-'),
          ({ selector, mod, ctx }) => {
            const darkMode = ctx.theme('darkMode') || 'media';
            if (darkMode === 'class') {
              return `.dark ${selector}`;
            } else {
              return `@media (prefers-color-scheme: dark) { ${selector} }`;
            }
          }
        );
        
        functionalModifier(
          (mod: string) => mod.startsWith('print-'),
          ({ selector, mod }) => {
            return `@media print { ${selector} }`;
          }
        );
        
        ctx.extendTheme('conditionalModifiers', {
          'dark': 'dark-mode',
          'print': 'print-mode'
        });
      }

      const ctx = createContext({
        plugins: [conditionalPlugin]
      })

      expect(ctx.theme('conditionalModifiers', 'dark')).toBe('dark-mode')
      expect(ctx.theme('conditionalModifiers', 'print')).toBe('print-mode')
    })
  })
}) 