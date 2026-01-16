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

program
  .name('pocket-stakeholder')
  .description(
    'A virtual feature team in your pocket. Simulates stakeholder roles to help transform ideas into production-ready applications.'
  )
  .version('0.1.0');

// Register commands
program.addCommand(techLeadCommand);

// Parse command line arguments
program.parse();
