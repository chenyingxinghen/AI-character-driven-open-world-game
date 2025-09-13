/**
 * 游戏数据配置系统
 * 管理所有游戏相关的配置数据，包括角色模板、世界设定、游戏机制等
 */

import { Logger } from '../services/Logger';

/**
 * 角色模板配置
 */
export interface CharacterTemplate {
  readonly id: string;
  readonly name: string;
  readonly category: 'npc' | 'companion' | 'antagonist' | 'neutral';
  readonly personality: {
    readonly traits: readonly string[];
    readonly values: readonly { trait: string; score: number }[];
    readonly speechPatterns: readonly string[];
  };
  readonly background: {
    readonly profession?: string;
    readonly origin?: string;
    readonly motivation?: string;
    readonly goals: readonly string[];
    readonly fears: readonly string[];
  };
  readonly abilities: {
    readonly skills: readonly { name: string; level: number }[];
    readonly specialPowers?: readonly string[];
    readonly limitations?: readonly string[];
  };
  readonly appearance: {
    readonly physicalTraits: readonly string[];
    readonly clothing?: readonly string[];
    readonly accessories?: readonly string[];
  };
  readonly dialogueStyle: {
    readonly tone: 'formal' | 'casual' | 'friendly' | 'hostile' | 'mysterious';
    readonly vocabulary: 'simple' | 'moderate' | 'complex' | 'archaic';
    readonly preferredTopics: readonly string[];
    readonly avoidedTopics: readonly string[];
  };
  readonly relationshipTendencies: {
    readonly trustfulness: number; // 0-100
    readonly sociability: number; // 0-100
    readonly empathy: number; // 0-100
    readonly competitiveness: number; // 0-100
  };
}

/**
 * 世界位置配置
 */
export interface LocationTemplate {
  readonly id: string;
  readonly name: string;
  readonly type: 'urban' | 'rural' | 'wilderness' | 'underground' | 'mystical';
  readonly description: string;
  readonly atmosphere: readonly string[];
  readonly availableActivities: readonly string[];
  readonly npcsPresent: readonly string[];
  readonly itemsAvailable: readonly string[];
  readonly environment: {
    readonly climate: string;
    readonly timeOfDay: readonly string[];
    readonly weatherPatterns: readonly string[];
    readonly ambientSounds: readonly string[];
  };
  readonly mechanics: {
    readonly accessRequirements?: readonly string[];
    readonly dangerLevel: number; // 0-100
    readonly restoreChance: number; // 0-100
    readonly eventProbability: number; // 0-100
  };
  readonly connections: readonly {
    readonly toLocationId: string;
    readonly travelTime: number;
    readonly requirements?: readonly string[];
    readonly description: string;
  }[];
}

/**
 * 游戏机制配置
 */
export interface GameMechanicsConfig {
  readonly conversationSystem: {
    readonly maxContextTurns: number;
    readonly emotionalWeightDecay: number;
    readonly memoryFormationThreshold: number;
    readonly relationshipChangeRate: number;
  };
  readonly worldSimulation: {
    readonly timeAcceleration: number;
    readonly eventGenerationRate: number;
    readonly populationDynamics: boolean;
    readonly economicSimulation: boolean;
  };
  readonly characterBehavior: {
    readonly autonomyLevel: number; // 0-100
    readonly predictabilityFactor: number; // 0-100
    readonly learningRate: number;
    readonly memoryRetention: number;
  };
  readonly difficultyScaling: {
    readonly adaptiveDifficulty: boolean;
    readonly playerSkillTracking: boolean;
    readonly challengeProgression: number;
  };
}

/**
 * 对话模板配置
 */
export interface DialogueTemplate {
  readonly id: string;
  readonly situation: string;
  readonly participantTypes: readonly string[];
  readonly conversationStarters: readonly string[];
  readonly topicTransitions: readonly {
    readonly from: string;
    readonly to: string;
    readonly triggers: readonly string[];
  }[];
  readonly emotionalProgression: readonly {
    readonly phase: string;
    readonly emotions: readonly string[];
    readonly duration: number;
  }[];
  readonly outcomeInfluences: readonly {
    readonly action: string;
    readonly relationshipChange: number;
    readonly emotionalImpact: number;
  }[];
}

