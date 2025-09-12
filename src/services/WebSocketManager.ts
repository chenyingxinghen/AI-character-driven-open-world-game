export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
}

export interface GameEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
}

// 兼容浏览器和Node.js环境的WebSocket
const WebSocketClass = (() => {
  if (typeof window !== 'undefined') {
    // 浏览器环境
    return window.WebSocket;
  } else {
    // Node.js环境
    try {
      return require('ws');
    } catch (error) {
      throw new Error('WebSocket not available in this environment');
    }
  }
})();

export class WebSocketManager {
  private ws: any = null; // 使用any类型兼容不同环境
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private isConnected: boolean = false;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private heartbeatIntervalId: NodeJS.Timeout | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          this.ws.close();
        }

        this.ws = new WebSocketClass(this.url);

        const onOpen = () => {
          console.log('WebSocket connection established');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };

        const onMessage = (event: any) => {
          try {
            // 兼容浏览器和Node.js的消息格式
            const data = typeof event.data === 'string' ? event.data : event.toString();
            const message: WebSocketMessage = JSON.parse(data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        const onClose = () => {
          console.log('WebSocket connection closed');
          this.isConnected = false;
          this.stopHeartbeat();
          this.attemptReconnect();
        };

        const onError = (error: any) => {
          console.error('WebSocket error:', error);
          if (!this.isConnected) {
            reject(error);
          }
        };

        // 兼容浏览器和Node.js的事件监听
        if (typeof window !== 'undefined') {
          // 浏览器环境
          this.ws.onopen = onOpen;
          this.ws.onmessage = onMessage;
          this.ws.onclose = onClose;
          this.ws.onerror = onError;
        } else {
          // Node.js环境
          this.ws.on('open', onOpen);
          this.ws.on('message', onMessage);
          this.ws.on('close', onClose);
          this.ws.on('error', onError);
        }

        // 连接超时处理
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      this.reconnectTimeoutId = setTimeout(() => {
        this.connect().catch(() => {
          this.attemptReconnect();
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }

  private startHeartbeat(): void {
    this.heartbeatIntervalId = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage('ping', { timestamp: Date.now() });
      }
    }, 30000); // 每30秒发送一次心跳
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.payload));
    }
  }

  sendMessage(type: string, payload: any): void {
    if (!this.ws || !this.isConnected) {
      console.warn('WebSocket is not connected');
      return;
    }

    // 检查WebSocket状态
    const readyState = this.ws.readyState !== undefined ? this.ws.readyState : this.ws.OPEN;
    if (readyState !== (typeof window !== 'undefined' ? WebSocket.OPEN : 1)) {
      console.warn('WebSocket is not in OPEN state');
      return;
    }

    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date()
    };

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      this.isConnected = false;
    }
  }

  subscribe(type: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    
    this.messageHandlers.get(type)!.push(handler);
  }

  unsubscribe(type: string, handler: (data: any) => void): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  isConnectedStatus(): boolean {
    return this.isConnected;
  }

  // Game-specific methods
  sendPlayerInput(sessionId: string, playerId: string, input: string): void {
    this.sendMessage('player_input', {
      sessionId,
      playerId,
      input
    });
  }

  sendAction(sessionId: string, playerId: string, action: any): void {
    this.sendMessage('player_action', {
      sessionId,
      playerId,
      action
    });
  }

  requestGameState(sessionId: string): void {
    this.sendMessage('request_game_state', {
      sessionId
    });
  }

  requestCharacterData(sessionId: string, characterId: string): void {
    this.sendMessage('request_character_data', {
      sessionId,
      characterId
    });
  }
}