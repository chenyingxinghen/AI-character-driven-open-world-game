import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Orchestrator, OrchestratorResult } from '../Orchestrator';
import { Logger } from '../services/Logger';
import { container } from '../services/DependencyInjectionContainer';
import { DefaultServiceFactory, SERVICE_IDENTIFIERS } from '../services/factory';
import { DatabaseService } from '../services/database/DatabaseService';
import path from 'path';
import { GameContextService } from '../services/game/GameContextService';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Interfaces for our game server
interface GameSession {
  id: string;
  playerId: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
}

interface ConnectedClient {
  ws: WebSocket;
  sessionId?: string;
  playerId?: string;
  lastActivity: Date;
}

// Game server state
const sessions: Map<string, GameSession> = new Map();
const clients: Map<WebSocket, ConnectedClient> = new Map();
let orchestrator: Orchestrator;
let logger: Logger;
let databaseService: DatabaseService;
let gameContextService: GameContextService;

// Initialize game orchestrator and logger
async function initializeGameServer() {
  try {
    // Initialize the service factory and register all services
    const serviceFactory = new DefaultServiceFactory();
    serviceFactory.registerAllServices();
    
    logger = new Logger();
    // Initialize database service
    databaseService = container.resolve<DatabaseService>(SERVICE_IDENTIFIERS.DATABASE_SERVICE);
    await databaseService.connect();
    logger.info('Database service initialized successfully');
    
    // Initialize game context service
    gameContextService = container.resolve<GameContextService>(SERVICE_IDENTIFIERS.GAME_CONTEXT_SERVICE);
    logger.info('Game context service initialized successfully');
    
    orchestrator = new Orchestrator();
    await orchestrator.initializeGame();
    logger.info('Game orchestrator initialized successfully');
  } catch (error) {
    console.error('Failed to initialize game orchestrator:', error);
    logger?.error('Failed to initialize game orchestrator:', error as Error);
    process.exit(1);
  }
}

// Create WebSocket server
const serverPort = parseInt(process.env.GAME_SERVER_PORT || '8080');
const wss = new WebSocketServer({ port: serverPort });

console.log(`Game server started on ws://${process.env.GAME_SERVER_HOST || 'localhost'}:${serverPort}`);

wss.on('connection', (ws: WebSocket) => {
  const clientId = uuidv4();
  const client: ConnectedClient = {
    ws,
    lastActivity: new Date()
  };
  clients.set(ws, client);
  
  logger.info(`New client connected: ${clientId}`);

  // Send connection status
  sendMessage(ws, 'connection_status', { connected: true });

  ws.on('message', async (data: string) => {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      client.lastActivity = new Date();
      await handleMessage(ws, message);
    } catch (error) {
      logger.error('Error parsing message:', error as Error);
      sendMessage(ws, 'error', { message: 'Invalid message format' });
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    logger.info(`Client disconnected: ${client?.playerId || 'unknown'}`);
    
    // Clean up session if exists
    if (client?.sessionId) {
      const session = sessions.get(client.sessionId);
      if (session) {
        session.isActive = false;
        session.lastActivity = new Date();
      }
    }
    
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error as Error);
  });
});

async function handleMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
  const client = clients.get(ws);
  if (!client) {
    logger.warn('Received message from unknown client');
    return;
  }

  logger.info(`Received message: ${message.type}`, { payload: message.payload });

  try {
    switch (message.type) {
      case 'create_session':
        await createSession(ws, message.payload);
        break;
        
      case 'player_input':
        await handlePlayerInput(ws, message.payload);
        break;
        
      case 'player_action':
        await handlePlayerAction(ws, message.payload);
        break;
        
      case 'request_game_state':
        await sendGameState(ws, message.payload);
        break;
        
      default:
        logger.warn(`Unknown message type: ${message.type}`);
        sendMessage(ws, 'error', { message: `Unknown message type: ${message.type}` });
    }
  } catch (error) {
    logger.error(`Error handling message ${message.type}:`, error as Error);
    sendMessage(ws, 'error', { 
      message: `Error processing ${message.type}: ${(error as Error).message}` 
    });
  }
}