/**
 * 游戏数据配置管理器
 */
export class GameDataConfiguration {
  private characterTemplates: Map<string, CharacterTemplate> = new Map();
  private locationTemplates: Map<string, LocationTemplate> = new Map();
  private dialogueTemplates: Map<string, DialogueTemplate> = new Map();
  private gameMechanics: GameMechanicsConfig;
  private isLoaded: boolean = false;

  constructor(private logger: Logger) {
    this.gameMechanics = this.getDefaultGameMechanics();
  }

  /**
   * 初始化配置数据
   */
  async initialize(): Promise<void> {
    try {
      await this.loadCharacterTemplates();
      await this.loadLocationTemplates();
      await this.loadDialogueTemplates();
      await this.loadGameMechanics();
      
      this.isLoaded = true;
      this.logger.info('Game data configuration loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load game data configuration:', error as Error);
      throw error;
    }
  }

  /**
   * 获取角色模板
   */
  getCharacterTemplate(id: string): CharacterTemplate | undefined {
    return this.characterTemplates.get(id);
  }

  /**
   * 获取所有角色模板
   */
  getAllCharacterTemplates(): CharacterTemplate[] {
    return Array.from(this.characterTemplates.values());
  }

  /**
   * 根据类别获取角色模板
   */
  getCharacterTemplatesByCategory(category: CharacterTemplate['category']): CharacterTemplate[] {
    return this.getAllCharacterTemplates().filter(template => template.category === category);
  }

  /**
   * 获取位置模板
   */
  getLocationTemplate(id: string): LocationTemplate | undefined {
    return this.locationTemplates.get(id);
  }

  /**
   * 获取所有位置模板
   */
  getAllLocationTemplates(): LocationTemplate[] {
    return Array.from(this.locationTemplates.values());
  }

  /**
   * 根据类型获取位置模板
   */
  getLocationTemplatesByType(type: LocationTemplate['type']): LocationTemplate[] {
    return this.getAllLocationTemplates().filter(template => template.type === type);
  }

  /**
   * 获取对话模板
   */
  getDialogueTemplate(id: string): DialogueTemplate | undefined {
    return this.dialogueTemplates.get(id);
  }

  /**
   * 根据情况获取对话模板
   */
  getDialogueTemplatesBySituation(situation: string): DialogueTemplate[] {
    return Array.from(this.dialogueTemplates.values())
      .filter(template => template.situation.toLowerCase().includes(situation.toLowerCase()));
  }

  /**
   * 获取游戏机制配置
   */
  getGameMechanics(): GameMechanicsConfig {
    return this.gameMechanics;
  }

  /**
   * 更新游戏机制配置
   */
  updateGameMechanics(updates: Partial<GameMechanicsConfig>): void {
    this.gameMechanics = {
      ...this.gameMechanics,
      ...updates
    };
  }

  /**
   * 添加角色模板
   */
  addCharacterTemplate(template: CharacterTemplate): void {
    this.characterTemplates.set(template.id, template);
    this.logger.info(`Added character template: ${template.id}`);
  }

  /**
   * 添加位置模板
   */
  addLocationTemplate(template: LocationTemplate): void {
    this.locationTemplates.set(template.id, template);
    this.logger.info(`Added location template: ${template.id}`);
  }

  /**
   * 添加对话模板
   */
  addDialogueTemplate(template: DialogueTemplate): void {
    this.dialogueTemplates.set(template.id, template);
    this.logger.info(`Added dialogue template: ${template.id}`);
  }

  /**
   * 获取随机角色模板
   */
  getRandomCharacterTemplate(category?: CharacterTemplate['category']): CharacterTemplate | undefined {
    const templates = category ? 
      this.getCharacterTemplatesByCategory(category) : 
      this.getAllCharacterTemplates();
    
    if (templates.length === 0) return undefined;
    
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
  }

  /**
   * 获取随机位置模板
   */
  getRandomLocationTemplate(type?: LocationTemplate['type']): LocationTemplate | undefined {
    const templates = type ? 
      this.getLocationTemplatesByType(type) : 
      this.getAllLocationTemplates();
    
    if (templates.length === 0) return undefined;
    
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
  }

