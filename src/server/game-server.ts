import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Orchestrator, OrchestratorResult } from '../Orchestrator';
import { Logger } from '../services/Logger';
import { container } from '../services/DependencyInjectionContainer';
import { SERVICE_IDENTIFIERS, DefaultServiceFactory } from '../services/factory';
import { DatabaseService } from '../services/database/DatabaseService';
import path from 'path';
import { GameContextService } from '../services/game/GameContextService';
import * as dotenv from 'dotenv';
import { WorldLoreService } from '../services/world/WorldLoreService';
import { DomainCoordinator } from '../domains/DomainCoordinator';
import { GameAction } from '../engine/GameAction';
import { LLMRequestController } from './LLMRequestController';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Interfaces for our game server
interface GameSession {
  id: string;
  playerId: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
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
  userId?: string;
  username?: string;
  lastActivity: Date;
}

// Game server state
const sessions: Map<string, GameSession> = new Map();
const clients: Map<WebSocket, ConnectedClient> = new Map();
let orchestrator: Orchestrator;
let logger: Logger = new Logger(); // 初始化logger
let databaseService: DatabaseService;
let gameContextService: GameContextService;
let llmRequestController: LLMRequestController;

// Initialize game orchestrator and logger
async function initializeGameServer() {
  try {
    // Create service factory and register all services
    const factory = new DefaultServiceFactory();
    factory.registerAllServices();

    // Initialize database service
    databaseService = container.resolve<DatabaseService>(SERVICE_IDENTIFIERS.DATABASE_SERVICE);
    await databaseService.connect();
    logger.info('Database service initialized successfully');

    // Initialize game context service
    gameContextService = container.resolve<GameContextService>(SERVICE_IDENTIFIERS.GAME_CONTEXT_SERVICE);
    logger.info('Game context service initialized successfully');

    // Initialize LLM request controller
    llmRequestController = new LLMRequestController(logger);
    logger.info('LLM request controller initialized successfully');

    orchestrator = new Orchestrator();
    await orchestrator.initializeGame();
    logger.info('Game orchestrator initialized successfully');

    // Start background monitoring for story stagnation
    startBackgroundMonitoring();
  } catch (error) {
    console.error('Failed to initialize game orchestrator:', error);
    logger?.error('Failed to initialize game orchestrator:', error as Error);
    process.exit(1);
  }
}

/**
 * 启动背景监控循环，检测会话停滞并触发导演干预
 */
