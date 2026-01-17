/**
 * UX Agent
 *
 * The third stakeholder in the pocket-stakeholder virtual feature team.
 * Focuses on user experience, flows, interface decisions, accessibility,
 * and ensuring the feature serves user goals effectively.
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
 * Configuration specific to UXAgent
 */
export interface UXAgentConfig extends StakeholderConfig {
  role: 'ux';
}

/**
 * Internal configuration with all properties defined
 */
interface UXAgentInternalConfig {
  role: 'ux';
  apiKey: string | undefined;
  model: string;
}

/**
 * UX analysis result from LLM
 */
export interface UXAnalysisResult {
  /** User flows identified */
  userFlows: UserFlow[];

  /** Interface decisions needed */
  interfaceDecisions: InterfaceDecision[];

  /** Usability concerns */
  usabilityConcerns: UsabilityConcern[];

  /** Accessibility requirements */
  accessibilityRequirements: AccessibilityRequirement[];

  /** Areas of ambiguity specific to UX */
  ambiguities: Ambiguity[];

  /** Summary of the UX analysis */
  summary: string;
}

/**
 * A user flow identified by UX
 */
export interface UserFlow {
  /** Name of the flow */
  name: string;

  /** Description of what the user is trying to accomplish */
  userGoal: string;

  /** Steps in the flow */
  steps: string[];

  /** Potential friction points */
  frictionPoints: string[];

  /** Success criteria */
  successCriteria: string;
}

/**
 * An interface decision that needs to be made
 */
export interface InterfaceDecision {
  /** What needs to be decided */
  area: string;

  /** Description of the decision */
  description: string;

  /** Options being considered */
  options: string[];

  /** Impact on user experience */
  uxImpact: 'high' | 'medium' | 'low';

  /** Recommendation if any */
  recommendation?: string;
}

/**
 * A usability concern identified by UX
 */
export interface UsabilityConcern {
  /** Area of concern */
  area: string;

  /** Description of the concern */
  concern: string;

  /** Why this matters for users */
  userImpact: string;

  /** Severity level */
  severity: 'critical' | 'major' | 'minor';

  /** Suggested improvement */
  suggestion?: string;
}

/**
 * An accessibility requirement identified by UX
 */
export interface AccessibilityRequirement {
  /** Type of requirement */
  type: 'visual' | 'motor' | 'cognitive' | 'auditory';

  /** Specific requirement */
  requirement: string;

  /** WCAG guideline reference if applicable */
  wcagReference?: string;

  /** Implementation guidance */
  implementation: string;
}

/**
 * UX analysis prompt
 *
 * This prompt instructs the LLM to analyze a spec from the perspective
 * of an experienced UX Designer, identifying user flows and experience issues.
 */
export const UX_ANALYSIS_PROMPT = `You are an experienced UX Designer reviewing a feature specification.

Your task is to analyze this spec and identify:
1. **User flows** - how users will interact with this feature
2. **Interface decisions** - UI/UX choices that need to be made
3. **Usability concerns** - potential friction or confusion
4. **Accessibility requirements** - inclusive design needs
5. **Ambiguities** - areas where user experience is unclear

## UX Impact Levels
- high: Directly affects core user goals or first impressions
- medium: Affects efficiency or satisfaction
- low: Minor polish or edge case scenarios

## Severity Levels for Concerns
- critical: Blocks user goals or causes significant frustration
- major: Creates notable friction or confusion
- minor: Suboptimal but workable

## Guidelines
- Focus on user goals, not just features
- Consider the complete user journey
- Think about error states and recovery
- Consider different user contexts (mobile, desktop, varying abilities)
- Note where the spec lacks UX specifics

Respond with a JSON object in this exact format:
{
  "userFlows": [
    {
      "name": "Flow name",
      "userGoal": "What the user is trying to accomplish",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "frictionPoints": ["Potential issue 1", "Potential issue 2"],
      "successCriteria": "How we know the user succeeded"
    }
  ],
  "interfaceDecisions": [
    {
      "area": "Interface area",
      "description": "What needs to be decided",
      "options": ["Option A", "Option B"],
      "uxImpact": "high|medium|low",
      "recommendation": "Suggested approach (if clear)"
    }
  ],
  "usabilityConcerns": [
    {
      "area": "Area of concern",
      "concern": "Description of the issue",
      "userImpact": "Why this matters to users",
      "severity": "critical|major|minor",
      "suggestion": "How to address it"
    }
  ],
  "accessibilityRequirements": [
    {
      "type": "visual|motor|cognitive|auditory",
      "requirement": "Specific accessibility need",
      "wcagReference": "WCAG guideline if applicable",
      "implementation": "How to implement this"
    }
  ],
  "ambiguities": [
    {
      "description": "What is unclear from a UX perspective",
      "location": "Section name or context",
      "suggestedQuestions": ["Question to clarify UX approach"]
    }
  ],
  "summary": "Brief 2-3 sentence summary of UX considerations and key decisions needed"
}`;

/**
 * UXAgent implements the UX Designer stakeholder role.
 *
 * Responsibilities:
 * - Analyze specs for user experience considerations
 * - Identify user flows and friction points
 * - Highlight interface decisions needed
 * - Ensure accessibility is addressed
 */
export class UXAgent implements StakeholderAgent {
  readonly role: StakeholderRole = 'ux';
  private readonly internalConfig: UXAgentInternalConfig;
  private readonly llmClient: LLMClient;
  private interviewExchanges: InterviewExchange[] = [];
  private lastAnalysisResult: UXAnalysisResult | undefined;

