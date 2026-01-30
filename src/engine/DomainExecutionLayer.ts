import { PipelineMiddleware, ProcessingContext } from './Pipeline';
import { DomainCoordinator } from '../domains/DomainCoordinator';
import { Logger } from '../services/Logger';
import { ActionType, GameAction } from './GameAction';

/**
 * 领域执行层中间件
 * 根据意图识别结果，分发具体任务给角色、世界等领域管理器
 */
export class DomainExecutionLayer implements PipelineMiddleware {
    public name = 'DomainExecution';

    constructor(
        private coordinator: DomainCoordinator,
        private logger: Logger
    ) { }

    async execute(context: ProcessingContext, next: () => Promise<void>): Promise<void> {
        this.logger.debug('[Pipeline] Executing Domain Logic');

        const classification = context.classification;
        if (!classification) {
            this.logger.warn('[Pipeline] No classification found, skipping domain execution');
            return next();
        }

        const gameContext = context.gameContext || {
            sessionId: context.sessionId,
            playerId: context.playerId,
            currentLocation: context.coordinationResult.stateChanges.locationChange || 'town_square',
            activeCharacters: [],
            gameState: {},
            timestamp: context.timestamp
        };

        try {
            // 调用 coordinator 的内部处理逻辑
            const result = await (this.coordinator as any).handleSimpleScenario(
                { classification },
                gameContext,
                context.coordinationResult.metadata.domainsInvolved
            );

            // 1. 合并执行结果到 context (保持兼容性)
            context.coordinationResult.responses = { ...context.coordinationResult.responses, ...result.responses };
            context.coordinationResult.stateChanges = { ...context.coordinationResult.stateChanges, ...result.stateChanges };

            // 2. 转换为标准 GameAction 并推送到 actions 列表
            if (result.responses?.characterResponses?.length > 0) {
                result.responses.characterResponses.forEach((resp: any) => {
                    context.actions.push({
                        type: ActionType.DIALOGUE,
                        actorId: resp.characterId,
                        description: resp.content,
                        priority: 5,
                        metadata: {
                            characterName: resp.characterName,
                            isSuccess: true,
                            timestamp: new Date()
                        }
                    });
                });
            }

            if (result.stateChanges?.locationChange) {
                context.actions.push({
                    type: ActionType.MOVEMENT,
                    actorId: context.playerId,
                    targetId: result.stateChanges.locationChange,
                    description: `Move to ${result.stateChanges.locationChange}`,
                    priority: 8,
                    metadata: { isSuccess: true, timestamp: new Date() }
                });
            }

            await next();
        } catch (error) {
            this.logger.error('[Pipeline] Domain Execution failed', error as Error);
            context.coordinationResult.success = false;
            context.coordinationResult.error = `Execution error: ${(error as Error).message}`;
            await next(); // 依然尝试后续流程
        }
    }
}
