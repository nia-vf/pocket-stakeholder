/**
 * ADR Generator Module
 *
 * Generates Architecture Decision Records (ADRs) from analysis and interview results.
 * Follows the ADR format defined in tech-lead-agent.md.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ADRDraft,
  IdentifiedDecision,
  InterviewResult,
  AlternativeOption,
} from '../types/index.js';

/**
 * Status options for an ADR
 */
export type ADRStatus = 'Proposed' | 'Accepted' | 'Deprecated' | 'Superseded';

/**
 * Configuration for the ADR generator
 */
export interface ADRGeneratorConfig {
  /** Base directory for ADR output (defaults to 'docs/adr') */
  outputDir?: string;
  /** Starting number for ADR numbering (defaults to 1) */
  startingNumber?: number;
  /** Whether to use global numbering (true) or per-feature numbering (false) */
  globalNumbering?: boolean;
  /** Feature name for per-feature numbering */
  featureName?: string;
}

/**
 * Internal configuration with all properties defined
 */
interface ADRGeneratorInternalConfig {
  outputDir: string;
  startingNumber: number;
  globalNumbering: boolean;
  featureName: string | undefined;
}

/**
 * A fully rendered ADR ready to be written
 */
export interface RenderedADR {
  /** ADR number (e.g., "001" or "feature-001") */
  number: string;
  /** Full title including ADR number */
  fullTitle: string;
  /** Rendered markdown content */
  content: string;
  /** Suggested filename */
  filename: string;
  /** Full path where the ADR should be written */
  fullPath: string;
}

/**
 * Result of writing ADRs to the filesystem
 */
export interface WriteResult {
  success: boolean;
  writtenFiles: string[];
  errors: Array<{ path: string; error: string }>;
}

/**
 * ADR Template - generates the standard ADR markdown format
 */
export function renderADRTemplate(
  adrNumber: string,
  draft: ADRDraft,
  status: ADRStatus = 'Proposed'
): string {
  const positiveConsequences = draft.consequences.positive
    .map((c) => `- ${c}`)
    .join('\n');
  const negativeConsequences = draft.consequences.negative
    .map((c) => `- ${c}`)
    .join('\n');

  const alternativesSection = draft.alternativesConsidered
    .map((alt) => formatAlternative(alt))
    .join('\n\n');

  return `# ADR-${adrNumber}: ${draft.title}

## Status
${status}

## Context
${draft.context}

## Decision
${draft.decision}

## Consequences

### Positive
${positiveConsequences || '- None identified'}

### Negative
${negativeConsequences || '- None identified'}

## Alternatives Considered
${alternativesSection || 'No alternatives were explicitly considered.'}
`;
}

/**
 * Format a single alternative option for the ADR
 */
function formatAlternative(alt: AlternativeOption): string {
  const pros = alt.pros.map((p) => `  - ${p}`).join('\n');
  const cons = alt.cons.map((c) => `  - ${c}`).join('\n');

  let section = `### ${alt.name}\n${alt.description}`;

  if (alt.pros.length > 0) {
    section += `\n\n**Pros:**\n${pros}`;
  }

  if (alt.cons.length > 0) {
    section += `\n\n**Cons:**\n${cons}`;
  }

  if (alt.rejectionReason) {
    section += `\n\n**Rejection Reason:** ${alt.rejectionReason}`;
  }

  return section;
}

/**
 * Format ADR number with leading zeros
 */
