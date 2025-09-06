---
title: Configuration API
description: Complete configuration options and customization in BaroCSS
---

# Configuration API

The Configuration API provides comprehensive options for customizing BaroCSS behavior, themes, and functionality. All configuration is done through the `Config` interface.

## Config Interface

```typescript
interface Config {
  // Class name prefix
  prefix?: string;
  
  // Dark mode strategy
  darkMode?: 'media' | 'class' | string[];
  
  // Theme configuration
  theme?: Theme;
  
  // Presets
  presets?: { theme: Theme }[];
  
  // Preflight CSS level
  preflight?: 'minimal' | 'standard' | 'full' | true | false;
  
  // Plugins
  plugins?: Plugin[];
  
  // Cache management
  clearCacheOnContextChange?: boolean;
  
  // Custom configuration
  [key: string]: any;
}
```

## Basic Configuration

### Minimal Configuration

```typescript
import { BrowserRuntime } from '@barocss/kit/runtime/browser';

const runtime = new BrowserRuntime({
  config: {
    // Uses all defaults
  }
});
```

### Custom Prefix

```typescript
const runtime = new BrowserRuntime({
  config: {
    prefix: 'tw-',  // Classes become tw-bg-blue-500
  }
});
```

### Dark Mode Configuration

```typescript
// Media query based (default)
const runtime = new BrowserRuntime({
  config: {
    darkMode: 'media'
  }
});

// Class based
const runtime = new BrowserRuntime({
  config: {
    darkMode: 'class'
  }
});

// Custom selectors
const runtime = new BrowserRuntime({
  config: {
    darkMode: ['class', '[data-theme="dark"]']
  }
});
```

## Theme Configuration

### Basic Theme Extension

```typescript
const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          brand: '#3b82f6',
          accent: '#10b981'
        },
        spacing: {
          '18': '4.5rem',
          '88': '22rem'
        }
      }
    }
  }
});
```

### Complete Theme Override

```typescript
const runtime = new BrowserRuntime({
  config: {
    theme: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          900: '#1e3a8a'
        }
      },
      spacing: {
        0: '0px',
        1: '0.25rem',
        2: '0.5rem',
        4: '1rem',
        8: '2rem'
      },
      fontSize: {
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem'
      }
    }
  }
});
```

### Theme Categories

#### Colors

```typescript
theme: {
  extend: {
    colors: {
      // Named colors
      brand: '#3b82f6',
      
      // Color scales
      primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        500: '#3b82f6',
        900: '#1e3a8a'
      },
      
      // CSS variables
      accent: 'var(--accent-color)',
      
      // Function-based
      dynamic: (theme) => ({
        ...theme('colors.blue'),
        'custom': '#1e40af'
      })
    }
  }
}
```

#### Spacing

```typescript
theme: {
  extend: {
    spacing: {
      // Numeric values
      '18': '4.5rem',
      '88': '22rem',
      
      // Fractional values
      '1/2': '50%',
      '1/3': '33.333333%',
      
      // CSS variables
      'header': 'var(--header-height)',
      
      // Function-based
      'dynamic': (theme) => ({
        ...theme('spacing'),
        'custom': 'calc(1rem + 2vw)'
      })
    }
  }
}
```

#### Typography

```typescript
theme: {
  extend: {
    fontSize: {
      // Simple values
      'xs': '0.75rem',
      'sm': '0.875rem',
      'base': '1rem',
      'lg': '1.125rem',
      
      // With line height
      'xl': ['1.25rem', '1.75rem'],
      '2xl': ['1.5rem', '2rem'],
      
      // Function-based
      'responsive': (theme) => ({
        ...theme('fontSize'),
        'fluid': 'clamp(1rem, 2.5vw, 2rem)'
      })
    },
    fontWeight: {
      'thin': '100',
      'light': '300',
      'normal': '400',
      'medium': '500',
      'semibold': '600',
      'bold': '700',
      'extrabold': '800',
      'black': '900'
    },
    fontFamily: {
      'sans': ['ui-sans-serif', 'system-ui', 'sans-serif'],
      'serif': ['ui-serif', 'Georgia', 'serif'],
      'mono': ['ui-monospace', 'SFMono-Regular', 'monospace']
    }
  }
}
```

#### Layout

```typescript
theme: {
  extend: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
      '3xl': '1600px'
    },
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    }
  }
}
```

#### Effects

```typescript
theme: {
  extend: {
    boxShadow: {
      'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
      'none': 'none'
    },
    borderRadius: {
      'none': '0px',
      'sm': '0.125rem',
      'DEFAULT': '0.25rem',
      'md': '0.375rem',
      'lg': '0.5rem',
      'xl': '0.75rem',
      '2xl': '1rem',
      '3xl': '1.5rem',
      'full': '9999px'
    },
    opacity: {
      '0': '0',
      '5': '0.05',
      '10': '0.1',
      '20': '0.2',
      '25': '0.25',
      '30': '0.3',
      '40': '0.4',
      '50': '0.5',
      '60': '0.6',
      '70': '0.7',
      '75': '0.75',
      '80': '0.8',
      '90': '0.9',
      '95': '0.95',
      '100': '1'
    }
  }
}
```

#### Animations

```typescript
theme: {
  extend: {
    animation: {
      'spin': 'spin 1s linear infinite',
      'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
      'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      'bounce': 'bounce 1s infinite',
      'fade-in': 'fade-in 0.5s ease-in-out',
      'slide-up': 'slide-up 0.3s ease-out'
    },
    keyframes: {
      'fade-in': {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' }
      },
      'slide-up': {
        '0%': { transform: 'translateY(100%)' },
        '100%': { transform: 'translateY(0)' }
      }
    }
  }
}
```

## Preflight Configuration

### Preflight Levels

```typescript
// Full preflight (default)
const runtime = new BrowserRuntime({
  config: {
    preflight: true  // or 'full'
  }
});

// Standard preflight
const runtime = new BrowserRuntime({
  config: {
    preflight: 'standard'
  }
});

// Minimal preflight
const runtime = new BrowserRuntime({
  config: {
    preflight: 'minimal'
  }
});

// No preflight
const runtime = new BrowserRuntime({
  config: {
    preflight: false
  }
});
```

## Plugin Configuration

### Basic Plugin Usage

```typescript
const customPlugin = (ctx: Context, config?: any) => {
  ctx.extendTheme('colors', {
    'brand': '#3b82f6'
  });
};

const runtime = new BrowserRuntime({
  config: {
    plugins: [customPlugin]
  }
});
```

### Plugin with Configuration

```typescript
const configurablePlugin = (ctx: Context, config?: any) => {
  const options = config?.pluginOptions || {};
  
  if (options.enableBrandColors) {
    ctx.extendTheme('colors', {
      'brand': options.brandColor || '#3b82f6'
    });
  }
};

const runtime = new BrowserRuntime({
  config: {
    plugins: [configurablePlugin],
    pluginOptions: {
      enableBrandColors: true,
      brandColor: '#10b981'
    }
  }
});
```

### Multiple Plugins

```typescript
const colorPlugin = (ctx: Context) => {
  ctx.extendTheme('colors', {
    'brand': '#3b82f6'
  });
};

const spacingPlugin = (ctx: Context) => {
  ctx.extendTheme('spacing', {
    '18': '4.5rem'
  });
};

const runtime = new BrowserRuntime({
  config: {
    plugins: [colorPlugin, spacingPlugin]
  }
});
```

## Presets

### Using Presets

```typescript
const runtime = new BrowserRuntime({
  config: {
    presets: [
      {
        theme: {
          colors: {
            'preset-blue': '#1e40af'
          }
        }
      }
    ]
  }
});
```

### Custom Preset

```typescript
const customPreset = {
  theme: {
    colors: {
      'preset-primary': '#3b82f6',
      'preset-secondary': '#10b981'
    },
    spacing: {
      'preset-sm': '0.5rem',
      'preset-lg': '2rem'
    }
  }
};

const runtime = new BrowserRuntime({
  config: {
    presets: [customPreset]
  }
});
```

