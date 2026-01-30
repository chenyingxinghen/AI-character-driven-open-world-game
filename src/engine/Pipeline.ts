/**
 * 游戏处理流水线与上下文定义
 */

import { DomainCoordinationResult } from '../domains/DomainCoordinator';
import { InputClassification } from '../domains/input/valueObjects';
import { GameAction } from './GameAction';

/**
 * 处理上下文 - 在流水线各个阶段之间传递的对象
 */
export interface ProcessingContext {
    // 基础标识
    sessionId: string;
    playerId: string;
    timestamp: Date;

    // 输入阶段结果
    rawInput: string;
    normalizedInput?: string;
    classification?: InputClassification;

    // 导演与引导阶段结果
    directorEvaluation?: any;
    storyGuidance?: string;

    // 标准游戏动作集 (重构核心)
    actions: GameAction[];

    // 领域执行阶段结果 (兼容层)
    coordinationResult: DomainCoordinationResult;

    // 完整的游戏上下文 (用于各层共享状态)
    gameContext?: any; // 这里使用 any 以避免循环依赖，实际为 GameContext

    // 性能与元数据
    metadata: {
        startTime: number;
        steps: Array<{
            name: string;
            duration: number;
        }>;
        [key: string]: any;
    };
}

/**
 * 流水线中间件接口
 */
export interface PipelineMiddleware {
    name: string;
    execute(context: ProcessingContext, next: () => Promise<void>): Promise<void>;
}

/**
 * 通用处理流水线
 */
export class Pipeline {
    private middlewares: PipelineMiddleware[] = [];

    /**
     * 注册中间件
     */
    use(middleware: PipelineMiddleware): this {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * 执行流水线
     */
    async execute(context: ProcessingContext): Promise<void> {
        let index = -1;

        const dispatch = async (i: number): Promise<void> => {
            if (i <= index) throw new Error('next() called multiple times');
            index = i;

            const middleware = this.middlewares[i];
            if (middleware) {
                const stepStartTime = Date.now();
                await middleware.execute(context, () => dispatch(i + 1));

                context.metadata.steps.push({
                    name: middleware.name,
                    duration: Date.now() - stepStartTime
                });
            }
        };

        await dispatch(0);
    }
}
