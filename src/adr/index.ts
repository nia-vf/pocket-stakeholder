/**
 * ADR (Architecture Decision Record) Module
 *
 * Exports ADR generation functionality including template rendering,
 * decision-to-ADR transformation, numbering system, and file writing.
 */

export {
  ADRGenerator,
  createADRGenerator,
  ADRNumberingSystem,
  renderADRTemplate,
  formatADRNumber,
  generateADRFilename,
  decisionToADRDraft,
  type ADRStatus,
  type ADRGeneratorConfig,
  type RenderedADR,
  type WriteResult,
} from './adr-generator.js';
