/**
 * Orchestrator Module
 *
 * Provides the pipeline orchestrator for coordinating multi-stakeholder flows.
 */

export {
  PipelineOrchestrator,
  createPipelineOrchestrator,
} from './pipeline.js';

export type {
  PipelineConfig,
  PipelineResult,
  PipelineProgressEvent,
  PipelineProgressCallback,
  PipelineRunOptions,
} from './pipeline.js';
