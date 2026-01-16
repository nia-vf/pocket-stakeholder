/**
 * Spec Analyzer
 *
 * Performs autonomous analysis of specifications to identify
 * technical decisions and ambiguities requiring documentation.
 */

import type {
  FeatureContext,
  IdentifiedDecision,
  Ambiguity,
  DecisionCategory,
} from '../types/index.js';
import { LLMClient, type LLMClientConfig } from './llm-client.js';
import { summarizeSpec } from './spec-parser.js';

/**
 * Decision with ambiguity scoring applied
 */
export interface ScoredDecision extends IdentifiedDecision {
  /** Whether this decision needs clarification based on clarity threshold */
  needsClarification: boolean;

  /** Ambiguity level: 'clear' | 'moderate' | 'unclear' */
  ambiguityLevel: AmbiguityLevel;
}

/**
 * Ambiguity levels for decisions
 */
export type AmbiguityLevel = 'clear' | 'moderate' | 'unclear';

/**
 * Result of spec analysis
 */
export interface AnalysisResult {
  /** Technical decisions identified that need documentation */
  decisions: IdentifiedDecision[];

  /** Decisions with ambiguity scoring applied */
  scoredDecisions: ScoredDecision[];

  /** Ambiguous areas requiring clarification */
  ambiguities: Ambiguity[];

  /** Summary of the analysis */
  summary: string;

  /** Statistics about the analysis */
  stats: AnalysisStats;
}

/**
 * Statistics about the analysis results
 */
export interface AnalysisStats {
  /** Total number of decisions identified */
  totalDecisions: number;

  /** Number of decisions needing clarification */
  decisionsNeedingClarification: number;

  /** Number of decisions that are clear */
  clearDecisions: number;

  /** Total number of ambiguities identified */
  totalAmbiguities: number;

  /** Breakdown of decisions by category */
  decisionsByCategory: Record<DecisionCategory, number>;

  /** Average clarity score across all decisions */
  averageClarityScore: number;
}

/**
 * Raw analysis response from LLM (before parsing)
 */
interface RawAnalysisResponse {
  decisions: Array<{
    title: string;
    category: string;
    description: string;
    clarityScore: number;
    options?: string[];
  }>;
  ambiguities: Array<{
    description: string;
    location?: string;
    suggestedQuestions: string[];
  }>;
  summary: string;
}

/**
 * Tech Lead analysis prompt
 *
 * This prompt instructs the LLM to analyze a spec from the perspective
 * of an experienced Tech Lead, identifying key technical decisions and
 * areas of ambiguity.
 */
export const TECH_LEAD_ANALYSIS_PROMPT = `You are an experienced Tech Lead reviewing a feature specification.

Your task is to analyze this spec and identify:
1. **Technical decisions** that need to be made and documented (in ADRs)
2. **Ambiguities** - areas where the spec is unclear or incomplete

## Decision Categories
Categorize each decision as one of:
- architecture: System structure, component organization, data flow
- library: Third-party packages, frameworks, dependencies
- pattern: Design patterns, coding conventions, implementation approaches
- integration: External services, APIs, inter-system communication
- data-model: Database schemas, data structures, entity relationships
- api-design: Endpoint design, request/response formats, versioning
- security: Authentication, authorization, data protection
- performance: Optimization strategies, caching, scaling

## Clarity Score
For each decision, rate clarity from 0 to 1:
- 1.0: Very clear, decision is almost self-evident from spec
- 0.7-0.9: Mostly clear, minor details need confirmation
- 0.4-0.6: Moderately clear, significant aspects need clarification
- 0.1-0.3: Unclear, requires substantial discussion
- 0.0: Completely ambiguous, no guidance in spec

## Guidelines
- Focus on decisions that would benefit from documentation (ADRs)
- Ignore trivial implementation details that don't warrant ADRs
- Consider both explicit requirements and implicit needs
- Note when the spec leaves important choices unspecified
- Suggest clarifying questions for ambiguous areas

Respond with a JSON object in this exact format:
{
  "decisions": [
    {
      "title": "Brief decision title",
      "category": "architecture|library|pattern|integration|data-model|api-design|security|performance",
      "description": "What decision needs to be made",
      "clarityScore": 0.7,
      "options": ["Option A", "Option B"] // optional, include if spec mentions alternatives
    }
  ],
  "ambiguities": [
    {
      "description": "What is unclear",
      "location": "Section name or context where this appears",
      "suggestedQuestions": ["Question to clarify this"]
    }
  ],
  "summary": "Brief 2-3 sentence summary of the overall technical complexity and key areas needing decisions"
}`;

