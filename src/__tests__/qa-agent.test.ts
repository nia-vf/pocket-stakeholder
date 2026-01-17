import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QAAgent, createQAAgent } from '../agents/qa-agent.js';
import type { FeatureContext, ParsedSpec, ProjectContext } from '../types/index.js';

// Mock the LLM client to avoid requiring API key
vi.mock('../utils/llm-client.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    completeJSON: vi.fn().mockResolvedValue({
      testingConsiderations: [
        {
          area: 'Authentication',
          description: 'Test user login and session handling',
          priority: 'high',
          suggestedTestTypes: ['unit', 'integration', 'e2e'],
        },
      ],
      edgeCases: [
        {
          description: 'Empty input fields',
          scenario: 'User submits form with empty required fields',
          expectedBehavior: 'Show validation errors',
          risk: 'medium',
        },
      ],
      failureModes: [
        {
          component: 'API connection',
          failureDescription: 'Network timeout',
          impact: 'User cannot complete action',
          suggestedMitigation: 'Retry with exponential backoff',
        },
      ],
      validationRequirements: [
        {
          field: 'email',
          validationType: 'input',
          rules: ['Valid email format', 'Not empty'],
          errorHandling: 'Show inline error message',
        },
      ],
      ambiguities: [],
      summary: 'Mock QA analysis summary',
    }),
  })),
}));

describe('QAAgent', () => {
  let agent: QAAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new QAAgent({ apiKey: 'test-key' });
  });

  describe('constructor', () => {
    it('should create an agent with default config', () => {
      expect(agent.role).toBe('qa');
    });

    it('should accept custom config', () => {
      const customAgent = new QAAgent({
        apiKey: 'test-key',
        model: 'claude-opus-4-20250514',
      });
      expect(customAgent.role).toBe('qa');
      expect(customAgent.config.model).toBe('claude-opus-4-20250514');
    });
  });

  describe('createQAAgent factory', () => {
    it('should create a QAAgent instance', () => {
      const factoryAgent = createQAAgent({ apiKey: 'test-key' });
      expect(factoryAgent).toBeInstanceOf(QAAgent);
      expect(factoryAgent.role).toBe('qa');
    });

    it('should pass config to the agent', () => {
      const factoryAgent = createQAAgent({
        apiKey: 'test-key',
        model: 'claude-opus-4-20250514',
      });
      expect(factoryAgent.role).toBe('qa');
      expect(factoryAgent.config.model).toBe('claude-opus-4-20250514');
    });
  });

  describe('conductInterview', () => {
    it('should return an InterviewResult with correct structure', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      expect(result).toHaveProperty('stakeholderRole', 'qa');
      expect(result).toHaveProperty('exchanges');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('identifiedDecisions');
      expect(result).toHaveProperty('ambiguities');
      expect(result).toHaveProperty('completedAt');
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should return arrays for collection properties', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      expect(Array.isArray(result.exchanges)).toBe(true);
      expect(Array.isArray(result.insights)).toBe(true);
      expect(Array.isArray(result.identifiedDecisions)).toBe(true);
      expect(Array.isArray(result.ambiguities)).toBe(true);
    });

    it('should store the analysis result', async () => {
      const context = createMockFeatureContext();
      await agent.conductInterview(context);

      const analysisResult = agent.getLastAnalysisResult();
      expect(analysisResult).toBeDefined();
      expect(analysisResult?.summary).toBe('Mock QA analysis summary');
    });

    it('should extract insights from analysis', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      expect(result.insights.length).toBeGreaterThan(0);
      // Check for expected insight patterns
      expect(result.insights.some((i) => i.includes('testing'))).toBe(true);
    });

    it('should convert testing considerations to decisions', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      // High priority testing consideration should become a decision
      const testingDecision = result.identifiedDecisions.find((d) =>
        d.title.includes('Testing Strategy')
      );
      expect(testingDecision).toBeDefined();
    });

    it('should convert failure modes to decisions', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      const failureDecision = result.identifiedDecisions.find((d) =>
        d.title.includes('Failure Handling')
      );
      expect(failureDecision).toBeDefined();
    });

    it('should consider previous interviews if provided', async () => {
      const context = createMockFeatureContext();
      context.previousInterviews = [
        {
          stakeholderRole: 'tech-lead',
          exchanges: [],
          insights: ['Use REST API', 'Consider caching'],
          identifiedDecisions: [],
          ambiguities: [],
          completedAt: new Date(),
        },
      ];

      const result = await agent.conductInterview(context);
      expect(result).toBeDefined();
    });
  });

  describe('generateRecommendations', () => {
    it('should return a Recommendations object with correct structure', async () => {
      const answers = { answers: new Map<string, string>() };
      const result = await agent.generateRecommendations(answers);

      expect(result).toHaveProperty('stakeholderRole', 'qa');
      expect(result).toHaveProperty('adrs');
      expect(result).toHaveProperty('generalRecommendations');
      expect(result).toHaveProperty('warnings');
    });

    it('should return arrays for collection properties', async () => {
      const answers = { answers: new Map<string, string>() };
      const result = await agent.generateRecommendations(answers);

      expect(Array.isArray(result.adrs)).toBe(true);
      expect(Array.isArray(result.generalRecommendations)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('getLastAnalysisResult', () => {
    it('should return undefined before analysis is run', () => {
      expect(agent.getLastAnalysisResult()).toBeUndefined();
    });
  });
});

/**
 * Helper function to create a mock FeatureContext for testing
 */
function createMockFeatureContext(): FeatureContext {
  const parsedSpec: ParsedSpec = {
    title: 'Test Feature',
    overview: 'A test feature for unit testing',
    features: [
      {
        name: 'User Authentication',
        description: 'Login and session management',
        priority: 'P0',
      },
    ],
    requirements: [
      {
        id: 'FR-1',
        description: 'Users must be able to log in with email and password',
        type: 'functional',
      },
    ],
    otherSections: {},
  };

  const projectContext: ProjectContext = {
    projectRoot: '/test/project',
    existingDecisions: [],
  };

  return {
    specPath: '/test/specs/test-feature.md',
    specContent: '# Test Feature\n\nTest content',
    parsedSpec,
    projectContext,
  };
}