## Cache Configuration

### Cache Management

```typescript
// Clear cache on context change (default)
const runtime = new BrowserRuntime({
  config: {
    clearCacheOnContextChange: true
  }
});

// Keep cache for better performance
const runtime = new BrowserRuntime({
  config: {
    clearCacheOnContextChange: false
  }
});
```

## Advanced Configuration

### Environment-Specific Configuration

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

const runtime = new BrowserRuntime({
  config: {
    theme: {
      extend: {
        colors: {
          'debug': isDevelopment ? '#ff0000' : 'transparent'
        }
      }
    },
    plugins: isDevelopment ? [debugPlugin] : []
  }
});
```

### Dynamic Configuration

```typescript
const createConfig = (userPreferences: any) => ({
  theme: {
    extend: {
      colors: {
        'user-primary': userPreferences.primaryColor || '#3b82f6',
        'user-secondary': userPreferences.secondaryColor || '#10b981'
      }
    }
  },
  darkMode: userPreferences.darkMode || 'media'
});

const runtime = new BrowserRuntime({
  config: createConfig(userPreferences)
});
```

### Configuration Validation

```typescript
const validateConfig = (config: any) => {
  if (config.theme?.extend?.colors?.brand && !config.theme.extend.colors.brand.match(/^#[0-9A-F]{6}$/i)) {
    throw new Error('Brand color must be a valid hex color');
  }
  return config;
};

const runtime = new BrowserRuntime({
  config: validateConfig({
    theme: {
      extend: {
        colors: {
          brand: '#3b82f6'
        }
      }
    }
  })
});
```

## Configuration Examples

### Complete Configuration

```typescript
const runtime = new BrowserRuntime({
  config: {
    prefix: 'tw-',
    darkMode: 'class',
    preflight: 'standard',
    clearCacheOnContextChange: true,
    theme: {
      extend: {
        colors: {
          brand: {
            50: '#eff6ff',
            100: '#dbeafe',
            500: '#3b82f6',
            900: '#1e3a8a'
          }
        },
        spacing: {
          '18': '4.5rem',
          '88': '22rem'
        },
        fontSize: {
          'fluid': 'clamp(1rem, 2.5vw, 2rem)'
        }
      }
    },
    plugins: [
      customPlugin,
      responsivePlugin
    ],
    customOptions: {
      enableAnimations: true,
      debugMode: false
    }
  }
});
```

### Framework Integration

```typescript
// React
const useBaroCSS = (config: Config) => {
  const runtimeRef = useRef<BrowserRuntime>();

  useEffect(() => {
    runtimeRef.current = new BrowserRuntime({ config });
    runtimeRef.current.observe(document.body, { scan: true });

    return () => {
      runtimeRef.current?.destroy();
    };
  }, [config]);

  return runtimeRef.current;
};

// Vue
const useBaroCSS = (config: Config) => {
  const runtime = ref<BrowserRuntime>();

  onMounted(() => {
    runtime.value = new BrowserRuntime({ config });
    runtime.value.observe(document.body, { scan: true });
  });

  onUnmounted(() => {
    runtime.value?.destroy();
  });

  return runtime;
};
```

## Best Practices

1. **Use extend**: Prefer `theme.extend` over direct theme overrides
2. **Function-based themes**: Use functions for dynamic theme values
3. **Plugin organization**: Group related functionality in plugins
4. **Configuration validation**: Validate configuration in production
5. **Environment-specific**: Use different configs for different environments
6. **Performance**: Use `clearCacheOnContextChange: false` for better performance
7. **Type safety**: Use TypeScript for configuration type safety

## Related APIs

- [Context API](/api/context) - Using configuration in context
- [Plugin System](/api/plugins) - Plugin configuration
- [Browser Runtime](/api/browser-runtime) - Runtime configuration
- [Server Runtime](/api/server-runtime) - Server configuration
