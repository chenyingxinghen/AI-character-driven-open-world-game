import { OperationsManager } from '../domains/operations/aggregates';
import { Logger } from '../services/Logger';
import { LLMService, DirectorDecision } from '../services/llm/LLMService';

export interface StoryEvaluation {
  tensionLevel: number;
  paceRating: number;
  conflictPresent: boolean;
  suggestedActions: string[];
  deviationFromScript: number;
  lastSignificantEvent?: Date;
}

export interface DirectorAction {
  type: string;
  description: string;
  targetCharacter?: string;
  parameters: Record<string, any>;
  priority: number;
}

export class GameDirectorEngine {
  private operationsManager: OperationsManager;

  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {
    this.operationsManager = new OperationsManager(logger);
  }

  async evaluateStoryProgression(currentState: any): Promise<StoryEvaluation> {
    try {
      const evaluation: StoryEvaluation = {
        tensionLevel: this.calculateTensionLevel(currentState),
        paceRating: this.calculatePaceRating(currentState),
        conflictPresent: this.detectConflict(currentState),
        suggestedActions: this.generateSuggestedActions(currentState),
        deviationFromScript: this.calculateDeviation(currentState)
      };
      
      return evaluation;
    } catch (error) {
      this.logger.error('Error evaluating story progression:', error as Error);
      return {
        tensionLevel: 50,
        paceRating: 50,
        conflictPresent: false,
        suggestedActions: ['continue'],
        deviationFromScript: 0
      };
    }
  }

  async generateDirectorDecision(context: any, evaluation: StoryEvaluation): Promise<DirectorDecision> {
    try {
      const decision: DirectorDecision = {
        action: evaluation.tensionLevel > 70 ? 'escalate_tension' : 'character_response',
        reasoning: `Based on tension level of ${evaluation.tensionLevel}%`,
        confidence: 85,
        parameters: {
          tensionLevel: evaluation.tensionLevel,
          suggestedActions: evaluation.suggestedActions
        }
      };
      
      return decision;
    } catch (error) {
      this.logger.error('Error generating director decision:', error as Error);
      return {
        action: 'continue',
        reasoning: 'Default continuation due to error',
        confidence: 50,
        parameters: {}
      };
    }
  }

  private calculateTensionLevel(state: any): number {
    let tension = 50;
    if (state.recentConflicts) tension += 20;
    if (state.characterEmotions?.some((e: any) => e.intensity > 70)) tension += 15;
    if (state.timeUntilDeadline < 10) tension += 25;
    return Math.min(100, tension);
  }

  private calculatePaceRating(state: any): number {
    const recentActionCount = state.recentActions?.length || 0;
    return Math.min(100, recentActionCount * 15);
  }

  private detectConflict(state: any): boolean {
    return state.activeConflicts?.length > 0 || false;
  }

  private generateSuggestedActions(state: any): string[] {
    const actions = ['character_response'];
    if (state.tensionLevel < 30) actions.push('environmental_event');
    if (state.paceRating < 40) actions.push('plot_advancement');
    return actions;
  }

  private calculateDeviation(state: any): number {
    return state.deviationScore || 0;
  }
}