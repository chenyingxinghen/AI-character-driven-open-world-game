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

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private isConnected: boolean = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.ws.close();
      }

      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch(() => {
          this.attemptReconnect();
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.payload));
    }
  }

  sendMessage(type: string, payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected');
      return;
    }

    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date()
    };

    this.ws.send(JSON.stringify(message));
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
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