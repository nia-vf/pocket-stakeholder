/**
 * Tech Lead Command
 *
 * CLI command for invoking the Tech Lead agent.
 * Usage: pocket-stakeholder tech-lead <spec-path> [options]
 */

import { Command } from 'commander';
import { resolve } from 'path';
import chalk from 'chalk';
import { TechLeadAgent } from '../../agents/tech-lead-agent.js';
import { parseSpec } from '../../utils/spec-parser.js';
import { ADRGenerator } from '../../adr/adr-generator.js';
import {
  InterviewSession,
  InterviewQuestionGenerator,
  InquirerCLIPrompt,
} from '../../interview/index.js';
import type { FeatureContext, InterviewResult, InterviewExchange } from '../../types/index.js';

/**
 * Options for the tech-lead command
 */
interface TechLeadOptions {
  autonomous?: boolean;
  output?: string;
}

/**
 * Progress reporter for CLI output
 */
class CLIProgressReporter {
  step(message: string): void {
    console.log(chalk.cyan('→') + ' ' + message);
  }

  success(message: string): void {
    console.log(chalk.green('✓') + ' ' + message);
  }

  error(message: string): void {
    console.log(chalk.red('✗') + ' ' + message);
  }

  warning(message: string): void {
    console.log(chalk.yellow('⚠') + ' ' + message);
  }

  info(message: string): void {
    console.log(chalk.blue('ℹ') + ' ' + message);
  }

  header(message: string): void {
    console.log('\n' + chalk.bold.underline(message) + '\n');
  }

  divider(): void {
    console.log(chalk.gray('─'.repeat(50)));
  }
}

/**
 * Run the tech-lead command
 */
async function runTechLead(specPath: string, options: TechLeadOptions): Promise<void> {
  const progress = new CLIProgressReporter();

  progress.header('Tech Lead Agent');
  progress.info(`Analyzing spec: ${specPath}`);

  // Resolve spec path
  const resolvedPath = resolve(process.cwd(), specPath);

  // Parse the specification
  progress.step('Parsing specification...');
  let context: FeatureContext;
  try {
    context = await parseSpec(resolvedPath);
    progress.success(`Parsed: ${context.parsedSpec.title}`);
  } catch (error) {
    progress.error(
      `Failed to parse spec: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

  // Create the Tech Lead agent
  progress.step('Initializing Tech Lead agent...');
  const agent = new TechLeadAgent();
  progress.success('Agent initialized');

  // Conduct analysis
  progress.step('Analyzing spec for technical decisions...');
  const interviewResult = await agent.conductInterview(context);

  // Get the analysis result for question generation
  const analysisResult = agent.getLastAnalysisResult();

  const decisionCount = interviewResult.identifiedDecisions.length;
  const ambiguityCount = interviewResult.ambiguities.length;
  progress.success(`Found ${decisionCount} decisions, ${ambiguityCount} ambiguities`);

  // Display identified decisions
  if (decisionCount > 0) {
    progress.divider();
    progress.info('Identified Decisions:');
    for (const decision of interviewResult.identifiedDecisions) {
      const clarity = decision.clarityScore >= 0.7 ? chalk.green('clear') : chalk.yellow('needs clarification');
      console.log(`  • ${decision.title} [${decision.category}] - ${clarity}`);
    }
  }

  // Display ambiguities
  if (ambiguityCount > 0) {
    progress.divider();
    progress.info('Ambiguities Found:');
    for (const ambiguity of interviewResult.ambiguities) {
      console.log(`  • ${ambiguity.description}`);
    }
  }

  // Conduct interview if not in autonomous mode and there are ambiguities
  let finalExchanges: InterviewExchange[] = interviewResult.exchanges;
  if (!options.autonomous && ambiguityCount > 0 && analysisResult) {
    progress.divider();
    progress.header('Interview Session');
    progress.info('Starting interactive interview to clarify ambiguities...');

    try {
      const questionGenerator = new InterviewQuestionGenerator({});
      const questionSet = questionGenerator.generateTechLeadQuestions(analysisResult);

      if (questionSet.coreQuestions.length > 0) {
        const cliPrompt = new InquirerCLIPrompt();
        const session = new InterviewSession({
          questionSet,
          cliAdapter: cliPrompt,
        });

        // Run the interview session
        const exchanges = await session.start();
        finalExchanges = exchanges;
        progress.success('Interview completed');
      } else {
        progress.info('No additional questions needed');
      }
    } catch (error) {
      progress.warning(
        `Interview skipped: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else if (options.autonomous) {
    progress.info('Running in autonomous mode - skipping interview');
  }

  // Build final interview result with any new exchanges
  const finalInterviewResult: InterviewResult = {
    ...interviewResult,
    exchanges: finalExchanges,
  };

  // Generate ADRs
  progress.divider();
  progress.step('Generating ADRs...');

  const outputDir = options.output || 'docs/adr';
  const adrGenerator = new ADRGenerator({ outputDir });
  await adrGenerator.initialize();

  const adrs = adrGenerator.generateFromDecisions(
    finalInterviewResult.identifiedDecisions,
    finalInterviewResult
  );

  if (adrs.length === 0) {
    progress.warning('No ADRs generated - no decisions identified');
    return;
  }

  // Write ADRs
  const writeResult = await adrGenerator.writeADRs(adrs);

  if (writeResult.success) {
    progress.success(`Generated ${adrs.length} ADR(s):`);
    for (const file of writeResult.writtenFiles) {
      console.log(`  • ${file}`);
    }
  } else {
    progress.error('Some ADRs failed to write:');
    for (const err of writeResult.errors) {
      console.log(`  • ${err.path}: ${err.error}`);
    }
    if (writeResult.writtenFiles.length > 0) {
      progress.info('Successfully written:');
      for (const file of writeResult.writtenFiles) {
        console.log(`  • ${file}`);
      }
    }
  }

  progress.divider();
  progress.header('Complete');
  progress.success('Tech Lead analysis finished');
}

/**
 * Tech Lead command definition
 */
export const techLeadCommand = new Command('tech-lead')
  .description('Analyze a spec and generate Architecture Decision Records')
  .argument('<spec-path>', 'Path to the specification markdown file')
  .option('-a, --autonomous', 'Run in autonomous mode (skip interactive interviews)')
  .option('-o, --output <path>', 'Output directory for ADRs (default: docs/adr)')
  .action(async (specPath: string, options: TechLeadOptions) => {
    try {
      await runTechLead(specPath, options);
    } catch (error) {
      console.error(
        chalk.red('Error:'),
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });
