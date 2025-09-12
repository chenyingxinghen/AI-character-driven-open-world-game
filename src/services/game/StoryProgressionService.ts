export interface StoryEvent {
  id: string;
  type: 'plot_point' | 'character_development' | 'world_event' | 'player_choice' | 'random_event';
  title: string;
  description: string;
  triggers: string[];
  consequences: StoryConsequence[];
  requiredConditions: StoryCondition[];
  probability: number; // 0-1, for random events
  priority: number; // 1-10, higher means more important
  createdAt: Date;
}

export interface StoryConsequence {
  type: 'stat_change' | 'relationship_change' | 'location_change' | 'unlock_content' | 'trigger_event' | 'story_flag';
  target: string; // character ID, location ID, or content ID
  value: any; // change value
  description: string; // human-readable description
}

export interface StoryCondition {
  type: 'character_stat' | 'relationship_level' | 'location_state' | 'story_flag' | 'time_passed';
  target: string; // character ID, location ID, or flag name
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: any; // comparison value
}

export interface StoryProgress {
  currentChapter: string;
  completedEvents: string[];
  activeQuests: string[];
  storyFlags: Record<string, boolean>;
  characterRelationships: Record<string, Record<string, number>>; // characterId -> { targetCharacterId -> relationshipLevel }
  worldStates: Record<string, any>; // locationId -> state
}

// Context for story evaluation
export interface StoryContext {
  sessionId: string;
  playerId: string;
  currentLocation: string;
  characters: Record<string, any>;
  currentTime: Date;
  recentEvents: string[];
}

export class StoryProgressionService {
  private events: StoryEvent[] = [];
  private progress: StoryProgress = {
    currentChapter: 'chapter_1',
    completedEvents: [],
    activeQuests: [],
    storyFlags: {},
    characterRelationships: {},
    worldStates: {}
  };
  private includeDefaultEvents: boolean;

  constructor(includeDefaultEvents: boolean = true) {
    this.includeDefaultEvents = includeDefaultEvents;
    // Initialize with some default events only if requested
    if (includeDefaultEvents) {
      this.initializeDefaultEvents();
    }
  }

  /**
   * 初始化默认事件
   */
  private initializeDefaultEvents(): void {
    // Initial plot point - arrival in town
    this.addEvent({
      id: 'arrive_in_town',
      type: 'plot_point',
      title: '初到迷雾镇',
      description: '你刚刚到达迷雾镇，开始探索这个神秘的地方。',
      triggers: ['game_start'],
      consequences: [
        {
          type: 'unlock_content',
          target: 'town_square',
          value: true,
          description: '解锁城镇广场区域'
        },
        {
          type: 'story_flag',
          target: 'new_arrival',
          value: true,
          description: '标记为新来者'
        }
      ],
      requiredConditions: [],
      probability: 1.0,
      priority: 10,
      createdAt: new Date()
    });

    // Character development - meeting Elena
    this.addEvent({
      id: 'meet_elena',
      type: 'character_development',
      title: '遇见艾琳娜',
      description: '你在图书馆遇到了神秘的图书管理员艾琳娜。',
      triggers: ['enter_library'],
      consequences: [
        {
          type: 'relationship_change',
          target: 'player:elena',
          value: 10,
          description: '与艾琳娜的关系提升'
        },
        {
          type: 'unlock_content',
          target: 'ancient_texts',
          value: true,
          description: '解锁古老文献'
        }
      ],
      requiredConditions: [
        {
          type: 'story_flag',
          target: 'new_arrival',
          operator: 'eq',
          value: true
        }
      ],
      probability: 1.0,
      priority: 8,
      createdAt: new Date()
    });

    // Player choice - help or ignore
    this.addEvent({
      id: 'help_stranger',
      type: 'player_choice',
      title: '帮助陌生人',
      description: '一个陌生人请求你的帮助，你决定怎么做？',
      triggers: ['town_square_interaction'],
      consequences: [],
      requiredConditions: [
        {
          type: 'story_flag',
          target: 'new_arrival',
          operator: 'eq',
          value: true
        }
      ],
      probability: 0.7,
      priority: 7,
      createdAt: new Date()
    });

    // Random event - mysterious noise
    this.addEvent({
      id: 'mysterious_noise',
      type: 'random_event',
      title: '神秘的声音',
      description: '你听到了从镇外传来的神秘声音。',
      triggers: ['night_time'],
      consequences: [
        {
          type: 'story_flag',
          target: 'heard_noise',
          value: true,
          description: '标记听到神秘声音'
        }
      ],
      requiredConditions: [],
      probability: 0.3,
      priority: 5,
      createdAt: new Date()
    });
  }

  /**
   * 添加故事事件
   */
  addEvent(event: StoryEvent): void {
    this.events.push(event);
  }

  /**
   * 评估可触发的事件
   */
  evaluateTriggerableEvents(context: StoryContext): StoryEvent[] {
    return this.events.filter(event => {
      // 检查事件是否已经完成
      if (this.progress.completedEvents.includes(event.id)) {
        return false;
      }
      
      // 检查概率（对于随机事件）
      if (event.type === 'random_event' && Math.random() > event.probability) {
        return false;
      }
      
      // 检查必要条件
      return this.checkConditions(event.requiredConditions, context);
    });
  }

  /**
   * 检查条件
   */
  private checkConditions(conditions: StoryCondition[], context: StoryContext): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'character_stat':
          // 检查角色属性
          const characterStat = this.getCharacterStat(condition.target, context);
          return this.compareValues(characterStat, condition.operator, condition.value);
          
        case 'relationship_level':
          // 检查关系等级
          const relationshipLevel = this.getRelationshipLevel(condition.target, context);
          return this.compareValues(relationshipLevel, condition.operator, condition.value);
          
        case 'location_state':
          // 检查位置状态
          const locationState = this.getLocationState(condition.target);
          return this.compareValues(locationState, condition.operator, condition.value);
          
        case 'story_flag':
          // 检查故事标记
          const storyFlag = this.progress.storyFlags[condition.target] || false;
          return this.compareValues(storyFlag, condition.operator, condition.value);
          
        case 'time_passed':
          // 检查时间流逝
          const timePassed = this.getTimeSinceLastEvent(condition.target, context);
          return this.compareValues(timePassed, condition.operator, condition.value);
          
