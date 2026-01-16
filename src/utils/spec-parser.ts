/**
 * Spec Parser
 *
 * Reads and parses specification documents (markdown) to extract
 * structured information for stakeholder analysis.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import type {
  ParsedSpec,
  SpecFeature,
  SpecRequirement,
  ProjectContext,
  ExistingDecision,
  FeatureContext,
} from '../types/index.js';

/**
 * Error thrown when spec parsing fails
 */
export class SpecParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SpecParseError';
  }
}

/**
 * Options for parsing a spec file
 */
export interface SpecParserOptions {
  /** Project root directory (defaults to spec file's parent directory) */
  projectRoot?: string;
  /** Whether to load project context (CLAUDE.md, existing decisions) */
  loadProjectContext?: boolean;
}

/**
 * Parsed section from the markdown document
 */
interface MarkdownSection {
  level: number;
  title: string;
  content: string;
}

/**
 * Parse a specification document and return a FeatureContext
 *
 * @param specPath Path to the specification markdown file
 * @param options Parsing options
 * @returns FeatureContext ready for stakeholder analysis
 */
export async function parseSpec(
  specPath: string,
  options?: SpecParserOptions
): Promise<FeatureContext> {
  // Read the spec file
  const specContent = await readSpecFile(specPath);

  // Parse the spec content
  const parsedSpec = parseSpecContent(specContent);

  // Determine project root
  const projectRoot = options?.projectRoot ?? dirname(specPath);

  // Load project context if requested (default: true)
  const loadContext = options?.loadProjectContext ?? true;
  const projectContext = loadContext
    ? await loadProjectContext(projectRoot)
    : {
        projectRoot,
        existingDecisions: [],
      };

  return {
    specPath,
    specContent,
    parsedSpec,
    projectContext,
  };
}

/**
 * Read a spec file from disk
 *
 * @param specPath Path to the spec file
 * @returns File content as string
 */
export async function readSpecFile(specPath: string): Promise<string> {
  if (!existsSync(specPath)) {
    throw new SpecParseError(`Spec file not found: ${specPath}`);
  }

  try {
    const content = await readFile(specPath, 'utf-8');
    if (!content.trim()) {
      throw new SpecParseError(`Spec file is empty: ${specPath}`);
    }
    return content;
  } catch (error) {
    if (error instanceof SpecParseError) {
      throw error;
    }
    throw new SpecParseError(`Failed to read spec file: ${specPath}`, error);
  }
}

/**
 * Parse spec content into structured sections
 *
 * @param content Raw markdown content
 * @returns ParsedSpec with extracted sections
 */
export function parseSpecContent(content: string): ParsedSpec {
  const sections = extractSections(content);

  // Extract title from first H1
  const titleSection = sections.find((s) => s.level === 1);
  const title = titleSection?.title ?? 'Untitled Spec';

  // Extract overview (content after title or from Overview section)
  const overviewSection = sections.find(
    (s) => s.title.toLowerCase() === 'overview' || s.title.toLowerCase() === 'summary'
  );
  const overview = overviewSection?.content ?? titleSection?.content;

  // Extract features
  const features = extractFeatures(sections);

  // Extract requirements
  const requirements = extractRequirements(sections);

  // Extract technical architecture
  const archSection = sections.find(
    (s) =>
      s.title.toLowerCase().includes('technical') ||
      s.title.toLowerCase().includes('architecture') ||
      s.title.toLowerCase().includes('design')
  );
  const technicalArchitecture = archSection?.content;

  // Collect other sections that weren't categorized
  const knownTitles = new Set([
    'overview',
    'summary',
    'features',
    'requirements',
    'functional requirements',
    'non-functional requirements',
    'technical architecture',
    'architecture',
    'design',
    title.toLowerCase(),
  ]);

  const otherSections: Record<string, string> = {};
  for (const section of sections) {
    const lowerTitle = section.title.toLowerCase();
    if (section.level >= 2 && !knownTitles.has(lowerTitle) && section.content.trim()) {
      otherSections[section.title] = section.content;
    }
  }

  // Build result, only including optional fields if they have values
  const result: ParsedSpec = {
    title,
    otherSections,
  };

  if (overview) {
    result.overview = overview;
  }

  if (features.length > 0) {
    result.features = features;
  }

  if (requirements.length > 0) {
    result.requirements = requirements;
  }

  if (technicalArchitecture) {
    result.technicalArchitecture = technicalArchitecture;
  }

  return result;
}

/**
 * Extract markdown sections from content
 *
 * @param content Markdown content
 * @returns Array of parsed sections
 */
