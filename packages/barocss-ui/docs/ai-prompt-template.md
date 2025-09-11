# AI Prompt Template for BaroCSS UI Runtime

This document provides prompt templates and system messages to be sent to AI services.

## 📋 Table of Contents

1. [System Message](#system-message)
2. [User Prompt Template](#user-prompt-template)
3. [Context Utilization Guide](#context-utilization-guide)
4. [Response Validation Checklist](#response-validation-checklist)

---

## System Message

System message to use when initializing AI services:

```
You are a professional AI assistant for BaroCSS UI Runtime.
Your main role is to receive natural language input from users and generate complete HTML UI.

## Main Responsibilities
1. Analyze user requests and generate appropriate UI components
2. Utilize provided context information to provide personalized UI
3. Define interactions for user engagement
4. Suggest next steps that fit the workflow

## Response Format
You must respond in the following JSON format:

```json
{
  "html": "Complete HTML string",
  "display": {
    "type": "modal|window|overlay|inline|embedded",
    "size": "small|medium|large|fullscreen|auto",
    "position": "center|cascade|beside-parent|overlay-parent|smart",
    "priority": "low|normal|high|critical",
    "backdrop": "none|blur|dim"
  },
  "context": {
    "id": "Unique identifier",
    "parent": "Parent ID or null",
    "purpose": "Purpose description",
    "workflow": "Workflow name"
  },
  "interactions": {
    "actionName": {
      "action": "Action type",
      "dataExtraction": {
        "dataKey": "CSS selector"
      },
      "nextPrompt": "Next prompt"
    }
  },
  "effects": {
    "entrance": "fadeIn|slideInFromTop|scaleIn|bounceIn|zoomIn|rotateIn|flipInX|flipInY",
    "duration": 300
  },
  "workflow": {
    "currentStep": "Current step",
    "nextSteps": ["Next step 1", "Next step 2"],
    "completionCriteria": ["Completion criteria 1", "Completion criteria 2"],
    "dataCollection": {}
  }
}
```

## HTML Generation Rules
1. All HTML must start with a top-level div with `barocss-{type}-frame` class
2. `custom-positioned` class is required
3. Required data attributes: `data-positioning-strategy`, `data-z-index`, `data-window-data`
4. `data-action` attribute is required for interaction elements
5. **Styling must be applied using Tailwind CSS classes in the `class` attribute** (inline styles prohibited)
6. Consider accessibility (aria-label, role, etc.)

## Context Utilization
Utilize the following information from the provided context:
- environment: Screen size, device type, theme
- guidelines: Preferred display type, maximum size, positioning strategy
- entities: User data, form data, previous interaction data
- history: Previous conversation records
- resources: Available effects, handlers, strategies

## Important Notes
- HTML must be complete and executable
- Provide nextPrompt for all interactions
- Design intuitive UI considering user experience
- Apply responsive design
- Handle error situations appropriately
```

---

## User Prompt Template

### Basic Template

```
User Input: {userInput}

Context Information:
- Current Active Windows: {windowsCount}
- Focused Window: {focusedWindowId}
- Device Type: {deviceType}
- Screen Size: {screenWidth}x{screenHeight}
- Available Space: {availableWidth}x{availableHeight}
- Theme: {theme}
- Preferred Display Type: {preferredDisplayType}
- Maximum Window Size: {maxWindowSize}
- Positioning Strategy: {positioningStrategy}
- Color Scheme: {colorScheme}
- Animation Style: {animationStyle}
- Layout Density: {layoutDensity}
- Available Effects: {availableEffects}
- Registered Handlers: {registeredHandlers}

User Data:
{entities}

Conversation History:
{history}

Based on the above information, generate a complete HTML UI that matches the user's request.
```

### Detailed Template

```
## User Request
{userInput}

## Current State
- Active Window Count: {currentState.windows.length}
- Focused Window: {currentState.focused}
- Workflow Stage: {currentState.workflow.currentStage}

## Environment Information
- Screen Size: {environment.screenSize.width}x{environment.screenSize.height}
- Available Space: {environment.availableSpace.width}x{environment.availableSpace.height}
- Device Type: {environment.deviceType}
- Theme: {environment.theme}

## UI Guidelines
- Preferred Display Type: {guidelines.preferredDisplayType}
- Maximum Window Size: {guidelines.maxWindowSize}
- Positioning Strategy: {guidelines.positioningStrategy}
- Color Scheme: {guidelines.stylePreferences.colorScheme}
- Animation Style: {guidelines.stylePreferences.animationStyle}
- Layout Density: {guidelines.stylePreferences.layoutDensity}

## Available Resources
- Available Effects: {resources.availableEffects.join(', ')}
- Custom Positioning Strategies: {resources.customPositioningStrategies.join(', ')}
- Registered Handlers: {resources.registeredHandlers.join(', ')}

## User Data
{Object.entries(entities).map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`).join('\n')}

## Conversation History
{history.map((entry, index) => `${index + 1}. ${entry.userInput} (${new Date(entry.timestamp).toLocaleTimeString()})`).join('\n')}

## Requirements
1. Generate UI considering all the above context
2. Appropriately reflect user data in UI
3. Maintain consistency with previous conversation flow
4. Apply responsive design
5. Consider accessibility
6. Provide nextPrompt for all interactions

Please respond in JSON format.
```

---

## Context Utilization Guide

### 1. Environment Information Utilization

```javascript
// UI adjustment based on screen size
if (context.environment.screenSize.width < 768) {
  // Mobile optimization
  size = 'small'
  layout = 'vertical'
  spacing = 'compact'
} else if (context.environment.screenSize.width < 1024) {
  // Tablet optimization
  size = 'medium'
  layout = 'grid-2'
  spacing = 'comfortable'
} else {
  // Desktop optimization
  size = 'large'
  layout = 'grid-3'
  spacing = 'spacious'
}

// Consider available space
if (context.environment.availableSpace.width < 400) {
  size = 'small'
} else if (context.environment.availableSpace.width < 800) {
  size = 'medium'
} else {
  size = 'large'
}
```

### 2. User Data Utilization

```javascript
// Utilize form data
const formData = context.entities.form_data || {}
const userEmail = formData.email || 'guest@example.com'
const userName = formData.name || 'Guest'

// Reflect user information in HTML
html: `
  <div class="user-greeting">
    <h2>Welcome, ${userName}!</h2>
    <p>Email: ${userEmail}</p>
  </div>
`
```

### 3. History-Based Personalization

```javascript
// Analyze previous request patterns
const lastRequest = context.history[context.history.length - 1]
if (lastRequest?.userInput.includes('login')) {
  // Follow-up processing for login
  nextSteps = ['dashboard', 'profile_setup']
} else if (lastRequest?.userInput.includes('survey')) {
  // Follow-up processing for survey
  nextSteps = ['question_2', 'completion']
}
```

### 4. Guidelines Application

```javascript
// Apply color scheme
const primaryColor = context.guidelines.stylePreferences.colorScheme
const bgClass = `bg-${primaryColor}-600`
const textClass = `text-${primaryColor}-800`

// Apply animation style
const animationStyle = context.guidelines.stylePreferences.animationStyle
const entrance = animationStyle === 'subtle' ? 'fadeIn' : 
                 animationStyle === 'dynamic' ? 'bounceIn' : 'slideInFromTop'
const duration = animationStyle === 'minimal' ? 200 : 
                 animationStyle === 'dynamic' ? 500 : 300
```

---

## Response Validation Checklist

After AI generates a response, check the following items:

### ✅ Required Fields Validation
- [ ] `html` field exists and is not empty
- [ ] `display` field exists and has correct structure
- [ ] `context` field exists and includes required properties
- [ ] `interactions` field exists and has correct structure (optional)
- [ ] `effects` field exists and has correct structure (optional)
- [ ] `workflow` field exists and has correct structure (optional)

### ✅ HTML Structure Validation
- [ ] Top-level div has `barocss-{type}-frame` class
- [ ] `custom-positioned` class included
- [ ] `data-positioning-strategy` attribute set
- [ ] `data-z-index` attribute set
- [ ] `data-window-data` attribute set (valid JSON)
- [ ] All interaction elements have `data-action` attribute
- [ ] Form elements have appropriate `name` attribute
- [ ] **All styling applied using Tailwind CSS classes in `class` attribute**
- [ ] No inline styles (`style` attribute) used

### ✅ Display Settings Validation
- [ ] `type` has valid value (modal, window, overlay, inline, embedded)
- [ ] `size` has valid value (small, medium, large, fullscreen, auto)
- [ ] `position` has valid value (center, cascade, beside-parent, overlay-parent, smart)
- [ ] `priority` has valid value (low, normal, high, critical)
- [ ] `backdrop` has valid value (none, blur, dim)

### ✅ Interaction Validation
- [ ] Interaction definitions correspond to all `data-action` elements
- [ ] `dataExtraction` rules defined for form submissions
- [ ] Appropriate `nextPrompt` provided for each interaction
- [ ] CSS selectors are valid

### ✅ Context Utilization Validation
- [ ] User data reflected in UI
- [ ] Environment information considered
- [ ] Guidelines applied
- [ ] Consistency maintained with history

### ✅ User Experience Validation
- [ ] Intuitive UI structure
- [ ] Appropriate visual hierarchy
- [ ] Clear action buttons
- [ ] Error situation handling
- [ ] Loading state consideration

---

## Example Prompts

### Login Form Request
```
User Input: Please create a login form

Context Information:
- Current Active Windows: 0
- Device Type: desktop
- Screen Size: 1920x1080
- Preferred Display Type: modal
- Maximum Window Size: large
- Positioning Strategy: center
- Color Scheme: blue
- Animation Style: subtle

User Data: {}

Conversation History: []

Based on the above information, generate a complete HTML UI that matches the user's request.
```

### Post-Form Submission Processing
```
User Input: Please verify user information and proceed to the next step

Context Information:
- Current Active Windows: 1
- Focused Window: window-123
- Device Type: desktop
- Screen Size: 1920x1080
- Preferred Display Type: window
- Maximum Window Size: large
- Positioning Strategy: smart

User Data:
- form_data: {"email": "user@example.com", "password": "123456"}

Conversation History:
1. Please create a login form (14:30:56)

Based on the above information, generate a complete HTML UI that matches the user's request.
```

By using this template, AI can generate consistent and accurate responses! 🚀
