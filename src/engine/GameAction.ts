/**
 * 标准游戏动作接口 - Standard Game Action Interface
 * 
 * 用于规范各领域层（Character, World 等）产生的结果，
 * 方便导演引擎评估和叙事层合成。
 */

export enum ActionType {
    DIALOGUE = 'dialogue',
    MOVEMENT = 'movement',
    INTERACTION = 'interaction',
    OBSERVATION = 'observation',
    ENVIRONMENT_CHANGE = 'environment_change',
    STORY_EVENT = 'story_event',
    SYSTEM = 'system'
}

export interface GameAction {
    /**
     * 动作类型
     */
    type: ActionType;

    /**
     * 执行主体 (如：角色 ID, 'player', 'system')
     */
    actorId: string;

    /**
     * 目标对象 (如：目标角色 ID, 目标位置 ID, 物品 ID)
     */
    targetId?: string;

    /**
     * 动作描述或内容
     */
    description: string;

    /**
     * 动作携带的数据负载
     */
    payload?: any;

    /**
     * 优先级 (1-10)
     */
    priority: number;

    /**
     * 动作元数据
     */
    metadata?: {
        isSuccess: boolean;
        reason?: string;
        timestamp: Date;
        [key: string]: any;
    };
}

/**
 * 动作执行结果
 */
export interface ActionExecutionResult {
    action: GameAction;
    success: boolean;
    message: string;
    resultingStateChanges?: any;
}
