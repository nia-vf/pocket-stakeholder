/**
 * QA Agent
 *
 * The second stakeholder in the pocket-stakeholder virtual feature team.
 * Focuses on testing strategy, edge cases, failure modes, and validation
 * to ensure robust implementation.
 */

import type {
  StakeholderAgent,
  StakeholderConfig,
  StakeholderRole,
  FeatureContext,
  InterviewResult,
  UserAnswers,
  Recommendations,
  InterviewExchange,
  IdentifiedDecision,
  Ambiguity,
  ADRDraft,
  DecisionCategory,
} from '../types/index.js';
import { LLMClient, type LLMClientConfig } from '../utils/llm-client.js';
import { summarizeSpec } from '../utils/spec-parser.js';

/**
 * Configuration specific to QAAgent
 */
export interface QAAgentConfig extends StakeholderConfig {
  role: 'qa';
}

/**
 * Internal configuration with all properties defined
 */
interface QAAgentInternalConfig {
  role: 'qa';
  apiKey: string | undefined;
  model: string;
}

/**
 * QA analysis result from LLM
 */
export interface QAAnalysisResult {
  /** Testing considerations identified */
  testingConsiderations: TestingConsideration[];

  /** Edge cases that need handling */
  edgeCases: EdgeCase[];

  /** Failure modes and how to handle them */
  failureModes: FailureMode[];

  /** Validation requirements */
  validationRequirements: ValidationRequirement[];

  /** Areas of ambiguity specific to testing/QA */
  ambiguities: Ambiguity[];

  /** Summary of the QA analysis */
  summary: string;
}

/**
 * A testing consideration identified by QA
 */
export interface TestingConsideration {
  /** Area being considered */
  area: string;

  /** Description of testing needs */
  description: string;

  /** Priority: high, medium, low */
  priority: 'high' | 'medium' | 'low';

  /** Suggested test types */
  suggestedTestTypes: TestType[];
}

/**
 * Types of tests that could be applied
 */
export type TestType = 'unit' | 'integration' | 'e2e' | 'performance' | 'security' | 'accessibility';

/**
 * An edge case identified by QA
 */
export interface EdgeCase {
  /** Description of the edge case */
  description: string;

  /** What scenario triggers this */
  scenario: string;

  /** Expected behavior or question about it */
  expectedBehavior?: string;

  /** Risk if not handled */
  risk: 'high' | 'medium' | 'low';
}

/**
 * A failure mode identified by QA
 */
export interface FailureMode {
  /** What could fail */
  component: string;

  /** How it could fail */
  failureDescription: string;

  /** Impact of this failure */
  impact: string;

  /** Suggested mitigation */
  suggestedMitigation?: string;
}

/**
 * A validation requirement identified by QA
 */
export interface ValidationRequirement {
  /** What needs validation */
  field: string;

  /** Type of validation needed */
  validationType: 'input' | 'output' | 'state' | 'business-rule';

  /** Rules to enforce */
  rules: string[];

  /** Error handling approach */
  errorHandling?: string;
}

/**
 * QA analysis prompt
 *
 * This prompt instructs the LLM to analyze a spec from the perspective
 * of an experienced QA engineer, identifying testing needs and edge cases.
 */
export const QA_ANALYSIS_PROMPT = `You are an experienced QA Engineer reviewing a feature specification.

Your task is to analyze this spec and identify:
1. **Testing considerations** - what needs to be tested and how
2. **Edge cases** - boundary conditions and unusual scenarios
3. **Failure modes** - what could go wrong and how to handle it
4. **Validation requirements** - input/output validation needs
5. **Ambiguities** - areas where testing strategy is unclear

## Priority Levels
- high: Critical functionality, security, data integrity
- medium: Important user flows, common scenarios
- low: Edge cases, nice-to-have coverage

## Risk Assessment
Consider:
- Data loss or corruption potential
- Security vulnerabilities
- User experience degradation
- System stability impact

## Guidelines
- Challenge assumptions in the spec
- Think about "what if" scenarios
- Consider both happy path and error paths
- Identify missing acceptance criteria
- Note testability concerns (how will this be tested?)

Respond with a JSON object in this exact format:
{
  "testingConsiderations": [
    {
      "area": "Area name",
      "description": "What needs testing",
      "priority": "high|medium|low",
      "suggestedTestTypes": ["unit", "integration", "e2e", "performance", "security", "accessibility"]
    }
  ],
  "edgeCases": [
    {
      "description": "Edge case description",
      "scenario": "When/how this occurs",
      "expectedBehavior": "What should happen (if known)",
      "risk": "high|medium|low"
    }
  ],
  "failureModes": [
    {
      "component": "What could fail",
      "failureDescription": "How it could fail",
      "impact": "What happens if it fails",
      "suggestedMitigation": "How to handle/prevent"
    }
  ],
  "validationRequirements": [
    {
      "field": "What needs validation",
      "validationType": "input|output|state|business-rule",
      "rules": ["Rule 1", "Rule 2"],
      "errorHandling": "How to handle validation failures"
    }
  ],
  "ambiguities": [
    {
      "description": "What is unclear from a testing perspective",
      "location": "Section name or context",
      "suggestedQuestions": ["Question to clarify testing approach"]
    }
  ],
  "summary": "Brief 2-3 sentence summary of testing complexity and key concerns"
}`;

