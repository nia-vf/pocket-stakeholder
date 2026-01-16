/**
 * Tech Lead Agent
 *
 * The first stakeholder in the pocket-stakeholder virtual feature team.
 * Reads product specifications, conducts interviews to clarify technical
 * requirements, and produces Architecture Decision Records (ADRs).
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
} from '../types/index.js';
import { SpecAnalyzer, type AnalysisResult } from '../utils/spec-analyzer.js';

/**
 * Configuration specific to TechLeadAgent
 */
export interface TechLeadAgentConfig extends StakeholderConfig {
  role: 'tech-lead';
}

/**
 * Internal configuration with all properties defined
 */
interface TechLeadAgentInternalConfig {
  role: 'tech-lead';
  apiKey: string | undefined;
  model: string;
}

/**
 * TechLeadAgent implements the Tech Lead stakeholder role.
 *
 * Responsibilities:
 * - Analyze specs for technical decisions needed
 * - Conduct interviews about trade-offs, constraints, and architecture
 * - Generate ADRs documenting key technical choices
 */
export class TechLeadAgent implements StakeholderAgent {
  readonly role: StakeholderRole = 'tech-lead';
  private readonly internalConfig: TechLeadAgentInternalConfig;
  private readonly specAnalyzer: SpecAnalyzer;
  private currentContext: FeatureContext | undefined;
  private interviewExchanges: InterviewExchange[] = [];
  private lastAnalysisResult: AnalysisResult | undefined;

  constructor(config?: Partial<TechLeadAgentConfig>) {
    this.internalConfig = {
      role: 'tech-lead',
      apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY,
      model: config?.model ?? 'claude-sonnet-4-20250514',
    };

    // Initialize the spec analyzer with same config
    // Only pass apiKey if it's defined
    const analyzerConfig: { apiKey?: string; model?: string } = {
      model: this.internalConfig.model,
    };
    if (this.internalConfig.apiKey) {
      analyzerConfig.apiKey = this.internalConfig.apiKey;
    }
    this.specAnalyzer = new SpecAnalyzer(analyzerConfig);
  }

  /**
   * Get the current agent configuration
   */
  get config(): TechLeadAgentInternalConfig {
    return this.internalConfig;
  }

  /**
   * Conduct an interview with the user based on the feature context.
   *
   * The interview follows the pattern from SPEC.md:
   * - 5-8 core questions covering technical domain essentials
   * - 1-8 follow-up questions based on complexity and answers
   *
   * @param context Feature context including spec and project info
   * @returns Interview results including insights and identified decisions
   */
  async conductInterview(context: FeatureContext): Promise<InterviewResult> {
    this.currentContext = context;
    this.interviewExchanges = [];

    // Phase 1: Autonomous analysis to identify decisions and ambiguities
    const { decisions, ambiguities } = await this.analyzeSpec(this.currentContext);

    // Phase 2: Generate and conduct interview based on analysis
    // (Implementation will be added in Phase 5: Interview System)

    return {
      stakeholderRole: this.role,
      exchanges: this.interviewExchanges,
      insights: [],
      identifiedDecisions: decisions,
      ambiguities: ambiguities,
      completedAt: new Date(),
    };
  }

  /**
   * Generate recommendations based on interview answers.
   *
   * Transforms the interview results into actionable ADRs and recommendations.
   *
   * @param answers User's answers from the interview
   * @returns Recommendations including ADR drafts
   */
  async generateRecommendations(_answers: UserAnswers): Promise<Recommendations> {
    // Implementation will be added in Phase 6: ADR Generator
    const adrs: ADRDraft[] = [];

    return {
      stakeholderRole: this.role,
      adrs,
      generalRecommendations: [],
      warnings: [],
    };
  }

  /**
   * Perform autonomous first-pass analysis of the specification.
   *
   * Identifies:
   * - Technical decisions that need documentation
   * - Ambiguous areas requiring clarification
   * - Categories of decisions (architecture, library, pattern, etc.)
   *
   * @param context The feature context to analyze
   * @returns Identified decisions and ambiguities
   */
  private async analyzeSpec(
    context: FeatureContext
  ): Promise<{ decisions: IdentifiedDecision[]; ambiguities: Ambiguity[] }> {
    // Use the SpecAnalyzer to perform LLM-powered analysis
    const result = await this.specAnalyzer.analyze(context);

    // Store the result for later use (e.g., generating ADRs)
    this.lastAnalysisResult = result;

    return {
      decisions: result.decisions,
      ambiguities: result.ambiguities,
    };
  }

  /**
   * Get the last analysis result
   *
   * @returns The most recent analysis result, or undefined if no analysis has been run
   */
  getLastAnalysisResult(): AnalysisResult | undefined {
    return this.lastAnalysisResult;
  }
}

/**
 * Factory function to create a TechLeadAgent instance
 */
export function createTechLeadAgent(config?: Partial<TechLeadAgentConfig>): TechLeadAgent {
  return new TechLeadAgent(config);
}
