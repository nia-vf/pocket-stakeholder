/**
 * CLI Tests
 *
 * Tests for the command-line interface.
 */

import { describe, it, expect } from 'vitest';
import { techLeadCommand } from '../cli/commands/tech-lead.js';

describe('CLI Commands', () => {
  describe('tech-lead command', () => {
    it('should be defined with correct name', () => {
      expect(techLeadCommand.name()).toBe('tech-lead');
    });

    it('should have a description', () => {
      expect(techLeadCommand.description()).toBe(
        'Analyze a spec and generate Architecture Decision Records'
      );
    });

    it('should accept a spec-path argument', () => {
      // Check that the command has the expected argument
      const args = techLeadCommand.registeredArguments;
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('spec-path');
      expect(args[0].required).toBe(true);
    });

    it('should have --autonomous option', () => {
      const options = techLeadCommand.options;
      const autonomousOpt = options.find(
        (opt) => opt.short === '-a' || opt.long === '--autonomous'
      );
      expect(autonomousOpt).toBeDefined();
      expect(autonomousOpt?.description).toBe(
        'Run in autonomous mode (skip interactive interviews)'
      );
    });

    it('should have --output option', () => {
      const options = techLeadCommand.options;
      const outputOpt = options.find(
        (opt) => opt.short === '-o' || opt.long === '--output'
      );
      expect(outputOpt).toBeDefined();
      expect(outputOpt?.description).toBe(
        'Output directory for ADRs (default: docs/adr)'
      );
    });
  });
});
