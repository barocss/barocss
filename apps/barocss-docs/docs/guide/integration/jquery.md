# jQuery Integration

BaroCSS works seamlessly with jQuery, enabling dynamic AI-driven styling with build-free CSS generation. Perfect for existing jQuery applications that want to add modern AI-powered UI capabilities.

## Setup

### 1. Include Dependencies

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>jQuery + BaroCSS AI Integration</title>
    
    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    
    <!-- BaroCSS -->
    <script src="https://unpkg.com/@barocss/browser@latest/dist/cdn/barocss.umd.cjs"></script>
</head>
<body>
    <div id="app"></div>
    
    <script>
        $(document).ready(function() {
            // Initialize BaroCSS
            const runtime = new BaroCSS.BrowserRuntime();
            runtime.init();
            
            // Initialize AI component system
            initAISystem();
        });
    </script>
</body>
</html>
```

## AI-Driven Component System

### jQuery AI Component Generator

```javascript
class jQueryAISystem {
    constructor() {
        this.components = [];
        this.isGenerating = false;
        this.cache = new Map();
        this.templates = {
            'modern card': {
                type: 'card',
                generator: this.generateCard.bind(this)
            },
            'data widget': {
                type: 'widget', 
                generator: this.generateWidget.bind(this)
            },
            'notification': {
                type: 'notification',
                generator: this.generateNotification.bind(this)
            },
            'form panel': {
                type: 'form',
                generator: this.generateForm.bind(this)
            }
        };
    }

