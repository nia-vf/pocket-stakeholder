/**
 * Interview Question Generator
 *
 * Generates interview questions for stakeholder agents based on
 * spec analysis results and identified decisions/ambiguities.
 */

import type {
  Ambiguity,
  DecisionCategory,
  StakeholderRole,
} from '../types/index.js';
import type { AnalysisResult, ScoredDecision } from '../utils/spec-analyzer.js';

/**
 * A question to be asked during an interview
 */
export interface InterviewQuestion {
  /** Unique identifier for the question */
  id: string;

  /** The question text to present to the user */
  text: string;

  /** Type of question: core or follow-up */
  type: 'core' | 'follow-up';

  /** Category this question relates to */
  category: DecisionCategory | 'general';

  /** Priority for ordering (lower = asked first) */
  priority: number;

  /** Related decision if this question is about a specific decision */
  relatedDecisionTitle?: string;

  /** Related ambiguity if this question addresses an ambiguity */
  relatedAmbiguityDescription?: string;

  /** Conditions under which this follow-up should be asked */
  followUpTrigger?: FollowUpTrigger;
}

/**
 * Conditions that trigger a follow-up question
 */
export interface FollowUpTrigger {
  /** ID of the question that triggers this follow-up */
  afterQuestionId: string;

  /** Keywords in the answer that trigger this follow-up */
  triggerKeywords?: string[];

  /** Always ask this follow-up regardless of answer content */
  alwaysAsk?: boolean;
}

/**
 * Question set for an interview session
 */
export interface QuestionSet {
  /** Role this question set is for */
  role: StakeholderRole;

  /** Core questions (5-8 as per SPEC.md) */
  coreQuestions: InterviewQuestion[];

  /** Potential follow-up questions (1-8 may be asked based on answers) */
  followUpQuestions: InterviewQuestion[];

  /** Total question count estimate */
  estimatedQuestionCount: {
    min: number;
    max: number;
  };
}

/**
 * Core question templates for Tech Lead role
 *
 * These cover the essential areas a Tech Lead would probe:
 * - Architecture and structure
 * - Trade-offs and constraints
 * - Scalability and future needs
 * - Technology choices
 * - Integration patterns
 */
const TECH_LEAD_CORE_TEMPLATES: Array<{
  template: string;
  category: DecisionCategory | 'general';
  priority: number;
}> = [
  {
    template:
      'What are the primary architectural constraints or requirements for this feature?',
    category: 'architecture',
    priority: 1,
  },
  {
    template:
      'Are there any performance requirements or SLAs that need to be considered?',
    category: 'performance',
    priority: 2,
  },
  {
    template:
      'How should this feature integrate with the existing system components?',
    category: 'integration',
    priority: 3,
  },
  {
    template: 'What data needs to be stored, and what are the access patterns?',
    category: 'data-model',
    priority: 4,
  },
  {
    template:
      'Are there specific security or compliance requirements to address?',
    category: 'security',
    priority: 5,
  },
  {
    template:
      'What are the expected scale requirements (users, data volume, transactions)?',
    category: 'performance',
    priority: 6,
  },
  {
    template:
      'Are there any technology constraints or preferences for implementation?',
    category: 'library',
    priority: 7,
  },
  {
    template: 'What trade-offs are you willing to make (speed vs. cost, simplicity vs. flexibility)?',
    category: 'general',
    priority: 8,
  },
];

/**
 * Follow-up question templates for Tech Lead role
 */
const TECH_LEAD_FOLLOWUP_TEMPLATES: Array<{
  template: string;
  category: DecisionCategory | 'general';
  triggerCategory?: DecisionCategory;
  triggerKeywords?: string[];
}> = [
  {
    template: 'Can you elaborate on the specific {category} requirements?',
    category: 'general',
  },
  {
    template: 'What happens if {aspect} fails? What is the fallback behavior?',
    category: 'architecture',
    triggerKeywords: ['depends on', 'relies on', 'integration', 'external'],
  },
  {
    template: 'How should the system handle peak load scenarios?',
    category: 'performance',
    triggerKeywords: ['scale', 'performance', 'high traffic', 'concurrent'],
  },
  {
    template: 'What backward compatibility requirements exist?',
    category: 'integration',
    triggerKeywords: ['existing', 'legacy', 'migration', 'upgrade'],
  },
  {
    template: 'What authentication/authorization model should be used?',
    category: 'security',
    triggerCategory: 'security',
  },
  {
    template: 'Should the data model support future extensibility?',
    category: 'data-model',
    triggerCategory: 'data-model',
  },
  {
    template: 'What caching strategy would be appropriate?',
    category: 'performance',
    triggerKeywords: ['performance', 'latency', 'fast', 'cache'],
  },
  {
    template: 'Are there any API versioning requirements?',
    category: 'api-design',
    triggerCategory: 'api-design',
  },
];

/**
 * Configuration for question generation
 */