/**
 * Configuration for the SpecAnalyzer
 */
export interface SpecAnalyzerConfig extends LLMClientConfig {
  /** Custom analysis prompt (defaults to TECH_LEAD_ANALYSIS_PROMPT) */
  analysisPrompt?: string;
}

/**
 * SpecAnalyzer performs autonomous analysis of specifications
 *
 * Uses an LLM to identify technical decisions and ambiguities
 * that should be documented in ADRs.
 */
export class SpecAnalyzer {
  private readonly llmClient: LLMClient;
  private readonly analysisPrompt: string;

  constructor(config?: SpecAnalyzerConfig) {
    this.llmClient = new LLMClient(config);
    this.analysisPrompt = config?.analysisPrompt ?? TECH_LEAD_ANALYSIS_PROMPT;
  }

  /**
   * Analyze a feature context and identify decisions/ambiguities
   *
   * @param context The feature context to analyze
   * @returns Analysis result with decisions and ambiguities
   */
  async analyze(context: FeatureContext): Promise<AnalysisResult> {
    // Build the prompt with spec content
    const specSummary = summarizeSpec(context.parsedSpec);
    const projectContextInfo = this.buildProjectContextPrompt(context);

    const userPrompt = `Analyze the following specification:

${specSummary}

${projectContextInfo}

Identify technical decisions that need to be documented and any ambiguities that need clarification.`;

    // Call LLM for analysis
    const response = await this.llmClient.completeJSON<RawAnalysisResponse>(userPrompt, {
      systemPrompt: this.analysisPrompt,
      temperature: 0.3, // Lower temperature for more consistent analysis
    });

    // Transform raw response to typed result
    return this.transformResponse(response);
  }

  /**
   * Build project context prompt section
   */
  private buildProjectContextPrompt(context: FeatureContext): string {
    const parts: string[] = [];

    // Include existing decisions context
    if (context.projectContext.existingDecisions.length > 0) {
      parts.push('## Existing Decisions');
      parts.push('The following decisions have already been made for this project:');
      for (const decision of context.projectContext.existingDecisions) {
        parts.push(`- ${decision.id}: ${decision.title} (${decision.status})`);
        if (decision.summary) {
          parts.push(`  ${decision.summary}`);
        }
      }
      parts.push('\nConsider these when identifying new decisions to avoid conflicts or duplication.');
    }

    // Include CLAUDE.md context if available
    if (context.projectContext.claudeMd) {
      parts.push('## Project Context (from CLAUDE.md)');
      // Truncate if too long
      const claudeMd = context.projectContext.claudeMd;
      const truncated = claudeMd.length > 1000 ? claudeMd.slice(0, 1000) + '...' : claudeMd;
      parts.push(truncated);
    }

    return parts.length > 0 ? parts.join('\n') : '';
  }

  /**
   * Transform raw LLM response to typed AnalysisResult
   */
  private transformResponse(raw: RawAnalysisResponse): AnalysisResult {
    const decisions: IdentifiedDecision[] = raw.decisions.map((d) => {
      const decision: IdentifiedDecision = {
        title: d.title,
        category: this.validateCategory(d.category),
        description: d.description,
        clarityScore: Math.max(0, Math.min(1, d.clarityScore)), // Clamp to 0-1
      };
      // Only add options if they exist
      if (d.options && d.options.length > 0) {
        decision.options = d.options;
      }
      return decision;
    });

    const ambiguities: Ambiguity[] = raw.ambiguities.map((a) => {
      const ambiguity: Ambiguity = {
        description: a.description,
        suggestedQuestions: a.suggestedQuestions,
      };
      // Only add location if it exists
      if (a.location) {
        ambiguity.location = a.location;
      }
      return ambiguity;
    });

    // Score decisions for ambiguity
    const scoredDecisions = scoreDecisions(decisions);

    // Calculate statistics
    const stats = calculateAnalysisStats(decisions, scoredDecisions, ambiguities);

    // Use LLM summary if provided, otherwise generate one locally
    const summary = raw.summary || generateAnalysisSummary(stats);

    return {
      decisions,
      scoredDecisions,
      ambiguities,
      summary,
      stats,
    };
  }