    // Main component generation method
    async generateComponent(prompt, config = {}) {
        if (this.isGenerating) return;
        
        this.isGenerating = true;
        this.showLoadingIndicator();
        
        try {
            const cacheKey = JSON.stringify({ prompt, config });
            
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                return this.addComponentToDOM(cached);
            }

            // Simulate AI processing
            const aiResponse = await this.simulateAIGeneration(prompt, config);
            this.cache.set(cacheKey, aiResponse);
            
            return this.addComponentToDOM(aiResponse);
            
        } finally {
            this.isGenerating = false;
            this.hideLoadingIndicator();
        }
    }

    // Generate card component
    generateCard(config) {
        const id = `card-${Date.now()}`;
        const {
            width = 320,
            height = 200,
            title = 'AI Generated Card',
            content = 'This card was created using jQuery and BaroCSS',
            color = '#667eea'
        } = config;

        const $card = $(`
            <div id="${id}" class="w-[${width}px] h-[${height}px] bg-gradient-to-br from-[${color}] to-[#764ba2] rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-[24px] m-[12px] transition-all duration-[300ms] hover:scale-[1.02] cursor-pointer relative group">
                <h3 class="text-[24px] font-[600] text-white mb-[12px] leading-[1.2]">${title}</h3>
                <p class="text-[16px] text-[rgba(255,255,255,0.9)] leading-[1.5] mb-[16px]">${content}</p>
                <button class="px-[20px] py-[8px] bg-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.3)] text-white rounded-[8px] transition-all duration-[200ms] cursor-pointer border-none font-[500]">
                    Interact
                </button>
                
                <!-- Edit controls -->
                <div class="absolute top-[8px] right-[8px] opacity-0 group-hover:opacity-100 transition-opacity duration-[200ms]">
                    <button class="ai-edit-btn w-[28px] h-[28px] bg-[rgba(0,0,0,0.5)] text-white rounded-[4px] text-[12px] cursor-pointer border-none mr-[4px]" data-action="edit">
                        ✏️
                    </button>
                    <button class="ai-remove-btn w-[28px] h-[28px] bg-[rgba(255,0,0,0.5)] text-white rounded-[4px] text-[12px] cursor-pointer border-none" data-action="remove">
                        ❌
                    </button>
                </div>
            </div>
        `);

        this.attachEventHandlers($card, id);
        return $card;
    }

    // Generate widget component
    generateWidget(config) {
        const id = `widget-${Date.now()}`;
        const {
            width = 280,
            height = 160,
            title = 'jQuery Metrics',
            value = '1,847',
            trend = '+12.3%',
            icon = '📊'
        } = config;

        const $widget = $(`
            <div id="${id}" class="w-[${width}px] h-[${height}px] bg-white rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] border-[1px] border-[#e2e8f0] p-[20px] hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-all duration-[300ms] hover:scale-[1.02] relative group">
                <div class="flex items-center justify-between mb-[16px]">
                    <h4 class="text-[14px] font-[500] text-[#64748b] uppercase tracking-[0.5px]">${title}</h4>
                    <div class="w-[32px] h-[32px] rounded-[8px] bg-[#3b82f6] bg-opacity-[0.1] flex items-center justify-center text-[16px]">
                        ${icon}
                    </div>
                </div>
                <div class="text-[28px] font-[700] text-[#1e293b] mb-[8px]">${value}</div>
                <div class="text-[12px] font-[500] text-[#10b981] flex items-center">
                    <span class="mr-[4px]">↗</span>
                    ${trend} vs last month
                </div>
                
                <!-- Edit controls -->
                <div class="absolute top-[8px] right-[8px] opacity-0 group-hover:opacity-100 transition-opacity duration-[200ms]">
                    <button class="ai-edit-btn w-[24px] h-[24px] bg-[rgba(0,0,0,0.5)] text-white rounded-[4px] text-[10px] cursor-pointer border-none mr-[4px]" data-action="edit">
                        ✏️
                    </button>
                    <button class="ai-remove-btn w-[24px] h-[24px] bg-[rgba(255,0,0,0.5)] text-white rounded-[4px] text-[10px] cursor-pointer border-none" data-action="remove">
                        ❌
                    </button>
                </div>
            </div>
        `);

        this.attachEventHandlers($widget, id);
        return $widget;
    }

    // Generate notification component
    generateNotification(config) {
        const id = `notification-${Date.now()}`;
        const {
            type = 'info',
            title = 'AI Notification',
            message = 'This notification was generated using jQuery and AI',
            duration = 5000
        } = config;

        const typeStyles = {
            info: 'bg-[#dbeafe] border-[#3b82f6] text-[#1e40af]',
            success: 'bg-[#d1fae5] border-[#10b981] text-[#047857]',
            warning: 'bg-[#fef3c7] border-[#f59e0b] text-[#92400e]',
            error: 'bg-[#fee2e2] border-[#ef4444] text-[#dc2626]'
        };

        const $notification = $(`
            <div id="${id}" class="fixed top-[20px] right-[20px] w-[320px] min-h-[80px] ${typeStyles[type]} border-l-[4px] rounded-[8px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] p-[16px] transform translate-x-[400px] transition-all duration-[300ms] z-[1000] cursor-pointer">
                <h5 class="font-[600] text-[14px] mb-[4px]">${title}</h5>
                <p class="text-[12px] opacity-[0.8] leading-[1.4]">${message}</p>
                <button class="absolute top-[8px] right-[8px] text-[16px] opacity-[0.6] hover:opacity-[1] cursor-pointer bg-transparent border-none">×</button>
            </div>
        `);

        // Animate in
        setTimeout(() => {
            $notification.css('transform', 'translate-x-[0px]');
        }, 100);

        // Auto-remove
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification($notification);
            }, duration);
        }

        // Click to dismiss
        $notification.on('click', () => {
            this.removeNotification($notification);
        });

        return $notification;
    }

    // Generate form component
    generateForm(config) {
        const id = `form-${Date.now()}`;
        const {
            width = 400,
            title = 'AI Generated Form',
            fields = [
                { label: 'Name', type: 'text', placeholder: 'Enter your name' },
                { label: 'Email', type: 'email', placeholder: 'Enter your email' },
                { label: 'Message', type: 'textarea', placeholder: 'Enter your message' }
            ]
        } = config;

        let fieldsHtml = '';
        fields.forEach(field => {
            if (field.type === 'textarea') {
                fieldsHtml += `
                    <div class="mb-[20px]">
                        <label class="block text-[14px] font-[500] text-[#374151] mb-[8px]">${field.label}</label>
                        <textarea 
                            placeholder="${field.placeholder}" 
                            class="w-full px-[16px] py-[12px] border-[1px] border-[#d1d5db] rounded-[8px] focus:border-[#3b82f6] focus:ring-[2px] focus:ring-[rgba(59,130,246,0.2)] transition-all duration-[200ms] outline-none text-[16px] placeholder:text-[#9ca3af] min-h-[100px] resize-none"
                        ></textarea>
                    </div>
                `;
            } else {
                fieldsHtml += `
                    <div class="mb-[20px]">
                        <label class="block text-[14px] font-[500] text-[#374151] mb-[8px]">${field.label}</label>
                        <input 
                            type="${field.type}" 
                            placeholder="${field.placeholder}" 
                            class="w-full px-[16px] py-[12px] border-[1px] border-[#d1d5db] rounded-[8px] focus:border-[#3b82f6] focus:ring-[2px] focus:ring-[rgba(59,130,246,0.2)] transition-all duration-[200ms] outline-none text-[16px] placeholder:text-[#9ca3af]"
                        />
                    </div>
                `;
            }
        });

        const $form = $(`
            <div id="${id}" class="w-[${width}px] bg-white rounded-[12px] shadow-[0_10px_40px_rgba(0,0,0,0.1)] p-[32px] m-[16px] relative group">
                <h3 class="text-[20px] font-[600] text-[#1e293b] mb-[24px]">${title}</h3>
                <form class="ai-form">
                    ${fieldsHtml}
                    <button type="submit" class="w-full px-[20px] py-[12px] bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-[8px] font-[500] cursor-pointer border-none transition-all duration-[200ms]">
                        Submit
                    </button>
                </form>
                
                <!-- Edit controls -->
                <div class="absolute top-[8px] right-[8px] opacity-0 group-hover:opacity-100 transition-opacity duration-[200ms]">
                    <button class="ai-edit-btn w-[28px] h-[28px] bg-[rgba(0,0,0,0.5)] text-white rounded-[4px] text-[12px] cursor-pointer border-none mr-[4px]" data-action="edit">
                        ✏️
                    </button>
                    <button class="ai-remove-btn w-[28px] h-[28px] bg-[rgba(255,0,0,0.5)] text-white rounded-[4px] text-[12px] cursor-pointer border-none" data-action="remove">
                        ❌
                    </button>
                </div>
            </div>
        `);

        this.attachEventHandlers($form, id);
        return $form;
    }

    // Attach event handlers to components
    attachEventHandlers($element, id) {
        // Edit button
        $element.find('.ai-edit-btn').on('click', (e) => {
            e.stopPropagation();
            this.openStyleEditor(id, $element);
        });

        // Remove button
        $element.find('.ai-remove-btn').on('click', (e) => {
            e.stopPropagation();
            this.removeComponent(id, $element);
        });

        // Form submission
        $element.find('.ai-form').on('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit($element);
        });
    }

    // Add component to DOM
    addComponentToDOM(component) {
        const $component = component.generator(component.config);
        
        // Add with animation
        $component.css({
            opacity: '0',
            transform: 'scale(0.9)'
        });
        
        $('#app').append($component);
        
        // Animate in
        setTimeout(() => {
            $component.animate({
                opacity: 1
            }, 300).css('transform', 'scale(1)');
        }, 50);

        this.components.push({
            id: $component.attr('id'),
            element: $component,
            type: component.type
        });

        return $component;
    }

    // Style editor modal
    openStyleEditor(id, $element) {
        const $modal = $(`
            <div class="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[2000]">
                <div class="bg-white rounded-[12px] p-[24px] w-[400px] max-w-[90vw]">
                    <h3 class="text-[18px] font-[600] text-[#1e293b] mb-[16px]">AI Style Editor</h3>
                    
                    <div class="mb-[16px]">
                        <label class="block text-[14px] font-[500] text-[#374151] mb-[8px]">Style Instruction</label>
                        <input type="text" id="style-instruction" placeholder="Describe how to modify the component..." class="w-full px-[12px] py-[8px] border-[1px] border-[#d1d5db] rounded-[6px] text-[14px] focus:border-[#3b82f6] outline-none" />
                    </div>
                    
                    <div class="grid grid-cols-2 gap-[8px] mb-[16px]">
                        <button class="quick-style px-[12px] py-[6px] bg-[#3b82f6] text-white text-[12px] rounded-[6px] cursor-pointer border-none" data-instruction="make it more vibrant">
                            More Vibrant
                        </button>
                        <button class="quick-style px-[12px] py-[6px] bg-[#10b981] text-white text-[12px] rounded-[6px] cursor-pointer border-none" data-instruction="add shadow effect">
                            Add Shadow
                        </button>
                        <button class="quick-style px-[12px] py-[6px] bg-[#f59e0b] text-white text-[12px] rounded-[6px] cursor-pointer border-none" data-instruction="make it larger">
                            Make Larger
                        </button>
                        <button class="quick-style px-[12px] py-[6px] bg-[#8b5cf6] text-white text-[12px] rounded-[6px] cursor-pointer border-none" data-instruction="add animation">
                            Add Animation
                        </button>
                    </div>
                    
                    <div class="flex gap-[8px]">
                        <button id="apply-styles" class="flex-1 px-[16px] py-[8px] bg-[#10b981] text-white rounded-[6px] cursor-pointer border-none">Apply</button>
                        <button id="cancel-styles" class="px-[16px] py-[8px] bg-[#6b7280] text-white rounded-[6px] cursor-pointer border-none">Cancel</button>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);

        // Quick style buttons
        $modal.find('.quick-style').on('click', function() {
            const instruction = $(this).data('instruction');
            $('#style-instruction').val(instruction);
        });

        // Apply styles
        $modal.find('#apply-styles').on('click', () => {
            const instruction = $('#style-instruction').val().trim();
            if (instruction) {
                this.applyStyleInstruction(id, $element, instruction);
            }
            $modal.remove();
        });

        // Cancel
        $modal.find('#cancel-styles').on('click', () => {
            $modal.remove();
        });

        // Close on overlay click
        $modal.on('click', function(e) {
            if (e.target === this) {
                $(this).remove();
            }
        });
    }

    // Apply AI style instruction
    async applyStyleInstruction(id, $element, instruction) {
        // Show processing indicator
        const $loader = $('<div class="absolute inset-0 bg-[rgba(255,255,255,0.8)] flex items-center justify-center rounded-[12px]"><div class="text-[12px] text-[#6b7280]">Applying AI styles...</div></div>');
        $element.css('position', 'relative').append($loader);

        try {
            // Simulate AI processing
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Apply style changes based on instruction
            this.processStyleInstruction($element, instruction);

        } finally {
            $loader.remove();
        }
    }

    // Process style instruction (AI simulation)
    processStyleInstruction($element, instruction) {
        const currentClasses = $element.attr('class');
        let newClasses = currentClasses;

        if (instruction.includes('vibrant')) {
            newClasses = newClasses.replace(
                'from-[#667eea] to-[#764ba2]',
                'from-[#ff6b6b] to-[#4ecdc4]'
            );
        }

        if (instruction.includes('shadow')) {
            newClasses = newClasses.replace(
                /shadow-\[0_\d+px_\d+px_rgba\(0,0,0,[\d.]+\)\]/,
                'shadow-[0_20px_60px_rgba(0,0,0,0.4)]'
            );
        }

        if (instruction.includes('larger')) {
            newClasses = newClasses.replace(
                /w-\[\d+px\]/,
                'w-[400px]'
            ).replace(
                /h-\[\d+px\]/,
                'h-[250px]'
            );
        }

        if (instruction.includes('animation')) {
            newClasses = newClasses.replace(
                'hover:scale-[1.02]',
                'hover:scale-[1.05] hover:rotate-[1deg]'
            );
        }

        // Apply the new classes
        $element.attr('class', newClasses);
    }

    // Remove component with animation
    removeComponent(id, $element) {
        $element.animate({
            opacity: 0,
            transform: 'scale(0.8)'
        }, 200, function() {
            $(this).remove();
        });

        // Remove from components array
        this.components = this.components.filter(comp => comp.id !== id);
    }

    // Remove notification
    removeNotification($notification) {
        $notification.css('transform', 'translate-x-[400px]');
        setTimeout(() => {
            $notification.remove();
        }, 300);
    }

    // Handle form submission
    handleFormSubmit($form) {
        const formData = {};
        
        $form.find('input, textarea').each(function() {
            const $field = $(this);
            const label = $field.closest('div').find('label').text();
            formData[label] = $field.val();
        });

        // Show success notification
        this.generateComponent('notification', {
            type: 'success',
            title: 'Form Submitted!',
            message: `Form data: ${JSON.stringify(formData)}`,
            duration: 3000
        });

        // Reset form
        $form[0].reset();
    }

    // Show/hide loading indicator
    showLoadingIndicator() {
        const $loader = $(`
            <div id="ai-loader" class="fixed top-[20px] left-[20px] bg-[#3b82f6] text-white px-[16px] py-[8px] rounded-[8px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] z-[1000]">
                <div class="flex items-center gap-[8px]">
                    <div class="w-[16px] h-[16px] border-[2px] border-white border-t-transparent rounded-full animate-spin"></div>
                    <span class="text-[12px]">AI is generating...</span>
                </div>
            </div>
        `);
        
        $('body').append($loader);
    }

    hideLoadingIndicator() {
        $('#ai-loader').remove();
    }

    // Simulate AI generation
    async simulateAIGeneration(prompt, config) {
        await new Promise(resolve => setTimeout(resolve, 800));

        // Find matching template
        const matchedTemplate = Object.keys(this.templates).find(key => 
            prompt.toLowerCase().includes(key)
        );

        const template = this.templates[matchedTemplate] || this.templates['modern card'];
        
        return {
            type: template.type,
            generator: template.generator,
            config: {
                ...config,
                title: this.generateTitle(prompt),
                content: this.generateContent(prompt)
            }
        };
    }

    generateTitle(prompt) {
        const titles = {
            'card': 'AI Generated Card',
            'widget': 'Dynamic Widget',
            'notification': 'Smart Notification',
            'form': 'AI Form Builder'
        };

        for (const [key, title] of Object.entries(titles)) {
            if (prompt.includes(key)) return title;
        }

        return 'AI Component';
    }

    generateContent(prompt) {
        return `This component was generated using AI based on: "${prompt}"`;
    }

// Initialize the AI system
function initAISystem() {
    const aiSystem = new jQueryAISystem();
    
    // Create control panel
    const $controlPanel = $(`
        <div class="mb-[30px] bg-white rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-[24px]">
            <h1 class="text-[24px] font-[700] text-[#1e293b] mb-[20px]">jQuery + BaroCSS AI Generator</h1>
            
            <div class="flex gap-[12px] mb-[16px]">
                <button id="btn-card" class="px-[16px] py-[8px] bg-[#3b82f6] text-white rounded-[6px] cursor-pointer border-none hover:bg-[#2563eb]">Generate Card</button>
                <button id="btn-widget" class="px-[16px] py-[8px] bg-[#10b981] text-white rounded-[6px] cursor-pointer border-none hover:bg-[#059669]">Generate Widget</button>
                <button id="btn-form" class="px-[16px] py-[8px] bg-[#f59e0b] text-white rounded-[6px] cursor-pointer border-none hover:bg-[#d97706]">Generate Form</button>
                <button id="btn-notification" class="px-[16px] py-[8px] bg-[#8b5cf6] text-white rounded-[6px] cursor-pointer border-none hover:bg-[#7c3aed]">Show Notification</button>
            </div>
            
            <div class="flex gap-[8px]">
                <input type="text" id="custom-prompt" placeholder="Describe your component..." class="flex-1 px-[12px] py-[8px] border-[1px] border-[#d1d5db] rounded-[6px] text-[14px] focus:border-[#3b82f6] outline-none" />
                <button id="btn-custom" class="px-[16px] py-[8px] bg-[#6b7280] text-white rounded-[6px] cursor-pointer border-none hover:bg-[#4b5563]">Generate</button>
            </div>
            
            <div class="mt-[16px] text-[12px] text-[#64748b]">
                Components: <span id="component-count">0</span>
            </div>
        </div>
    `);
    
    $('#app').prepend($controlPanel);

    // Attach event handlers
    $('#btn-card').on('click', () => {
        aiSystem.generateComponent('modern card');
        updateComponentCount();
    });

    $('#btn-widget').on('click', () => {
        aiSystem.generateComponent('data widget');
        updateComponentCount();
    });

    $('#btn-form').on('click', () => {
        aiSystem.generateComponent('form panel');
        updateComponentCount();
    });

    $('#btn-notification').on('click', () => {
        aiSystem.generateComponent('notification');
    });

    $('#btn-custom').on('click', () => {
        const prompt = $('#custom-prompt').val().trim();
        if (prompt) {
            aiSystem.generateComponent(prompt);
            $('#custom-prompt').val('');
            updateComponentCount();
        }
    });

    // Enter key for custom prompt
    $('#custom-prompt').on('keypress', function(e) {
        if (e.which === 13) {
            $('#btn-custom').click();
        }
    });

    function updateComponentCount() {
        setTimeout(() => {
            $('#component-count').text(aiSystem.components.length);
        }, 100);
    }

    // Demo: Generate initial components
    setTimeout(() => {
        aiSystem.generateComponent('modern card');
        updateComponentCount();
    }, 500);

    setTimeout(() => {
        aiSystem.generateComponent('data widget');
        updateComponentCount();
    }, 1000);
```

## Real-time Style Updates

### jQuery Style Animator

```javascript
class jQueryStyleAnimator {
    constructor() {
        this.activeAnimations = new Map();
    }

    // Animate style properties
    animateProperty(element, property, fromValue, toValue, duration = 300) {
        const $element = $(element);
        const animationId = Date.now();
        
        const startTime = performance.now();
        const startVal = parseFloat(fromValue) || 0;
        const endVal = parseFloat(toValue);
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentVal = startVal + (endVal - startVal) * eased;
            
            // Update the arbitrary class
            this.updateArbitraryClass($element, property, Math.round(currentVal));
            
            if (progress < 1) {
                this.activeAnimations.set(animationId, requestAnimationFrame(animate));
            } else {
                this.activeAnimations.delete(animationId);
            }
        };
        
        this.activeAnimations.set(animationId, requestAnimationFrame(animate));
        return animationId;
    }

    // Update arbitrary class value
    updateArbitraryClass($element, property, value) {
        const currentClasses = $element.attr('class');
        const regex = new RegExp(`${property}-\\[\\d+px\\]`);
        const newClasses = currentClasses.replace(regex, `${property}-[${value}px]`);
        $element.attr('class', newClasses);
    }

    // Morph between two complete style sets
    morphStyles($element, targetStyles, duration = 500) {
        const currentClasses = $element.attr('class');
        const startTime = performance.now();
        
        const morph = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            
            // Interpolate between current and target styles
            const interpolatedClasses = this.interpolateClasses(currentClasses, targetStyles, eased);
            $element.attr('class', interpolatedClasses);
            
            if (progress < 1) {
                requestAnimationFrame(morph);
            }
        };
        
        requestAnimationFrame(morph);
    }

    interpolateClasses(currentClasses, targetClasses, progress) {
        // Simple interpolation for numeric values
        return currentClasses.replace(/(\w+)-\[(\d+)px\]/g, (match, prop, value) => {
            const currentVal = parseFloat(value);
            const targetMatch = targetClasses.match(new RegExp(`${prop}-\\[(\\d+)px\\]`));
            
            if (targetMatch) {
                const targetVal = parseFloat(targetMatch[1]);
                const interpolated = currentVal + (targetVal - currentVal) * progress;
                return `${prop}-[${Math.round(interpolated)}px]`;
            }
            
            return match;
        });
    }

    // Cancel animation
    cancelAnimation(animationId) {
        if (this.activeAnimations.has(animationId)) {
            cancelAnimationFrame(this.activeAnimations.get(animationId));
            this.activeAnimations.delete(animationId);
        }
    }

    // Cancel all animations
    cancelAllAnimations() {
        this.activeAnimations.forEach((frameId) => {
            cancelAnimationFrame(frameId);
        });
        this.activeAnimations.clear();
    }

// Usage example
const animator = new jQueryStyleAnimator();

// Animate width change
$('#my-component').on('click', function() {
    animator.animateProperty(this, 'w', '320', '400', 500);
});

// Morph to new style set
$('#morph-btn').on('click', function() {
    const targetStyles = 'w-[400px] h-[300px] bg-[#ff6b6b] rounded-[20px]';
    animator.morphStyles($('#target-component'), targetStyles, 800);
});
```

## Performance Optimization

### Batch Operations Manager

```javascript
class jQueryBatchManager {
    constructor() {
        this.pendingOperations = [];
        this.batchTimeout = null;
        this.isProcessing = false;
    }

    // Add operation to batch
    addOperation(operation) {
        this.pendingOperations.push(operation);
        
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        this.batchTimeout = setTimeout(() => {
            this.processBatch();
        }, 16); // Next frame
    }

    // Process all pending operations
    processBatch() {
        if (this.isProcessing || this.pendingOperations.length === 0) {
            return;
        }

        this.isProcessing = true;
        
        // Group operations by type
        const grouped = this.groupOperations(this.pendingOperations);
        
        // Process DOM additions first
        if (grouped.add.length > 0) {
            this.batchDOMAdditions(grouped.add);
        }
        
        // Process style updates
        if (grouped.update.length > 0) {
            this.batchStyleUpdates(grouped.update);
        }
        
        // Process removals last
        if (grouped.remove.length > 0) {
            this.batchDOMRemovals(grouped.remove);
        }
        
        this.pendingOperations = [];
        this.batchTimeout = null;
        this.isProcessing = false;
    }

    groupOperations(operations) {
        return operations.reduce((acc, op) => {
            acc[op.type].push(op);
            return acc;
        }, { add: [], update: [], remove: [] });
    }

    batchDOMAdditions(operations) {
        const $container = $('#app');
        const $fragment = $(document.createDocumentFragment());
        
        operations.forEach(op => {
            $fragment.append(op.element);
        });
        
        $container.append($fragment);
    }

    batchStyleUpdates(operations) {
        operations.forEach(op => {
            $(op.selector).attr('class', op.newClasses);
        });
    }

    batchDOMRemovals(operations) {
        operations.forEach(op => {
            $(op.selector).remove();
        });
    }

// Global batch manager
const batchManager = new jQueryBatchManager();

// Usage
function addMultipleComponents(components) {
    components.forEach(component => {
        batchManager.addOperation({
            type: 'add',
            element: createComponent(component)
        });
    });

function updateMultipleStyles(updates) {
    updates.forEach(update => {
        batchManager.addOperation({
            type: 'update',
            selector: update.selector,
            newClasses: update.classes
        });
    });
```

This jQuery integration demonstrates how BaroCSS enables sophisticated AI-driven component generation with build-free styling, complete with real-time style editing, animations, and performance optimization - all using familiar jQuery patterns.
