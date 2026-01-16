/**
 * Tests for the Spec Analyzer module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SpecAnalyzer,
  createSpecAnalyzer,
  categorizeDecision,
  scoreAmbiguity,
  TECH_LEAD_ANALYSIS_PROMPT,
} from '../utils/spec-analyzer.js';
import type { FeatureContext, DecisionCategory } from '../types/index.js';

// Mock the LLM client
vi.mock('../utils/llm-client.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    completeJSON: vi.fn(),
  })),
}));

describe('SpecAnalyzer', () => {
  const mockContext: FeatureContext = {
    specPath: '/path/to/spec.md',
    specContent: '# Test Feature\n\n## Overview\n\nThis is a test feature.',
    parsedSpec: {
      title: 'Test Feature',
      overview: 'This is a test feature.',
      otherSections: {},
    },
    projectContext: {
      projectRoot: '/path/to/project',
      existingDecisions: [],
    },
  };

  describe('createSpecAnalyzer', () => {
    it('should create a SpecAnalyzer instance', () => {
      const analyzer = createSpecAnalyzer({ apiKey: 'test-key' });
      expect(analyzer).toBeInstanceOf(SpecAnalyzer);
    });
  });

  describe('TECH_LEAD_ANALYSIS_PROMPT', () => {
    it('should contain decision categories', () => {
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('architecture');
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('library');
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('pattern');
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('integration');
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('data-model');
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('api-design');
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('security');
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('performance');
    });

    it('should contain clarity score guidance', () => {
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('Clarity Score');
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('0 to 1');
    });

    it('should request JSON output format', () => {
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('JSON');
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('"decisions"');
      expect(TECH_LEAD_ANALYSIS_PROMPT).toContain('"ambiguities"');
    });
  });
});

describe('categorizeDecision', () => {
  const testCases: Array<{ description: string; expected: DecisionCategory }> = [
    { description: 'What architecture should we use?', expected: 'architecture' },
    { description: 'System structure and component organization', expected: 'architecture' },
    { description: 'Which library for date formatting?', expected: 'library' },
    { description: 'Select npm package for validation', expected: 'library' },
    { description: 'What pattern and approach should we use here?', expected: 'pattern' },
    { description: 'Implementation approach and method for this', expected: 'pattern' },
    { description: 'How to integrate with external service?', expected: 'integration' },
    { description: 'API integration with third-party webhook', expected: 'integration' },
    { description: 'Database schema design', expected: 'data-model' },
    { description: 'Entity model relationships', expected: 'data-model' },
    { description: 'REST API endpoint design', expected: 'api-design' },
    { description: 'GraphQL response format', expected: 'api-design' },
    { description: 'Authentication and authorization', expected: 'security' },
    { description: 'Token-based access control', expected: 'security' },
    { description: 'Cache performance optimization', expected: 'performance' },
    { description: 'Scaling and latency performance improvements', expected: 'performance' },
  ];

  testCases.forEach(({ description, expected }) => {
    it(`should categorize "${description.substring(0, 40)}..." as ${expected}`, () => {
      const result = categorizeDecision(description);
      expect(result).toBe(expected);
    });
  });

  it('should default to architecture for unclear descriptions', () => {
    const result = categorizeDecision('Something completely unrelated');
    expect(result).toBe('architecture');
  });
});

describe('scoreAmbiguity', () => {
  describe('high ambiguity indicators', () => {
    it('should score empty text as fully ambiguous', () => {
      expect(scoreAmbiguity('')).toBe(1.0);
      expect(scoreAmbiguity('   ')).toBe(1.0);
    });

    it('should increase score for TBD markers', () => {
      const withTbd = scoreAmbiguity('The authentication method is TBD');
      const withoutTbd = scoreAmbiguity('The authentication method is OAuth2');
      expect(withTbd).toBeGreaterThan(withoutTbd);
    });

    it('should increase score for uncertainty terms', () => {
      const uncertain = scoreAmbiguity('We might use Redis or maybe memcached');
      const certain = scoreAmbiguity('We will use Redis for caching');
      expect(uncertain).toBeGreaterThan(certain);
    });

    it('should increase score for question marks', () => {
      const withQuestions = scoreAmbiguity('Should we use TypeScript? What about tests?');
      const withoutQuestions = scoreAmbiguity('We use TypeScript with Jest tests.');
      expect(withQuestions).toBeGreaterThan(withoutQuestions);
    });

    it('should increase score for short content', () => {
      const short = scoreAmbiguity('Use Redis');
      const long = scoreAmbiguity(
        'We will use Redis as our caching layer because it provides excellent performance for our use case'
      );
      expect(short).toBeGreaterThan(long);
    });
  });

  describe('low ambiguity indicators', () => {
    it('should decrease score for definitive terms', () => {
      const definitive = scoreAmbiguity('The system must use PostgreSQL as required');
      const vague = scoreAmbiguity('The system could possibly use some database');
      expect(definitive).toBeLessThan(vague);
    });

    it('should handle mixed signals appropriately', () => {
      const mixed = scoreAmbiguity(
        'The system must use authentication, but the specific method is TBD and we are not sure about the approach, maybe OAuth?'
      );
      // Should be somewhere in the middle (has both TBD/maybe AND must)
      expect(mixed).toBeGreaterThan(0.1);
      expect(mixed).toBeLessThan(0.8);
    });
  });

  describe('score bounds', () => {
    it('should always return a score between 0 and 1', () => {
      const testCases = [
        '',
        'x',
        'A very long and detailed specification with many requirements and constraints',
        'TBD TBD TBD maybe possibly unclear?????',
        'MUST REQUIRED SHALL MANDATORY specifically exactly',
      ];

      for (const text of testCases) {
        const score = scoreAmbiguity(text);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('SpecAnalyzer.analyze', () => {
  let analyzer: SpecAnalyzer;
  let mockCompleteJSON: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Get the mocked LLMClient
    const { LLMClient } = await import('../utils/llm-client.js');
    mockCompleteJSON = vi.fn();
    (LLMClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      completeJSON: mockCompleteJSON,
    }));

    analyzer = new SpecAnalyzer({ apiKey: 'test-key' });
  });

  it('should return decisions and ambiguities from LLM response', async () => {
    mockCompleteJSON.mockResolvedValue({
      decisions: [
        {
          title: 'Database Choice',
          category: 'data-model',
          description: 'Select primary database',
          clarityScore: 0.5,
          options: ['PostgreSQL', 'MongoDB'],
        },
      ],
      ambiguities: [
        {
          description: 'Authentication method unclear',
          location: 'Security section',
          suggestedQuestions: ['OAuth or JWT?'],
        },
      ],
      summary: 'Test summary',
    });

    const result = await analyzer.analyze({
      specPath: '/test.md',
      specContent: '# Test',
      parsedSpec: { title: 'Test', otherSections: {} },
      projectContext: { projectRoot: '/test', existingDecisions: [] },
    });

    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0].title).toBe('Database Choice');
    expect(result.decisions[0].category).toBe('data-model');
    expect(result.decisions[0].clarityScore).toBe(0.5);
    expect(result.decisions[0].options).toEqual(['PostgreSQL', 'MongoDB']);

    expect(result.ambiguities).toHaveLength(1);
    expect(result.ambiguities[0].description).toBe('Authentication method unclear');

    expect(result.summary).toBe('Test summary');
  });

  it('should clamp clarity scores to 0-1 range', async () => {
    mockCompleteJSON.mockResolvedValue({
      decisions: [
        { title: 'Test', category: 'architecture', description: 'Test', clarityScore: 1.5 },
        { title: 'Test2', category: 'library', description: 'Test2', clarityScore: -0.5 },
      ],
      ambiguities: [],
      summary: 'Test',
    });

    const result = await analyzer.analyze({
      specPath: '/test.md',
      specContent: '# Test',
      parsedSpec: { title: 'Test', otherSections: {} },
      projectContext: { projectRoot: '/test', existingDecisions: [] },
    });

    expect(result.decisions[0].clarityScore).toBe(1);
    expect(result.decisions[1].clarityScore).toBe(0);
  });

  it('should default unknown categories to architecture', async () => {
    mockCompleteJSON.mockResolvedValue({
      decisions: [
        { title: 'Test', category: 'unknown-category', description: 'Test', clarityScore: 0.5 },
      ],
      ambiguities: [],
      summary: 'Test',
    });

    const result = await analyzer.analyze({
      specPath: '/test.md',
      specContent: '# Test',
      parsedSpec: { title: 'Test', otherSections: {} },
      projectContext: { projectRoot: '/test', existingDecisions: [] },
    });

    expect(result.decisions[0].category).toBe('architecture');
  });

  it('should include existing decisions in context', async () => {
    mockCompleteJSON.mockResolvedValue({
      decisions: [],
      ambiguities: [],
      summary: 'Test',
    });

    await analyzer.analyze({
      specPath: '/test.md',
      specContent: '# Test',
      parsedSpec: { title: 'Test', otherSections: {} },
      projectContext: {
        projectRoot: '/test',
        existingDecisions: [
          { id: 'ADR-001', title: 'Use TypeScript', status: 'Accepted', path: '/docs/adr/001.md' },
        ],
      },
    });

    // Check that the LLM was called with context including existing decisions
    expect(mockCompleteJSON).toHaveBeenCalled();
    const callArg = mockCompleteJSON.mock.calls[0][0];
    expect(callArg).toContain('ADR-001');
    expect(callArg).toContain('Use TypeScript');
  });
});
