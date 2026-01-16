/**
 * CLI Prompt Adapter
 *
 * Provides an interactive CLI interface for conducting interviews
 * using the inquirer library.
 */

import type { CLIPromptAdapter } from './interview-session.js';
import type { InterviewQuestion } from './question-generator.js';

/**
 * Configuration for the CLI prompt adapter
 */
export interface CLIPromptConfig {
  /** Prefix to show before questions (default: "❓") */
  questionPrefix?: string;

  /** Color theme for chalk (default: cyan) */
  theme?: 'cyan' | 'green' | 'yellow' | 'blue' | 'magenta';

  /** Whether to show question metadata (category, type) */
  showMetadata?: boolean;

  /** Custom prompt message template */
  promptTemplate?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChalkInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InquirerInstance = any;

/**
 * InquirerCLIPrompt provides an interactive CLI interface for interviews
 *
 * Uses inquirer for robust user input handling with:
 * - Multi-line text input for detailed answers
 * - Formatted question display with category/type info
 * - Progress indicators
 */
export class InquirerCLIPrompt implements CLIPromptAdapter {
  private readonly config: Required<CLIPromptConfig>;
  private chalk: ChalkInstance | null = null;
  private inquirer: InquirerInstance | null = null;

  constructor(config?: CLIPromptConfig) {
    this.config = {
      questionPrefix: config?.questionPrefix ?? '❓',
      theme: config?.theme ?? 'cyan',
      showMetadata: config?.showMetadata ?? true,
      promptTemplate: config?.promptTemplate ?? 'Your answer',
    };
  }

  /**
   * Lazy-load chalk and inquirer for better startup performance
   */
  private async loadDependencies(): Promise<void> {
    if (!this.chalk) {
      const chalkModule = await import('chalk');
      this.chalk = chalkModule.default;
    }
    if (!this.inquirer) {
      const inquirerModule = await import('inquirer');
      this.inquirer = inquirerModule.default;
    }
  }

  /**
   * Prompt the user for an answer via CLI
   */
  async prompt(question: InterviewQuestion): Promise<string> {
    await this.loadDependencies();

    const chalk = this.chalk;
    const inquirer = this.inquirer;

    // Build the question display
    const lines: string[] = [];

    // Question header with metadata
    if (this.config.showMetadata) {
      const categoryBadge = chalk.dim(`[${question.category}]`);
      const typeBadge = question.type === 'follow-up'
        ? chalk.yellow('(follow-up)')
        : '';
      lines.push(`${categoryBadge} ${typeBadge}`.trim());
    }

    // Main question text
    const themedColor = chalk[this.config.theme] || chalk.cyan;
    lines.push(`${this.config.questionPrefix} ${themedColor(question.text)}`);
    lines.push('');

    // Display the formatted question
    console.log(lines.join('\n'));

    // Prompt for answer using inquirer
    const { answer } = await inquirer.prompt([
      {
        type: 'input',
        name: 'answer',
        message: this.config.promptTemplate,
        validate: (input: string): boolean | string => {
          if (!input.trim()) {
            return 'Please provide an answer (or type "skip" to skip this question)';
          }
          return true;
        },
      },
    ]);

    // Handle skip command
    if (answer.toLowerCase().trim() === 'skip') {
      return '';
    }

    return answer;
  }

  /**
   * Display a message to the user
   */
  display(message: string): void {
    console.log(message);
  }

  /**
   * Display a formatted section header
   */
  async displayHeader(title: string): Promise<void> {
    await this.loadDependencies();
    const chalk = this.chalk;

    const line = '─'.repeat(50);
    console.log(chalk.dim(line));
    console.log(chalk.bold(title));
    console.log(chalk.dim(line));
  }

  /**
   * Display interview progress
   */
  async displayProgress(current: number, total: number): Promise<void> {
    await this.loadDependencies();
    const chalk = this.chalk;

    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(percentage / 5);
    const empty = 20 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);

    console.log(chalk.dim(`Progress: [${bar}] ${percentage}% (${current}/${total})`));
  }

  /**
   * Display a success message
   */
  async displaySuccess(message: string): Promise<void> {
    await this.loadDependencies();
    const chalk = this.chalk;
    console.log(chalk.green(`✓ ${message}`));
  }

  /**
   * Display a warning message
   */
  async displayWarning(message: string): Promise<void> {
    await this.loadDependencies();
    const chalk = this.chalk;
    console.log(chalk.yellow(`⚠ ${message}`));
  }

  /**
   * Display an error message
   */
  async displayError(message: string): Promise<void> {
    await this.loadDependencies();
    const chalk = this.chalk;
    console.log(chalk.red(`✗ ${message}`));
  }
}

/**
 * Simple CLI prompt that uses process stdin/stdout directly
 *
 * Useful for environments where inquirer is not available or
 * for simpler use cases.
 */
export class SimpleCLIPrompt implements CLIPromptAdapter {
  private readline: typeof import('readline') | null = null;

  /**
   * Prompt the user for an answer via CLI
   */
  async prompt(question: InterviewQuestion): Promise<string> {
    if (!this.readline) {
      this.readline = await import('readline');
    }

    const rl = this.readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Display the question
    console.log(`\n[${question.category}] ${question.type === 'follow-up' ? '(follow-up)' : ''}`);
    console.log(`❓ ${question.text}\n`);

    return new Promise((resolve) => {
      rl.question('Your answer: ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  /**
   * Display a message to the user
   */
  display(message: string): void {
    console.log(message);
  }
}

/**
 * Factory function to create the default CLI prompt adapter
 */
export function createCLIPrompt(config?: CLIPromptConfig): CLIPromptAdapter {
  return new InquirerCLIPrompt(config);
}

/**
 * Factory function to create a simple CLI prompt adapter
 */
export function createSimpleCLIPrompt(): CLIPromptAdapter {
  return new SimpleCLIPrompt();
}
