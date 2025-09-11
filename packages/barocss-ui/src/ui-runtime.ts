import { DOMManager } from "./dom-manager";
import { WindowStackManager } from "./window-stack";
import { ContextManager } from "./context-manager";
import {
  AIService,
  OrchestrateResult,
  AIResponse,
  WindowInstance,
  DisplayConfig,
  ContextInfo,
  UIRuntimeOptions,
  ErrorPolicy,
  InteractionHandler,
} from "./types";
import { LogManager } from "./log-manager";
import { ValidationManager } from "./validation-manager";

export class UIRuntime {
  readonly dom: DOMManager;
  readonly windows: WindowStackManager;
  readonly context: ContextManager;
  readonly logger: LogManager;
  readonly validator: ValidationManager;
  private ai: AIService;
  private hooks: Required<
    Pick<UIRuntimeOptions, "onBeforeRender" | "onAfterRender" | "onError">
  >;
  private errorPolicy: ErrorPolicy;

  constructor(options: UIRuntimeOptions) {
    this.dom = new DOMManager();
    this.windows = new WindowStackManager(options.layoutPolicy);
    this.context = new ContextManager();
    this.ai = options.ai;

    // Initialize managers
    this.logger = new LogManager({
      level: options.logLevel || "error",
      prefix: "[UIRuntime]",
    });

    this.validator = new ValidationManager({
      maxHtmlSize: options.validationOptions?.maxHtmlSize,
      strictMode: options.validationOptions?.strictMode,
    });

    this.hooks = {
      onBeforeRender: options.onBeforeRender || (() => {}),
      onAfterRender: options.onAfterRender || (() => {}),
      onError: options.onError || (() => {}),
    };

    // Default error policy
    this.errorPolicy = options.errorPolicy || {
      showUserFriendlyErrors: true,
      fallbackUI: (error: Error) => {
        const div = document.createElement("div");
        div.className =
          "error-fallback p-4 bg-red-50 border border-red-200 rounded-lg";
        div.innerHTML = `
          <h3 class="text-red-800 font-semibold mb-2">오류가 발생했습니다</h3>
          <p class="text-red-600 text-sm">${
            this.errorPolicy.showUserFriendlyErrors
              ? "잠시 후 다시 시도해주세요."
              : error.message
          }</p>
        `;
        return div;
      },
    };
  }

  async processUserInput(input: string): Promise<OrchestrateResult> {
    try {
      const active = this.windows.getActiveWindows();
      const focused = this.windows.getFocusedWindow()?.id ?? null;

      // Build comprehensive context for AI
      const aiContext = this.context.buildAIContext(input, active, focused);

      // Log context for debugging
      this.logger.debug("AI Context generated", {
        windowsCount: active.length,
        focusedWindow: focused,
        deviceType: aiContext.environment.deviceType,
        availableSpace: aiContext.environment.availableSpace,
        guidelines: aiContext.guidelines,
      });

      const rawResponse: AIResponse = await this.ai.generateResponse(
        input,
        aiContext
      );
      const aiResponse = this.normalizeAIResponse(rawResponse);

      // Validate AI response
      const validationResult = this.validator.validateAIResponse(aiResponse);
      if (!validationResult.isValid) {
        const error = new Error(
          `Validation failed: ${validationResult.errors.join(", ")}`
        );
        this.logger.error("AI Response validation failed", {
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        });
        throw error;
      }

      if (validationResult.warnings.length > 0) {
        this.logger.warn("AI Response validation warnings", {
          warnings: validationResult.warnings,
        });
      }

      this.hooks.onBeforeRender(aiResponse);
      const domResult = await this.dom.process(aiResponse);
      if (!domResult.success || !domResult.element) {
        return {
          success: false,
          error: domResult.error || "DOM generation failed",
        };
      }

      const element = this.ensureElementId(
        domResult.element,
        aiResponse.context.id
      );

      const windowInstance: WindowInstance = this.windows.createWindow(
        element,
        {
          type: aiResponse.display.type,
          size: aiResponse.display.size,
          draggable: true,
          resizable: true,
          modal: aiResponse.display.type === "modal",
        },
        aiResponse.display.position,
        aiResponse.context.parent
      );

      this.context.addConversation({
        id: `${Date.now()}`,
        timestamp: Date.now(),
        userInput: input,
        aiResponse,
        context: this.context.captureSnapshot(
          this.windows.getActiveWindows(),
          this.windows.getFocusedWindow()?.id ?? null
        ),
        windowsCreated: [windowInstance.id],
        windowsClosed: [],
      });

      // Set up interaction handlers for multi-step workflows
      this.setupInteractionHandlers(domResult.element, aiResponse);

      this.hooks.onAfterRender(windowInstance);
      return {
        success: true,
        element: domResult.element,
        window: windowInstance,
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error("Process user input failed", error);
        this.hooks.onError(error);

        // Return fallback UI if error policy allows
        if (this.errorPolicy.fallbackUI) {
          const fallbackElement = this.errorPolicy.fallbackUI(error);
          // Let WindowStackManager handle DOM insertion
          this.windows.createWindow(fallbackElement, {
            type: "overlay",
            size: "small",
            draggable: false,
            resizable: false,
            modal: false,
          });
          return {
            success: false,
            error: error.message,
            element: fallbackElement,
          };
        }

        return { success: false, error: error.message };
      }
      return { success: false, error: "Unknown error" };
    }
  }

