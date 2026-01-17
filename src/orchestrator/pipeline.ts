/**
 * Pipeline Orchestrator
 *
 * Coordinates the sequential stakeholder interview flow:
 * Tech Lead → QA → UX
 *
 * Each stakeholder builds on insights from previous interviews,
 * as specified in SPEC.md Sequential Interview design.
 */

import type {
  StakeholderAgent,
  StakeholderRole,
  FeatureContext,
  InterviewResult,
} from '../types/index.js';
import { TechLeadAgent } from '../agents/tech-lead-agent.js';
import { QAAgent } from '../agents/qa-agent.js';
import { UXAgent } from '../agents/ux-agent.js';

/**
 * Configuration for the pipeline orchestrator
 */
export interface PipelineConfig {
  /** API key for LLM (defaults to ANTHROPIC_API_KEY env var) */
  apiKey?: string;
  /** Model to use (defaults to claude-sonnet-4-20250514) */
  model?: string;
  /** Which stakeholders to include (defaults to all) */
  stakeholders?: StakeholderRole[];
}

/**
 * Result from running the full pipeline
 */
export interface PipelineResult {
  /** Results from each stakeholder interview */
  interviews: InterviewResult[];
  /** Combined insights from all stakeholders */
  combinedInsights: string[];
  /** All decisions identified across stakeholders */
  allDecisions: InterviewResult['identifiedDecisions'];
  /** All ambiguities identified across stakeholders */
  allAmbiguities: InterviewResult['ambiguities'];
  /** Timestamp of pipeline completion */
  completedAt: Date;
}

/**
 * Progress event during pipeline execution
 */
export interface PipelineProgressEvent {
  type: 'stakeholder_start' | 'stakeholder_complete' | 'pipeline_complete';
  stakeholder?: StakeholderRole;
  message: string;
}

/**
 * Callback for receiving progress updates
 */
export type PipelineProgressCallback = (event: PipelineProgressEvent) => void;

/**
 * Options for running the pipeline
 */
export interface PipelineRunOptions {
  /** Callback for progress updates */
  onProgress?: PipelineProgressCallback;
}

/**
 * Default stakeholder order as specified in SPEC.md
 */
const DEFAULT_STAKEHOLDER_ORDER: StakeholderRole[] = ['tech-lead', 'qa', 'ux'];

/**
 * PipelineOrchestrator coordinates the multi-stakeholder interview flow.
 *
 * The pipeline runs stakeholders sequentially:
 * 1. Tech Lead - identifies architecture decisions, technical constraints
 * 2. QA - explores edge cases, failure modes, testing needs
 * 3. UX - reviews user flows, accessibility, interface decisions
 *
 * Each subsequent stakeholder receives insights from previous interviews,
 * allowing them to build on earlier analysis.
 */
export class PipelineOrchestrator {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly configuredStakeholders: StakeholderRole[];
  private readonly agents: Map<StakeholderRole, StakeholderAgent>;

  constructor(config?: PipelineConfig) {
    this.apiKey = config?.apiKey;
    this.model = config?.model ?? 'claude-sonnet-4-20250514';
    this.configuredStakeholders = config?.stakeholders ?? DEFAULT_STAKEHOLDER_ORDER;

    // Initialize agents for configured stakeholders
    this.agents = new Map();
    this.initializeAgents();
  }

  /**
   * Initialize stakeholder agents based on configuration
   */
  private initializeAgents(): void {
    // Build agent config, only including apiKey if defined
    const baseConfig: { model: string; apiKey?: string } = {
      model: this.model,
    };
    if (this.apiKey !== undefined) {
      baseConfig.apiKey = this.apiKey;
    }

    for (const role of this.configuredStakeholders) {
      switch (role) {
        case 'tech-lead':
          this.agents.set('tech-lead', new TechLeadAgent(baseConfig));
          break;
        case 'qa':
          this.agents.set('qa', new QAAgent(baseConfig));
          break;
        case 'ux':
          this.agents.set('ux', new UXAgent(baseConfig));
          break;
      }
    }
  }

  /**
   * Get the configured stakeholder roles
   */
  get stakeholders(): StakeholderRole[] {
    return [...this.configuredStakeholders];
  }

  /**
   * Get a specific agent by role
   */
  getAgent(role: StakeholderRole): StakeholderAgent | undefined {
    return this.agents.get(role);
  }