/**
 * QAAgent implements the QA stakeholder role.
 *
 * Responsibilities:
 * - Analyze specs for testing requirements
 * - Identify edge cases and failure modes
 * - Challenge assumptions and explore "what if" scenarios
 * - Ensure validation requirements are clear
 */
export class QAAgent implements StakeholderAgent {
  readonly role: StakeholderRole = 'qa';
  private readonly internalConfig: QAAgentInternalConfig;
  private readonly llmClient: LLMClient;
  private interviewExchanges: InterviewExchange[] = [];
  private lastAnalysisResult: QAAnalysisResult | undefined;

  constructor(config?: Partial<QAAgentConfig>) {
    this.internalConfig = {
      role: 'qa',
      apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY,
      model: config?.model ?? 'claude-sonnet-4-20250514',
    };

    // Initialize the LLM client with same config
    const llmConfig: LLMClientConfig = {
      model: this.internalConfig.model,
    };
    if (this.internalConfig.apiKey) {
      llmConfig.apiKey = this.internalConfig.apiKey;
    }
    this.llmClient = new LLMClient(llmConfig);
  }

  /**
   * Get the current agent configuration
   */
  get config(): QAAgentInternalConfig {
    return this.internalConfig;
  }

  /**
   * Conduct an interview with the user based on the feature context.
   *
   * The interview follows the pattern from SPEC.md:
   * - 5-8 core questions covering QA domain essentials
   * - 1-8 follow-up questions based on complexity and answers
   *
   * @param context Feature context including spec and project info
   * @returns Interview results including insights and identified decisions
   */
  async conductInterview(context: FeatureContext): Promise<InterviewResult> {
    this.interviewExchanges = [];

    // Phase 1: Autonomous analysis to identify testing needs and edge cases
    const analysisResult = await this.analyzeSpec(context);

    // Convert QA analysis to identified decisions and ambiguities
    const decisions = this.analysisToDecisions(analysisResult);
    const ambiguities = analysisResult.ambiguities;

    return {
      stakeholderRole: this.role,
      exchanges: this.interviewExchanges,
      insights: this.extractInsights(analysisResult),
      identifiedDecisions: decisions,
      ambiguities: ambiguities,
      completedAt: new Date(),
    };
  }

  /**
   * Generate recommendations based on interview answers.
   *
   * Transforms the interview results into actionable recommendations.
   *
   * @param answers User's answers from the interview
   * @returns Recommendations including ADR drafts
   */
  async generateRecommendations(_answers: UserAnswers): Promise<Recommendations> {
    const adrs: ADRDraft[] = [];

    // Could generate testing strategy ADRs based on analysis
    // For now, return empty recommendations
    return {
      stakeholderRole: this.role,
      adrs,
      generalRecommendations: [],
      warnings: [],
    };
  }

  /**
   * Perform QA-focused analysis of the specification.
   *
   * Identifies:
   * - Testing considerations
   * - Edge cases
   * - Failure modes
   * - Validation requirements
   *
   * @param context The feature context to analyze
   * @returns QA analysis result
   */
  private async analyzeSpec(context: FeatureContext): Promise<QAAnalysisResult> {
    const specSummary = summarizeSpec(context.parsedSpec);
    const previousInsights = this.buildPreviousInsightsPrompt(context);

    const userPrompt = `Analyze the following specification from a QA/Testing perspective:

${specSummary}

${previousInsights}

Identify testing needs, edge cases, failure modes, and validation requirements.`;

    const response = await this.llmClient.completeJSON<QAAnalysisResult>(userPrompt, {
      systemPrompt: QA_ANALYSIS_PROMPT,
      temperature: 0.3,
    });

    this.lastAnalysisResult = response;
    return response;
  }

