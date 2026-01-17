import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UXAgent, createUXAgent } from '../agents/ux-agent.js';
import type { FeatureContext, ParsedSpec, ProjectContext } from '../types/index.js';

// Mock the LLM client to avoid requiring API key
vi.mock('../utils/llm-client.js', () => ({
  LLMClient: vi.fn().mockImplementation(() => ({
    completeJSON: vi.fn().mockResolvedValue({
      userFlows: [
        {
          name: 'Login Flow',
          userGoal: 'User wants to access their account',
          steps: ['Open login page', 'Enter credentials', 'Submit form', 'Access dashboard'],
          frictionPoints: ['Password requirements unclear', 'No password visibility toggle'],
          successCriteria: 'User lands on dashboard with session active',
        },
      ],
      interfaceDecisions: [
        {
          area: 'Form Layout',
          description: 'How should the login form be structured',
          options: ['Single column', 'Two column with social login'],
          uxImpact: 'high',
          recommendation: 'Single column for simplicity',
        },
      ],
      usabilityConcerns: [
        {
          area: 'Error Messaging',
          concern: 'Error messages may not be visible to users',
          userImpact: 'Users may not understand what went wrong',
          severity: 'major',
          suggestion: 'Use inline validation with clear error messages',
        },
      ],
      accessibilityRequirements: [
        {
          type: 'visual',
          requirement: 'Sufficient color contrast for form elements',
          wcagReference: 'WCAG 2.1 AA 1.4.3',
          implementation: 'Ensure 4.5:1 contrast ratio for text',
        },
      ],
      ambiguities: [],
      summary: 'Mock UX analysis summary',
    }),
  })),
}));

describe('UXAgent', () => {
  let agent: UXAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new UXAgent({ apiKey: 'test-key' });
  });

  describe('constructor', () => {
    it('should create an agent with default config', () => {
      expect(agent.role).toBe('ux');
    });

    it('should accept custom config', () => {
      const customAgent = new UXAgent({
        apiKey: 'test-key',
        model: 'claude-opus-4-20250514',
      });
      expect(customAgent.role).toBe('ux');
      expect(customAgent.config.model).toBe('claude-opus-4-20250514');
    });
  });

  describe('createUXAgent factory', () => {
    it('should create a UXAgent instance', () => {
      const factoryAgent = createUXAgent({ apiKey: 'test-key' });
      expect(factoryAgent).toBeInstanceOf(UXAgent);
      expect(factoryAgent.role).toBe('ux');
    });

    it('should pass config to the agent', () => {
      const factoryAgent = createUXAgent({
        apiKey: 'test-key',
        model: 'claude-opus-4-20250514',
      });
      expect(factoryAgent.role).toBe('ux');
      expect(factoryAgent.config.model).toBe('claude-opus-4-20250514');
    });
  });

  describe('conductInterview', () => {
    it('should return an InterviewResult with correct structure', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      expect(result).toHaveProperty('stakeholderRole', 'ux');
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
      expect(analysisResult?.summary).toBe('Mock UX analysis summary');
    });

    it('should extract insights from analysis', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      expect(result.insights.length).toBeGreaterThan(0);
      // Check for expected insight patterns
      expect(result.insights.some((i) => i.includes('flow'))).toBe(true);
    });

    it('should convert interface decisions to identified decisions', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      const uxDecision = result.identifiedDecisions.find((d) =>
        d.title.includes('UX Decision')
      );
      expect(uxDecision).toBeDefined();
    });

    it('should convert usability concerns to decisions', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      const usabilityDecision = result.identifiedDecisions.find((d) =>
        d.title.includes('Usability')
      );
      expect(usabilityDecision).toBeDefined();
    });

    it('should convert user flows with friction to decisions', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      const flowDecision = result.identifiedDecisions.find((d) =>
        d.title.includes('User Flow')
      );
      expect(flowDecision).toBeDefined();
    });

    it('should convert accessibility requirements to decisions', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      const a11yDecision = result.identifiedDecisions.find((d) =>
        d.title.includes('Accessibility')
      );
      expect(a11yDecision).toBeDefined();
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
        {
          stakeholderRole: 'qa',
          exchanges: [],
          insights: ['Need edge case testing', 'Validate input formats'],
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

      expect(result).toHaveProperty('stakeholderRole', 'ux');
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
    title: 'User Login Feature',
    overview: 'A login system for user authentication',
    features: [
      {
        name: 'Login Form',
        description: 'Allow users to log in with email and password',
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
    specPath: '/test/specs/login-feature.md',
    specContent: '# User Login Feature\n\nTest content',
    parsedSpec,
    projectContext,
  };
}
