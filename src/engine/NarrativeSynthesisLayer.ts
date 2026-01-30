import { PipelineMiddleware, ProcessingContext } from './Pipeline';
import { LLMService } from '../services/llm/LLMService';
import { Logger } from '../services/Logger';

/**
 * 叙事合成层中间件
 * 将各个领域的反馈、导演的干预融合成一段最终的文学叙述
 */
export class NarrativeSynthesisLayer implements PipelineMiddleware {
    public name = 'NarrativeSynthesis';

    constructor(
        private llmService: LLMService,
        private logger: Logger
    ) { }

    async execute(context: ProcessingContext, next: () => Promise<void>): Promise<void> {
        this.logger.debug('[Pipeline] Synthesizing Final Narrative');

        const actionsSummary = context.actions.map(a => `- [${a.type}] ${a.actorId}: ${a.description}`).join('\n');

        const prompt = `
As a Master Storyteller, synthesize a cohesive and immersive narrative based on the following game actions:

[Player Input]: ${context.rawInput}
[Game Actions]:
${actionsSummary}

Requirements:
1. Use second-person perspective ("You...").
2. Maintain a premium, atmospheric tone.
3. Integrate all actions naturally into a single unified paragraph or two.
4. Prioritize director actions (story events) if they conflict with character actions.
`;

        try {
            const narrative = await this.llmService.generateText(prompt, {
                maxTokens: 1000,
                temperature: 0.7
            });

            context.coordinationResult.responses.narrative = narrative;
            context.coordinationResult.success = true;

            await next();
        } catch (error) {
            this.logger.error('[Pipeline] Narrative Synthesis failed', error as Error);
            // 回退逻辑：手动拼接
            context.coordinationResult.responses.narrative = this.fallbackSynthesis(context);
            await next();
        }
    }

    private fallbackSynthesis(context: ProcessingContext): string {
        const { responses } = context.coordinationResult;
        let parts = [];
        if (context.storyGuidance) parts.push(context.storyGuidance);
        if (responses.locationDescription) parts.push(responses.locationDescription);
        if (responses.characterResponses && responses.characterResponses.length > 0) {
            parts.push(responses.characterResponses.map((r: any) => r.content).join(' '));
        }
        return parts.join('\n\n');
    }
}