  private normalizeAIResponse(response: AIResponse): AIResponse {
    const display: DisplayConfig = {
      type: response.display?.type || "inline",
      size: response.display?.size || "auto",
      position: response.display?.position || "center",
      priority: response.display?.priority || "normal",
      backdrop: response.display?.backdrop || "none",
    };
    const context: ContextInfo = {
      id: response.context?.id || `ui-${Date.now().toString(36)}`,
      parent: response.context?.parent ?? null,
      purpose: response.context?.purpose ?? "general",
      workflow: response.context?.workflow ?? null,
    };
    return {
      html: response.html || "<div></div>",
      display,
      context,
      interactions: response.interactions || {},
      effects: response.effects || { duration: 300 },
    };
  }

  private ensureElementId(element: HTMLElement, id: string): HTMLElement {
    if (!element.id) {
      element.id = id;
    }
    return element;
  }

  // Set up interaction handlers for multi-step workflows
  private setupInteractionHandlers(
    element: HTMLElement,
    aiResponse: AIResponse
  ): void {
    if (!aiResponse.interactions) return;

    // Set up event listeners for each interaction
    Object.entries(aiResponse.interactions).forEach(([selector, handler]) => {
      const elements = element.querySelectorAll(`[data-action="${selector}"]`);

      elements.forEach((el) => {
        el.addEventListener("click", async (event) => {
          event.preventDefault();
          await this.handleInteraction(selector, handler, element, aiResponse);
        });
      });
    });

    // Set up form submission handlers
    const forms = element.querySelectorAll("form");
    forms.forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await this.handleFormSubmission(form, aiResponse);
      });
    });
  }

  // Handle individual interactions (button clicks, etc.)
  private async handleInteraction(
    action: string,
    handler: InteractionHandler,
    element: HTMLElement,
    aiResponse: AIResponse
  ): Promise<void> {
    try {
      this.logger.debug("Handling interaction", { action, handler });

      // Extract data if specified
      const extractedData = this.extractInteractionData(
        element,
        handler.dataExtraction
      );

      // Update context with extracted data
      if (extractedData && Object.keys(extractedData).length > 0) {
        this.context.setCustomContext(`interaction_${action}`, extractedData);
      }

      // Generate next prompt based on interaction
      const nextPrompt =
        handler.nextPrompt || this.generateNextPrompt(action, aiResponse);

      if (nextPrompt) {
        // Continue the conversation with accumulated context
        await this.processUserInput(nextPrompt);
      }
    } catch (error) {
      this.logger.error("Interaction handling failed", { action, error });
      this.hooks.onError(
        error instanceof Error ? error : new Error("Unknown interaction error")
      );
    }
  }

  // Handle form submissions
  private async handleFormSubmission(
    form: HTMLFormElement,
    aiResponse: AIResponse
  ): Promise<void> {
    try {
      const formData = new FormData(form);
      const formObject: Record<string, unknown> = {};

      formData.forEach((value, key) => {
        formObject[key] = value;
      });

      // Store form data in context
      this.context.setCustomContext("form_data", formObject);

      // Generate next prompt based on form submission
      const nextPrompt = this.generateFormSubmissionPrompt(
        formObject,
        aiResponse
      );

      if (nextPrompt) {
        await this.processUserInput(nextPrompt);
      }
    } catch (error) {
      this.logger.error("Form submission handling failed", { error });
      this.hooks.onError(
        error instanceof Error
          ? error
          : new Error("Unknown form submission error")
      );
    }
  }

  // Extract data from form elements based on handler configuration
  private extractInteractionData(
    element: HTMLElement,
    dataExtraction?: Record<string, string>
  ): Record<string, unknown> {
    if (!dataExtraction) return {};

    const data: Record<string, unknown> = {};

    Object.entries(dataExtraction).forEach(([key, selector]) => {
      const targetElement = element.querySelector(selector) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement;
      if (targetElement) {
        data[key] = targetElement.value;
      }
    });

    return data;
  }

  // Generate next prompt based on interaction
  private generateNextPrompt(
    action: string,
    aiResponse: AIResponse
  ): string | null {
    // Check if there's a workflow with next steps
    if (
      aiResponse.workflow?.nextSteps &&
      aiResponse.workflow.nextSteps.length > 0
    ) {
      const nextStep = aiResponse.workflow.nextSteps[0];
      return `Continue to next step: ${nextStep}`;
    }

    // Generate contextual prompt based on action
    switch (action) {
      case "close":
        return "Close this window and clean up";
      case "minimize":
        return "Minimize this window";
      case "maximize":
        return "Maximize this window";
      default:
        return `User interacted with ${action}. What should happen next?`;
    }
  }

  // Generate prompt for form submission
  private generateFormSubmissionPrompt(
    formData: Record<string, unknown>,
    aiResponse: AIResponse
  ): string | null {
    // Check workflow completion criteria
    if (aiResponse.workflow?.completionCriteria) {
      const isComplete = aiResponse.workflow.completionCriteria.every(
        (criteria) => {
          // Simple completion check - can be enhanced
          return Object.keys(formData).some((key) =>
            key.includes(criteria.toLowerCase())
          );
        }
      );

      if (isComplete) {
        return "Form completed successfully. What should happen next?";
      }
    }

    // Generate contextual prompt based on form data
    const fields = Object.keys(formData).join(", ");
    return `Form submitted with fields: ${fields}. Process this data and continue the workflow.`;
  }
}