  /**
   * 验证配置完整性
   */
  validateConfiguration(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查角色模板
    if (this.characterTemplates.size === 0) {
      errors.push('No character templates found');
    }

    // 检查位置模板
    if (this.locationTemplates.size === 0) {
      errors.push('No location templates found');
    }

    // 检查位置连接
    for (const location of this.locationTemplates.values()) {
      for (const connection of location.connections) {
        if (!this.locationTemplates.has(connection.toLocationId)) {
          warnings.push(`Location ${location.id} has invalid connection to ${connection.toLocationId}`);
        }
      }
    }

    // 检查角色模板引用
    for (const location of this.locationTemplates.values()) {
      for (const npcId of location.npcsPresent) {
        if (!this.characterTemplates.has(npcId)) {
          warnings.push(`Location ${location.id} references unknown NPC ${npcId}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 重新加载配置
   */
  async reload(): Promise<void> {
    this.isLoaded = false;
    this.characterTemplates.clear();
    this.locationTemplates.clear();
    this.dialogueTemplates.clear();
    
    await this.initialize();
  }

  /**
   * 检查是否已加载
   */
  isConfigurationLoaded(): boolean {
    return this.isLoaded;
  }

  // ========== 私有方法 ==========

  /**
   * 加载角色模板
   */
  private async loadCharacterTemplates(): Promise<void> {
    // 这里应该从文件或数据库加载，暂时使用硬编码的默认模板
    const defaultTemplates = this.getDefaultCharacterTemplates();
    
    for (const template of defaultTemplates) {
      this.characterTemplates.set(template.id, template);
    }
  }

  /**
   * 加载位置模板
   */
  private async loadLocationTemplates(): Promise<void> {
    // 这里应该从文件或数据库加载，暂时使用硬编码的默认模板
    const defaultTemplates = this.getDefaultLocationTemplates();
    
    for (const template of defaultTemplates) {
      this.locationTemplates.set(template.id, template);
    }
  }

  /**
   * 加载对话模板
   */
  private async loadDialogueTemplates(): Promise<void> {
    // 这里应该从文件或数据库加载，暂时使用硬编码的默认模板
    const defaultTemplates = this.getDefaultDialogueTemplates();
    
    for (const template of defaultTemplates) {
      this.dialogueTemplates.set(template.id, template);
    }
  }

  /**
   * 加载游戏机制配置
   */
  private async loadGameMechanics(): Promise<void> {
    // 这里应该从文件加载，暂时使用默认配置
    this.gameMechanics = this.getDefaultGameMechanics();
  }

  /**
   * 获取默认角色模板
   */
  private getDefaultCharacterTemplates(): CharacterTemplate[] {
    return [
      {
        id: 'wise_mentor',
        name: 'Wise Mentor',
        category: 'companion',
        personality: {
          traits: ['wise', 'patient', 'encouraging', 'experienced'],
          values: [
            { trait: 'wisdom', score: 95 },
            { trait: 'patience', score: 90 },
            { trait: 'kindness', score: 85 }
          ],
          speechPatterns: ['thoughtful pauses', 'metaphorical language', 'gentle guidance']
        },
        background: {
          profession: 'Former scholar and advisor',
          origin: 'Ancient library',
          motivation: 'Guide others to their potential',
          goals: ['Share knowledge', 'Prevent past mistakes'],
          fears: ['Being forgotten', 'Students failing']
        },
        abilities: {
          skills: [
            { name: 'Ancient Lore', level: 95 },
            { name: 'Insight', level: 90 },
            { name: 'Teaching', level: 85 }
          ],
          specialPowers: ['Memory projection', 'Wisdom sharing'],
          limitations: ['Physical frailty', 'Bound to library']
        },
        appearance: {
          physicalTraits: ['aged features', 'knowing eyes', 'gentle smile'],
          clothing: ['flowing robes', 'ancient pendant'],
          accessories: ['walking staff', 'book collection']
        },
        dialogueStyle: {
          tone: 'formal',
          vocabulary: 'complex',
          preferredTopics: ['history', 'philosophy', 'learning', 'growth'],
          avoidedTopics: ['gossip', 'trivial matters']
        },
        relationshipTendencies: {
          trustfulness: 70,
          sociability: 60,
          empathy: 95,
          competitiveness: 20
        }
      },
      {
        id: 'mysterious_trader',
        name: 'Mysterious Trader',
        category: 'neutral',
        personality: {
          traits: ['enigmatic', 'shrewd', 'worldly', 'secretive'],
          values: [
            { trait: 'independence', score: 90 },
            { trait: 'profit', score: 75 },
            { trait: 'secrecy', score: 85 }
          ],
          speechPatterns: ['cryptic hints', 'commercial language', 'world-weary observations']
        },
        background: {
          profession: 'Interdimensional trader',
          origin: 'Unknown realm',
          motivation: 'Acquire rare items and knowledge',
          goals: ['Build trading network', 'Discover new markets'],
          fears: ['Authorities', 'Being exposed']
        },
        abilities: {
          skills: [
            { name: 'Appraisal', level: 95 },
            { name: 'Negotiation', level: 88 },
            { name: 'Portal Magic', level: 70 }
          ],
          specialPowers: ['Dimensional storage', 'Value assessment'],
          limitations: ['Bound by contracts', 'Limited time in each realm']
        },
        appearance: {
          physicalTraits: ['weathered hands', 'calculating eyes', 'travel-worn appearance'],
          clothing: ['merchant robes', 'many pockets'],
          accessories: ['ornate scales', 'portable shop']
        },
        dialogueStyle: {
          tone: 'mysterious',
          vocabulary: 'moderate',
          preferredTopics: ['trade', 'rare items', 'distant lands'],
          avoidedTopics: ['personal history', 'authorities']
        },
        relationshipTendencies: {
          trustfulness: 45,
          sociability: 70,
          empathy: 50,
          competitiveness: 80
        }
      },
      {
        id: 'village_guard',
        name: 'Village Guard',
        category: 'npc',
        personality: {
          traits: ['dutiful', 'protective', 'straightforward', 'loyal'],
          values: [
            { trait: 'duty', score: 90 },
            { trait: 'protection', score: 95 },
            { trait: 'honor', score: 85 }
          ],
          speechPatterns: ['direct statements', 'protective warnings', 'formal address']
        },
        background: {
          profession: 'Village protector',
          origin: 'Local village',
          motivation: 'Keep community safe',
          goals: ['Protect villagers', 'Maintain order'],
          fears: ['Village being attacked', 'Failing in duty']
        },
        abilities: {
          skills: [
            { name: 'Combat', level: 80 },
            { name: 'Vigilance', level: 85 },
            { name: 'Local Knowledge', level: 75 }
          ],
          limitations: ['Cannot leave post', 'Limited authority']
        },
        appearance: {
          physicalTraits: ['strong build', 'alert posture', 'weathered hands'],
          clothing: ['leather armor', 'guard insignia'],
          accessories: ['weapon belt', 'signal horn']
        },
        dialogueStyle: {
          tone: 'formal',
          vocabulary: 'simple',
          preferredTopics: ['village safety', 'local news', 'travelers'],
          avoidedTopics: ['personal life', 'politics']
        },
        relationshipTendencies: {
          trustfulness: 60,
          sociability: 50,
          empathy: 70,
          competitiveness: 40
        }
      }
    ];
  }

  /**
   * 获取默认位置模板
   */
  private getDefaultLocationTemplates(): LocationTemplate[] {
    return [
      {
        id: 'village_square',
        name: 'Village Square',
        type: 'urban',
        description: 'A bustling central square where villagers gather for trade and conversation',
        atmosphere: ['lively', 'communal', 'safe', 'familiar'],
        availableActivities: ['trade', 'gather information', 'meet people', 'rest'],
        npcsPresent: ['village_guard', 'mysterious_trader'],
        itemsAvailable: ['basic supplies', 'local crafts', 'information'],
        environment: {
          climate: 'temperate',
          timeOfDay: ['dawn', 'morning', 'afternoon', 'evening'],
          weatherPatterns: ['sunny', 'cloudy', 'light rain'],
          ambientSounds: ['market chatter', 'horse hooves', 'children playing']
        },
        mechanics: {
          dangerLevel: 5,
          restoreChance: 80,
          eventProbability: 60
        },
        connections: [
          {
            toLocationId: 'ancient_library',
            travelTime: 15,
            description: 'A winding path leads to the old library'
          },
          {
            toLocationId: 'forest_path',
            travelTime: 20,
            description: 'A well-traveled road into the forest'
          }
        ]
      },
      {
        id: 'ancient_library',
        name: 'Ancient Library',
        type: 'mystical',
        description: 'A vast repository of knowledge from ages past, filled with mysterious energies',
        atmosphere: ['mystical', 'quiet', 'scholarly', 'timeless'],
        availableActivities: ['research', 'study', 'seek wisdom', 'explore archives'],
        npcsPresent: ['wise_mentor'],
        itemsAvailable: ['ancient texts', 'magical scrolls', 'knowledge crystals'],
        environment: {
          climate: 'controlled',
          timeOfDay: ['eternal twilight'],
          weatherPatterns: ['indoor'],
          ambientSounds: ['turning pages', 'distant whispers', 'magical humming']
        },
        mechanics: {
          accessRequirements: ['intellectual curiosity'],
          dangerLevel: 15,
          restoreChance: 95,
          eventProbability: 40
        },
        connections: [
          {
            toLocationId: 'village_square',
            travelTime: 15,
            description: 'Return to the village center'
          },
          {
            toLocationId: 'hidden_chamber',
            travelTime: 5,
            requirements: ['mentor approval'],
            description: 'A secret passage to deeper mysteries'
          }
        ]
      },
      {
        id: 'forest_path',
        name: 'Forest Path',
        type: 'wilderness',
        description: 'A natural trail winding through dense woodland, alive with flora and fauna',
        atmosphere: ['natural', 'peaceful', 'wild', 'mysterious'],
        availableActivities: ['explore', 'gather herbs', 'observe wildlife', 'find shelter'],
        npcsPresent: [],
        itemsAvailable: ['herbs', 'wild berries', 'animal tracks'],
        environment: {
          climate: 'forest',
          timeOfDay: ['dawn', 'morning', 'afternoon', 'dusk', 'night'],
          weatherPatterns: ['sunny', 'cloudy', 'rain', 'mist'],
          ambientSounds: ['bird songs', 'rustling leaves', 'distant streams']
        },
        mechanics: {
          dangerLevel: 25,
          restoreChance: 60,
          eventProbability: 70
        },
        connections: [
          {
            toLocationId: 'village_square',
            travelTime: 20,
            description: 'Return to the safety of the village'
          },
          {
            toLocationId: 'deep_forest',
            travelTime: 30,
            description: 'Venture deeper into the unknown'
          }
        ]
      },
      {
        id: 'hidden_chamber',
        name: 'Hidden Chamber',
        type: 'mystical',
        description: 'A secret chamber containing powerful artifacts and ancient secrets',
        atmosphere: ['mysterious', 'powerful', 'sacred', 'hidden'],
        availableActivities: ['examine artifacts', 'perform rituals', 'unlock secrets'],
        npcsPresent: [],
        itemsAvailable: ['ancient artifacts', 'power crystals', 'forbidden knowledge'],
        environment: {
          climate: 'mystical',
          timeOfDay: ['eternal'],
          weatherPatterns: ['energy fluctuations'],
          ambientSounds: ['power humming', 'ethereal whispers']
        },
        mechanics: {
          accessRequirements: ['mentor approval', 'proven wisdom'],
          dangerLevel: 50,
          restoreChance: 100,
          eventProbability: 90
        },
        connections: [
          {
            toLocationId: 'ancient_library',
            travelTime: 5,
            description: 'Return to the library'
          }
        ]
      }
    ];
  }

  /**
   * 获取默认对话模板
   */
  private getDefaultDialogueTemplates(): DialogueTemplate[] {
    return [
      {
        id: 'first_meeting',
        situation: 'Initial encounter with a new character',
        participantTypes: ['player', 'any_npc'],
        conversationStarters: [
          'Hello there, I don\'t believe we\'ve met.',
          'Greetings, traveler. What brings you here?',
          'I haven\'t seen you around before. Are you new to these parts?'
        ],
        topicTransitions: [
          {
            from: 'greeting',
            to: 'introduction',
            triggers: ['name exchange', 'polite inquiry']
          },
          {
            from: 'introduction',
            to: 'purpose',
            triggers: ['why are you here', 'what do you do']
          }
        ],
        emotionalProgression: [
          {
            phase: 'cautious',
            emotions: ['curious', 'guarded'],
            duration: 2
          },
          {
            phase: 'warming',
            emotions: ['interested', 'friendly'],
            duration: 3
          },
          {
            phase: 'open',
            emotions: ['trusting', 'helpful'],
            duration: 5
          }
        ],
        outcomeInfluences: [
          {
            action: 'polite conversation',
            relationshipChange: 10,
            emotionalImpact: 5
          },
          {
            action: 'rude behavior',
            relationshipChange: -15,
            emotionalImpact: -10
          }
        ]
      },
      {
        id: 'seeking_help',
        situation: 'Player seeks assistance or information',
        participantTypes: ['player', 'helpful_npc'],
        conversationStarters: [
          'I could use some help with something.',
          'Do you know anything about...?',
          'I\'m looking for information on...'
        ],
        topicTransitions: [
          {
            from: 'request',
            to: 'clarification',
            triggers: ['specific question', 'details needed']
          },
          {
            from: 'clarification',
            to: 'assistance',
            triggers: ['understanding reached', 'willingness to help']
          }
        ],
        emotionalProgression: [
          {
            phase: 'hopeful',
            emotions: ['expectant', 'curious'],
            duration: 2
          },
          {
            phase: 'engaged',
            emotions: ['focused', 'collaborative'],
            duration: 4
          },
          {
            phase: 'resolved',
            emotions: ['satisfied', 'grateful'],
            duration: 2
          }
        ],
        outcomeInfluences: [
          {
            action: 'helpful response',
            relationshipChange: 15,
            emotionalImpact: 10
          },
          {
            action: 'refuse to help',
            relationshipChange: -5,
            emotionalImpact: -8
          }
        ]
      },
      {
        id: 'sharing_knowledge',
        situation: 'Exchange of information or wisdom',
        participantTypes: ['player', 'wise_character'],
        conversationStarters: [
          'Let me share something I\'ve learned.',
          'There\'s an old saying that goes...',
          'In my experience, I\'ve found that...'
        ],
        topicTransitions: [
          {
            from: 'wisdom_sharing',
            to: 'deeper_discussion',
            triggers: ['interest shown', 'follow-up questions']
          },
          {
            from: 'deeper_discussion',
            to: 'personal_application',
            triggers: ['practical application', 'personal relevance']
          }
        ],
        emotionalProgression: [
          {
            phase: 'teaching',
            emotions: ['wise', 'patient'],
            duration: 3
          },
          {
            phase: 'connecting',
            emotions: ['understanding', 'empathetic'],
            duration: 4
          },
          {
            phase: 'bonding',
            emotions: ['close', 'mentoring'],
            duration: 3
          }
        ],
        outcomeInfluences: [
          {
            action: 'attentive listening',
            relationshipChange: 20,
            emotionalImpact: 15
          },
          {
            action: 'dismissive attitude',
            relationshipChange: -10,
            emotionalImpact: -12
          }
        ]
      }
    ];
  }

  /**
   * 获取默认游戏机制配置
   */
  private getDefaultGameMechanics(): GameMechanicsConfig {
    return {
      conversationSystem: {
        maxContextTurns: 10,
        emotionalWeightDecay: 0.95,
        memoryFormationThreshold: 0.7,
        relationshipChangeRate: 1.0
      },
      worldSimulation: {
        timeAcceleration: 1.0,
        eventGenerationRate: 0.3,
        populationDynamics: true,
        economicSimulation: false
      },
      characterBehavior: {
        autonomyLevel: 75,
        predictabilityFactor: 60,
        learningRate: 0.1,
        memoryRetention: 0.9
      },
      difficultyScaling: {
        adaptiveDifficulty: true,
        playerSkillTracking: true,
        challengeProgression: 1.2
      }
    };
  }
}