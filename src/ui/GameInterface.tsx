import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { GameClient, GameClientConfig } from '../client/GameClient';

// 添加JSX命名空间声明
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// 定义接口
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

// 组件属性接口
interface TopNavigationProps {
  gameTitle: string;
  onCharacterSelect: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onExit: () => void;
}

interface CharacterInfoPanelProps {
  character: Character;
}

interface SceneDisplayProps {
  scene: Scene;
}

interface PlayerInputProps {
  onSubmit: (input: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface CharacterResponseProps {
  responses: GameResponse[];
}

interface ActionOptionsProps {
  options: ActionOption[];
  onOptionSelect: (option: ActionOption) => void;
}

interface StatusBarProps {
  gameState: GameState;
}

// 组件实现
const TopNavigation: React.FC<TopNavigationProps> = ({
  gameTitle,
  onCharacterSelect,
  onSettings,
  onHelp,
  onExit
}) => {
  return (
    <nav className="top-navigation">
      <div className="game-title">{gameTitle}</div>
      <div className="nav-buttons">
        <button onClick={onCharacterSelect}>角色</button>
        <button onClick={onSettings}>设置</button>
        <button onClick={onHelp}>帮助</button>
        <button onClick={onExit}>退出</button>
      </div>
    </nav>
  );
};

const CharacterInfoPanel: React.FC<CharacterInfoPanelProps> = ({ character }) => {
  return (
    <div className="character-info-panel">
      <div className="character-avatar">
        <img src={character.avatar} alt={character.name} />
      </div>
      <div className="character-name">{character.name}</div>
      <div className="emotional-state">
        <span>情绪: {character.emotionalState.mood}</span>
        <div className="emotion-meter">
          <div 
            className="emotion-level" 
            style={{ width: `${character.emotionalState.intensity}%` }}
          ></div>
        </div>
      </div>
      <div className="relationships">
        <h4>关系</h4>
        {character.relationships.map((rel: any) => (
          <div key={rel.characterId} className="relationship-item">
            <span>{rel.name}</span>
            <div className="relationship-meter">
              <div 
                className="relationship-level" 
                style={{ width: `${rel.relationshipLevel}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SceneDisplay: React.FC<SceneDisplayProps> = ({ scene }) => {
  return (
    <div className="scene-display">
      {scene.imageUrl && (
        <div className="scene-image">
          <img src={scene.imageUrl} alt={scene.title} />
        </div>
      )}
      <div className="scene-title">{scene.title}</div>
      <div className="scene-description">{scene.description}</div>
      <div className="scene-objects">
        {scene.objects.map((obj: any) => (
          <div key={obj.id} className="scene-object">
            <strong>{obj.name}</strong>: {obj.description}
          </div>
        ))}
      </div>
    </div>
  );
};

const PlayerInput: React.FC<PlayerInputProps> = ({ 
  onSubmit, 
  placeholder = "输入你的行动或对话...", 
  disabled = false 
}) => {
  const [inputValue, setInputValue] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !disabled) {
      onSubmit(inputValue);
      setInputValue('');
    }
  };

  return (
    <form className="player-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !inputValue.trim()}>
        发送
      </button>
    </form>
  );
};

const CharacterResponse: React.FC<CharacterResponseProps> = ({ responses }) => {
  const responseContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 滚动到最新回应
    if (responseContainerRef.current) {
      responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight;
    }
  }, [responses]);

  return (
    <div className="character-response" ref={responseContainerRef}>
      {responses.map((response: GameResponse, index: number) => (
        <div key={index} className={`response-item ${response.type}`}>
          <div className="character-name">{response.characterName}:</div>
          <div className="response-content">{response.content}</div>
        </div>
      ))}
    </div>
  );
};

const ActionOptions: React.FC<ActionOptionsProps> = ({ options, onOptionSelect }) => {
  return (
    <div className="action-options">
      <h4>可选操作</h4>
      <div className="options-list">
        {options.map((option: ActionOption) => (
          <button 
            key={option.id} 
            onClick={() => onOptionSelect(option)}
            className={`action-button ${option.type}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const StatusBar: React.FC<StatusBarProps> = ({ gameState }) => {
  return (
    <div className="status-bar">
      <div className="game-status">状态: {gameState.status}</div>
      <div className="current-time">时间: {gameState.currentTime}</div>
      <div className="current-location">位置: {gameState.currentLocation}</div>
      <div className="hints">
        {gameState.hints.map((hint: string, index: number) => (
          <span key={index} className="hint-item">{hint}</span>
        ))}
      </div>
    </div>
  );
};

// 主游戏界面组件
const GameInterface: React.FC = () => {
  // 初始化游戏客户端
  const [gameClient] = useState<GameClient>(() => {
    const config: GameClientConfig = {
      websocketUrl: process.env.WEBSOCKET_URL || 'ws://localhost:8080',
      playerId: `player_${Date.now()}`
    };
    return new GameClient(config);
  });

  // 状态管理
  const [gameTitle] = useState('AI角色驱动开放世界游戏');
  const [isConnected, setIsConnected] = useState(false);
  const [currentCharacter, setCurrentCharacter] = useState<Character>({
    id: '1',
    name: '艾琳娜',
    avatar: '/avatars/elena.jpg',
    emotionalState: {
      mood: '平静',
      intensity: 70
    },
    relationships: [
      { characterId: '2', name: '马库斯', relationshipLevel: 80 },
      { characterId: '3', name: '索菲亚', relationshipLevel: 60 }
    ]
  });

  const [currentScene, setCurrentScene] = useState<Scene>({
    id: 'town_square',
    title: '镇中心广场',
    description: '你站在迷雾镇的中心广场，周围是古老的建筑和熙熙攘攘的人群。喷泉在中央静静流淌，发出轻柔的水声。',
    imageUrl: '/scenes/town_square.jpg',
    charactersPresent: ['1', '2', '3'],
    objects: [
      { id: 'fountain', name: '古老喷泉', description: '镇上的标志性建筑，据说有神秘的力量' },
      { id: 'notice_board', name: '公告栏', description: '张贴着各种通知和信息' }
    ]
  });

  const [responses, setResponses] = useState<GameResponse[]>([
    {
      characterId: '1',
      characterName: '艾琳娜',
      content: '欢迎来到迷雾镇，陌生人。我是这里的图书管理员艾琳娜。',
      type: 'dialogue',
      timestamp: new Date()
    }
  ]);

  const [actionOptions, setActionOptions] = useState<ActionOption[]>([
    { id: '1', label: '询问关于镇上的历史', type: 'dialogue', action: () => {} },
    { id: '2', label: '前往图书馆', type: 'movement', action: () => {} },
    { id: '3', label: '观察周围环境', type: 'interaction', action: () => {} }
  ]);

  const [gameState, setGameState] = useState<GameState>({
    status: 'playing',
    currentTime: '下午 3:45',
    currentLocation: '镇中心广场',
    hints: ['与角色对话了解更多信息', '探索不同区域发现秘密']
  });

  // 位置过渡状态
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('');

  // 连接到游戏服务器
  useEffect(() => {
    const connectToGame = async () => {
      try {
        const connected = await gameClient.connect();
        setIsConnected(connected);
        
        if (connected) {
          // 注册事件处理器
          gameClient.onConnectionChange(setIsConnected);
          gameClient.onGameStateUpdate(setGameState);
          gameClient.onCharacterResponse((response: GameResponse) => {
            setResponses((prev: GameResponse[]) => [...prev, response]);
          });
          gameClient.onSceneUpdate(setCurrentScene);
          gameClient.onActionOptionsUpdate(setActionOptions);
          
          // 添加位置过渡处理器
          gameClient.onLocationTransition((transition: any) => {
            if (transition.type === 'start') {
              setIsTransitioning(true);
              setTransitionMessage(transition.message);
              
              // 添加系统消息到对话中
              const transitionResponse: GameResponse = {
                characterId: 'system',
                characterName: '系统',
                content: transition.message,
                type: 'narration',
                timestamp: new Date()
              };
              setResponses((prev: GameResponse[]) => [...prev, transitionResponse]);
            } else if (transition.type === 'complete') {
              setIsTransitioning(false);
              setTransitionMessage('');
              
              // 添加到达消息到对话中
              const arrivalResponse: GameResponse = {
                characterId: 'system',
                characterName: '系统',
                content: transition.message,
                type: 'narration',
                timestamp: new Date()
              };
              setResponses((prev: GameResponse[]) => [...prev, arrivalResponse]);
            }
          });
        }
      } catch (error) {
        console.error('Failed to connect to game:', error);
      }
    };

    connectToGame();

    // 清理函数
    return () => {
      gameClient.disconnect();
    };
  }, [gameClient]);

  // 处理玩家输入
  const handlePlayerInput = (input: string) => {
    // 添加玩家输入到回应列表
    const playerResponse: GameResponse = {
      characterId: 'player',
      characterName: '你',
      content: input,
      type: 'dialogue',
      timestamp: new Date()
    };

    setResponses((prev: GameResponse[]) => [...prev, playerResponse]);

    // 发送到游戏服务器
    gameClient.sendPlayerInput(input);
  };

  // 处理操作选项选择
  const handleOptionSelect = (option: ActionOption) => {
    // 执行操作
    option.action();
  };

  // 处理角色选择
  const handleCharacterSelect = () => {
    console.log('打开角色选择界面');
  };

  // 处理设置
  const handleSettings = () => {
    console.log('打开设置界面');
  };

  // 处理帮助
  const handleHelp = () => {
    console.log('打开帮助界面');
  };

  // 处理退出
  const handleExit = () => {
    gameClient.disconnect();
    console.log('退出游戏');
  };

  return (
    <div className="game-interface">
      <TopNavigation
        gameTitle={gameTitle}
        onCharacterSelect={handleCharacterSelect}
        onSettings={handleSettings}
        onHelp={handleHelp}
        onExit={handleExit}
      />
      
      <div className="main-content">
        <div className="left-sidebar">
          <CharacterInfoPanel character={currentCharacter} />
        </div>
        
        <div className="center-content">
          <SceneDisplay scene={currentScene} />
          <CharacterResponse responses={responses} />
          <PlayerInput 
            onSubmit={handlePlayerInput} 
            disabled={!isConnected || isTransitioning}
            placeholder={isConnected ? 
              (isTransitioning ? transitionMessage : "输入你的行动或对话...") : 
              "连接中..."
            }
          />
          <ActionOptions 
            options={actionOptions} 
            onOptionSelect={handleOptionSelect} 
          />
        </div>
      </div>
      
      <StatusBar gameState={gameState} />
    </div>
  );
};

export default GameInterface;