  /**
   * Run the full stakeholder pipeline.
   *
   * Executes stakeholder interviews in sequence, passing insights
   * from each interview to subsequent stakeholders.
   *
   * @param context Initial feature context with spec and project info
   * @param options Optional run configuration
   * @returns Combined results from all stakeholder interviews
   */
  async run(context: FeatureContext, options?: PipelineRunOptions): Promise<PipelineResult> {
    const onProgress = options?.onProgress ?? ((): void => {});
    const interviews: InterviewResult[] = [];
    let currentContext = { ...context };

    // Run each stakeholder in sequence
    for (const role of this.configuredStakeholders) {
      const agent = this.agents.get(role);
      if (!agent) {
        continue;
      }

      onProgress({
        type: 'stakeholder_start',
        stakeholder: role,
        message: `Starting ${this.formatRoleName(role)} analysis...`,
      });

      // Pass previous interview results to build context
      currentContext = {
        ...currentContext,
        previousInterviews: [...interviews],
      };

      // Conduct the interview
      const result = await agent.conductInterview(currentContext);
      interviews.push(result);

      onProgress({
        type: 'stakeholder_complete',
        stakeholder: role,
        message: `${this.formatRoleName(role)} analysis complete. Found ${result.identifiedDecisions.length} decisions, ${result.ambiguities.length} ambiguities.`,
      });
    }

    // Aggregate results
    const combinedInsights = this.aggregateInsights(interviews);
    const allDecisions = this.aggregateDecisions(interviews);
    const allAmbiguities = this.aggregateAmbiguities(interviews);

    const result: PipelineResult = {
      interviews,
      combinedInsights,
      allDecisions,
      allAmbiguities,
      completedAt: new Date(),
    };

    onProgress({
      type: 'pipeline_complete',
      message: `Pipeline complete. ${interviews.length} stakeholder(s) analyzed. ${allDecisions.length} total decisions, ${allAmbiguities.length} ambiguities.`,
    });

    return result;
  }

  /**
   * Run a single stakeholder with optional previous context
   *
   * @param role Which stakeholder to run
   * @param context Feature context
   * @param previousInterviews Optional previous interview results for context
   * @returns Interview result from the stakeholder
   */
  async runSingle(
    role: StakeholderRole,
    context: FeatureContext,
    previousInterviews?: InterviewResult[]
  ): Promise<InterviewResult> {
    const agent = this.agents.get(role);
    if (!agent) {
      throw new Error(`Stakeholder agent '${role}' is not configured in this pipeline`);
    }

    const contextWithPrevious: FeatureContext = {
      ...context,
      previousInterviews: previousInterviews ?? context.previousInterviews ?? [],
    };

    return agent.conductInterview(contextWithPrevious);
  }

  /**
   * Aggregate insights from all interviews
   */
  private aggregateInsights(interviews: InterviewResult[]): string[] {
    const insights: string[] = [];

    for (const interview of interviews) {
      const roleName = this.formatRoleName(interview.stakeholderRole);
      for (const insight of interview.insights) {
        insights.push(`[${roleName}] ${insight}`);
      }
    }

    return insights;
  }

  /**
   * Aggregate decisions from all interviews (deduplicating similar ones)
   */
  private aggregateDecisions(
    interviews: InterviewResult[]
  ): InterviewResult['identifiedDecisions'] {
    const decisions: InterviewResult['identifiedDecisions'] = [];
    const seenTitles = new Set<string>();

    for (const interview of interviews) {
      for (const decision of interview.identifiedDecisions) {
        // Simple deduplication by title
        const normalizedTitle = decision.title.toLowerCase();
        if (!seenTitles.has(normalizedTitle)) {
          seenTitles.add(normalizedTitle);
          decisions.push(decision);
        }
      }
    }

    return decisions;
  }

  /**
   * Aggregate ambiguities from all interviews
   */
  private aggregateAmbiguities(interviews: InterviewResult[]): InterviewResult['ambiguities'] {
    const ambiguities: InterviewResult['ambiguities'] = [];
    const seenDescriptions = new Set<string>();

    for (const interview of interviews) {
      for (const ambiguity of interview.ambiguities) {
        // Simple deduplication by description
        const normalizedDesc = ambiguity.description.toLowerCase();
        if (!seenDescriptions.has(normalizedDesc)) {
          seenDescriptions.add(normalizedDesc);
          ambiguities.push(ambiguity);
        }
      }
    }

    return ambiguities;
  }

  /**
   * Format a role name for display
   */
  private formatRoleName(role: StakeholderRole): string {
    const names: Record<StakeholderRole, string> = {
      'tech-lead': 'Tech Lead',
      qa: 'QA',
      ux: 'UX',
    };
    return names[role] ?? role;
  }
}

/**
 * Factory function to create a PipelineOrchestrator instance
 */
export function createPipelineOrchestrator(config?: PipelineConfig): PipelineOrchestrator {
  return new PipelineOrchestrator(config);
}
