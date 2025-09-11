# AI Response Guide for BaroCSS UI Runtime

This document provides a comprehensive guide for AI services to generate accurate responses for BaroCSS UI Runtime.

## 📋 Table of Contents

1. [Response Structure Overview](#response-structure-overview)
2. [HTML Generation Guide](#html-generation-guide)
3. [Display Configuration Guide](#display-configuration-guide)
4. [Interaction Definition Guide](#interaction-definition-guide)
5. [Effects and Animation Guide](#effects-and-animation-guide)
6. [Workflow Definition Guide](#workflow-definition-guide)
7. [Context Utilization Guide](#context-utilization-guide)
8. [Example Responses](#example-responses)

---

## Response Structure Overview

AI must return an `AIResponse` object with the following structure:

```typescript
interface AIResponse {
  html: string;                    // Required: HTML to generate
  display: DisplayConfig;          // Required: Display configuration
  context: ContextInfo;           // Required: Context information
  interactions?: Record<string, InteractionHandler>;  // Optional: Interaction definitions
  effects?: {                     // Optional: Animation effects
    entrance?: string;
    exit?: string;
    duration?: number;
  };
  workflow?: {                    // Optional: Workflow definition
    currentStep: string;
    nextSteps: string[];
    completionCriteria: string[];
    dataCollection: Record<string, unknown>;
  };
}
```

---

## HTML Generation Guide

### 1. Basic Structure

All HTML must follow this structure:

```html
<div class="barocss-{type}-frame custom-positioned" 
     data-positioning-strategy="{strategy}"
     data-z-index="{zIndex}"
     data-window-data='{jsonData}'>
  
  <!-- Actual UI content -->
  
</div>
```

### 2. HTML Structure by Display Type

#### Modal
```html
<div class="barocss-modal-frame custom-positioned" 
     data-positioning-strategy="center"
     data-z-index="9999"
     data-window-data='{"theme": "dark", "priority": "high"}'>
  
  <div class="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
    <div class="modal-container bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4">
      
      <!-- Header -->
      <div class="modal-header flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">제목</h3>
        <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" data-action="close">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Content -->
      <div class="modal-content p-6">
        <!-- Actual content -->
      </div>
    </div>
  </div>
</div>
```

#### Window
```html
<div class="barocss-window-frame custom-positioned" 
     data-positioning-strategy="smart"
     data-z-index="9998"
     data-window-data='{"type": "dashboard", "user": "user@example.com"}'>
  
  <div class="window-titlebar bg-blue-50 border-b border-blue-200 p-4">
    <h3 class="text-lg font-semibold text-blue-800">Window Title</h3>
    <div class="text-sm text-blue-600">Subtitle or Description</div>
  </div>
  
  <div class="window-content p-6">
    <!-- Actual content -->
  </div>
</div>
```

#### Overlay
```html
<div class="barocss-overlay custom-positioned" 
     data-positioning-strategy="center"
     data-z-index="9997"
     data-window-data='{"type": "notification", "priority": "normal"}'>
  
  <div class="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
    <!-- Actual content -->
  </div>
</div>
```

#### Inline
```html
<div class="barocss-inline custom-positioned" 
     data-positioning-strategy="inline"
     data-z-index="9996"
     data-window-data='{"type": "widget", "embedded": true}'>
  
  <div class="inline-container">
    <!-- Actual content -->
  </div>
</div>
```

### 3. Required CSS Classes

#### Basic Framework Classes
- `barocss-{type}-frame`: Basic frame (type: modal, window, overlay, inline, embedded)
- `custom-positioned`: Indicates custom positioning usage
- `modal-backdrop`: Modal background
- `modal-container`: Modal container
- `window-titlebar`: Window title bar
- `window-content`: Window content area

#### Tailwind CSS Classes (Recommended)
- Layout: `flex`, `grid`, `space-y-4`, `gap-4`
- Colors: `bg-white`, `text-gray-900`, `border-gray-200`
- Sizing: `w-full`, `max-w-md`, `h-6`, `p-4`, `m-2`
- States: `hover:bg-blue-700`, `focus:ring-2`, `active:scale-95`
- Responsive: `md:grid-cols-2`, `lg:grid-cols-3`, `sm:text-sm`

**Important**: All styling must be applied using Tailwind CSS classes in the `class` attribute. Avoid using inline styles (`style` attribute) and utilize Tailwind classes instead.

### 4. Data Attribute Rules

#### Required Data Attributes
```html
data-positioning-strategy="{strategy}"  // center, cascade, beside-parent, overlay-parent, smart
data-z-index="{number}"                 // 9999, 9998, 9997, ...
data-window-data='{json}'              // Store data as JSON string
```

#### Interaction Data Attributes
```html
data-action="{actionName}"             // submit, close, dashboard, profile, etc.
data-target="{elementId}"              // Target element ID
data-confirm="{boolean}"               // Whether confirmation is required
```

### 5. Form Element Guide

#### Basic Form Structure
```html
<form class="space-y-4" data-action="submit">
  <div>
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      Label Text
    </label>
    <input type="email" 
           name="email" 
           required
           class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
           placeholder="Placeholder text">
  </div>
  
  <button type="submit" 
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
    Submit Button
  </button>
</form>
```

#### Input Field Types by Class
- Text: `input[type="text"]`
- Email: `input[type="email"]`
- Password: `input[type="password"]`
- Number: `input[type="number"]`
- Date: `input[type="date"]`
- Checkbox: `input[type="checkbox"]`
- Radio: `input[type="radio"]`
- Select: `select`
- Textarea: `textarea`

---

## Display Configuration Guide

### DisplayConfig Structure
```typescript
interface DisplayConfig {
  type: DisplayType;           // Required: window, modal, overlay, inline, embedded
  size: WindowSize;           // Required: small, medium, large, fullscreen, auto
  position?: string;          // Optional: center, cascade, beside-parent, overlay-parent, smart
  priority?: Priority;        // Optional: low, normal, high, critical
  backdrop?: string;          // Optional: none, blur, dim
}
```

### Recommended Settings by Type

#### Modal
```typescript
{
  type: 'modal',
  size: 'medium',           // small, medium, large
  position: 'center',       // Always center
  priority: 'high',         // Generally high
  backdrop: 'blur'          // blur or dim
}
```

#### Window
```typescript
{
  type: 'window',
  size: 'large',            // small, medium, large, fullscreen
  position: 'smart',        // smart, cascade, center
  priority: 'normal',       // normal, high
  backdrop: 'none'          // Windows have no backdrop
}
```

#### Overlay
```typescript
{
  type: 'overlay',
  size: 'small',            // small, medium
  position: 'center',       // center, cascade
  priority: 'normal',       // normal, high
  backdrop: 'none'          // Overlays have no backdrop
}
```

### Context-Based Settings

#### Screen Size Consideration
```typescript
// Based on context.environment.screenSize
if (screenWidth < 768) {
  size: 'small'              // Mobile
} else if (screenWidth < 1024) {
  size: 'medium'             // Tablet
} else {
  size: 'large'              // Desktop
}
```

#### Available Space Consideration
```typescript
// Based on context.environment.availableSpace
if (availableWidth < 400) {
  size: 'small'
} else if (availableWidth < 800) {
  size: 'medium'
} else {
  size: 'large'
}
```

---

## Interaction Definition Guide

### InteractionHandler Structure
```typescript
interface InteractionHandler {
  action: string;                    // Required: Action name
  validation?: string[];            // Optional: Validation rules
  onSuccess?: string;               // Optional: Action on success
  onError?: string;                 // Optional: Action on error
  dataExtraction?: Record<string, string>;  // Optional: Data extraction rules
  nextPrompt?: string;              // Optional: Next prompt
}
```

### Common Interaction Patterns

#### Form Submission
```typescript
'submit': {
  action: 'validate_and_submit',
  dataExtraction: { 
    email: 'input[name="email"]', 
    password: 'input[name="password"]' 
  },
  nextPrompt: 'Please verify user information and proceed to the next step'
}
```

#### Close Window
```typescript
'close': {
  action: 'close_modal',
  nextPrompt: 'Please close the window and clean up'
}
```

#### Navigation
```typescript
'dashboard': {
  action: 'navigate_dashboard',
  nextPrompt: 'Please create a user dashboard'
}
```

#### Confirm/Cancel
```typescript
'confirm': {
  action: 'confirm_action',
  nextPrompt: 'User has confirmed. Please proceed to the next step'
},
'cancel': {
  action: 'cancel_action',
  nextPrompt: 'User has cancelled. Please return to the previous state'
}
```

### Data Extraction Rules

#### Using CSS Selectors
```typescript
dataExtraction: {
  email: 'input[name="email"]',           // Select by name attribute
  password: 'input[name="password"]',     // Select by name attribute
  username: '#username',                  // Select by ID
  age: '.age-input',                      // Select by class
  country: 'select[name="country"]'       // Select select element
}
```

#### Complex Data Extraction
```typescript
dataExtraction: {
  userInfo: 'form[data-form="user-info"]',  // Entire form
  preferences: '.preference-checkbox:checked',  // Checked checkboxes
  selectedItems: '.item.selected'           // Selected items
}
```

---

## Effects and Animation Guide

### Available Effects List
```typescript
const availableEffects = [
  'fadeIn', 'fadeOut',
  'slideInFromTop', 'slideInFromBottom', 'slideInFromLeft', 'slideInFromRight',
  'scaleIn', 'scaleOut',
  'bounceIn', 'bounceOut',
  'zoomIn', 'zoomOut',
  'rotateIn', 'rotateOut',
  'flipInX', 'flipInY'
];
```

### Effect Selection Guide

#### Context-Based Selection
```typescript
// Based on context.guidelines.stylePreferences.animationStyle
switch (animationStyle) {
  case 'subtle':
    entrance: 'fadeIn'
    duration: 300
    break
  case 'dynamic':
    entrance: 'bounceIn'
    duration: 500
    break
  case 'minimal':
    entrance: 'slideInFromTop'
    duration: 200
    break
}
```

#### Recommended Effects by UI Type
```typescript
// Modal
effects: { entrance: 'fadeIn', duration: 300 }

// Window
effects: { entrance: 'slideInFromTop', duration: 400 }

// Overlay
effects: { entrance: 'scaleIn', duration: 200 }

// Notification
effects: { entrance: 'bounceIn', duration: 500 }
```

### Duration Settings
```typescript
// Based on context.guidelines.stylePreferences.animationStyle
const duration = animationStyle === 'minimal' ? 200 : 
                 animationStyle === 'dynamic' ? 500 : 300;
```

---

## Workflow Definition Guide

### Workflow Structure
```typescript
interface Workflow {
  currentStep: string;              // Current step
  nextSteps: string[];             // Next steps
  completionCriteria: string[];    // Completion criteria
  dataCollection: Record<string, unknown>;  // Collected data
}
```

### Step-by-Step Workflow Examples

#### Login Workflow
```typescript
{
  currentStep: 'login_form',
  nextSteps: ['validation', 'dashboard_redirect'],
  completionCriteria: ['email', 'password'],
  dataCollection: {}
}
```

#### Survey Workflow
```typescript
{
  currentStep: 'question_1',
  nextSteps: ['question_2', 'question_3', 'completion'],
  completionCriteria: ['name', 'email', 'answers'],
  dataCollection: { currentQuestion: 1, totalQuestions: 3 }
}
```

#### Shopping Workflow
```typescript
{
  currentStep: 'product_selection',
  nextSteps: ['cart_review', 'checkout', 'payment'],
  completionCriteria: ['products', 'shipping', 'payment_method'],
  dataCollection: { cartItems: [], totalAmount: 0 }
}
```

---

## Context Utilization Guide

### Context Data Utilization

#### User Information Utilization
```typescript
// Extract user information from context.entities.form_data
const userEmail = context.entities.form_data?.email || 'guest@example.com';
const userName = context.entities.form_data?.name || 'Guest';

// Reflect user information in HTML
html: `<h2>Welcome, ${userName}!</h2>`
```

#### Previous Conversation History Utilization
```typescript
// Check previous requests from context.history
const lastRequest = context.history[context.history.length - 1];
if (lastRequest?.userInput.includes('login')) {
  // Follow-up processing for login
}
```

#### Environment Information Utilization
```typescript
// Check screen size from context.environment
const { screenSize, deviceType } = context.environment;

if (deviceType === 'mobile') {
  // Generate mobile-optimized UI
  size: 'small'
  layout: 'vertical'
} else {
  // Generate desktop-optimized UI
  size: 'large'
  layout: 'grid'
}
```

#### Guidelines Utilization
```typescript
// Check style preferences from context.guidelines
const { colorScheme, animationStyle, layoutDensity } = context.guidelines.stylePreferences;

// Apply color scheme
const primaryColor = colorScheme === 'blue' ? 'blue-600' : 'green-600';
const bgClass = `bg-${primaryColor}`;

// Apply layout density
const spacing = layoutDensity === 'compact' ? 'space-y-2' : 
                layoutDensity === 'spacious' ? 'space-y-6' : 'space-y-4';
```

### Dynamic Data Binding

#### User Data Display
```typescript
// Reflect data collected from forms in UI
const formData = context.entities.form_data || {};
const displayData = {
  email: formData.email || 'No email',
  name: formData.name || 'No name',
  age: formData.age || 'No age'
};

html: `
  <div class="user-info">
    <p>Email: ${displayData.email}</p>
    <p>Name: ${displayData.name}</p>
    <p>Age: ${displayData.age}</p>
  </div>
`
```

#### Conditional UI Generation
```typescript
// Generate UI based on user permissions
const userRole = context.entities.user_role || 'guest';

if (userRole === 'admin') {
  // Admin-only UI
  html += `<button data-action="admin_panel">Admin Panel</button>`;
} else if (userRole === 'user') {
  // Regular user UI
  html += `<button data-action="profile">Profile</button>`;
}
```

---

## Example Responses

### 1. Login Form Response
```typescript
{
  html: `
    <div class="barocss-modal-frame custom-positioned" 
         data-positioning-strategy="center"
         data-z-index="9999"
         data-window-data='{"theme": "dark", "priority": "high"}'>
      
      <div class="modal-backdrop fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div class="modal-container bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full mx-4">
          
          <div class="modal-header flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Login</h3>
            <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" data-action="close">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="modal-content p-6">
            <form class="space-y-4" data-action="submit">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input type="email" name="email" required
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                       placeholder="Enter your email">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input type="password" name="password" required
                       class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                       placeholder="Enter your password">
              </div>
              
              <button type="submit" 
                      class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors">
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
  
  display: {
    type: 'modal',
    size: 'medium',
    position: 'center',
    priority: 'high',
    backdrop: 'blur'
  },
  
  context: {
    id: 'login-form-1703123456789',
    parent: null,
    purpose: 'user_authentication',
    workflow: 'user_onboarding'
  },
  
  interactions: {
    'submit': {
      action: 'validate_and_submit',
      dataExtraction: { 
        email: 'input[name="email"]', 
        password: 'input[name="password"]' 
      },
      nextPrompt: 'Please verify user information and proceed to the next step'
    },
    'close': {
      action: 'close_modal',
      nextPrompt: 'Please cancel login and return to the beginning'
    }
  },
  
  effects: {
    entrance: 'fadeIn',
    duration: 300
  },
  
  workflow: {
    currentStep: 'login_form',
    nextSteps: ['validation', 'dashboard_redirect'],
    completionCriteria: ['email', 'password'],
    dataCollection: {}
  }
}
```

### 2. Dashboard Response
```typescript
{
  html: `
    <div class="barocss-window-frame custom-positioned" 
         data-positioning-strategy="smart"
         data-z-index="9999"
         data-window-data='{"type": "dashboard", "user": "user@example.com"}'>
      
      <div class="window-titlebar bg-blue-50 border-b border-blue-200 p-4">
        <h3 class="text-lg font-semibold text-blue-800">Dashboard</h3>
        <div class="text-sm text-blue-600">user@example.com</div>
      </div>
      
      <div class="window-content p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="bg-white rounded-lg shadow p-4 border">
            <h4 class="font-semibold text-gray-800 mb-2">Total Projects</h4>
            <p class="text-3xl font-bold text-blue-600">12</p>
          </div>
          
          <div class="bg-white rounded-lg shadow p-4 border">
            <h4 class="font-semibold text-gray-800 mb-2">Completed Tasks</h4>
            <p class="text-3xl font-bold text-green-600">8</p>
          </div>
          
          <div class="bg-white rounded-lg shadow p-4 border">
            <h4 class="font-semibold text-gray-800 mb-2">In Progress</h4>
            <p class="text-3xl font-bold text-yellow-600">4</p>
          </div>
        </div>
        
        <div class="mt-6 space-y-2">
          <button class="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md" data-action="new_project">
            Create New Project
          </button>
          <button class="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md" data-action="view_reports">
            View Reports
          </button>
        </div>
      </div>
    </div>
  `,
  
  display: {
    type: 'window',
    size: 'large',
    position: 'smart'
  },
  
  context: {
    id: 'dashboard-1703123456791',
    parent: null,
    purpose: 'main_dashboard',
    workflow: 'user_onboarding'
  },
  
  interactions: {
    'new_project': {
      action: 'create_project',
      nextPrompt: 'Please create a new project form'
    },
    'view_reports': {
      action: 'view_reports',
      nextPrompt: 'Please create a reports page'
    }
  },
  
  effects: {
    entrance: 'zoomIn',
    duration: 400
  }
}
```

### 3. Error Message Response
```typescript
{
  html: `
    <div class="barocss-overlay custom-positioned" 
         data-positioning-strategy="center"
         data-z-index="9998">
      
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <div class="flex items-center">
          <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
          </svg>
          <strong>Error:</strong> Please enter both email and password.
        </div>
        <div class="mt-2">
          <button class="text-red-500 hover:text-red-700 font-medium" data-action="retry">
            Try Again
          </button>
        </div>
      </div>
    </div>
  `,
  
  display: {
    type: 'overlay',
    size: 'small',
    position: 'center'
  },
  
  context: {
    id: 'error-1703123456792',
    parent: null,
    purpose: 'error_display'
  },
  
  interactions: {
    'retry': {
      action: 'retry_login',
      nextPrompt: 'Please display the login form again'
    }
  },
  
  effects: {
    entrance: 'bounceIn',
    duration: 300
  }
}
```

---

## Checklist

When AI generates responses, check the following items:

### ✅ HTML Structure
- [ ] Correct `barocss-{type}-frame` class usage
- [ ] `custom-positioned` class included
- [ ] Required data attributes set (`data-positioning-strategy`, `data-z-index`, `data-window-data`)
- [ ] `data-action` attribute set on interaction elements
- [ ] **All styling applied using Tailwind CSS classes in `class` attribute**
- [ ] No inline styles (`style` attribute) used
- [ ] Accessibility considered (aria-label, role, etc.)

### ✅ Display Settings
- [ ] Appropriate `type` selected for context
- [ ] Appropriate `size` selected for screen size
- [ ] Appropriate `position` strategy selected
- [ ] Appropriate `priority` set

### ✅ Interaction Definition
- [ ] `data-action` set on all clickable elements
- [ ] `dataExtraction` rules defined for form submissions
- [ ] Appropriate `nextPrompt` set
- [ ] Action flow considering user experience

### ✅ Context Utilization
- [ ] Previous data reflected in UI
- [ ] Responsive design considering environment information
- [ ] User preferences reflected
- [ ] History-based personalization

By following this guide, AI can generate accurate and consistent responses! 🚀