  /**
   * Validate and normalize decision category
   */
  private validateCategory(category: string): DecisionCategory {
    const validCategories: DecisionCategory[] = [
      'architecture',
      'library',
      'pattern',
      'integration',
      'data-model',
      'api-design',
      'security',
      'performance',
    ];

    const normalized = category.toLowerCase().trim() as DecisionCategory;

    if (validCategories.includes(normalized)) {
      return normalized;
    }

    // Default to architecture for unknown categories
    return 'architecture';
  }
}

/**
 * Categorize a decision based on its description
 *
 * This is a heuristic categorizer for when the LLM doesn't provide
 * a category or for manual decision creation.
 *
 * @param description Decision description
 * @returns Most likely category
 */
export function categorizeDecision(description: string): DecisionCategory {
  const lower = description.toLowerCase();

  // Check for keywords that indicate specific categories
  const categoryKeywords: Record<DecisionCategory, string[]> = {
    architecture: [
      'architecture',
      'structure',
      'component',
      'layer',
      'module',
      'organize',
      'design',
      'system',
    ],
    library: [
      'library',
      'package',
      'dependency',
      'framework',
      'npm',
      'pip',
      'crate',
      'third-party',
    ],
    pattern: [
      'pattern',
      'approach',
      'method',
      'strategy',
      'convention',
      'style',
      'implementation',
    ],
    integration: [
      'integration',
      'external',
      'service',
      'webhook',
      'connect',
      'third-party api',
      'sync',
    ],
    'data-model': [
      'database',
      'schema',
      'model',
      'entity',
      'table',
      'data structure',
      'storage',
    ],
    'api-design': ['api', 'endpoint', 'rest', 'graphql', 'rpc', 'request', 'response', 'route'],
    security: [
      'security',
      'auth',
      'permission',
      'encryption',
      'token',
      'credential',
      'access control',
    ],
    performance: [
      'performance',
      'cache',
      'optimize',
      'scale',
      'latency',
      'throughput',
      'speed',
    ],
  };

  let bestMatch: DecisionCategory = 'architecture';
  let highestScore = 0;

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > highestScore) {
      highestScore = score;
      bestMatch = category as DecisionCategory;
    }
  }

  return bestMatch;
}

/**
 * Score the ambiguity level of a spec section
 *
 * Higher scores indicate more ambiguity/need for clarification.
 *
 * @param text Text to analyze
 * @returns Ambiguity score from 0 (clear) to 1 (very ambiguous)
 */
export function scoreAmbiguity(text: string): number {
  if (!text || text.trim().length === 0) {
    return 1.0; // Empty content is fully ambiguous
  }

  let score = 0;
  const lower = text.toLowerCase();

  // Ambiguity indicators (increase score)
  const ambiguousTerms = [
    'tbd',
    'to be determined',
    'todo',
    'to do',
    'unclear',
    'maybe',
    'possibly',
    'might',
    'could',
    'should consider',
    'open question',
    'decide later',
    'not sure',
    'either',
    'or alternatively',
  ];

  for (const term of ambiguousTerms) {
    if (lower.includes(term)) {
      score += 0.15;
    }
  }

  // Question marks indicate uncertainty
  const questionCount = (text.match(/\?/g) || []).length;
  score += Math.min(questionCount * 0.1, 0.3);

  // Short content is more ambiguous
  if (text.length < 50) {
    score += 0.2;
  } else if (text.length < 100) {
    score += 0.1;
  }

  // Clarity indicators (decrease score)
  const clearTerms = [
    'must',
    'shall',
    'will',
    'specifically',
    'exactly',
    'required',
    'mandatory',
  ];

  for (const term of clearTerms) {
    if (lower.includes(term)) {
      score -= 0.1;
    }
  }

  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}

/**
 * Factory function to create a SpecAnalyzer instance
 */
export function createSpecAnalyzer(config?: SpecAnalyzerConfig): SpecAnalyzer {
  return new SpecAnalyzer(config);
}

/**
 * Clarity threshold for determining if a decision needs clarification
 * Decisions with clarityScore below this threshold need clarification
 */
export const CLARITY_THRESHOLD = 0.6;

