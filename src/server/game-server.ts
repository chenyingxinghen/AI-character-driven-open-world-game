import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

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

// Simple in-memory storage for sessions
const sessions: Map<string, GameSession> = new Map();

// Create WebSocket server
const wss = new WebSocketServer({ port: 8080 });

console.log('Game server started on ws://localhost:8080');

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');

  // Send connection status
  ws.send(JSON.stringify({
    type: 'connection_status',
    payload: { connected: true },
    timestamp: new Date()
  }));

  ws.on('message', (data: string) => {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      handleMessage(ws, message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleMessage(ws: WebSocket, message: WebSocketMessage): void {
  console.log('Received message:', message.type, message.payload);

  switch (message.type) {
    case 'create_session':
      createSession(ws, message.payload);
      break;
      
    case 'player_input':
      handlePlayerInput(ws, message.payload);
      break;
      
    case 'player_action':
      handlePlayerAction(ws, message.payload);
      break;
      
    case 'request_game_state':
      sendGameState(ws, message.payload);
      break;
      
    default:
      console.warn('Unknown message type:', message.type);
  }
}

function createSession(ws: WebSocket, payload: any): void {
  const sessionId = uuidv4();
  const session: GameSession = {
    id: sessionId,
    playerId: payload.playerId,
    createdAt: new Date(),
    lastActivity: new Date(),
    isActive: true
  };
  
  sessions.set(sessionId, session);
  
  // Send session created message
  ws.send(JSON.stringify({
    type: 'session_created',
    payload: { sessionId },
    timestamp: new Date()
  }));
  
  // Send initial game state
  sendInitialState(ws, sessionId);
}

function handlePlayerInput(ws: WebSocket, payload: any): void {
  const { sessionId, playerId, input } = payload;
  
  // Update session activity
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  }
  
  // Simulate AI response
  setTimeout(() => {
    const responses = [
      `你说了: "${input}"。我是艾琳娜，很高兴认识你。`,
      `关于"${input}"，我知道一些相关信息。`,
      `你提到"${input}"，这让我想起了一个故事...`,
      `"${input}"是个有趣的话题。你想了解更多吗？`
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    ws.send(JSON.stringify({
      type: 'character_response',
      payload: {
        characterId: '1',
        characterName: '艾琳娜',
        content: randomResponse,
        type: 'dialogue',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    }));
  }, 1000);
  
  // Send updated action options
  sendActionOptions(ws);
}

function handlePlayerAction(ws: WebSocket, payload: any): void {
  const { sessionId, playerId, action } = payload;
  
  // Update session activity
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  }
  
  console.log('Player action:', action);
  
  // Send confirmation
  ws.send(JSON.stringify({
    type: 'action_confirmation',
    payload: { 
      actionId: action.actionId,
      success: true,
      message: '操作执行成功'
    },
    timestamp: new Date()
  }));
}

function sendGameState(ws: WebSocket, payload: any): void {
  const { sessionId } = payload;
  
  // Update session activity
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
  }
  
  ws.send(JSON.stringify({
    type: 'game_state_update',
    payload: {
      status: 'playing',
      currentTime: new Date().toLocaleTimeString('zh-CN'),
      currentLocation: '镇中心广场',
      hints: ['与角色对话了解更多信息', '探索不同区域发现秘密']
    },
    timestamp: new Date()
  }));
}

function sendInitialState(ws: WebSocket, sessionId: string): void {
  // Send initial game state
  sendGameState(ws, { sessionId });
  
  // Send initial scene
  ws.send(JSON.stringify({
    type: 'scene_update',
    payload: {
      id: 'town_square',
      title: '镇中心广场',
      description: '你站在迷雾镇的中心广场，周围是古老的建筑和熙熙攘攘的人群。喷泉在中央静静流淌，发出轻柔的水声。',
      imageUrl: '/scenes/town_square.jpg',
      charactersPresent: ['1', '2', '3'],
      objects: [
        { id: 'fountain', name: '古老喷泉', description: '镇上的标志性建筑，据说有神秘的力量' },
        { id: 'notice_board', name: '公告栏', description: '张贴着各种通知和信息' }
      ]
    },
    timestamp: new Date()
  }));
  
  // Send initial action options
  sendActionOptions(ws);
}

function sendActionOptions(ws: WebSocket): void {
  const options = [
    { id: '1', label: '询问关于镇上的历史', type: 'dialogue' },
    { id: '2', label: '前往图书馆', type: 'movement' },
    { id: '3', label: '观察周围环境', type: 'interaction' },
    { id: '4', label: '查看背包', type: 'interaction' }
  ];
  
  ws.send(JSON.stringify({
    type: 'action_options_update',
    payload: { options },
    timestamp: new Date()
  }));
}

// Periodic cleanup of inactive sessions
setInterval(() => {
  const now = new Date();
  const expiredSessions: string[] = [];
  
  sessions.forEach((session, sessionId) => {
    const minutesSinceActivity = (now.getTime() - session.lastActivity.getTime()) / (1000 * 60);
    if (minutesSinceActivity > 60) { // Expire after 1 hour
      expiredSessions.push(sessionId);
    }
  });
  
  expiredSessions.forEach(sessionId => {
    sessions.delete(sessionId);
    console.log(`Cleaned up expired session: ${sessionId}`);
  });
}, 5 * 60 * 1000); // Check every 5 minutes