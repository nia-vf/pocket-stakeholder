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
 * Result of spec analysis
 */
export interface AnalysisResult {
  /** Technical decisions identified that need documentation */
  decisions: IdentifiedDecision[];

  /** Ambiguous areas requiring clarification */
  ambiguities: Ambiguity[];

  /** Summary of the analysis */
  summary: string;
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

    return {
      decisions,
      ambiguities,
      summary: raw.summary,
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