/**
 * Score a decision and determine its ambiguity level
 *
 * Converts a clarity score (0-1 where 1 is clear) to an ambiguity assessment.
 *
 * @param decision The decision to score
 * @returns ScoredDecision with needsClarification and ambiguityLevel
 */
export function scoreDecisionAmbiguity(decision: IdentifiedDecision): ScoredDecision {
  const clarityScore = decision.clarityScore;

  // Determine ambiguity level based on clarity score
  let ambiguityLevel: AmbiguityLevel;
  if (clarityScore >= 0.7) {
    ambiguityLevel = 'clear';
  } else if (clarityScore >= 0.4) {
    ambiguityLevel = 'moderate';
  } else {
    ambiguityLevel = 'unclear';
  }

  return {
    ...decision,
    needsClarification: clarityScore < CLARITY_THRESHOLD,
    ambiguityLevel,
  };
}

/**
 * Score all decisions in a list
 *
 * @param decisions List of decisions to score
 * @returns List of scored decisions
 */
export function scoreDecisions(decisions: IdentifiedDecision[]): ScoredDecision[] {
  return decisions.map(scoreDecisionAmbiguity);
}

/**
 * Calculate analysis statistics from decisions and ambiguities
 *
 * @param decisions List of identified decisions
 * @param scoredDecisions List of scored decisions
 * @param ambiguities List of ambiguities
 * @returns Analysis statistics
 */
export function calculateAnalysisStats(
  decisions: IdentifiedDecision[],
  scoredDecisions: ScoredDecision[],
  ambiguities: Ambiguity[]
): AnalysisStats {
  const decisionsByCategory: Record<DecisionCategory, number> = {
    architecture: 0,
    library: 0,
    pattern: 0,
    integration: 0,
    'data-model': 0,
    'api-design': 0,
    security: 0,
    performance: 0,
  };

  for (const decision of decisions) {
    decisionsByCategory[decision.category]++;
  }

  const totalClarityScore = decisions.reduce((sum, d) => sum + d.clarityScore, 0);
  const averageClarityScore = decisions.length > 0 ? totalClarityScore / decisions.length : 0;

  return {
    totalDecisions: decisions.length,
    decisionsNeedingClarification: scoredDecisions.filter((d) => d.needsClarification).length,
    clearDecisions: scoredDecisions.filter((d) => !d.needsClarification).length,
    totalAmbiguities: ambiguities.length,
    decisionsByCategory,
    averageClarityScore: Math.round(averageClarityScore * 100) / 100,
  };
}

/**
 * Generate a human-readable analysis summary
 *
 * Creates a summary based on the analysis results that can be used
 * standalone (without relying on LLM-generated summary).
 *
 * @param stats Analysis statistics
 * @returns Human-readable summary string
 */
export function generateAnalysisSummary(stats: AnalysisStats): string {
  const parts: string[] = [];

  // Opening statement about decision count
  if (stats.totalDecisions === 0) {
    parts.push('No technical decisions were identified in this specification.');
  } else if (stats.totalDecisions === 1) {
    parts.push('1 technical decision was identified that may warrant documentation.');
  } else {
    parts.push(`${stats.totalDecisions} technical decisions were identified that may warrant documentation.`);
  }

  // Clarity assessment
  if (stats.totalDecisions > 0) {
    if (stats.decisionsNeedingClarification === 0) {
      parts.push('All decisions appear to have clear direction in the specification.');
    } else if (stats.decisionsNeedingClarification === stats.totalDecisions) {
      parts.push('All decisions require clarification before proceeding.');
    } else {
      parts.push(
        `${stats.decisionsNeedingClarification} decision(s) require clarification, ` +
          `while ${stats.clearDecisions} have clear direction.`
      );
    }
  }

  // Highlight key categories with multiple decisions
  const significantCategories = Object.entries(stats.decisionsByCategory)
    .filter(([, count]) => count >= 2)
    .map(([category]) => category);

  if (significantCategories.length > 0) {
    parts.push(`Key areas include: ${significantCategories.join(', ')}.`);
  }

  // Ambiguity assessment
  if (stats.totalAmbiguities > 0) {
    parts.push(
      `${stats.totalAmbiguities} area(s) of ambiguity were identified that may need clarification.`
    );
  }

  return parts.join(' ');
}
