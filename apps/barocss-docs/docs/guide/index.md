# BaroCSS Guide

Welcome to the BaroCSS documentation! This guide will help you understand and use BaroCSS effectively.

## What is BaroCSS?

BaroCSS is a **CSS parsing and generation engine** that brings Tailwind's utility-first approach to runtime environments. It consists of three main packages:

- **`@barocss/kit`** - Core parsing and generation engine
- **`@barocss/browser`** - Browser runtime with DOM change detection  
- **`@barocss/server`** - Server runtime for static CSS generation

## Key Features

### ⚡ Runtime-First
Parse and generate CSS at runtime without build processes. Perfect for dynamic content and real-time styling.

### 🎯 Tailwind Compatible
Full support for Tailwind CSS syntax including utilities, variants, and arbitrary values.

### 🧠 Smart Parsing
Advanced AST processing with incremental parsing and intelligent caching for optimal performance.

### 🚀 Multiple Runtimes
Browser runtime for real-time DOM detection and server runtime for static CSS generation.

### 🔧 TypeScript API
Comprehensive TypeScript API with full type safety and excellent developer experience.

### 🌐 Universal
Works in browsers, Node.js, and any JavaScript environment with consistent behavior.

## Next Steps

Ready to get started? Continue with:

### Getting Started
- [Installation Guide](/guide/installation) - Set up BaroCSS in your project
- [CDN Usage](/guide/cdn-usage) - Use BaroCSS via CDN

### Core Concepts
- [JIT Mode](/guide/jit-mode) - Understand how JIT compilation and real-time generation works
- [Incremental Parsing](/guide/incremental-parsing) - Advanced parsing capabilities with smart caching
- [DOM Change Detection](/guide/dom-change-detection) - Automatic DOM monitoring
- [Runtime APIs](/guide/runtime-apis) - Browser and Server runtime APIs

### Integration
- [Integration Overview](/guide/integration/overview) - Build-free UI generation
- [Frameworks](/guide/integration/frameworks) - React, Vue, Svelte, Solid
- [jQuery](/guide/integration/jquery) - jQuery integration

### Styling & Theming
- [Styling with Utility Classes](/guide/styling-with-utility-classes) - Core utility usage
- [Hover, Focus and Other States](/guide/hover-focus-and-other-states) - Interactive states
- [Responsive Design](/guide/responsive-design) - Mobile-first approach
- [Dark Mode](/guide/dark-mode) - Dark theme support
- [Theme Configuration](/guide/theme) - Customizing your theme
- [Colors](/guide/colors) - Color system
- [Adding Custom Styles](/guide/adding-custom-styles) - Extending BaroCSS
- [Functions and Directives](/guide/functions-and-directives) - Advanced features

### API Reference
- [API Overview](/api/) - Complete API documentation
- [Context API](/api/context) - Core context management
- [Engine API](/api/engine) - CSS generation engine
- [Browser Runtime](/api/browser-runtime) - Browser-specific APIs
- [Server Runtime](/api/server-runtime) - Server-side rendering
- [Static Utility API](/api/static-utility) - Creating fixed utilities
- [Functional Utility API](/api/functional-utility) - Creating dynamic utilities
- [Static Modifier API](/api/static-modifier) - Creating fixed modifiers
- [Functional Modifier API](/api/functional-modifier) - Creating dynamic modifiers
- [Custom Utilities](/guide/adding-custom-styles) - Extending functionality
- [Configuration](/api/configuration) - Setup and options

### Examples
- [Examples Overview](/examples/) - See BaroCSS in action
