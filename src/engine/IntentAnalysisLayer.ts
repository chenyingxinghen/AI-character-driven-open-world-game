import { PipelineMiddleware, ProcessingContext } from '../engine/Pipeline';
import { InputManager } from '../domains/input/aggregates';
import { Logger } from '../services/Logger';

/**
 * 意图分析层中间件
 * 负责解析玩家输入、提取实体、识别意图
 */
export class IntentAnalysisLayer implements PipelineMiddleware {
    public name = 'IntentAnalysis';

    constructor(
        private inputManager: InputManager,
        private logger: Logger
    ) { }

    async execute(context: ProcessingContext, next: () => Promise<void>): Promise<void> {
        this.logger.debug(`[Pipeline] Starting Intent Analysis for: "${context.rawInput}"`);

        try {
            // 获取上下文历史等增强数据
            const sessionContext = this.inputManager.getSessionContext(context.sessionId);

            // 执行深度分析
            const analysisResult = await this.inputManager.analyzeInput(
                context.sessionId,
                context.playerId,
                context.rawInput,
                {
                    currentLocation: context.gameContext?.currentLocation || context.coordinationResult.stateChanges.locationChange || 'unknown',
                    knownCharacters: context.gameContext?.activeCharacters || [],
                    recentEvents: context.gameContext?.recentStoryEvents || [],
                }
            );

            // 将结果存储在上下文中
            context.normalizedInput = analysisResult.preprocessed.sanitizedInput;
            context.classification = analysisResult.classification;

            // 如果识别到特定的场景复杂度，记录在元数据中
            if (analysisResult.complexAnalysis?.isComplex) {
                context.metadata.isComplexScenario = true;
                context.metadata.requiredDomains = analysisResult.complexAnalysis.requiredDomains;
            }

            await next();
        } catch (error) {
            this.logger.error('[Pipeline] Intent Analysis failed', error as Error);
            context.coordinationResult.success = false;
            context.coordinationResult.error = `Input analysis error: ${(error as Error).message}`;
            // 不再调用 next() 终止流水线或在下一层处理
        }
    }
}
