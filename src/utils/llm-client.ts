/**
 * LLM Client Wrapper
 *
 * Provides a unified interface for interacting with the Claude API.
 * Handles API key management, request formatting, and response parsing.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock } from '@anthropic-ai/sdk/resources/messages';

/**
 * Configuration for the LLM client
 */
export interface LLMClientConfig {
  /** API key for Claude (defaults to ANTHROPIC_API_KEY env var) */
  apiKey?: string;
  /** Model to use (defaults to claude-sonnet-4-20250514) */
  model?: string;
  /** Maximum tokens in response (defaults to 4096) */
  maxTokens?: number;
}

/**
 * Internal configuration with all properties defined
 */
interface LLMClientInternalConfig {
  apiKey: string | undefined;
  model: string;
  maxTokens: number;
}

/**
 * A message in the conversation
 */
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Options for a completion request
 */
export interface CompletionOptions {
  /** System prompt to set context */
  systemPrompt?: string;
  /** Temperature for response generation (0-1) */
  temperature?: number;
  /** Maximum tokens for this specific request */
  maxTokens?: number;
}

/**
 * Result of a completion request
 */
export interface CompletionResult {
  /** The generated text content */
  content: string;
  /** Token usage statistics */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Stop reason from the API */
  stopReason: string | null;
}

/**
 * Error thrown when LLM operations fail
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * LLM Client for interacting with Claude API
 *
 * Provides methods for:
 * - Single completions with system prompts
 * - Multi-turn conversations
 * - Structured output parsing (JSON)
 */
export class LLMClient {
  private readonly config: LLMClientInternalConfig;
  private readonly client: Anthropic;

  constructor(config?: LLMClientConfig) {
    this.config = {
      apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY,
      model: config?.model ?? 'claude-sonnet-4-20250514',
      maxTokens: config?.maxTokens ?? 4096,
    };

    if (!this.config.apiKey) {
      throw new LLMError(
        'No API key provided. Set ANTHROPIC_API_KEY environment variable or pass apiKey in config.'
      );
    }

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
    });
  }

  /**
   * Get the current model being used
   */
  get model(): string {
    return this.config.model;
  }

  /**
   * Make a single completion request
   *
   * @param prompt The user prompt
   * @param options Optional configuration for this request
   * @returns The completion result
   */
  async complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  /**
   * Make a completion request with conversation history
   *
   * @param messages The conversation messages
   * @param options Optional configuration for this request
   * @returns The completion result
   */
  async chat(messages: LLMMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    try {
      const anthropicMessages: MessageParam[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const requestParams: Anthropic.Messages.MessageCreateParamsNonStreaming = {
        model: this.config.model,
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        messages: anthropicMessages,
      };

      // Only add system prompt if provided
      if (options?.systemPrompt) {
        requestParams.system = options.systemPrompt;
      }

      // Only add temperature if provided
      if (options?.temperature !== undefined) {
        requestParams.temperature = options.temperature;
      }

      const response = await this.client.messages.create(requestParams);

      const textContent = response.content
        .filter((block): block is ContentBlock & { type: 'text' } => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        content: textContent,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        stopReason: response.stop_reason,
      };
    } catch (error) {
      // Check if it's an Anthropic API error by checking the constructor name
      // This works better with mocking than instanceof
      const isApiError =
        error instanceof Error &&
        (error.constructor.name === 'APIError' ||
          (typeof Anthropic !== 'undefined' &&
            Anthropic.APIError &&
            error instanceof Anthropic.APIError));

      if (isApiError && error instanceof Error) {
        throw new LLMError(`Claude API error: ${error.message}`, error);
      }
      throw new LLMError('Failed to complete LLM request', error);
    }
  }

  /**
   * Make a completion request expecting JSON output
   *
   * @param prompt The user prompt (should instruct the model to output JSON)
   * @param options Optional configuration for this request
   * @returns Parsed JSON object
   */
  async completeJSON<T = unknown>(prompt: string, options?: CompletionOptions): Promise<T> {
    const result = await this.complete(prompt, options);

    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : result.content.trim();
      return JSON.parse(jsonString) as T;
    } catch (error) {
      throw new LLMError(
        `Failed to parse JSON response: ${result.content.substring(0, 100)}...`,
        error
      );
    }
  }

  /**
   * Check if the client is properly configured and can make requests
   *
   * @returns True if a test request succeeds
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.complete('Say "ok" and nothing else.', {
        maxTokens: 10,
        temperature: 0,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Factory function to create an LLMClient instance
 */
export function createLLMClient(config?: LLMClientConfig): LLMClient {
  return new LLMClient(config);
}
