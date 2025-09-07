# Vanilla HTML + JavaScript

BaroCSS works seamlessly with vanilla HTML and JavaScript, providing immediate CSS generation without any build process. This makes it perfect for rapid prototyping, AI-generated components, and dynamic web applications.

## Basic Setup

### 1. Include BaroCSS

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BaroCSS + AI Integration</title>
    <script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
</head>
<body>
    <div id="app"></div>
    
    <script>
        // Initialize BaroCSS
        const runtime = new BaroCSS.BrowserRuntime();
        runtime.init();
    </script>
</body>
</html>
```

### 2. Basic AI Component Generation

```javascript
// Simulate AI component generation
async function generateAIComponent(prompt) {
    // This would typically call an AI service
    const aiResponse = {
        type: 'card',
        content: 'AI-generated content',
        styles: {
            container: 'w-[320px] h-[200px] bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-[24px] m-[16px]',
            title: 'text-[24px] font-[600] text-white mb-[12px] leading-[1.2]',
            content: 'text-[16px] text-[rgba(255,255,255,0.9)] leading-[1.5]'
        }
    };
    
    return `
        <div class="${aiResponse.styles.container}">
            <h3 class="${aiResponse.styles.title}">AI Generated Card</h3>
            <p class="${aiResponse.styles.content}">${aiResponse.content}</p>
        </div>
    `;

// Add component to DOM
async function addAIComponent() {
    const component = await generateAIComponent('Create a modern card');
    document.getElementById('app').innerHTML += component;
    // BaroCSS automatically processes the new classes
```

## Dynamic Style Generation

### Real-time Style Updates

```javascript
class DynamicStyleGenerator {
    constructor() {
        this.currentTheme = 'light';
        this.animationSpeed = 300;
    }
    
    // Generate dynamic button with AI-like arbitrary values
    createButton(text, variant = 'primary') {
        const variants = {
            primary: {
                base: 'px-[24px] py-[12px] bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-[8px]',
                animation: 'transition-all duration-[300ms] hover:scale-[1.05] hover:shadow-[0_4px_20px_rgba(59,130,246,0.4)]'
            },
            secondary: {
                base: 'px-[24px] py-[12px] bg-[#6b7280] hover:bg-[#4b5563] text-white rounded-[8px]',
                animation: 'transition-all duration-[300ms] hover:scale-[1.05] hover:shadow-[0_4px_20px_rgba(107,114,128,0.4)]'
            },
            danger: {
                base: 'px-[24px] py-[12px] bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-[8px]',
                animation: 'transition-all duration-[300ms] hover:scale-[1.05] hover:shadow-[0_4px_20px_rgba(239,68,68,0.4)]'
            }
        };
        
        const style = variants[variant];
        const button = document.createElement('button');
        button.className = `${style.base} ${style.animation} cursor-pointer border-none outline-none font-[500]`;
        button.textContent = text;
        
        return button;
    }
    
    // Generate AI-styled form
    createForm(fields) {
        const form = document.createElement('form');
        form.className = 'w-[400px] bg-white rounded-[12px] shadow-[0_10px_40px_rgba(0,0,0,0.1)] p-[32px] m-[16px]';
        
        fields.forEach(field => {
            const wrapper = document.createElement('div');
            wrapper.className = 'mb-[24px]';
            
            const label = document.createElement('label');
            label.className = 'block text-[14px] font-[500] text-[#374151] mb-[8px]';
            label.textContent = field.label;
            
            const input = document.createElement('input');
            input.type = field.type || 'text';
            input.placeholder = field.placeholder || '';
            input.className = `
                w-full px-[16px] py-[12px] border-[1px] border-[#d1d5db] rounded-[8px]
                focus:border-[#3b82f6] focus:ring-[2px] focus:ring-[rgba(59,130,246,0.2)]
                transition-all duration-[200ms] outline-none
                text-[16px] placeholder:text-[#9ca3af]
            `.replace(/\s+/g, ' ').trim();
            
            wrapper.appendChild(label);
            wrapper.appendChild(input);
            form.appendChild(wrapper);
        });
        
        const submitButton = this.createButton('Submit', 'primary');
        form.appendChild(submitButton);
        
        return form;
    }

// Usage
const generator = new DynamicStyleGenerator();

// Add dynamic form
const formFields = [
    { label: 'Email', type: 'email', placeholder: 'Enter your email' },
    { label: 'Password', type: 'password', placeholder: 'Enter your password' },
    { label: 'Name', type: 'text', placeholder: 'Enter your name' }
];

const form = generator.createForm(formFields);
document.getElementById('app').appendChild(form);
```

## AI-Driven Component System

### Complete AI Component Generator

```javascript
class AIComponentSystem {
    constructor() {
        this.componentCache = new Map();
        this.themeColors = {
            primary: '#3b82f6',
            secondary: '#6b7280',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444'
        };
    }
    
    // AI-simulated component generation with complex arbitrary values
    async generateComponent(type, config = {}) {
        const cacheKey = JSON.stringify({ type, config });
        
        if (this.componentCache.has(cacheKey)) {
            return this.componentCache.get(cacheKey);
        }
        
        let component;
        
        switch (type) {
            case 'dashboard-card':
                component = this.createDashboardCard(config);
                break;
            case 'data-visualization':
                component = this.createDataVisualization(config);
                break;
            case 'notification':
                component = this.createNotification(config);
                break;
            case 'modal':
                component = this.createModal(config);
                break;
            default:
                component = this.createGenericCard(config);
        }
        
        this.componentCache.set(cacheKey, component);
        return component;
    }
    
    createDashboardCard(config) {
        const {
            title = 'Dashboard Card',
            value = '1,234',
            trend = '+12%',
            color = this.themeColors.primary,
            width = 280,
            height = 160
        } = config;
        
        const container = document.createElement('div');
        container.className = `
            w-[${width}px] h-[${height}px] bg-white rounded-[16px]
            shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-[1px] border-[#f1f5f9]
            p-[24px] flex flex-col justify-between
            hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-all duration-[300ms]
            hover:scale-[1.02] cursor-pointer
        `.replace(/\s+/g, ' ').trim();
        
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-[16px]';
        
        const titleEl = document.createElement('h3');
        titleEl.className = 'text-[14px] font-[500] text-[#64748b] uppercase tracking-[0.5px]';
        titleEl.textContent = title;
        
        const icon = document.createElement('div');
        icon.className = `w-[32px] h-[32px] rounded-[8px] bg-[${color}] bg-opacity-[0.1] flex items-center justify-center`;
        icon.innerHTML = `<div class="w-[16px] h-[16px] bg-[${color}] rounded-[4px]"></div>`;
        
        header.appendChild(titleEl);
        header.appendChild(icon);
        
        const valueEl = document.createElement('div');
        valueEl.className = 'text-[32px] font-[700] text-[#1e293b] mb-[8px]';
        valueEl.textContent = value;
        
        const trendEl = document.createElement('div');
        trendEl.className = `text-[14px] font-[500] text-[${color}] flex items-center`;
        trendEl.innerHTML = `
            <span class="mr-[4px]">↗</span>
            ${trend} from last month
        `;
        
        container.appendChild(header);
        container.appendChild(valueEl);
        container.appendChild(trendEl);
        
        return container;
    }
    
    createDataVisualization(config) {
        const {
            data = [30, 60, 45, 80, 25, 70, 55],
            color = this.themeColors.primary,
            width = 400,
            height = 200
        } = config;
        
        const container = document.createElement('div');
        container.className = `
            w-[${width}px] h-[${height}px] bg-white rounded-[12px]
            shadow-[0_6px_30px_rgba(0,0,0,0.1)] p-[20px]
            border-[1px] border-[#e2e8f0]
        `.replace(/\s+/g, ' ').trim();
        
        const title = document.createElement('h4');
        title.className = 'text-[16px] font-[600] text-[#334155] mb-[16px]';
        title.textContent = 'Live Data Visualization';
        
        const chartContainer = document.createElement('div');
        chartContainer.className = 'flex items-end justify-between h-[120px] w-full';
        
        data.forEach((value, index) => {
            const bar = document.createElement('div');
            const barHeight = (value / 100) * 120;
            const hue = (index * 30) % 360;
            
            bar.className = `
                w-[${(width - 80) / data.length - 4}px] bg-gradient-to-t
                from-[${color}] to-[hsl(${hue},70%,60%)]
                rounded-t-[4px] transition-all duration-[500ms]
                hover:scale-y-[1.1] hover:brightness-[1.1]
                cursor-pointer opacity-[0.8] hover:opacity-[1]
            `.replace(/\s+/g, ' ').trim();
            
            bar.style.height = `${barHeight}px`;
            
            // Add tooltip on hover
            bar.addEventListener('mouseenter', () => {
                bar.setAttribute('title', `Value: ${value}`);
            });
            
            chartContainer.appendChild(bar);
        });
        
        container.appendChild(title);
        container.appendChild(chartContainer);
        
        return container;
    }
    
    createNotification(config) {
        const {
            type = 'info',
            title = 'Notification',
            message = 'This is a notification message',
            duration = 5000
        } = config;
        
        const typeStyles = {
            info: 'bg-[#dbeafe] border-[#3b82f6] text-[#1e40af]',
            success: 'bg-[#d1fae5] border-[#10b981] text-[#047857]',
            warning: 'bg-[#fef3c7] border-[#f59e0b] text-[#92400e]',
            error: 'bg-[#fee2e2] border-[#ef4444] text-[#dc2626]'
        };
        
        const notification = document.createElement('div');
        notification.className = `
            fixed top-[20px] right-[20px] w-[320px] min-h-[80px]
            ${typeStyles[type]} border-l-[4px] rounded-[8px]
            shadow-[0_10px_40px_rgba(0,0,0,0.15)] p-[16px]
            transform translate-x-[400px] transition-all duration-[300ms]
            z-[1000] cursor-pointer
        `.replace(/\s+/g, ' ').trim();
        
        const titleEl = document.createElement('h5');
        titleEl.className = 'font-[600] text-[14px] mb-[4px]';
        titleEl.textContent = title;
        
        const messageEl = document.createElement('p');
        messageEl.className = 'text-[12px] opacity-[0.8] leading-[1.4]';
        messageEl.textContent = message;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'absolute top-[8px] right-[8px] text-[16px] opacity-[0.6] hover:opacity-[1] cursor-pointer bg-transparent border-none';
        closeBtn.innerHTML = '×';
        
        notification.appendChild(titleEl);
        notification.appendChild(messageEl);
        notification.appendChild(closeBtn);
        
        // Animation and auto-removal
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translate-x-[0px]';
        }, 100);
        
        const remove = () => {
            notification.style.transform = 'translate-x-[400px]';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        };
        
        closeBtn.addEventListener('click', remove);
        notification.addEventListener('click', remove);
        
        if (duration > 0) {
            setTimeout(remove, duration);
        }
        
        return notification;
    }

// Usage Examples
const aiSystem = new AIComponentSystem();

// Generate dashboard cards
async function createDashboard() {
    const app = document.getElementById('app');
    
    const dashboard = document.createElement('div');
    dashboard.className = 'grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[20px] p-[20px] bg-[#f8fafc] min-h-screen';
    
    // Add multiple dashboard cards
    const cards = await Promise.all([
        aiSystem.generateComponent('dashboard-card', {
            title: 'Total Revenue',
            value: '$45,234',
            trend: '+23%',
            color: '#10b981'
        }),
        aiSystem.generateComponent('dashboard-card', {
            title: 'Active Users',
            value: '2,345',
            trend: '+12%',
            color: '#3b82f6'
        }),
        aiSystem.generateComponent('dashboard-card', {
            title: 'Conversion Rate',
            value: '3.2%',
            trend: '+5%',
            color: '#f59e0b'
        })
    ]);
    
    cards.forEach(card => dashboard.appendChild(card));
    
    // Add data visualization
    const chart = await aiSystem.generateComponent('data-visualization', {
        data: [65, 78, 45, 88, 92, 67, 83, 71],
        color: '#8b5cf6'
    });
    dashboard.appendChild(chart);
    
    app.appendChild(dashboard);

// Create notification system
function showNotifications() {
    const notifications = [
        { type: 'success', title: 'Success!', message: 'Your data has been saved successfully.' },
        { type: 'warning', title: 'Warning', message: 'Please check your input data.' },
        { type: 'info', title: 'Info', message: 'New update available.' }
    ];
    
    notifications.forEach((notif, index) => {
        setTimeout(() => {
            aiSystem.generateComponent('notification', notif);
        }, index * 1000);
    });

// Initialize the demo
createDashboard();
setTimeout(showNotifications, 2000);
```

## Partial UI Updates

### Live Style Modifications

```javascript
class LiveStyleEditor {
    constructor(element) {
        this.element = element;
        this.originalClasses = element.className;
    }
    
    // Update specific style properties
    updateProperty(property, value) {
        // Remove existing classes for this property
        const classesToRemove = this.getClassesForProperty(property);
        classesToRemove.forEach(cls => this.element.classList.remove(cls));
        
        // Add new class with arbitrary value
        const newClass = this.generateClassForProperty(property, value);
        this.element.classList.add(newClass);
    }
    
    getClassesForProperty(property) {
        const propertyPrefixes = {
            width: ['w-'],
            height: ['h-'],
            padding: ['p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-'],
            margin: ['m-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-'],
            background: ['bg-'],
            color: ['text-'],
            fontSize: ['text-'],
            borderRadius: ['rounded-']
        };
        
        const prefixes = propertyPrefixes[property] || [];
        const existingClasses = Array.from(this.element.classList);
        
        return existingClasses.filter(cls => 
            prefixes.some(prefix => cls.startsWith(prefix))
        );
    }
    
    generateClassForProperty(property, value) {
        const propertyMap = {
            width: `w-[${value}]`,
            height: `h-[${value}]`,
            padding: `p-[${value}]`,
            margin: `m-[${value}]`,
            background: `bg-[${value}]`,
            color: `text-[${value}]`,
            fontSize: `text-[${value}]`,
            borderRadius: `rounded-[${value}]`
        };
        
        return propertyMap[property] || `${property}-[${value}]`;
    }
    
    // AI-guided style updates
    async updateWithAI(instruction) {
        // Simulate AI processing the instruction
        const updates = this.parseInstruction(instruction);
        
        updates.forEach(update => {
            this.updateProperty(update.property, update.value);
        });
    }
    
    parseInstruction(instruction) {
        // Simple instruction parsing (would use AI in real implementation)
        const updates = [];
        
        if (instruction.includes('bigger')) {
            updates.push({ property: 'fontSize', value: '24px' });
        }
        if (instruction.includes('blue')) {
            updates.push({ property: 'background', value: '#3b82f6' });
        }
        if (instruction.includes('padding')) {
            const match = instruction.match(/padding (\w+)/);
            if (match) {
                updates.push({ property: 'padding', value: match[1] });
            }
        }
        
        return updates;
    }

// Usage
const editableElements = document.querySelectorAll('[data-editable]');
editableElements.forEach(element => {
    const editor = new LiveStyleEditor(element);
    
    // Add context menu for live editing
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        const instruction = prompt('How should I modify this element?');
        if (instruction) {
            editor.updateWithAI(instruction);
        }
    });
});
```

## Performance Optimization

### Batch Operations

```javascript
class BatchOperationManager {
    constructor() {
        this.pendingOperations = [];
        this.batchTimeout = null;
    }
    
    addOperation(operation) {
        this.pendingOperations.push(operation);
        
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        this.batchTimeout = setTimeout(() => {
            this.executeBatch();
        }, 16); // Next frame
    }
    
    executeBatch() {
        const fragment = document.createDocumentFragment();
        
        this.pendingOperations.forEach(operation => {
            if (operation.type === 'add') {
                fragment.appendChild(operation.element);
            } else if (operation.type === 'modify') {
                operation.element.className = operation.classes;
            }
        });
        
        if (fragment.children.length > 0) {
            document.getElementById('app').appendChild(fragment);
        }
        
        this.pendingOperations = [];
        this.batchTimeout = null;
    }

const batchManager = new BatchOperationManager();

// Batch multiple AI-generated components
function addMultipleComponents(components) {
    components.forEach(componentHTML => {
        const element = document.createElement('div');
        element.innerHTML = componentHTML;
        
        batchManager.addOperation({
            type: 'add',
            element: element.firstElementChild
        });
    });
```

This comprehensive vanilla HTML/JavaScript integration shows how BaroCSS enables true build-free UI generation with AI-driven components, real-time style updates, and optimal performance through smart caching and batching.
