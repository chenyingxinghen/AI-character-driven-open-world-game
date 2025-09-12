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
      // Record the evaluation operation
      const startTime = Date.now();
      
      // Use operations domain to analyze system performance and story metrics
      const systemHealth = this.operationsManager.getSystemHealth();
      
      // In a full implementation, this would use LLM and domain logic
      // to evaluate story progression more sophisticatedly
      const evaluation: StoryEvaluation = {
        tensionLevel: this.calculateTensionLevel(currentState),
        paceRating: this.calculatePaceRating(currentState),
        conflictPresent: this.detectConflict(currentState),
        suggestedActions: this.generateSuggestedActions(currentState),
        deviationFromScript: this.calculateDeviation(currentState)
      };
      
      // Record performance metrics
      this.operationsManager.recordPerformance({
        operation: 'story_evaluation',
        executionTime: Date.now() - startTime,
        memoryUsage: typeof process !== 'undefined' ? (process as any).memoryUsage().heapUsed : 0,
        cpuUsage: 0,
        timestamp: new Date(),
        success: true
      });
      
      return evaluation;
    } catch (error) {
      this.logger.error('Error evaluating story progression:', error as Error);
      
      // Record error
      this.operationsManager.recordError({
        id: `error-${Date.now()}`,
        type: 'story_evaluation_error',
        message: (error as Error).message,
        stackTrace: (error as Error).stack,
        context: { operation: 'story_evaluation', currentState },
        severity: 'medium',
        timestamp: new Date(),
        resolved: false
      });
      
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
      // In a full implementation, this would use LLM to generate sophisticated decisions
      // For now, use a simplified approach
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

  detectTensionLevel(recentEvents: any[]): number {
    // Enhanced tension detection using operations domain insights
    const baseLevel = Math.min(100, recentEvents.length * 10);
    const systemHealth = this.operationsManager.getSystemHealth();
    
    // Adjust based on system performance (simplified)
    return Math.max(0, Math.min(100, baseLevel));
  }

  async suggestPlotTwist(context: any): Promise<any> {
    try {
      // Use LLM to generate plot twist suggestions
      const response = await this.llmService.generateText(
        `Generate a plot twist suggestion based on the current game context: ${JSON.stringify(context)}`,
        { maxTokens: 200 }
      );
      return response;
    } catch (error) {
      this.logger.error('Error suggesting plot twist:', error as Error);
      return null;
    }
  }

  shouldPauseForChoice(context: any): boolean {
    // Enhanced choice detection
    const hasMultipleOptions = context.availableActions && context.availableActions.length > 1;
    const tensionLevel = this.detectTensionLevel(context.recentEvents || []);
    
    return hasMultipleOptions && tensionLevel > 60;
  }

  detectStoryDeviation(currentState: any): number {
    // Enhanced deviation detection
    return this.calculateDeviation(currentState);
  }

  async generateGuidanceAction(deviation: number, context: any): Promise<DirectorAction | null> {
    if (deviation < 30) {
      return null; // No guidance needed
    }
    
    try {
      return {
        type: 'guidance',
        description: `Story deviation detected (${deviation}%). Suggesting course correction.`,
        parameters: {
          deviationLevel: deviation,
          suggestedActions: this.generateCorrectionActions(deviation, context)
        },
        priority: Math.min(100, deviation)
      };
    } catch (error) {
      this.logger.error('Error generating guidance action:', error as Error);
      return null;
    }
  }

  private calculateTensionLevel(state: any): number {
    // Simplified tension calculation
    let tension = 50;
    if (state.recentConflicts) tension += 20;
    if (state.characterEmotions?.some((e: any) => e.intensity > 70)) tension += 15;
    if (state.timeUntilDeadline < 10) tension += 25;
    return Math.min(100, tension);
  }

  private calculatePaceRating(state: any): number {
    // Simplified pace calculation
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
    // Simplified deviation calculation
    return state.deviationScore || 0;
  }

  private getAvailableActions(context: any): string[] {
    return context.availableActions || ['continue', 'pause', 'redirect'];
  }

  private generateCorrectionActions(deviation: number, context: any): string[] {
    if (deviation > 70) {
      return ['major_plot_redirect', 'character_intervention'];
    } else if (deviation > 40) {
      return ['subtle_guidance', 'environmental_hint'];
    } else {
      return ['continue_monitoring'];
    }
  }
}