function startBackgroundMonitoring() {
  const CHECK_INTERVAL = 30000; // 每30秒检查一次
  const STAGNATION_THRESHOLD = 60000; // 1分钟无活动视为停滞（用于简单检查，复杂检查在导演引擎中）

  setInterval(async () => {
    const now = new Date();
    logger.debug('Running background stagnation check...');

    for (const [sessionId, session] of sessions.entries()) {
      if (!session.isActive) continue;

      const idleTime = now.getTime() - session.lastActivity.getTime();

      // 如果空闲超过阈值，或者我们想要周期性评估剧情进度
      if (idleTime > STAGNATION_THRESHOLD) {
        try {
          logger.info(`Session ${sessionId} is idle for ${idleTime}ms, checking for interventions...`);

          const result = await orchestrator.processBackgroundIntervention(sessionId);

          if (result && result.type === 'director_intervention') {
            // 找到对应的客户端并发送干预
            for (const [ws, client] of clients.entries()) {
              if (client.sessionId === sessionId && ws.readyState === WebSocket.OPEN) {
                logger.info(`Pushing director intervention to client for session ${sessionId}`);
                sendMessage(ws, 'director_intervention', result);

                // 更新最后活动时间，避免短时间内重复触发
                session.lastActivity = new Date();
                client.lastActivity = new Date();
              }
            }
          }
        } catch (error) {
          logger.error(`Error in background intervention for session ${sessionId}:`, error as Error);
        }
      }
    }
  }, CHECK_INTERVAL);
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
      case 'login':
        await handleLogin(ws, message.payload);
        break;

      case 'get_user_sessions':
        await handleGetUserSessions(ws, message.payload);
        break;

      case 'create_session':
        await createSession(ws, message.payload);
        break;

      case 'load_session':
        await handleLoadSession(ws, message.payload);
        break;

      case 'rename_session':
        await handleRenameSession(ws, message.payload);
        break;

      case 'delete_session':
        await handleDeleteSession(ws, message.payload);
        break;

      case 'change_username':
        await handleChangeUsername(ws, message.payload);
        break;

      case 'import_user_data':
        await handleImportUserData(ws, message.payload);
        break;

      case 'export_user_data':
        await handleExportUserData(ws, message.payload);
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

      case 'get_world_records':
        await handleGetWorldRecords(ws, message.payload);
        break;

      case 'get_character_outline':
        await handleGetCharacterOutline(ws, message.payload);
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

async function handleLogin(ws: WebSocket, payload: any): Promise<void> {
  const { username } = payload;

  if (!username) {
    sendMessage(ws, 'error', { message: 'Username is required' });
    return;
  }

  try {
    // Get or create user
    let user = await databaseService.getUserByUsername(username);
    if (!user) {
      user = await databaseService.createUser(username, {
        language: 'zh',
        difficulty: 'normal',
        narrativeStyle: 'immersive'
      });
      logger.info(`Created new user: ${username}`);
    } else {
      logger.info(`User logged in: ${username}`);
    }

    // Update client info
    const client = clients.get(ws);
    if (client) {
      client.userId = user.id;
      client.username = user.username;
    }

    // Send login success
    sendMessage(ws, 'login_success', {
      userId: user.id,
      username: user.username,
      preferences: user.preferences
    });

  } catch (error) {
    logger.error('Error during login:', error as Error);
    sendMessage(ws, 'error', { message: 'Login failed' });
  }
}

async function handleGetUserSessions(ws: WebSocket, payload: any): Promise<void> {
  const client = clients.get(ws);
  if (!client?.userId) {
    sendMessage(ws, 'error', { message: 'Not logged in' });
    return;
  }

  try {
    const sessions = await databaseService.getUserSessions(client.userId);
    sendMessage(ws, 'user_sessions', { sessions });
    logger.info(`Retrieved ${sessions.length} sessions for user ${client.username}`);
  } catch (error) {
    logger.error('Error getting user sessions:', error as Error);
    sendMessage(ws, 'error', { message: 'Failed to get sessions' });
  }
}

async function handleLoadSession(ws: WebSocket, payload: any): Promise<void> {
  const { sessionId } = payload;
  const client = clients.get(ws);

  if (!client?.userId) {
    sendMessage(ws, 'error', { message: 'Not logged in' });
    return;
  }

  if (!sessionId) {
    sendMessage(ws, 'error', { message: 'Session ID is required' });
    return;
  }

  try {
    const session = await databaseService.getSession(sessionId);
    if (!session) {
      sendMessage(ws, 'error', { message: 'Session not found' });
      return;
    }

    // Verify session belongs to user
    if (session.user_id !== client.userId) {
      sendMessage(ws, 'error', { message: 'Access denied' });
      return;
    }

    // Update session activity
    await databaseService.updateSessionActivity(sessionId);

    // Store session in memory via Orchestrator (this triggers deep sync)
    const gameSession = await orchestrator.loadSession(sessionId);
    if (!gameSession) {
      sendMessage(ws, 'error', { message: 'Failed to initialize session in orchestrator' });
      return;
    }

    sessions.set(sessionId, gameSession);

    // Update client info
    client.sessionId = sessionId;
    client.playerId = session.player_id;

    // 获取历史对话
    let conversations: any[] = [];
    try {
      conversations = await databaseService.getConversationHistory(sessionId, 50);
    } catch (error) {
      logger.warn('Failed to get conversation history for session:', sessionId);
    }

    logger.info(`Loaded session ${sessionId} for user ${client.username}`);

    // Send session loaded message with conversation history
    sendMessage(ws, 'session_loaded', {
      sessionId: sessionId,
      sessionName: session.session_name,
      conversations: conversations
    });

    // Send initial game state
    await sendInitialState(ws, sessionId);

  } catch (error) {
    logger.error('Error loading session:', error as Error);
    sendMessage(ws, 'error', { message: 'Failed to load session' });
  }
}

async function handleRenameSession(ws: WebSocket, payload: any): Promise<void> {
  const { sessionId, newName } = payload;
  const client = clients.get(ws);

  if (!client?.userId) {
    sendMessage(ws, 'error', { message: 'Not logged in' });
    return;
  }

  if (!sessionId || !newName) {
    sendMessage(ws, 'error', { message: 'Session ID and new name are required' });
    return;
  }

  try {
    await databaseService.renameSession(sessionId, newName);
    sendMessage(ws, 'session_renamed', { sessionId, newName });
    logger.info(`Renamed session ${sessionId} to "${newName}" for user ${client.username}`);
  } catch (error) {
    logger.error('Error renaming session:', error as Error);
    sendMessage(ws, 'error', { message: 'Failed to rename session' });
  }
}

async function handleDeleteSession(ws: WebSocket, payload: any): Promise<void> {
  const { sessionId } = payload;
  const client = clients.get(ws);

  if (!client?.userId) {
    sendMessage(ws, 'error', { message: 'Not logged in' });
    return;
  }

  if (!sessionId) {
    sendMessage(ws, 'error', { message: 'Session ID is required' });
    return;
  }

  try {
    await databaseService.deleteSession(sessionId);
    sessions.delete(sessionId);

    // If this is the current session, clear client info
    if (client.sessionId === sessionId) {
      client.sessionId = undefined;
      client.playerId = undefined;
    }

    sendMessage(ws, 'session_deleted', { sessionId });
    logger.info(`Deleted session ${sessionId} for user ${client.username}`);
  } catch (error) {
    logger.error('Error deleting session:', error as Error);
    sendMessage(ws, 'error', { message: 'Failed to delete session' });
  }
}

async function handleGetWorldRecords(ws: WebSocket, payload: any): Promise<void> {
  const client = clients.get(ws);
  if (!client?.userId) {
    sendMessage(ws, 'error', { message: 'Not logged in' });
    return;
  }

  try {
    const sessions = await databaseService.getUserSessions(client.userId);
    const worldRecords = [];
    for (const session of sessions) {
      const lore = await databaseService.getWorldLoreBySession(session.id, 'main_story');
      worldRecords.push({
        sessionId: session.id,
        sessionName: session.session_name,
        worldStyle: session.world_style || 'fantasy',
        mainStory: lore.length > 0 ? lore[0].content : '该世界尚无背景记录。',
        createdAt: session.created_at
      });
    }
    sendMessage(ws, 'world_records', { worlds: worldRecords });
  } catch (error) {
    logger.error('Error getting world records:', error as Error);
    sendMessage(ws, 'error', { message: 'Failed to get world records' });
  }
}

async function handleGetCharacterOutline(ws: WebSocket, payload: any): Promise<void> {
  const client = clients.get(ws);
  if (!client?.sessionId) {
    sendMessage(ws, 'error', { message: 'No active session' });
    return;
  }

  try {
    const outline = await databaseService.getStoryGeneratedOutline(client.sessionId);
    const sessionDoc = await databaseService.getSession(client.sessionId);
    if (!sessionDoc) {
      sendMessage(ws, 'error', { message: 'Session data not found' });
      return;
    }

    // Get nearby characters (in current location)
    const characters = await databaseService.getCharactersByLocation(client.sessionId, sessionDoc.current_location);

    sendMessage(ws, 'character_outline_data', {
      storyOutline: outline ? outline.story_outline : null,
      nearbyCharacters: characters,
      currentLocation: sessionDoc.current_location
    });
  } catch (error) {
    logger.error('Error getting character outline:', error as Error);
    sendMessage(ws, 'error', { message: 'Failed to get character outline' });
  }
}

async function createSession(ws: WebSocket, payload: any): Promise<void> {
  const { sessionName, inspiration, description, worldStyle, difficulty, gameMode } = payload;
  const client = clients.get(ws);

  if (!client?.userId) {
    sendMessage(ws, 'error', { message: 'Not logged in' });
    return;
  }

  try {
    // 确定游戏模式，默认为引导自由模式
    const selectedGameMode = gameMode || 'guided_free';

    // 映射 worldStyle 到 setting (如果提供)
    const settingMap: Record<string, any> = {
      'fantasy': 'fantasy',
      'sci-fi': 'sci-fi',
      'modern': 'modern',
      'medieval': 'medieval',
      'mixed': 'mixed'
    };

    // Create session in database for the user with all parameters
    const sessionResult = await databaseService.createSessionForUser(
      client.userId,
      sessionName,
      {
        timeOfDay: 'afternoon',
        weather: 'sunny',
        atmosphere: 'peaceful',
        playerLevel: 1,
        completedQuests: [],
        inspiration: inspiration,
        description: description,
        worldStyle: worldStyle || 'fantasy',
        difficulty: difficulty || 'normal',
        gameMode: selectedGameMode
      }
    );

    // 准备玩家偏好设置
    const playerPreferences = {
      startingLocationPreference: worldStyle === 'urban' ? 'city' : 'village',
      characterInteractionLevel: 'medium',
      atmospherePreference: description ? 'story_driven' : 'exploration',
      difficultyLevel: difficulty || 'normal',
      storyPacing: 'medium'
    };

    // Create session through orchestrator with enhanced parameters
    const gameSession = await orchestrator.createSession(
      sessionResult.id, // Use the database session ID
      inspiration, // Pass inspiration for world lore generation
      selectedGameMode, // Pass game mode
      playerPreferences, // Pass player preferences
      (step, message) => {
        sendMessage(ws, 'setup_progress', { step, message });
      },
      {
        worldName: sessionName,
        worldDescription: description,
        setting: settingMap[worldStyle] || 'fantasy',
        complexity: payload.complexity || 'moderate',
        locale: payload.locale || 'zh'
      }
    );

    const session: GameSession = {
      id: sessionResult.id,
      playerId: gameSession.playerId,
      createdAt: gameSession.createdAt,
      lastActivity: gameSession.lastActivity,
      isActive: gameSession.isActive,
      metadata: gameSession.metadata
    };

    sessions.set(session.id, session);

    // Update database with the actual initial location and metadata
    await databaseService.updateSession(session.id, {
      current_location: session.metadata?.currentLocation || 'town_square',
      game_state: session.metadata
    });

    // Update client info
    client.sessionId = session.id;
    client.playerId = gameSession.playerId;

    logger.info(`Created session ${session.id} ("${sessionResult.session_name}") for user ${client.username} with mode ${selectedGameMode}. Initial location: ${session.metadata?.currentLocation}`);

    // Send session created message with additional metadata
    sendMessage(ws, 'session_created', {
      sessionId: session.id,
      sessionName: sessionResult.session_name,
      description: description,
      worldStyle: worldStyle || 'fantasy',
      difficulty: difficulty || 'normal',
      inspiration: inspiration,
      gameMode: selectedGameMode,
      hasStoryOutline: session.metadata?.hasStoryOutline || false
    });

    // 获取WorldLoreService并发送worldlore内容
    try {
      const worldLoreService = container.resolve<WorldLoreService>(SERVICE_IDENTIFIERS.WORLD_LORE_SERVICE);
      const worldLore = await worldLoreService.getWorldLoreForSession(session.id);

      // 发送worldlore内容给客户端
      if (worldLore && worldLore.length > 0) {
        // 发送主故事作为欢迎消息的一部分
        const mainStory = worldLore.find((lore: any) => lore.loreType === 'main_story');
        if (mainStory) {
          sendMessage(ws, 'character_response', {
            characterId: 'world',
            characterName: '世界背景',
            content: `世界背景：${mainStory.content}`,
            type: 'narration',
            timestamp: new Date().toISOString()
          });
        }

        // 发送所有worldlore内容
        sendMessage(ws, 'world_lore_update', {
          sessionId: session.id,
          worldLore: worldLore
        });
      }
    } catch (loreError) {
      logger.warn(`Failed to send world lore for session ${session.id}:`, loreError as Error);
    }

    // 如果有剧情大纲，发送相关信息
    if (session.metadata?.hasStoryOutline && session.metadata?.storyContext) {
      sendMessage(ws, 'story_outline_ready', {
        sessionId: session.id,
        currentPlotPoint: session.metadata.storyContext.currentPlotPoint,
        availableStoryPaths: session.metadata.storyContext.availableStoryPaths,
        playerObjectives: session.metadata.storyContext.playerObjectives
      });
    }

    // Send initial game state (with world and character initialization)
    await sendInitialState(ws, session.id);

    // Initialize world and characters for the new session
    try {
      await initializeSessionWorld(session.id, client.playerId);
      logger.info(`World and characters initialized for session ${session.id}`);
    } catch (initError) {
      logger.warn(`Failed to initialize world for session ${session.id}:`, initError as Error);
    }
  } catch (error) {
    logger.error('Error creating session:', error as Error);
    sendMessage(ws, 'error', { message: 'Failed to create session' });
  }
}

async function handlePlayerInput(ws: WebSocket, payload: any): Promise<void> {
  const { sessionId, playerId, input } = payload;
  const client = clients.get(ws);
  const effectivePlayerId = client?.playerId || playerId || 'player1';

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

  // Check if session is already processing a request
  if (llmRequestController.isProcessing(sessionId)) {
    const status = llmRequestController.getStatus(sessionId);
    sendMessage(ws, 'request_queued', {
      message: '正在处理上一个请求，当前请求已加入队列',
      queuePosition: status.queueLength + 1,
      queueLength: status.queueLength
    });

    // Enqueue the request
    const request = {
      id: uuidv4(),
      sessionId,
      input,
      timestamp: new Date()
    };

    llmRequestController.enqueue(request);

    // Process the queued request when ready
    processQueuedRequest(ws, sessionId, effectivePlayerId);
    return;
  }

  // Mark as processing
  const request = {
    id: uuidv4(),
    sessionId,
    input,
    timestamp: new Date()
  };

  const canProcess = llmRequestController.enqueue(request);
  if (!canProcess) {
    // This shouldn't happen since we checked above, but handle it anyway
    logger.warn(`Unexpected queue state for session ${sessionId}`);
    return;
  }

  // Send processing indicator
  sendMessage(ws, 'processing_start', {
    message: '正在处理您的请求...'
  });

  try {
    await processPlayerInput(ws, sessionId, effectivePlayerId, input);
  } finally {
    // Mark request as complete and process next in queue
    const nextRequest = llmRequestController.complete(sessionId);
    if (nextRequest) {
      // Process next request in queue
      setTimeout(() => {
        processQueuedRequest(ws, sessionId, effectivePlayerId);
      }, 100); // Small delay to allow UI to update
    }
  }
}

// Helper function to process queued requests
async function processQueuedRequest(ws: WebSocket, sessionId: string, playerId: string): Promise<void> {
  const status = llmRequestController.getStatus(sessionId);
  if (!status.currentRequest) {
    return;
  }

  sendMessage(ws, 'processing_start', {
    message: '正在处理队列中的请求...',
    queueRemaining: status.queueLength
  });

  try {
    await processPlayerInput(ws, sessionId, playerId, status.currentRequest.input);
  } finally {
    const nextRequest = llmRequestController.complete(sessionId);
    if (nextRequest) {
      setTimeout(() => {
        processQueuedRequest(ws, sessionId, playerId);
      }, 100);
    }
  }
}

// Actual processing logic extracted from handlePlayerInput
async function processPlayerInput(ws: WebSocket, sessionId: string, playerId: string, input: string): Promise<void> {
  // Get session for state updates
  const session = sessions.get(sessionId);
  if (!session) {
    sendMessage(ws, 'error', { message: 'Session not found' });
    return;
  }

  try {
    logger.info(`Processing player input: "${input}" for session ${sessionId}`);

    // Process input through orchestrator - Use server-validated playerId
    const result: OrchestratorResult = await orchestrator.runOnce(input, sessionId, playerId);

    if (result.success && result.coordinationResult) {
      const coordination = result.coordinationResult;

      // Send character responses
      let hasSentResponse = false;
      if (coordination.responses.characterResponses && coordination.responses.characterResponses.length > 0) {
        for (const response of coordination.responses.characterResponses) {
          sendMessage(ws, 'character_response', {
            characterId: response.characterId,
            characterName: response.characterName,
            content: response.content,
            type: 'dialogue',
            timestamp: new Date().toISOString()
          });
          hasSentResponse = true;
        }
      }

      // If no character response was sent, send narrative
      if (!hasSentResponse && coordination.responses.narrative) {
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
        // 如果有位置变更，同步更新会话和数据库
        if (!session.metadata) session.metadata = {};
        session.metadata.currentLocation = coordination.stateChanges.locationChange;

        await databaseService.updateSession(sessionId, {
          current_location: coordination.stateChanges.locationChange,
          updated_at: new Date()
        });

        await sendGameState(ws, { sessionId });
      } else {
        await sendGameState(ws, { sessionId });
      }

      // 发送流水线动作序列到客户端
      if (coordination.actions && coordination.actions.length > 0) {
        sendMessage(ws, 'pipeline_actions', {
          sessionId,
          actions: coordination.actions
        });
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

    const locationId = (await gameContextService.getGameContext(sessionId, session.playerId || 'player1')).currentLocation.id;

    sendMessage(ws, 'game_state_update', {
      status: 'playing',
      currentTime: new Date().toLocaleTimeString('zh-CN'),
      currentLocation,
      mapData: await gameContextService.getDiscoveredLocations(sessionId, locationId),
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
  const session = sessions.get(sessionId);
  try {
    // Send initial game state
    await sendGameState(ws, { sessionId });

    // 获取动态位置信息而非硬编码
    // 首先尝试从 Session 或 DatabaseService 获取真实位置
    let locationInfo = {
      location: session?.metadata?.currentLocation || 'unknown',
      description: '加载中...',
      title: '正在进入游戏...'
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
      // 如果获取失败，尝试从 session 元数据中恢复基础信息
      if (session?.metadata?.currentLocation) {
        locationInfo.location = session.metadata.currentLocation;
      }
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

// 为新会话初始化世界和角色
async function initializeSessionWorld(sessionId: string, playerId: string): Promise<void> {
  try {
    // 通过DomainCoordinator初始化游戏世界
    const domainCoordinator = container.resolve<DomainCoordinator>(SERVICE_IDENTIFIERS.DOMAIN_COORDINATOR);
    await domainCoordinator.initializeGame();

    // 确保玩家在正确的起始位置
    const gameContext = await gameContextService.getGameContext(sessionId, playerId);

    logger.info(`Session world initialized for ${sessionId}`, {
      sessionId,
      playerId,
      currentLocation: gameContext.currentLocation?.name || 'unknown'
    });
  } catch (error) {
    logger.error(`Failed to initialize session world for ${sessionId}:`, error as Error);
    throw error;
  }
}

// 新增的处理函数

// 处理修改用户名
async function handleChangeUsername(ws: WebSocket, payload: any): Promise<void> {
  const { newUsername } = payload;
  const client = clients.get(ws);

  if (!client || !client.userId) {
    sendMessage(ws, 'error', { message: '用户未登录' });
    return;
  }

  try {
    // 检查用户名是否已存在
    const existingUser = await databaseService.getUserByUsername(newUsername);
    if (existingUser && existingUser.id !== client.userId) {
      sendMessage(ws, 'error', { message: '用户名已存在' });
      return;
    }

    // 更新用户名
    await databaseService.query(
      'UPDATE users SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newUsername, client.userId]
    );

    client.username = newUsername;
    sendMessage(ws, 'username_changed', { username: newUsername });

  } catch (error) {
    logger.error('Failed to change username:', error as Error);
    sendMessage(ws, 'error', { message: '修改用户名失败' });
  }
}

// 处理数据导入
async function handleImportUserData(ws: WebSocket, payload: any): Promise<void> {
  const client = clients.get(ws);

  if (!client || !client.userId) {
    sendMessage(ws, 'error', { message: '用户未登录' });
    return;
  }

  try {
    const { user, sessions: importSessions, version } = payload;

    // 简单的版本检查
    if (!version || version !== '1.0') {
      sendMessage(ws, 'error', { message: '不支持的数据版本' });
      return;
    }

    // 导入新数据（简化实现）
    for (const sessionData of importSessions) {
      const newSessionId = uuidv4();
      await databaseService.query(
        'INSERT INTO game_sessions (id, user_id, session_name, session_description, world_style, difficulty, inspiration, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [newSessionId, client.userId, sessionData.session_name + '_导入', sessionData.session_description, sessionData.world_style, sessionData.difficulty, sessionData.inspiration, new Date()]
      );
    }

    sendMessage(ws, 'data_imported', { message: '数据导入成功' });

    // 重新发送会话列表
    await handleGetUserSessions(ws, {});

  } catch (error) {
    logger.error('Failed to import user data:', error as Error);
    sendMessage(ws, 'error', { message: '数据导入失败' });
  }
}

// 处理数据导出
async function handleExportUserData(ws: WebSocket, payload: any): Promise<void> {
  const client = clients.get(ws);

  if (!client || !client.userId) {
    sendMessage(ws, 'error', { message: '用户未登录' });
    return;
  }

  try {
    const user = await databaseService.query('SELECT * FROM users WHERE id = $1', [client.userId]);
    const sessions = await databaseService.query('SELECT * FROM game_sessions WHERE user_id = $1', [client.userId]);

    const exportData = {
      user: user[0],
      sessions,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    sendMessage(ws, 'data_exported', exportData);

  } catch (error) {
    logger.error('Failed to export user data:', error as Error);
    sendMessage(ws, 'error', { message: '数据导出失败' });
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