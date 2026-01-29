import { WebSocketManager } from '../services/WebSocketManager';

// 定义接口而不是从GameInterface导入
interface Character {
  id: string;
  name: string;
  avatar: string;
  emotionalState: {
    mood: string;
    intensity: number;
  };
  relationships: Array<{
    characterId: string;
    name: string;
    relationshipLevel: number;
  }>;
}

interface Scene {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  charactersPresent: string[];
  objects: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

interface GameResponse {
  characterId: string;
  characterName: string;
  content: string;
  type: 'dialogue' | 'action' | 'narration';
  timestamp: Date;
}

interface ActionOption {
  id: string;
  label: string;
  type: 'movement' | 'interaction' | 'dialogue' | 'custom';
  action: () => void;
}

interface GameState {
  status: 'playing' | 'paused' | 'ended';
  currentTime: string;
  currentLocation: string;
  hints: string[];
}

// 添加WorldLore接口定义
interface WorldLore {
  id: string;
  sessionId: string;
  loreType: 'main_story' | 'history' | 'legend' | 'culture' | 'geography';
  title: string;
  content: string;
  inspiration?: string;
  generationSeed: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameClientConfig {
  websocketUrl: string;
  playerId: string;
}

export class GameClient {
  private wsManager: WebSocketManager;
  private sessionId: string | null = null;
  private playerId: string;
  private isConnected: boolean = false;
  private gameState: GameState = {
    status: 'paused',
    currentTime: '',
    currentLocation: '',
    hints: []
  };

  // Event handlers
  private onConnectionChangeHandlers: ((connected: boolean) => void)[] = [];
  private onGameStateUpdateHandlers: ((state: GameState) => void)[] = [];
  private onCharacterResponseHandlers: ((response: GameResponse) => void)[] = [];
  private onSceneUpdateHandlers: ((scene: Scene) => void)[] = [];
  private onActionOptionsUpdateHandlers: ((options: ActionOption[]) => void)[] = [];
  private onLocationTransitionHandlers: ((transition: any) => void)[] = [];
  private onSessionCreatedHandlers: ((sessionId: string) => void)[] = [];
  private onWorldLoreUpdateHandlers: ((worldLore: WorldLore[]) => void)[] = []; // 添加worldlore更新处理器

  constructor(config: GameClientConfig) {
    this.wsManager = new WebSocketManager(config.websocketUrl);
    this.playerId = config.playerId;
    
    // Set up WebSocket message handlers
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.wsManager.subscribe('connection_status', (data: any) => {
      this.isConnected = data.connected;
      this.onConnectionChangeHandlers.forEach(handler => handler(this.isConnected));
    });

    this.wsManager.subscribe('game_state_update', (data: any) => {
      this.gameState = {
        status: data.status,
        currentTime: data.currentTime,
        currentLocation: data.currentLocation,
        hints: data.hints || []
      };
      this.onGameStateUpdateHandlers.forEach(handler => handler(this.gameState));
    });

    this.wsManager.subscribe('character_response', (data: any) => {
      const response: GameResponse = {
        characterId: data.characterId,
        characterName: data.characterName,
        content: data.content,
        type: data.type,
        timestamp: new Date(data.timestamp)
      };
      this.onCharacterResponseHandlers.forEach(handler => handler(response));
    });

    this.wsManager.subscribe('scene_update', (data: any) => {
      const scene: Scene = {
        id: data.id,
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        charactersPresent: data.charactersPresent,
        objects: data.objects
      };
      this.onSceneUpdateHandlers.forEach(handler => handler(scene));
    });

    this.wsManager.subscribe('action_options_update', (data: any) => {
      const options: ActionOption[] = data.options.map((opt: any) => ({
        id: opt.id,
        label: opt.label,
        type: opt.type,
        action: () => {
          this.sendAction(opt.id);
        }
      }));
      this.onActionOptionsUpdateHandlers.forEach(handler => handler(options));
    });

    this.wsManager.subscribe('session_created', (data: any) => {
      this.sessionId = data.sessionId;
      console.log('Session created:', this.sessionId);
      // 调用会话创建处理器
      this.onSessionCreatedHandlers.forEach(handler => handler(this.sessionId!));
    });

    // 新增位置过渡消息处理
    this.wsManager.subscribe('location_transition_start', (data: any) => {
      const transition = {
        type: 'start',
        fromLocation: data.fromLocation,
        toLocation: data.toLocation,
        transitionType: data.transitionType,
        message: data.message
      };
      this.onLocationTransitionHandlers.forEach(handler => handler(transition));
    });

    this.wsManager.subscribe('location_transition_complete', (data: any) => {
      const transition = {
        type: 'complete',
        newLocation: data.newLocation,
        message: data.message
      };
      this.onLocationTransitionHandlers.forEach(handler => handler(transition));
    });
    
    // 添加world_lore_update消息处理
    this.wsManager.subscribe('world_lore_update', (data: any) => {
      console.log('Received world lore update:', data);
      // 调用worldlore更新处理器
      this.onWorldLoreUpdateHandlers.forEach(handler => handler(data.worldLore || []));
    });
  }

  async connect(): Promise<boolean> {
    try {
      await this.wsManager.connect();
      this.isConnected = true;
      
      // Request a new session
      this.wsManager.sendMessage('create_session', {
        playerId: this.playerId
      });
      
      return true;
    } catch (error) {
      console.error('Failed to connect to game server:', error);
      return false;
    }
  }

  disconnect(): void {
    this.wsManager.disconnect();
    this.isConnected = false;
  }

  sendPlayerInput(input: string): void {
    if (!this.sessionId) {
      console.warn('No active session');
      return;
    }
    
    this.wsManager.sendPlayerInput(this.sessionId, this.playerId, input);
  }

  sendAction(actionId: string): void {
    if (!this.sessionId) {
      console.warn('No active session');
      return;
    }
    
    this.wsManager.sendAction(this.sessionId, this.playerId, { actionId });
  }

  requestGameState(): void {
    if (!this.sessionId) {
      console.warn('No active session');
      return;
    }
    
    this.wsManager.requestGameState(this.sessionId);
  }

  // Event handler registration methods
  onConnectionChange(handler: (connected: boolean) => void): void {
    this.onConnectionChangeHandlers.push(handler);
  }

  onGameStateUpdate(handler: (state: GameState) => void): void {
    this.onGameStateUpdateHandlers.push(handler);
  }

  onCharacterResponse(handler: (response: GameResponse) => void): void {
    this.onCharacterResponseHandlers.push(handler);
  }

  onSceneUpdate(handler: (scene: Scene) => void): void {
    this.onSceneUpdateHandlers.push(handler);
  }

  onActionOptionsUpdate(handler: (options: ActionOption[]) => void): void {
    this.onActionOptionsUpdateHandlers.push(handler);
  }

  onLocationTransition(handler: (transition: any) => void): void {
    this.onLocationTransitionHandlers.push(handler);
  }

  // 添加会话创建事件处理器注册方法
  onSessionCreated(handler: (sessionId: string) => void): void {
    this.onSessionCreatedHandlers.push(handler);
  }
  
  // 添加worldlore更新事件处理器注册方法
  onWorldLoreUpdate(handler: (worldLore: WorldLore[]) => void): void {
    this.onWorldLoreUpdateHandlers.push(handler);
  }

  // Getters
  getSessionId(): string | null {
    return this.sessionId;
  }

  isConnectedStatus(): boolean {
    return this.isConnected;
  }

  getCurrentGameState(): GameState {
    return { ...this.gameState };
  }
}