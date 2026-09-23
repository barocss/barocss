# BaroCSS Guide

Use the [Quick Start](/guide/quick-start) to run the browser package. Read the [compatibility scope](/guide/compatibility) before using existing Tailwind markup.

## What is BaroCSS?

BaroCSS is a **CSS parsing and generation engine** that brings Tailwind's utility-first approach to runtime environments. Inspired by Tailwind CSS and UnoCSS. It consists of three main packages:

- **`@barocss/kit`** - Core parsing and generation engine
- **`@barocss/browser`** - Browser runtime with DOM change detection  
- **`@barocss/server`** - Server runtime for static CSS generation

## Key Features

### ⚡ Runtime-First
Parse and generate CSS at runtime without build processes. Perfect for dynamic content and real-time styling.

### Tailwind-style syntax
BaroCSS supports selected utilities, variants, and arbitrary values. The measured sample does not establish full Tailwind compatibility.

### 🧠 Smart Parsing
Advanced AST processing with incremental parsing and intelligent caching for optimal performance.

### 🚀 Multiple Runtimes
Browser runtime for real-time DOM detection and server runtime for static CSS generation.

### 🔧 TypeScript API
Comprehensive TypeScript API with full type safety and excellent developer experience.

### Browser and server packages
Use the browser runtime for DOM changes and the server runtime for CSS generation in Node.js.