  constructor(config?: Partial<UXAgentConfig>) {
    this.internalConfig = {
      role: 'ux',
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
  get config(): UXAgentInternalConfig {
    return this.internalConfig;
  }

  /**
   * Conduct an interview with the user based on the feature context.
   *
   * The interview follows the pattern from SPEC.md:
   * - 5-8 core questions covering UX domain essentials
   * - 1-8 follow-up questions based on complexity and answers
   *
   * @param context Feature context including spec and project info
   * @returns Interview results including insights and identified decisions
   */
  async conductInterview(context: FeatureContext): Promise<InterviewResult> {
    this.interviewExchanges = [];

    // Phase 1: Autonomous analysis to identify UX needs
    const analysisResult = await this.analyzeSpec(context);

    // Convert UX analysis to identified decisions and ambiguities
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

    // Could generate UX decision ADRs based on analysis
    // For now, return empty recommendations
    return {
      stakeholderRole: this.role,
      adrs,
      generalRecommendations: [],
      warnings: [],
    };
  }

  /**
   * Perform UX-focused analysis of the specification.
   *
   * Identifies:
   * - User flows
   * - Interface decisions
   * - Usability concerns
   * - Accessibility requirements
   *
   * @param context The feature context to analyze
   * @returns UX analysis result
   */
  private async analyzeSpec(context: FeatureContext): Promise<UXAnalysisResult> {
    const specSummary = summarizeSpec(context.parsedSpec);
    const previousInsights = this.buildPreviousInsightsPrompt(context);

    const userPrompt = `Analyze the following specification from a UX/Design perspective:

${specSummary}

${previousInsights}

Identify user flows, interface decisions, usability concerns, and accessibility requirements.`;

    const response = await this.llmClient.completeJSON<UXAnalysisResult>(userPrompt, {
      systemPrompt: UX_ANALYSIS_PROMPT,
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

    parts.push('\nConsider these insights when identifying UX concerns. Note any potential conflicts between technical and UX requirements.');
    return parts.join('\n');
  }

  /**
   * Convert UX analysis results to identified decisions
   */
  private analysisToDecisions(analysis: UXAnalysisResult): IdentifiedDecision[] {
    const decisions: IdentifiedDecision[] = [];

    // Convert interface decisions
    for (const interfaceDecision of analysis.interfaceDecisions) {
      decisions.push({
        title: `UX Decision: ${interfaceDecision.area}`,
        category: 'pattern' as DecisionCategory,
        description: interfaceDecision.description,
        clarityScore: interfaceDecision.recommendation ? 0.7 : 0.4,
        options: interfaceDecision.options,
      });
    }

    // Convert critical usability concerns to decisions
    for (const concern of analysis.usabilityConcerns) {
      if (concern.severity === 'critical' || concern.severity === 'major') {
        const decision: IdentifiedDecision = {
          title: `Usability: ${concern.area}`,
          category: 'pattern' as DecisionCategory,
          description: `${concern.concern}. Impact: ${concern.userImpact}`,
          clarityScore: concern.suggestion ? 0.6 : 0.3,
        };
        if (concern.suggestion) {
          decision.options = [concern.suggestion];
        }
        decisions.push(decision);
      }
    }

    // Convert user flows with friction points to decisions
    for (const flow of analysis.userFlows) {
      if (flow.frictionPoints.length > 0) {
        decisions.push({
          title: `User Flow: ${flow.name}`,
          category: 'pattern' as DecisionCategory,
          description: `Goal: ${flow.userGoal}. Friction points: ${flow.frictionPoints.join('; ')}`,
          clarityScore: 0.5,
        });
      }
    }

    // Convert accessibility requirements to decisions
    for (const a11y of analysis.accessibilityRequirements) {
      decisions.push({
        title: `Accessibility: ${a11y.type}`,
        category: 'pattern' as DecisionCategory,
        description: a11y.requirement,
        clarityScore: 0.7, // Usually fairly clear what needs to be done
        options: [a11y.implementation],
      });
    }

    return decisions;
  }

  /**
   * Extract key insights from UX analysis
   */
  private extractInsights(analysis: UXAnalysisResult): string[] {
    const insights: string[] = [];

    // Summarize user flows
    if (analysis.userFlows.length > 0) {
      const flowNames = analysis.userFlows.map((f) => f.name);
      insights.push(`${analysis.userFlows.length} user flow(s) identified: ${flowNames.join(', ')}`);
    }

    // Summarize interface decisions
    const highImpactDecisions = analysis.interfaceDecisions.filter((d) => d.uxImpact === 'high');
    if (highImpactDecisions.length > 0) {
      insights.push(`${highImpactDecisions.length} high-impact interface decision(s) needed`);
    }

    // Summarize usability concerns
    const criticalConcerns = analysis.usabilityConcerns.filter((c) => c.severity === 'critical');
    if (criticalConcerns.length > 0) {
      insights.push(`${criticalConcerns.length} critical usability concern(s) identified`);
    }

    // Summarize accessibility
    if (analysis.accessibilityRequirements.length > 0) {
      const types = [...new Set(analysis.accessibilityRequirements.map((a) => a.type))];
      insights.push(`Accessibility requirements: ${types.join(', ')}`);
    }

    // Note total friction points
    const totalFriction = analysis.userFlows.reduce((sum, f) => sum + f.frictionPoints.length, 0);
    if (totalFriction > 0) {
      insights.push(`${totalFriction} potential friction point(s) across user flows`);
    }

    return insights;
  }

  /**
   * Get the last analysis result
   *
   * @returns The most recent analysis result, or undefined if no analysis has been run
   */
  getLastAnalysisResult(): UXAnalysisResult | undefined {
    return this.lastAnalysisResult;
  }
}

/**
 * Factory function to create a UXAgent instance
 */
export function createUXAgent(config?: Partial<UXAgentConfig>): UXAgent {
  return new UXAgent(config);
}
