import { AIResponse, DisplayType, WindowSize, Priority } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationManagerOptions {
  maxHtmlSize: number;
  allowedDisplayTypes: DisplayType[];
  allowedWindowSizes: WindowSize[];
  allowedPriorities: Priority[];
  strictMode: boolean;
}

export class ValidationManager {
  private options: ValidationManagerOptions;

  constructor(options?: Partial<ValidationManagerOptions>) {
    this.options = {
      maxHtmlSize: 50 * 1024, // 50KB
      allowedDisplayTypes: ['window', 'modal', 'overlay', 'inline', 'embedded'],
      allowedWindowSizes: ['small', 'medium', 'large', 'fullscreen', 'auto'],
      allowedPriorities: ['low', 'normal', 'high', 'critical'],
      strictMode: false,
      ...options
    };
  }

  validateAIResponse(response: AIResponse): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate HTML
    if (!response.html || typeof response.html !== 'string') {
      errors.push('AIResponse.html must be a non-empty string');
    } else if (response.html.trim().length === 0) {
      errors.push('AIResponse.html cannot be empty');
    } else if (response.html.length > this.options.maxHtmlSize) {
      errors.push(`AIResponse.html exceeds maximum size of ${this.options.maxHtmlSize} bytes`);
    }

    // Validate display config
    if (!response.display) {
      errors.push('AIResponse.display is required');
    } else {
      if (!this.options.allowedDisplayTypes.includes(response.display.type)) {
        errors.push(`Invalid display.type: ${response.display.type}. Allowed: ${this.options.allowedDisplayTypes.join(', ')}`);
      }

      if (!this.options.allowedWindowSizes.includes(response.display.size)) {
        errors.push(`Invalid display.size: ${response.display.size}. Allowed: ${this.options.allowedWindowSizes.join(', ')}`);
      }

      if (response.display.priority && !this.options.allowedPriorities.includes(response.display.priority)) {
        errors.push(`Invalid display.priority: ${response.display.priority}. Allowed: ${this.options.allowedPriorities.join(', ')}`);
      }
    }

    // Validate context
    if (!response.context) {
      errors.push('AIResponse.context is required');
    } else {
      if (!response.context.id || typeof response.context.id !== 'string') {
        errors.push('AIResponse.context.id must be a non-empty string');
      }
    }

    // XSS validation (basic)
    if (response.html && this.containsXSS(response.html)) {
      errors.push('AIResponse.html contains potentially unsafe content');
    }

    // Warnings for optional fields
    if (!response.interactions) {
      warnings.push('AIResponse.interactions is missing (optional)');
    }

    if (!response.effects) {
      warnings.push('AIResponse.effects is missing (optional)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private containsXSS(html: string): boolean {
    // Basic XSS detection patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi
    ];

    return xssPatterns.some(pattern => pattern.test(html));
  }

  sanitizeHTML(html: string): string {
    // Basic HTML sanitization - remove script tags and dangerous attributes
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>.*?<\/embed>/gi, '');
  }
}