function extractSections(content: string): MarkdownSection[] {
  const lines = content.split('\n');
  const sections: MarkdownSection[] = [];

  let currentSection: MarkdownSection | null = null;
  let contentLines: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentLines.join('\n').trim();
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        level: headerMatch[1].length,
        title: headerMatch[2].trim(),
        content: '',
      };
      contentLines = [];
    } else if (currentSection) {
      contentLines.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentLines.join('\n').trim();
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Extract features from parsed sections
 *
 * @param sections Parsed markdown sections
 * @returns Array of SpecFeatures
 */
function extractFeatures(sections: MarkdownSection[]): SpecFeature[] {
  const features: SpecFeature[] = [];

  // Look for features section
  const featuresSection = sections.find(
    (s) =>
      s.title.toLowerCase() === 'features' || s.title.toLowerCase().includes('user stories')
  );

  if (!featuresSection) {
    return features;
  }

  // Parse list items as features
  const listItemRegex = /^[-*]\s+\*?\*?([^*\n]+)\*?\*?\s*[-:]?\s*(.*)$/gm;
  let match: RegExpExecArray | null;

  while ((match = listItemRegex.exec(featuresSection.content)) !== null) {
    const name = match[1].trim();
    const description = match[2]?.trim() || name;

    // Try to extract priority from name or description
    const priorityMatch = (name + ' ' + description).match(/\b(P[0-3])\b/i);

    const feature: SpecFeature = {
      name: name.replace(/\s*\(P[0-3]\)\s*/gi, '').trim(),
      description,
    };

    if (priorityMatch) {
      const priorityStr = priorityMatch[1].toUpperCase();
      if (priorityStr === 'P0' || priorityStr === 'P1' || priorityStr === 'P2' || priorityStr === 'P3') {
        feature.priority = priorityStr;
      }
    }

    features.push(feature);
  }

  return features;
}

/**
 * Extract requirements from parsed sections
 *
 * @param sections Parsed markdown sections
 * @returns Array of SpecRequirements
 */
function extractRequirements(sections: MarkdownSection[]): SpecRequirement[] {
  const requirements: SpecRequirement[] = [];

  // Look for requirements sections
  const reqSections = sections.filter(
    (s) =>
      s.title.toLowerCase().includes('requirement') ||
      s.title.toLowerCase().includes('constraints')
  );

  for (const section of reqSections) {
    const isFunctional = !section.title.toLowerCase().includes('non-functional');
    const type: SpecRequirement['type'] = isFunctional ? 'functional' : 'non-functional';

    // Parse table rows for requirements (common format)
    // Format: | **FR-1** | Description |
    const tableRowRegex = /\|\s*\*?\*?([A-Z]+-\d+)\*?\*?\s*\|\s*([^|]+)\|/g;
    let tableMatch: RegExpExecArray | null;

    while ((tableMatch = tableRowRegex.exec(section.content)) !== null) {
      requirements.push({
        id: tableMatch[1].trim(),
        description: tableMatch[2].trim(),
        type,
      });
    }

    // Also parse list items with requirement IDs
    const listRegex = /[-*]\s*\*?\*?([A-Z]+-\d+)\*?\*?\s*[-:]?\s*(.+)/g;
    let listMatch: RegExpExecArray | null;
    while ((listMatch = listRegex.exec(section.content)) !== null) {
      // Avoid duplicates
      if (!requirements.some((r) => r.id === listMatch![1].trim())) {
        requirements.push({
          id: listMatch[1].trim(),
          description: listMatch[2].trim(),
          type,
        });
      }
    }
  }

  return requirements;
}

/**
 * Load project context from CLAUDE.md and existing decisions
 *
 * @param projectRoot Project root directory
 * @returns ProjectContext with loaded data
 */
export async function loadProjectContext(projectRoot: string): Promise<ProjectContext> {
  const context: ProjectContext = {
    projectRoot,
    existingDecisions: [],
  };

  // Try to load CLAUDE.md
  const claudeMdPath = join(projectRoot, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    try {
      context.claudeMd = await readFile(claudeMdPath, 'utf-8');
    } catch {
      // Silently ignore if we can't read CLAUDE.md
    }
  }

  // Try to load existing decisions
  context.existingDecisions = await loadExistingDecisions(projectRoot);

  return context;
}

/**
 * Load existing ADRs/decisions from the project
 *
 * @param projectRoot Project root directory
 * @returns Array of existing decisions
 */
async function loadExistingDecisions(projectRoot: string): Promise<ExistingDecision[]> {
  const decisions: ExistingDecision[] = [];

  // Check common locations for ADRs
  const adrLocations = [
    join(projectRoot, 'docs', 'adr'),
    join(projectRoot, 'docs', 'decisions'),
    join(projectRoot, 'specs'),
  ];

  for (const location of adrLocations) {
    if (!existsSync(location)) {
      continue;
    }

    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(location);

      for (const file of files) {
        // Look for decision files
        if (file.endsWith('.decisions.md') || file.match(/^ADR-\d+/i)) {
          const filePath = join(location, file);
          try {
            const content = await readFile(filePath, 'utf-8');
            const parsed = parseDecisionFile(content, filePath);
            if (parsed) {
              decisions.push(...parsed);
            }
          } catch {
            // Skip files we can't read
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  return decisions;
}

/**
 * Parse a decision file to extract ADRs
 *
 * @param content File content
 * @param filePath Path to the file
 * @returns Array of decisions from the file
 */
function parseDecisionFile(content: string, filePath: string): ExistingDecision[] {
  const decisions: ExistingDecision[] = [];

  // Match ADR headers: # ADR-001: Title
  const adrRegex = /^#\s*(ADR-\d+):\s*(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = adrRegex.exec(content)) !== null) {
    const id = match[1];
    const title = match[2].trim();

    // Try to extract status
    const statusMatch = content
      .slice(match.index)
      .match(/##\s*Status\s*\n+([^\n#]+)/i);
    const statusText = statusMatch?.[1]?.trim().toLowerCase() ?? 'proposed';

    let status: ExistingDecision['status'] = 'Proposed';
    if (statusText.includes('accepted')) status = 'Accepted';
    else if (statusText.includes('deprecated')) status = 'Deprecated';
    else if (statusText.includes('superseded')) status = 'Superseded';

    // Extract first paragraph as summary
    const summaryMatch = content
      .slice(match.index)
      .match(/##\s*(?:Context|Decision)\s*\n+([^\n#]+)/i);
    const summary = summaryMatch?.[1]?.trim();

    const decision: ExistingDecision = {
      id,
      title,
      status,
      path: filePath,
    };

    if (summary) {
      decision.summary = summary;
    }

    decisions.push(decision);
  }

  return decisions;
}

/**
 * Create an empty ParsedSpec with default values
 * Useful for testing and as a fallback
 */
export function createEmptyParsedSpec(title: string = 'Untitled'): ParsedSpec {
  return {
    title,
    otherSections: {},
  };
}

/**
 * Validation result for a parsed spec
 */
export interface SpecValidationResult {
  /** Whether the spec is valid for processing */
  isValid: boolean;

  /** List of warnings (non-blocking issues) */
  warnings: string[];

  /** List of errors (blocking issues) */
  errors: string[];

  /** Completeness score (0-1, where 1 is fully complete) */
  completenessScore: number;

  /** Sections that are present */
  presentSections: string[];

  /** Sections that are missing */
  missingSections: string[];
}

/**
 * Validate a parsed spec and provide detailed feedback
 *
 * This function checks for:
 * - Required sections (title)
 * - Recommended sections (overview, features or requirements)
 * - Quality of content (non-empty sections)
 *
 * @param parsedSpec The parsed spec to validate
 * @returns Validation result with errors, warnings, and completeness score
 */
export function validateParsedSpec(parsedSpec: ParsedSpec): SpecValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const presentSections: string[] = [];
  const missingSections: string[] = [];

  // Check title (required)
  if (!parsedSpec.title || parsedSpec.title === 'Untitled Spec' || parsedSpec.title === 'Untitled') {
    errors.push('Spec is missing a title. Add a level-1 heading (# Title) at the top of the document.');
  } else {
    presentSections.push('title');
  }

  // Check overview (recommended)
  if (parsedSpec.overview && parsedSpec.overview.trim().length > 0) {
    presentSections.push('overview');
    if (parsedSpec.overview.trim().length < 20) {
      warnings.push('Overview section is very brief. Consider adding more context about the feature.');
    }
  } else {
    missingSections.push('overview');
    warnings.push('No overview section found. Consider adding an "Overview" or "Summary" section to describe the feature.');
  }

  // Check features (recommended for feature specs)
  if (parsedSpec.features && parsedSpec.features.length > 0) {
    presentSections.push('features');
  } else {
    missingSections.push('features');
    // Only warn, not an error - some specs may not have explicit features
  }

  // Check requirements (recommended)
  if (parsedSpec.requirements && parsedSpec.requirements.length > 0) {
    presentSections.push('requirements');
  } else {
    missingSections.push('requirements');
    // Only warn if no features either - spec needs at least one
    if (!parsedSpec.features || parsedSpec.features.length === 0) {
      warnings.push('No features or requirements found. Consider adding a "Features" or "Requirements" section.');
    }
  }

  // Check technical architecture (optional but valuable for tech lead)
  if (parsedSpec.technicalArchitecture && parsedSpec.technicalArchitecture.trim().length > 0) {
    presentSections.push('technicalArchitecture');
  } else {
    missingSections.push('technicalArchitecture');
    // Don't warn - technical architecture is optional
  }

  // Check if there's any meaningful content at all
  const hasContent =
    presentSections.length > 1 || // More than just title
    Object.keys(parsedSpec.otherSections).length > 0;

  if (!hasContent) {
    warnings.push('Spec appears to have minimal content. Consider adding more details for better analysis.');
  }

  // Calculate completeness score
  // Title is required (weight 0.2), overview (0.2), features (0.2), requirements (0.2), architecture (0.2)
  const weights = {
    title: 0.2,
    overview: 0.2,
    features: 0.2,
    requirements: 0.2,
    technicalArchitecture: 0.2,
  };

  let completenessScore = 0;
  for (const section of presentSections) {
    if (section in weights) {
      completenessScore += weights[section as keyof typeof weights];
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    completenessScore,
    presentSections,
    missingSections,
  };
}

/**
 * Extract a summary of the spec suitable for LLM context
 *
 * This creates a condensed version of the spec that includes:
 * - Title and overview
 * - Feature list (names only)
 * - Requirement IDs and descriptions
 * - Technical architecture summary
 *
 * @param parsedSpec The parsed spec to summarize
 * @returns A string summary suitable for LLM prompts
 */
export function summarizeSpec(parsedSpec: ParsedSpec): string {
  const parts: string[] = [];

  // Title
  parts.push(`# ${parsedSpec.title}`);

  // Overview
  if (parsedSpec.overview) {
    parts.push(`\n## Overview\n${parsedSpec.overview}`);
  }

  // Features (condensed)
  if (parsedSpec.features && parsedSpec.features.length > 0) {
    parts.push('\n## Features');
    for (const feature of parsedSpec.features) {
      const priority = feature.priority ? ` (${feature.priority})` : '';
      parts.push(`- ${feature.name}${priority}: ${feature.description}`);
    }
  }

  // Requirements (condensed)
  if (parsedSpec.requirements && parsedSpec.requirements.length > 0) {
    const functional = parsedSpec.requirements.filter((r) => r.type === 'functional');
    const nonFunctional = parsedSpec.requirements.filter((r) => r.type === 'non-functional');

    if (functional.length > 0) {
      parts.push('\n## Functional Requirements');
      for (const req of functional) {
        parts.push(`- ${req.id}: ${req.description}`);
      }
    }

    if (nonFunctional.length > 0) {
      parts.push('\n## Non-Functional Requirements');
      for (const req of nonFunctional) {
        parts.push(`- ${req.id}: ${req.description}`);
      }
    }
  }

  // Technical architecture
  if (parsedSpec.technicalArchitecture) {
    // Truncate if too long
    const arch = parsedSpec.technicalArchitecture;
    const truncated = arch.length > 500 ? arch.slice(0, 500) + '...' : arch;
    parts.push(`\n## Technical Architecture\n${truncated}`);
  }

  // Other notable sections
  const importantSections = [
    'Dependencies',
    'Open Questions',
    'Technical Decisions',
    'Constraints',
    'Out of Scope',
  ];

  for (const sectionName of importantSections) {
    const content = parsedSpec.otherSections[sectionName];
    if (content) {
      const truncated = content.length > 300 ? content.slice(0, 300) + '...' : content;
      parts.push(`\n## ${sectionName}\n${truncated}`);
    }
  }

  return parts.join('\n');
}

/**
 * Build a complete FeatureContext with validation
 *
 * This is the primary function for creating a context object from a spec file.
 * It validates the spec and includes validation results in the context.
 *
 * @param specPath Path to the specification file
 * @param options Parsing options
 * @returns FeatureContext with validation results
 * @throws SpecParseError if the spec has blocking errors
 */
export async function buildFeatureContext(
  specPath: string,
  options?: SpecParserOptions & { strict?: boolean }
): Promise<FeatureContext & { validation: SpecValidationResult }> {
  const context = await parseSpec(specPath, options);
  const validation = validateParsedSpec(context.parsedSpec);

  // In strict mode, throw if there are errors
  if (options?.strict && !validation.isValid) {
    throw new SpecParseError(
      `Spec validation failed:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }

  return {
    ...context,
    validation,
  };
}