        default:
          return false;
      }
    });
  }

  /**
   * 获取角色属性
   */
  private getCharacterStat(characterId: string, context: StoryContext): any {
    // 从上下文获取角色数据
    if (context.characters && context.characters[characterId]) {
      return context.characters[characterId].stat || 50;
    }
    
    // 从进度中获取角色属性
    // 这里简化实现，返回默认值
    return 50;
  }

  /**
   * 获取关系等级
   */
  private getRelationshipLevel(relationshipKey: string, context: StoryContext): number {
    // relationshipKey 格式: "characterId:targetCharacterId"
    const [characterId, targetCharacterId] = relationshipKey.split(':');
    
    if (this.progress.characterRelationships[characterId] && 
        this.progress.characterRelationships[characterId][targetCharacterId] !== undefined) {
      return this.progress.characterRelationships[characterId][targetCharacterId];
    }
    
    return 0;
  }

  /**
   * 获取位置状态
   */
  private getLocationState(locationId: string): any {
    return this.progress.worldStates[locationId];
  }

  /**
   * 获取自上次事件以来的时间
   */
  private getTimeSinceLastEvent(eventId: string, context: StoryContext): number {
    // 简化实现，基于当前时间和上下文
    return context.currentTime.getTime() - Date.now();
  }

  /**
   * 比较值
   */
  private compareValues(left: any, operator: string, right: any): boolean {
    switch (operator) {
      case 'eq': return left === right;
      case 'ne': return left !== right;
      case 'gt': return left > right;
      case 'lt': return left < right;
      case 'gte': return left >= right;
      case 'lte': return left <= right;
      case 'contains': return Array.isArray(left) && left.includes(right);
      default: return false;
    }
  }

  /**
   * 触发事件
   */
  triggerEvent(event: StoryEvent, context: StoryContext): StoryConsequence[] {
    // 标记事件为已完成
    if (!this.progress.completedEvents.includes(event.id)) {
      this.progress.completedEvents.push(event.id);
    }
    
    // 应用后果
    const appliedConsequences: StoryConsequence[] = [];
    
    for (const consequence of event.consequences) {
      this.applyConsequence(consequence, context);
      appliedConsequences.push(consequence);
    }
    
    return appliedConsequences;
  }

  /**
   * 应用后果
   */
  private applyConsequence(consequence: StoryConsequence, context: StoryContext): void {
    switch (consequence.type) {
      case 'stat_change':
        // 改变角色属性
        this.updateCharacterStat(consequence.target, consequence.value, context);
        break;
        
      case 'relationship_change':
        // 改变关系等级
        this.updateRelationshipLevel(consequence.target, consequence.value);
        break;
        
      case 'location_change':
        // 改变位置状态
        this.updateLocationState(consequence.target, consequence.value);
        break;
        
      case 'unlock_content':
        // 解锁内容
        this.unlockContent(consequence.target);
        break;
        
      case 'trigger_event':
        // 触发其他事件
        this.setStoryFlag(consequence.target, true);
        break;
        
      case 'story_flag':
        // 设置故事标记
        this.setStoryFlag(consequence.target, consequence.value);
        break;
    }
  }

  /**
   * 更新角色属性
   */
  private updateCharacterStat(characterId: string, change: any, context: StoryContext): void {
    // 在实际实现中，这会更新角色的实际属性
    console.log(`Updating stat for character ${characterId}:`, change);
    
    // 更新上下文中的角色数据
    if (context.characters && context.characters[characterId]) {
      context.characters[characterId].stat = (context.characters[characterId].stat || 50) + change;
    }
  }

  /**
   * 更新关系等级
   */
  private updateRelationshipLevel(relationshipKey: string, change: number): void {
    // relationshipKey 格式: "characterId:targetCharacterId"
    const [characterId, targetCharacterId] = relationshipKey.split(':');
    
    if (!this.progress.characterRelationships[characterId]) {
      this.progress.characterRelationships[characterId] = {};
    }
    
    const currentLevel = this.progress.characterRelationships[characterId][targetCharacterId] || 0;
    const newLevel = Math.max(0, Math.min(100, currentLevel + change));
    
    this.progress.characterRelationships[characterId][targetCharacterId] = newLevel;
  }

  /**
   * 更新位置状态
   */
  private updateLocationState(locationId: string, state: any): void {
    this.progress.worldStates[locationId] = { ...this.progress.worldStates[locationId], ...state };
  }

  /**
   * 解锁内容
   */
  private unlockContent(contentId: string): void {
    this.setStoryFlag(`unlocked_${contentId}`, true);
  }

  /**
   * 设置故事标记
   */
  private setStoryFlag(flagName: string, value: boolean): void {
    this.progress.storyFlags[flagName] = value;
  }

  /**
   * 获取当前故事进度
   */
  getProgress(): StoryProgress {
    return { ...this.progress };
  }

  /**
   * 更新故事进度
   */
  updateProgress(updates: Partial<StoryProgress>): void {
    this.progress = { ...this.progress, ...updates };
  }

  /**
   * 获取可选的剧情分支
   */
  getAvailableChoices(context: StoryContext): StoryEvent[] {
    return this.evaluateTriggerableEvents(context).filter(event => 
      event.type === 'player_choice'
    );
  }

  /**
   * 获取当前章节信息
   */
  getCurrentChapterInfo(): any {
    // 根据当前章节返回信息
    switch (this.progress.currentChapter) {
      case 'chapter_1':
        return {
          id: this.progress.currentChapter,
          title: '第一章：初到迷雾镇',
          description: '你刚刚到达迷雾镇，开始探索这个神秘的地方。'
        };
      case 'chapter_2':
        return {
          id: this.progress.currentChapter,
          title: '第二章：秘密浮现',
          description: '随着调查的深入，你发现这个小镇隐藏着许多秘密。'
        };
      default:
        return {
          id: this.progress.currentChapter,
          title: '未知章节',
          description: '故事还在继续...'
        };
    }
  }

  /**
   * 推进到下一章节
   */
  advanceToNextChapter(): void {
    // 根据当前章节推进到下一章节
    const chapterNumber = parseInt(this.progress.currentChapter.split('_')[1]) || 1;
    this.progress.currentChapter = `chapter_${chapterNumber + 1}`;
  }

  /**
   * 检查是否满足章节结束条件
   */
  checkChapterCompletion(context: StoryContext): boolean {
    // 检查是否完成了足够的事件来推进章节
    const requiredEvents = {
      'chapter_1': ['arrive_in_town', 'meet_elena'],
      'chapter_2': ['help_stranger', 'mysterious_noise']
    };
    
    const chapterEvents = requiredEvents[this.progress.currentChapter as keyof typeof requiredEvents] || [];
    return chapterEvents.every(eventId => this.progress.completedEvents.includes(eventId));
  }

  /**
   * 获取所有事件
   */
  getAllEvents(): StoryEvent[] {
    return [...this.events];
  }

  /**
   * 根据ID查找事件
   */
  getEventById(id: string): StoryEvent | undefined {
    return this.events.find(event => event.id === id);
  }

  /**
   * 移除事件
   */
  removeEvent(id: string): boolean {
    const index = this.events.findIndex(event => event.id === id);
    if (index !== -1) {
      this.events.splice(index, 1);
      return true;
    }
    return false;
  }
}