  /**
   * Build context from previous stakeholder interviews
   */
  private buildPreviousInsightsPrompt(context: FeatureContext): string {
    if (!context.previousInterviews || context.previousInterviews.length === 0) {
      return '';
    }

    const parts: string[] = ['## Previous Stakeholder Insights'];

    for (const interview of context.previousInterviews) {
      parts.push(`\n### ${interview.stakeholderRole.toUpperCase()} Insights:`);
      for (const insight of interview.insights) {
        parts.push(`- ${insight}`);
      }

      if (interview.identifiedDecisions.length > 0) {
        parts.push('\nDecisions identified:');
        for (const decision of interview.identifiedDecisions) {
          parts.push(`- ${decision.title}: ${decision.description}`);
        }
      }
    }

    parts.push('\nConsider these insights when identifying testing concerns.');
    return parts.join('\n');
  }

  /**
   * Convert QA analysis results to identified decisions
   */
  private analysisToDecisions(analysis: QAAnalysisResult): IdentifiedDecision[] {
    const decisions: IdentifiedDecision[] = [];

    // Convert high-priority testing considerations to decisions
    for (const consideration of analysis.testingConsiderations) {
      if (consideration.priority === 'high') {
        decisions.push({
          title: `Testing Strategy: ${consideration.area}`,
          category: 'pattern' as DecisionCategory,
          description: consideration.description,
          clarityScore: 0.5, // Testing strategies often need clarification
          options: consideration.suggestedTestTypes.map((t) => `${t} testing`),
        });
      }
    }

    // Convert high-risk edge cases to decisions
    for (const edgeCase of analysis.edgeCases) {
      if (edgeCase.risk === 'high') {
        decisions.push({
          title: `Edge Case Handling: ${edgeCase.description.substring(0, 50)}`,
          category: 'pattern' as DecisionCategory,
          description: `${edgeCase.scenario} - ${edgeCase.expectedBehavior || 'behavior needs definition'}`,
          clarityScore: edgeCase.expectedBehavior ? 0.6 : 0.3,
        });
      }
    }

    // Convert failure modes to decisions
    for (const failure of analysis.failureModes) {
      const decision: IdentifiedDecision = {
        title: `Failure Handling: ${failure.component}`,
        category: 'architecture' as DecisionCategory,
        description: `${failure.failureDescription}. Impact: ${failure.impact}`,
        clarityScore: failure.suggestedMitigation ? 0.7 : 0.4,
      };
      if (failure.suggestedMitigation) {
        decision.options = [failure.suggestedMitigation];
      }
      decisions.push(decision);
    }

    return decisions;
  }

  /**
   * Extract key insights from QA analysis
   */
  private extractInsights(analysis: QAAnalysisResult): string[] {
    const insights: string[] = [];

    // Summarize testing considerations
    const highPriorityAreas = analysis.testingConsiderations
      .filter((c) => c.priority === 'high')
      .map((c) => c.area);
    if (highPriorityAreas.length > 0) {
      insights.push(`High-priority testing areas: ${highPriorityAreas.join(', ')}`);
    }

    // Summarize edge cases
    const highRiskEdgeCases = analysis.edgeCases.filter((e) => e.risk === 'high');
    if (highRiskEdgeCases.length > 0) {
      insights.push(`${highRiskEdgeCases.length} high-risk edge case(s) identified`);
    }

    // Summarize failure modes
    if (analysis.failureModes.length > 0) {
      insights.push(`${analysis.failureModes.length} potential failure mode(s) identified`);
    }

    // Summarize validation needs
    const inputValidations = analysis.validationRequirements.filter((v) => v.validationType === 'input');
    if (inputValidations.length > 0) {
      insights.push(`${inputValidations.length} input validation requirement(s) identified`);
    }

    return insights;
  }

  /**
   * Get the last analysis result
   *
   * @returns The most recent analysis result, or undefined if no analysis has been run
   */
  getLastAnalysisResult(): QAAnalysisResult | undefined {
    return this.lastAnalysisResult;
  }
}

/**
 * Factory function to create a QAAgent instance
 */
export function createQAAgent(config?: Partial<QAAgentConfig>): QAAgent {
  return new QAAgent(config);
}
