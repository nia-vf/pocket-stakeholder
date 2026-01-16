#!/usr/bin/env node
/**
 * CLI Entry Point
 *
 * Main entry point for the pocket-stakeholder CLI.
 * Provides commands for invoking stakeholder agents.
 */

import { Command } from 'commander';
import { techLeadCommand } from './commands/tech-lead.js';

const program = new Command();

const helpText = `
A virtual feature team in your pocket. Simulates stakeholder roles
to help solo developers transform ideas into production-ready applications.

Stakeholder Agents:
  tech-lead    Analyze specs and generate Architecture Decision Records (ADRs)
  qa           (coming soon) Review specs for testability and edge cases
  ux           (coming soon) Evaluate user experience and accessibility

Examples:
  $ pocket-stakeholder tech-lead specs/my-feature.md
    Analyze a spec interactively, asking clarifying questions

  $ pocket-stakeholder tech-lead specs/my-feature.md --autonomous
    Analyze a spec without interactive prompts

  $ pocket-stakeholder tech-lead specs/my-feature.md -o ./decisions
    Output ADRs to a custom directory

Workflow:
  1. Write a feature specification in markdown
  2. Run a stakeholder agent to analyze it
  3. Answer clarifying questions (or use --autonomous)
  4. Review generated Architecture Decision Records

For more information, visit: https://github.com/pocket-stakeholder
`;

program
  .name('pocket-stakeholder')
  .description(
    'A virtual feature team in your pocket. Simulates stakeholder roles to help transform ideas into production-ready applications.'
  )
  .version('0.1.0')
  .addHelpText('after', helpText);

// Register commands
program.addCommand(techLeadCommand);

// Parse command line arguments
program.parse();