export function formatADRNumber(num: number, featureName?: string): string {
  const paddedNum = String(num).padStart(3, '0');
  if (featureName) {
    // Sanitize feature name for use in filename
    const sanitized = featureName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${sanitized}-${paddedNum}`;
  }
  return paddedNum;
}

/**
 * Generate filename for an ADR
 */
export function generateADRFilename(adrNumber: string, title: string): string {
  // Sanitize title for filename
  const sanitizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `ADR-${adrNumber}-${sanitizedTitle}.md`;
}

/**
 * Convert an IdentifiedDecision to an ADRDraft
 * This creates a basic draft that can be enhanced with interview context
 */
export function decisionToADRDraft(
  decision: IdentifiedDecision,
  interviewContext?: InterviewResult
): ADRDraft {
  // Extract options as alternatives if available
  const alternatives: AlternativeOption[] = (decision.options || []).map(
    (opt) => ({
      name: opt,
      description: `Option: ${opt}`,
      pros: [],
      cons: [],
    })
  );

  // Extract relevant insights from interview context if available
  const contextFromInterview = interviewContext
    ? extractInterviewContext(decision, interviewContext)
    : '';

  const context = contextFromInterview || decision.description;

  return {
    title: decision.title,
    category: decision.category,
    context,
    decision: `We will proceed with the approach for ${decision.title}.`,
    consequences: {
      positive: [],
      negative: [],
    },
    alternativesConsidered: alternatives,
  };
}

/**
 * Extract relevant context from interview results for a specific decision
 */
function extractInterviewContext(
  decision: IdentifiedDecision,
  interview: InterviewResult
): string {
  // Find exchanges related to this decision
  const relevantExchanges = interview.exchanges.filter(
    (ex) =>
      ex.question.toLowerCase().includes(decision.title.toLowerCase()) ||
      ex.answer.toLowerCase().includes(decision.title.toLowerCase())
  );

  if (relevantExchanges.length === 0) {
    return decision.description;
  }

  // Build context from the exchanges
  const contextParts = [decision.description];

  for (const exchange of relevantExchanges) {
    contextParts.push(`\nDuring discussion, the question arose: "${exchange.question}"`);
    contextParts.push(`The response was: "${exchange.answer}"`);
  }

  // Add relevant insights
  const relevantInsights = interview.insights.filter(
    (insight) =>
      insight.toLowerCase().includes(decision.title.toLowerCase()) ||
      insight.toLowerCase().includes(decision.category)
  );

  if (relevantInsights.length > 0) {
    contextParts.push('\nKey insights:');
    for (const insight of relevantInsights) {
      contextParts.push(`- ${insight}`);
    }
  }

  return contextParts.join('\n');
}

/**
 * ADR Numbering System
 *
 * Manages ADR numbers to ensure unique, sequential numbering.
 */
export class ADRNumberingSystem {
  private nextNumber: number;
  private readonly featureName: string | undefined;
  private readonly globalNumbering: boolean;

  constructor(config: {
    startingNumber?: number;
    featureName?: string;
    globalNumbering?: boolean;
  }) {
    this.nextNumber = config.startingNumber ?? 1;
    this.featureName = config.featureName;
    this.globalNumbering = config.globalNumbering ?? true;
  }

  /**
   * Get the next ADR number and increment the counter
   */
  getNextNumber(): string {
    const num = this.nextNumber;
    this.nextNumber++;
    return formatADRNumber(
      num,
      this.globalNumbering ? undefined : this.featureName
    );
  }

  /**
   * Get the current next number without incrementing
   */
  peekNextNumber(): string {
    return formatADRNumber(
      this.nextNumber,
      this.globalNumbering ? undefined : this.featureName
    );
  }

  /**
   * Reset the numbering to a specific value
   */
  reset(startingNumber: number): void {
    this.nextNumber = startingNumber;
  }

  /**
   * Scan a directory for existing ADRs and set the next number accordingly
   */
  async scanExistingADRs(directory: string): Promise<number> {
    try {
      const files = await fs.readdir(directory);
      const adrPattern = /ADR-(\d{3})(?:-[a-z0-9-]+)?\.md$/i;

      let maxNumber = 0;
      for (const file of files) {
        const match = file.match(adrPattern);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }

      this.nextNumber = maxNumber + 1;
      return maxNumber;
    } catch {
      // Directory doesn't exist or is empty, start from configured number
      return 0;
    }
  }
}

/**
 * ADR Generator
 *
 * Main class for generating ADRs from decisions and interview results.
 */
export class ADRGenerator {
  private readonly config: ADRGeneratorInternalConfig;
  private readonly numberingSystem: ADRNumberingSystem;

  constructor(config?: ADRGeneratorConfig) {
    this.config = {
      outputDir: config?.outputDir ?? 'docs/adr',
      startingNumber: config?.startingNumber ?? 1,
      globalNumbering: config?.globalNumbering ?? true,
      featureName: config?.featureName,
    };

    const numberingConfig: {
      startingNumber?: number;
      featureName?: string;
      globalNumbering?: boolean;
    } = {
      startingNumber: this.config.startingNumber,
      globalNumbering: this.config.globalNumbering,
    };
    if (this.config.featureName !== undefined) {
      numberingConfig.featureName = this.config.featureName;
    }
    this.numberingSystem = new ADRNumberingSystem(numberingConfig);
  }

  /**
   * Initialize the generator by scanning for existing ADRs
   */
  async initialize(): Promise<void> {
    await this.numberingSystem.scanExistingADRs(this.config.outputDir);
  }

  /**
   * Generate a rendered ADR from a draft
   */
  renderADR(draft: ADRDraft, status: ADRStatus = 'Proposed'): RenderedADR {
    const number = this.numberingSystem.getNextNumber();
    const content = renderADRTemplate(number, draft, status);
    const filename = generateADRFilename(number, draft.title);
    const fullPath = path.join(this.config.outputDir, filename);

    return {
      number,
      fullTitle: `ADR-${number}: ${draft.title}`,
      content,
      filename,
      fullPath,
    };
  }

  /**
   * Generate ADRs from a list of drafts
   */
  renderMultipleADRs(
    drafts: ADRDraft[],
    status: ADRStatus = 'Proposed'
  ): RenderedADR[] {
    return drafts.map((draft) => this.renderADR(draft, status));
  }

  /**
   * Convert identified decisions to ADR drafts
   */
  decisionsToADRDrafts(
    decisions: IdentifiedDecision[],
    interviewResult?: InterviewResult
  ): ADRDraft[] {
    return decisions.map((decision) =>
      decisionToADRDraft(decision, interviewResult)
    );
  }

  /**
   * Full pipeline: decisions -> drafts -> rendered ADRs
   */
  generateFromDecisions(
    decisions: IdentifiedDecision[],
    interviewResult?: InterviewResult,
    status: ADRStatus = 'Proposed'
  ): RenderedADR[] {
    const drafts = this.decisionsToADRDrafts(decisions, interviewResult);
    return this.renderMultipleADRs(drafts, status);
  }

  /**
   * Write rendered ADRs to the filesystem
   */
  async writeADRs(adrs: RenderedADR[]): Promise<WriteResult> {
    const result: WriteResult = {
      success: true,
      writtenFiles: [],
      errors: [],
    };

    // Ensure output directory exists
    try {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    } catch (err) {
      result.success = false;
      result.errors.push({
        path: this.config.outputDir,
        error: `Failed to create output directory: ${err instanceof Error ? err.message : String(err)}`,
      });
      return result;
    }

    // Write each ADR
    for (const adr of adrs) {
      try {
        await fs.writeFile(adr.fullPath, adr.content, 'utf-8');
        result.writtenFiles.push(adr.fullPath);
      } catch (err) {
        result.success = false;
        result.errors.push({
          path: adr.fullPath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }

  /**
   * Get the configured output directory
   */
  getOutputDir(): string {
    return this.config.outputDir;
  }

  /**
   * Get the numbering system for advanced use
   */
  getNumberingSystem(): ADRNumberingSystem {
    return this.numberingSystem;
  }
}

/**
 * Factory function to create an ADRGenerator instance
 */
export function createADRGenerator(config?: ADRGeneratorConfig): ADRGenerator {
  return new ADRGenerator(config);
}