export interface QuestionGeneratorConfig {
  /** Minimum number of core questions to generate */
  minCoreQuestions?: number;

  /** Maximum number of core questions to generate */
  maxCoreQuestions?: number;

  /** Maximum number of follow-up questions to prepare */
  maxFollowUpQuestions?: number;
}

const DEFAULT_CONFIG: Required<QuestionGeneratorConfig> = {
  minCoreQuestions: 5,
  maxCoreQuestions: 8,
  maxFollowUpQuestions: 8,
};

/**
 * InterviewQuestionGenerator creates contextual interview questions
 * based on spec analysis results.
 */
export class InterviewQuestionGenerator {
  private readonly config: Required<QuestionGeneratorConfig>;

  constructor(config?: QuestionGeneratorConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Generate a complete question set for the Tech Lead role
   *
   * @param analysisResult Result from spec analysis
   * @returns Question set with core and follow-up questions
   */
  generateTechLeadQuestions(analysisResult: AnalysisResult): QuestionSet {
    const coreQuestions = this.generateCoreQuestions(
      analysisResult,
      'tech-lead'
    );
    const followUpQuestions = this.generateFollowUpQuestions(
      analysisResult,
      coreQuestions,
      'tech-lead'
    );

    return {
      role: 'tech-lead',
      coreQuestions,
      followUpQuestions,
      estimatedQuestionCount: {
        min: coreQuestions.length,
        max: coreQuestions.length + Math.min(followUpQuestions.length, this.config.maxFollowUpQuestions),
      },
    };
  }

  /**
   * Generate core questions based on analysis results
   */
  private generateCoreQuestions(
    analysisResult: AnalysisResult,
    role: StakeholderRole
  ): InterviewQuestion[] {
    const questions: InterviewQuestion[] = [];
    const usedCategories = new Set<string>();

    // First, generate questions for decisions needing clarification
    for (const decision of analysisResult.scoredDecisions) {
      if (
        decision.needsClarification &&
        questions.length < this.config.maxCoreQuestions
      ) {
        const question = this.createDecisionQuestion(decision, questions.length);
        if (question) {
          questions.push(question);
          usedCategories.add(decision.category);
        }
      }
    }

    // Next, add questions for ambiguities
    for (const ambiguity of analysisResult.ambiguities) {
      if (questions.length < this.config.maxCoreQuestions) {
        const question = this.createAmbiguityQuestion(
          ambiguity,
          questions.length
        );
        if (question) {
          questions.push(question);
        }
      }
    }

    // Fill remaining slots with template questions for uncovered categories
    const templates =
      role === 'tech-lead' ? TECH_LEAD_CORE_TEMPLATES : TECH_LEAD_CORE_TEMPLATES;

    for (const template of templates) {
      if (questions.length >= this.config.maxCoreQuestions) break;
      if (questions.length >= this.config.minCoreQuestions && usedCategories.has(template.category)) {
        continue; // Skip if we already have enough questions and this category is covered
      }

      const question: InterviewQuestion = {
        id: `${role}-core-${questions.length + 1}`,
        text: template.template,
        type: 'core',
        category: template.category,
        priority: template.priority,
      };

      // Avoid duplicate questions
      if (!questions.some((q) => q.text === question.text)) {
        questions.push(question);
      }
    }

    // Sort by priority
    questions.sort((a, b) => a.priority - b.priority);

    // Ensure we have at least minimum questions
    return questions.slice(0, this.config.maxCoreQuestions);
  }

  /**
   * Generate follow-up questions based on analysis and core questions
   */
  private generateFollowUpQuestions(
    analysisResult: AnalysisResult,
    coreQuestions: InterviewQuestion[],
    role: StakeholderRole
  ): InterviewQuestion[] {
    const followUps: InterviewQuestion[] = [];
    const templates =
      role === 'tech-lead'
        ? TECH_LEAD_FOLLOWUP_TEMPLATES
        : TECH_LEAD_FOLLOWUP_TEMPLATES;

    // Generate follow-ups for decisions that might need deeper probing
    for (const decision of analysisResult.scoredDecisions) {
      if (decision.ambiguityLevel === 'moderate' || decision.ambiguityLevel === 'unclear') {
        const relatedCore = coreQuestions.find(
          (q) => q.relatedDecisionTitle === decision.title || q.category === decision.category
        );

        if (relatedCore) {
          const followUp = this.createDecisionFollowUp(
            decision,
            relatedCore,
            followUps.length
          );
          if (followUp) {
            followUps.push(followUp);
          }
        }
      }
    }

    // Add template-based follow-ups
    for (const template of templates) {
      if (followUps.length >= this.config.maxFollowUpQuestions) break;

      // Find a core question this could follow up on
      const triggerQuestion = coreQuestions.find(
        (q) =>
          q.category === template.category ||
          q.category === template.triggerCategory
      );

      if (triggerQuestion) {
        const trigger: FollowUpTrigger = {
          afterQuestionId: triggerQuestion.id,
        };

        // Only add triggerKeywords if they exist
        if (template.triggerKeywords) {
          trigger.triggerKeywords = template.triggerKeywords;
        } else {
          trigger.alwaysAsk = true;
        }

        const followUp: InterviewQuestion = {
          id: `${role}-followup-${followUps.length + 1}`,
          text: template.template.replace('{category}', template.category),
          type: 'follow-up',
          category: template.category,
          priority: followUps.length + 10,
          followUpTrigger: trigger,
        };

        if (!followUps.some((q) => q.text === followUp.text)) {
          followUps.push(followUp);
        }
      }
    }

    return followUps.slice(0, this.config.maxFollowUpQuestions);
  }

  /**
   * Create a question specifically about an identified decision
   */
  private createDecisionQuestion(
    decision: ScoredDecision,
    index: number
  ): InterviewQuestion | null {
    // Generate a question based on the decision
    let questionText: string;

    switch (decision.category) {
      case 'architecture':
        questionText = `Regarding "${decision.title}": What architectural approach would you prefer, and what are your constraints?`;
        break;
      case 'library':
        questionText = `For "${decision.title}": Do you have preferences or requirements for the libraries/frameworks to use?`;
        break;
      case 'pattern':
        questionText = `About "${decision.title}": What design patterns or implementation approaches should be considered?`;
        break;
      case 'integration':
        questionText = `Concerning "${decision.title}": How should this integrate with existing systems?`;
        break;
      case 'data-model':
        questionText = `For "${decision.title}": What are the data requirements and relationships to consider?`;
        break;
      case 'api-design':
        questionText = `Regarding "${decision.title}": What API design principles or constraints apply?`;
        break;
      case 'security':
        questionText = `About "${decision.title}": What security requirements must be addressed?`;
        break;
      case 'performance':
        questionText = `For "${decision.title}": What performance requirements or optimizations are needed?`;
        break;
      default:
        questionText = `Can you clarify the requirements for "${decision.title}"?`;
    }

    return {
      id: `decision-${index + 1}`,
      text: questionText,
      type: 'core',
      category: decision.category,
      priority: decision.needsClarification ? 1 : 5,
      relatedDecisionTitle: decision.title,
    };
  }

  /**
   * Create a question to address an identified ambiguity
   */
  private createAmbiguityQuestion(
    ambiguity: Ambiguity,
    index: number
  ): InterviewQuestion | null {
    // Use the first suggested question if available, otherwise create one
    const questionText =
      ambiguity.suggestedQuestions[0] ||
      `Can you clarify: ${ambiguity.description}?`;

    return {
      id: `ambiguity-${index + 1}`,
      text: questionText,
      type: 'core',
      category: 'general',
      priority: 2,
      relatedAmbiguityDescription: ambiguity.description,
    };
  }

  /**
   * Create a follow-up question for a decision
   */
  private createDecisionFollowUp(
    decision: ScoredDecision,
    coreQuestion: InterviewQuestion,
    index: number
  ): InterviewQuestion | null {
    let questionText: string;

    if (decision.options && decision.options.length > 0) {
      questionText = `Between ${decision.options.join(' and ')}, which would you lean toward and why?`;
    } else {
      questionText = `Can you elaborate on the trade-offs you'd consider for "${decision.title}"?`;
    }

    return {
      id: `decision-followup-${index + 1}`,
      text: questionText,
      type: 'follow-up',
      category: decision.category,
      priority: index + 10,
      relatedDecisionTitle: decision.title,
      followUpTrigger: {
        afterQuestionId: coreQuestion.id,
        alwaysAsk: decision.ambiguityLevel === 'unclear',
      },
    };
  }
}

/**
 * Determine which follow-up questions should be asked based on an answer
 *
 * @param answer The user's answer to the previous question
 * @param questionId ID of the question that was answered
 * @param followUpQuestions Available follow-up questions
 * @returns Follow-up questions that should be asked
 */
export function selectFollowUps(
  answer: string,
  questionId: string,
  followUpQuestions: InterviewQuestion[]
): InterviewQuestion[] {
  const lowerAnswer = answer.toLowerCase();

  return followUpQuestions.filter((followUp) => {
    if (!followUp.followUpTrigger) return false;
    if (followUp.followUpTrigger.afterQuestionId !== questionId) return false;

    // Always ask if flagged
    if (followUp.followUpTrigger.alwaysAsk) return true;

    // Check for trigger keywords
    if (followUp.followUpTrigger.triggerKeywords) {
      return followUp.followUpTrigger.triggerKeywords.some((keyword) =>
        lowerAnswer.includes(keyword.toLowerCase())
      );
    }

    return false;
  });
}

/**
 * Factory function to create an InterviewQuestionGenerator
 */
export function createQuestionGenerator(
  config?: QuestionGeneratorConfig
): InterviewQuestionGenerator {
  return new InterviewQuestionGenerator(config);
}
