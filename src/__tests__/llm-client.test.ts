import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMClient, LLMError, createLLMClient } from '../utils/llm-client.js';

// Store mock function reference
const mockCreate = vi.fn();

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

describe('LLMClient', () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  describe('constructor', () => {
    it('should create a client with default config', () => {
      const client = new LLMClient();
      expect(client.model).toBe('claude-sonnet-4-20250514');
    });

    it('should accept custom config', () => {
      const client = new LLMClient({
        apiKey: 'custom-key',
        model: 'claude-opus-4-20250514',
        maxTokens: 8192,
      });
      expect(client.model).toBe('claude-opus-4-20250514');
    });

    it('should throw LLMError if no API key is available', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => new LLMClient()).toThrow(LLMError);
      expect(() => new LLMClient()).toThrow(/No API key provided/);
    });

    it('should use env var if no apiKey in config', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key';
      const client = new LLMClient();
      expect(client).toBeInstanceOf(LLMClient);
    });
  });

  describe('createLLMClient factory', () => {
    it('should create an LLMClient instance', () => {
      const client = createLLMClient();
      expect(client).toBeInstanceOf(LLMClient);
    });

    it('should pass config to the client', () => {
      const client = createLLMClient({ model: 'claude-opus-4-20250514' });
      expect(client.model).toBe('claude-opus-4-20250514');
    });
  });

  describe('complete', () => {
    it('should make a completion request and return result', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello, world!' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const client = new LLMClient();
      const result = await client.complete('Say hello');

      expect(result.content).toBe('Hello, world!');
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(5);
      expect(result.stopReason).toBe('end_turn');
    });

    it('should pass system prompt to API', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const client = new LLMClient();
      await client.complete('Test prompt', {
        systemPrompt: 'You are a helpful assistant',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
        })
      );
    });

    it('should pass temperature when specified', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const client = new LLMClient();
      await client.complete('Test prompt', { temperature: 0.7 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        })
      );
    });

    it('should use custom maxTokens when specified', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const client = new LLMClient();
      await client.complete('Test prompt', { maxTokens: 1000 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1000,
        })
      );
    });
  });

  describe('chat', () => {
    it('should handle multi-turn conversations', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I can help with that!' }],
        usage: { input_tokens: 20, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const client = new LLMClient();
      const result = await client.chat([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Can you help me?' },
      ]);

      expect(result.content).toBe('I can help with that!');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'Can you help me?' },
          ],
        })
      );
    });

    it('should concatenate multiple text blocks', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'First part. ' },
          { type: 'text', text: 'Second part.' },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const client = new LLMClient();
      const result = await client.chat([{ role: 'user', content: 'Test' }]);

      expect(result.content).toBe('First part. Second part.');
    });
  });

  describe('completeJSON', () => {
    it('should parse JSON from response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: '{"name": "test", "value": 42}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const client = new LLMClient();
      const result = await client.completeJSON<{ name: string; value: number }>('Give me JSON');

      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should extract JSON from markdown code blocks', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Here is the JSON:\n```json\n{"name": "test"}\n```',
          },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const client = new LLMClient();
      const result = await client.completeJSON<{ name: string }>('Give me JSON');

      expect(result).toEqual({ name: 'test' });
    });

    it('should throw LLMError on invalid JSON', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'This is not JSON' }],
        usage: { input_tokens: 10, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const client = new LLMClient();
      await expect(client.completeJSON('Give me JSON')).rejects.toThrow(LLMError);
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is accessible', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 5, output_tokens: 1 },
        stop_reason: 'end_turn',
      });

      const client = new LLMClient();
      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when API fails', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const client = new LLMClient();
      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should wrap errors in LLMError', async () => {
      mockCreate.mockRejectedValue(new Error('Unknown error'));

      const client = new LLMClient();
      try {
        await client.complete('Test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as Error).message).toMatch(/Failed to complete LLM request/);
      }
    });
  });
});

describe('LLMError', () => {
  it('should have correct name and message', () => {
    const error = new LLMError('Test error');
    expect(error.name).toBe('LLMError');
    expect(error.message).toBe('Test error');
  });

  it('should store the cause', () => {
    const cause = new Error('Original error');
    const error = new LLMError('Wrapped error', cause);
    expect(error.cause).toBe(cause);
  });
});
