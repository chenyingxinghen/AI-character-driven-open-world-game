import { PipelineMiddleware, ProcessingContext } from './Pipeline';
import { SimplifiedDirectorEngine } from './SimplifiedDirectorEngine';
import { Logger } from '../services/Logger';
import { ActionType, GameAction } from './GameAction';

/**
 * 导演干预层中间件
 * 评估当前故事状态并决定是否进行戏剧化干预
 */
export class DirectorLayer implements PipelineMiddleware {
    public name = 'DirectorEvaluation';

    constructor(
        private directorEngine: SimplifiedDirectorEngine,
        private logger: Logger
    ) { }

    async execute(context: ProcessingContext, next: () => Promise<void>): Promise<void> {
        this.logger.debug('[Pipeline] Evaluating Director Intervention');

        try {
            const directorContext = {
                sessionId: context.sessionId,
                playerId: context.playerId,
                currentLocation: context.classification?.targetLocation || 'town_square',
                recentActions: [context.rawInput],
                storyState: {},
                characterStates: {},
                currentTime: new Date()
            };

            // 评估是否干预
            const result = await this.directorEngine.evaluateStoryProgression(directorContext);
            context.directorEvaluation = result;

            if (result.shouldIntervene && result.decision) {
                const decision = result.decision;

                // 将导演决策转换为标准动作
                const action: GameAction = {
                    type: ActionType.STORY_EVENT,
                    actorId: 'director',
                    description: decision.content,
                    priority: decision.parameters?.priority || 5,
                    metadata: {
                        isSuccess: true,
                        timestamp: new Date(),
                        interventionType: decision.interventionType
                    }
                };

                context.actions.push(action);
                context.storyGuidance = decision.content;

                this.logger.info(`[Pipeline] Director intervention planned: ${decision.interventionType}`);
            }

            await next();
        } catch (error) {
            this.logger.warn('[Pipeline] Director evaluation skipped due to error', error as Error);
            await next();
        }
    }
}