async function createSession(ws: WebSocket, payload: any): Promise<void> {
  const playerId = payload.playerId || uuidv4();
  
  try {
    // Create session through orchestrator
    const gameSession = await orchestrator.createSession(playerId);
    
    const session: GameSession = {
      id: gameSession.id,
      playerId: gameSession.playerId,
      createdAt: gameSession.createdAt,
      lastActivity: gameSession.lastActivity,
      isActive: gameSession.isActive
    };
    
    sessions.set(session.id, session);
    
    // Update client info
    const client = clients.get(ws);
    if (client) {
      client.sessionId = session.id;
      client.playerId = playerId;
    }
    
    logger.info(`Created session ${session.id} for player ${playerId}`);
    
    // Send session created message
    sendMessage(ws, 'session_created', { sessionId: session.id });
    
    // Send initial game state
    await sendInitialState(ws, session.id);
  } catch (error) {
    logger.error('Error creating session:', error as Error);
    sendMessage(ws, 'error', { message: 'Failed to create session' });
  }
}

async function handlePlayerInput(ws: WebSocket, payload: any): Promise<void> {
  const { sessionId, playerId, input } = payload;
  
  if (!sessionId || !input) {
    sendMessage(ws, 'error', { message: 'Missing sessionId or input' });
    return;
  }
  
  // Update session activity
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  } else {
    sendMessage(ws, 'error', { message: 'Session not found' });
    return;
  }
  
  try {
    logger.info(`Processing player input: "${input}" for session ${sessionId}`);
    
    // Process input through orchestrator
    const result: OrchestratorResult = await orchestrator.runOnce(input, sessionId, playerId);
    
    if (result.success && result.coordinationResult) {
      const coordination = result.coordinationResult;
      
      // Send character responses
      if (coordination.responses.characterResponses) {
        for (const response of coordination.responses.characterResponses) {
          sendMessage(ws, 'character_response', {
            characterId: 'npc_1',
            characterName: '镇守卫',
            content: response,
            type: 'dialogue',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Send narrative response
      if (coordination.responses.narrative) {
        sendMessage(ws, 'character_response', {
          characterId: 'narrator',
          characterName: '叙述者',
          content: coordination.responses.narrative,
          type: 'narration',
          timestamp: new Date().toISOString()
        });
      }
      
      // Send location description if changed
      if (coordination.responses.locationDescription) {
        // 发送位置变更开始消息
        if (coordination.stateChanges.locationChange) {
          sendMessage(ws, 'location_transition_start', {
            fromLocation: session.playerId, // 这里应该是当前位置，暂时用playerId
            toLocation: coordination.stateChanges.locationChange,
            transitionType: 'movement',
            message: '正在前往新位置...'
          });
          
          // 延迟发送场景更新，模拟移动过程
          setTimeout(() => {
            sendSceneUpdate(ws, {
              description: coordination.responses.locationDescription,
              location: coordination.stateChanges.locationChange
            });
            
            // 发送位置变更完成消息
            sendMessage(ws, 'location_transition_complete', {
              newLocation: coordination.stateChanges.locationChange,
              message: '已到达目的地'
            });
          }, 1000); // 1秒延迟模拟移动时间
        } else {
          await sendSceneUpdate(ws, {
            description: coordination.responses.locationDescription,
            location: coordination.stateChanges.locationChange || session.playerId
          });
        }
      }
      
      // Update game state
      if (coordination.stateChanges.locationChange) {
        // 如果有位置变更，立即更新游戏状态
        session.playerId = coordination.stateChanges.locationChange; // 这应该是一个location字段，这里临时使用
        await sendGameState(ws, { sessionId });
      } else {
        await sendGameState(ws, { sessionId });
      }
      
    } else {
      // Send error response
      sendMessage(ws, 'character_response', {
        characterId: 'system',
        characterName: '系统',
        content: result.error || '处理输入时出现错误，请稍后再试。',
        type: 'narration',
        timestamp: new Date().toISOString()
      });
    }
    
    // Send updated action options
    await sendActionOptions(ws);
    
  } catch (error) {
    logger.error('Error processing player input:', error as Error);
    sendMessage(ws, 'character_response', {
      characterId: 'system',
      characterName: '系统',
      content: '系统出现错误，请稍后再试。',
      type: 'narration',
      timestamp: new Date().toISOString()
    });
  }
}

async function handlePlayerAction(ws: WebSocket, payload: any): Promise<void> {
  const { sessionId, playerId, action } = payload;
  
  if (!sessionId || !action) {
    sendMessage(ws, 'error', { message: 'Missing sessionId or action' });
    return;
  }
  
  // Update session activity
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  } else {
    sendMessage(ws, 'error', { message: 'Session not found' });
    return;
  }
  
  try {
    logger.info(`Processing player action: ${action.actionId} for session ${sessionId}`);
    
    // Convert action to input text for processing
    let inputText = '';
    switch (action.actionId) {
      case '1':
        inputText = '询问关于镇上的历史';
        break;
      case '2':
        // 使用动态位置而非硬编码
        try {
          const gameContext = await gameContextService.getGameContext(sessionId, playerId);
          const availableLocations = gameContext.availableLocations.filter(loc => loc.accessibility === 'direct');
          if (availableLocations.length > 0) {
            inputText = `前往${availableLocations[0].name}`;
          } else {
            inputText = '寻找可以前往的地方';
          }
        } catch (error) {
          logger.warn('Failed to get dynamic location, using fallback');
          inputText = '寻找可以前往的地方';
        }
        break;
      case '3':
        inputText = '观察周围环境';
        break;
      case '4':
        inputText = '查看背包';
        break;
      default:
        inputText = `执行操作：${action.actionId}`;
    }
    
    // Process through orchestrator
    const result: OrchestratorResult = await orchestrator.runOnce(inputText, sessionId, playerId);
    
    if (result.success) {
      // Send confirmation
      sendMessage(ws, 'action_confirmation', {
        actionId: action.actionId,
        success: true,
        message: '操作执行成功'
      });
      
      // Process any resulting responses similar to handlePlayerInput
      if (result.coordinationResult?.responses.narrative) {
        sendMessage(ws, 'character_response', {
          characterId: 'narrator',
          characterName: '叙述者',
          content: result.coordinationResult.responses.narrative,
          type: 'narration',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      sendMessage(ws, 'action_confirmation', {
        actionId: action.actionId,
        success: false,
        message: result.error || '操作执行失败'
      });
    }
    
  } catch (error) {
    logger.error('Error processing player action:', error as Error);
    sendMessage(ws, 'action_confirmation', {
      actionId: action.actionId,
      success: false,
      message: '操作执行时出现错误'
    });
  }
}

async function sendGameState(ws: WebSocket, payload: any): Promise<void> {
  const { sessionId } = payload;
  
  if (!sessionId) {
    sendMessage(ws, 'error', { message: 'Missing sessionId' });
    return;
  }
  
  // Update session activity
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  } else {
    sendMessage(ws, 'error', { message: 'Session not found' });
    return;
  }
  
  try {
    // 使用动态上下文获取当前位置
    let currentLocation = '未知位置';
    try {
      if (session.playerId) {
        const gameContext = await gameContextService.getGameContext(sessionId, session.playerId);
        currentLocation = gameContext.currentLocation.name;
      }
    } catch (error) {
      logger.warn('Failed to get dynamic location from GameContextService, using fallback');
      currentLocation = '默认位置';
    }
    
    // Get system status from orchestrator
    const systemStatus = await orchestrator.getSystemStatus();
    
    sendMessage(ws, 'game_state_update', {
      status: 'playing',
      currentTime: new Date().toLocaleTimeString('zh-CN'),
      currentLocation,
      hints: [
        '与角色对话了解更多信息',
        '探索不同区域发现秘密',
        '输入你的行动来推进故事发展'
      ]
    });
  } catch (error) {
    logger.error('Error sending game state:', error as Error);
    sendMessage(ws, 'error', { message: 'Failed to get game state' });
  }
}

async function sendInitialState(ws: WebSocket, sessionId: string): Promise<void> {
  try {
    // Send initial game state
    await sendGameState(ws, { sessionId });
    
    // 获取动态位置信息而非硬编码
    let locationInfo = {
      location: 'town_square',
      description: '你站在一个未知的地方，周围的景色模糊不清。',
      title: '神秘之地'
    };
    
    try {
      const client = clients.get(ws);
      if (client?.playerId) {
        const gameContext = await gameContextService.getGameContext(sessionId, client.playerId);
        locationInfo = {
          location: gameContext.currentLocation.id,
          description: gameContext.currentLocation.description,
          title: gameContext.currentLocation.name
        };
      }
    } catch (error) {
      logger.warn('Failed to get dynamic location info, using fallback');
    }
    
    // Send initial scene
    await sendSceneUpdate(ws, locationInfo);
    
    // Send initial action options
    await sendActionOptions(ws, sessionId);
    
    // Send welcome message
    sendMessage(ws, 'character_response', {
      characterId: 'narrator',
      characterName: '叙述者',
      content: `欢迎来到AI角色驱动的开放世界游戏！你现在位于${locationInfo.title}。你可以与角色对话、探索环境，或使用下方的快捷操作。`,
      type: 'narration',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error sending initial state:', error as Error);
    sendMessage(ws, 'error', { message: 'Failed to send initial state' });
  }
}

async function sendActionOptions(ws: WebSocket, sessionId?: string): Promise<void> {
  let options = [
    { id: '1', label: '询问关于当地的历史', type: 'dialogue' },
    { id: '2', label: '寻找可以前往的地方', type: 'movement' },
    { id: '3', label: '观察周围环境', type: 'interaction' },
    { id: '4', label: '查看背包', type: 'interaction' },
    { id: '5', label: '与附近的人交谈', type: 'dialogue' },
    { id: '6', label: '查看周围的信息', type: 'interaction' }
  ];
  
  // 如果有sessionId，尝试获取动态选项
  if (sessionId) {
    try {
      const client = Array.from(clients.values()).find(c => c.sessionId === sessionId);
      if (client?.playerId) {
        const gameContext = await gameContextService.getGameContext(sessionId, client.playerId);
        
        // 动态生成移动选项
        if (gameContext.availableLocations.length > 0) {
          options[1] = {
            id: '2',
            label: `前往${gameContext.availableLocations[0].name}`,
            type: 'movement'
          };
        }
        
        // 动态生成对话选项
        if (gameContext.nearbyCharacters.length > 0) {
          options[4] = {
            id: '5',
            label: `与${gameContext.nearbyCharacters[0].name}交谈`,
            type: 'dialogue'
          };
        }
      }
    } catch (error) {
      logger.warn('Failed to get dynamic action options, using default options');
    }
  }
  
  sendMessage(ws, 'action_options_update', { options });
}

async function sendSceneUpdate(ws: WebSocket, sceneData: any): Promise<void> {
  // 使用传入的动态数据，如果没有则使用默认值
  const sceneInfo = {
    id: sceneData.location || 'unknown_location',
    title: sceneData.title || '未知地点',
    description: sceneData.description || '你站在一个神秘的地方。',
    imageUrl: `/scenes/${sceneData.location || 'default'}.jpg`,
    charactersPresent: sceneData.charactersPresent || [],
    objects: sceneData.objects || [
      { id: 'mystery_object', name: '神秘物品', description: '一个看起来很有趣的物品' }
    ]
  };
  
  sendMessage(ws, 'scene_update', sceneInfo);
}

function sendMessage(ws: WebSocket, type: string, payload: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type,
      payload,
      timestamp: new Date()
    }));
  }
}

// Periodic cleanup of inactive sessions
setInterval(async () => {
  const now = new Date();
  const expiredSessions: string[] = [];
  const timeoutMinutes = parseInt(process.env.GAME_SESSION_TIMEOUT_MINUTES || '60');
  
  sessions.forEach((session, sessionId) => {
    const minutesSinceActivity = (now.getTime() - session.lastActivity.getTime()) / (1000 * 60);
    if (minutesSinceActivity > timeoutMinutes) {
      expiredSessions.push(sessionId);
    }
  });
  
  for (const sessionId of expiredSessions) {
    try {
      await orchestrator.closeSession(sessionId);
      sessions.delete(sessionId);
      logger.info(`Cleaned up expired session: ${sessionId}`);
    } catch (error) {
      logger.error(`Error cleaning up session ${sessionId}:`, error as Error);
    }
  }
  
  // Clean up expired orchestrator sessions
  try {
    await orchestrator.cleanupExpiredSessions(timeoutMinutes);
  } catch (error) {
    logger.error('Error during orchestrator cleanup:', error as Error);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down game server...');
  
  // Close all WebSocket connections
  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      sendMessage(ws, 'server_shutdown', { message: '服务器正在关闭，请保存游戏进度' });
      ws.close();
    }
  });
  
  // Close WebSocket server
  wss.close(() => {
    logger.info('WebSocket server closed');
    process.exit(0);
  });
});

// Initialize and start the server
initializeGameServer().then(() => {
  logger.info('Game server fully initialized and ready for connections');
}).catch((error) => {
  console.error('Failed to start game server:', error);
  process.exit(1);
});

export { wss, orchestrator, logger };