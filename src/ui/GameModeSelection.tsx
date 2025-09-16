/**
 * 游戏模式选择组件
 * 提供用户界面来选择和配置游戏模式
 */

import React, { useState, useEffect } from 'react';
import { 
  GameModeType, 
  StoryGenre, 
  FreeModeConfig, 
  ScriptModeConfig, 
  PlayerPreferences 
} from '../domains/gameMode/valueObjects';

interface GameModeSelectionProps {
  onModeSelected: (mode: GameModeType, config: FreeModeConfig | ScriptModeConfig) => void;
  onCancel?: () => void;
}

interface ModeStats {
  totalSessions: number;
  averagePlayTime: number;
  popularGenre?: StoryGenre;
}

export const GameModeSelection: React.FC<GameModeSelectionProps> = ({ 
  onModeSelected, 
  onCancel 
}) => {
  const [selectedMode, setSelectedMode] = useState<GameModeType>(GameModeType.FREE);
  const [playerPrefs, setPlayerPrefs] = useState<PlayerPreferences>({
    preferredGenre: StoryGenre.FANTASY,
    difficultyLevel: 50,
    narrativeStyle: 'descriptive',
    interactionFrequency: 'medium',
    allowMatureContent: false,
    languagePreference: 'zh-CN'
  });
  
  // 自由模式配置
  const [freeModeConfig, setFreeModeConfig] = useState<FreeModeConfig>({
    worldGenerationType: 'random',
    characterCreationEnabled: true,
    locationAccessLevel: 'unrestricted',
    eventRandomness: 70,
    creativeFreedom: 80
  });
  
  // 剧本模式配置
  const [scriptModeConfig, setScriptModeConfig] = useState<ScriptModeConfig>({
    storyOutlineId: 'mystery-artifact',
    directorInterventionLevel: 60,
    storyDeviationTolerance: 40,
    targetStoryLength: 120,
    keyPlotPoints: [],
    allowPlayerDeviations: true
  });

  const [modeStats, setModeStats] = useState<Record<GameModeType, ModeStats>>({
    [GameModeType.FREE]: {
      totalSessions: 156,
      averagePlayTime: 45,
      popularGenre: StoryGenre.FANTASY
    },
    [GameModeType.SCRIPT]: {
      totalSessions: 89,
      averagePlayTime: 67,
      popularGenre: StoryGenre.MYSTERY
    }
  });

  const handleStartGame = () => {
    const config = selectedMode === GameModeType.FREE ? freeModeConfig : scriptModeConfig;
    onModeSelected(selectedMode, config);
  };

  const storyOutlines = [
    { id: 'mystery-artifact', title: '神秘的古代文物', genre: StoryGenre.MYSTERY, duration: 90 },
    { id: 'space-adventure', title: '星际探险', genre: StoryGenre.SCIENCE_FICTION, duration: 120 },
    { id: 'medieval-quest', title: '中世纪传奇', genre: StoryGenre.FANTASY, duration: 150 },
    { id: 'modern-thriller', title: '现代惊悚', genre: StoryGenre.MYSTERY, duration: 80 }
  ];

  return (
    <div className="game-mode-selection">
      <div className="mode-selection-container">
        <h1 className="title">选择游戏模式</h1>
        <p className="subtitle">选择适合你的游戏体验</p>

        {/* 模式选择卡片 */}
        <div className="mode-cards">
          {/* 自由模式 */}
          <div 
            className={`mode-card ${selectedMode === GameModeType.FREE ? 'selected' : ''}`}
            onClick={() => setSelectedMode(GameModeType.FREE)}
          >
            <div className="mode-header">
              <h2>🌟 自由模式</h2>
              <div className="mode-stats">
                <span>{modeStats[GameModeType.FREE].totalSessions} 次游戏</span>
                <span>平均 {modeStats[GameModeType.FREE].averagePlayTime} 分钟</span>
              </div>
            </div>
            <div className="mode-description">
              <p>无限创意，自由探索。没有固定剧情约束，你可以创造属于自己的故事。</p>
              <ul className="mode-features">
                <li>✨ 无剧情约束</li>
                <li>🎭 自主创建角色</li>
                <li>🗺️ 动态世界生成</li>
                <li>🎲 随机事件系统</li>
              </ul>
            </div>
          </div>

          {/* 剧本模式 */}
          <div 
            className={`mode-card ${selectedMode === GameModeType.SCRIPT ? 'selected' : ''}`}
            onClick={() => setSelectedMode(GameModeType.SCRIPT)}
          >
            <div className="mode-header">
              <h2>📖 剧本模式</h2>
              <div className="mode-stats">
                <span>{modeStats[GameModeType.SCRIPT].totalSessions} 次游戏</span>
                <span>平均 {modeStats[GameModeType.SCRIPT].averagePlayTime} 分钟</span>
              </div>
            </div>
            <div className="mode-description">
              <p>体验精心设计的故事情节，智能导演系统将引导你完成完整的叙事体验。</p>
              <ul className="mode-features">
                <li>📚 精心编写的故事</li>
                <li>🎬 智能导演引导</li>
                <li>🎯 明确的目标和结局</li>
                <li>⚖️ 灵活的偏离容忍</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 配置面板 */}
        <div className="config-panel">
          {selectedMode === GameModeType.FREE ? (
            <div className="free-mode-config">
              <h3>自由模式配置</h3>
              
              <div className="config-section">
                <label>世界生成类型</label>
                <select 
                  value={freeModeConfig.worldGenerationType}
                  onChange={(e) => setFreeModeConfig({
                    ...freeModeConfig,
                    worldGenerationType: e.target.value as any
                  })}
                >
                  <option value="random">随机生成</option>
                  <option value="guided">引导生成</option>
                  <option value="custom">自定义</option>
                </select>
              </div>

              <div className="config-section">
                <label>创意自由度: {freeModeConfig.creativeFreedom}%</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={freeModeConfig.creativeFreedom}
                  onChange={(e) => setFreeModeConfig({
                    ...freeModeConfig,
                    creativeFreedom: parseInt(e.target.value)
                  })}
                />
              </div>

              <div className="config-section">
                <label>随机事件频率: {freeModeConfig.eventRandomness}%</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={freeModeConfig.eventRandomness}
                  onChange={(e) => setFreeModeConfig({
                    ...freeModeConfig,
                    eventRandomness: parseInt(e.target.value)
                  })}
                />
              </div>

              <div className="config-section">
                <label>
                  <input 
                    type="checkbox"
                    checked={freeModeConfig.characterCreationEnabled}
                    onChange={(e) => setFreeModeConfig({
                      ...freeModeConfig,
                      characterCreationEnabled: e.target.checked
                    })}
                  />
                  允许创建角色
                </label>
              </div>
            </div>
          ) : (
            <div className="script-mode-config">
              <h3>剧本模式配置</h3>
              
              <div className="config-section">
                <label>选择故事</label>
                <select 
                  value={scriptModeConfig.storyOutlineId}
                  onChange={(e) => setScriptModeConfig({
                    ...scriptModeConfig,
                    storyOutlineId: e.target.value
                  })}
                >
                  {storyOutlines.map(story => (
                    <option key={story.id} value={story.id}>
                      {story.title} ({story.duration}分钟)
                    </option>
                  ))}
                </select>
              </div>

              <div className="config-section">
                <label>导演干预程度: {scriptModeConfig.directorInterventionLevel}%</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={scriptModeConfig.directorInterventionLevel}
                  onChange={(e) => setScriptModeConfig({
                    ...scriptModeConfig,
                    directorInterventionLevel: parseInt(e.target.value)
                  })}
                />
                <div className="slider-labels">
                  <span>自由</span>
                  <span>引导</span>
                  <span>严格</span>
                </div>
              </div>

              <div className="config-section">
                <label>偏离容忍度: {scriptModeConfig.storyDeviationTolerance}%</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={scriptModeConfig.storyDeviationTolerance}
                  onChange={(e) => setScriptModeConfig({
                    ...scriptModeConfig,
                    storyDeviationTolerance: parseInt(e.target.value)
                  })}
                />
                <div className="slider-labels">
                  <span>严格</span>
                  <span>平衡</span>
                  <span>宽松</span>
                </div>
              </div>

              <div className="config-section">
                <label>
                  <input 
                    type="checkbox"
                    checked={scriptModeConfig.allowPlayerDeviations}
                    onChange={(e) => setScriptModeConfig({
                      ...scriptModeConfig,
                      allowPlayerDeviations: e.target.checked
                    })}
                  />
                  允许玩家偏离主线
                </label>
              </div>
            </div>
          )}

          {/* 玩家偏好设置 */}
          <div className="player-preferences">
            <h3>玩家偏好</h3>
            
            <div className="config-section">
              <label>喜欢的类型</label>
              <select 
                value={playerPrefs.preferredGenre}
                onChange={(e) => setPlayerPrefs({
                  ...playerPrefs,
                  preferredGenre: e.target.value as StoryGenre
                })}
              >
                <option value={StoryGenre.FANTASY}>奇幻</option>
                <option value={StoryGenre.SCIENCE_FICTION}>科幻</option>
                <option value={StoryGenre.MYSTERY}>悬疑</option>
                <option value={StoryGenre.HISTORICAL}>历史</option>
                <option value={StoryGenre.MODERN}>现代</option>
                <option value={StoryGenre.ADVENTURE}>冒险</option>
              </select>
            </div>

            <div className="config-section">
              <label>叙事风格</label>
              <select 
                value={playerPrefs.narrativeStyle}
                onChange={(e) => setPlayerPrefs({
                  ...playerPrefs,
                  narrativeStyle: e.target.value as any
                })}
              >
                <option value="descriptive">描述性</option>
                <option value="dialogue_heavy">对话丰富</option>
                <option value="action_oriented">动作导向</option>
              </select>
            </div>

            <div className="config-section">
              <label>难度级别: {playerPrefs.difficultyLevel}%</label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={playerPrefs.difficultyLevel}
                onChange={(e) => setPlayerPrefs({
                  ...playerPrefs,
                  difficultyLevel: parseInt(e.target.value)
                })}
              />
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="action-buttons">
          {onCancel && (
            <button className="cancel-button" onClick={onCancel}>
              取消
            </button>
          )}
          <button className="start-button" onClick={handleStartGame}>
            开始游戏
          </button>
        </div>
      </div>

      {/* 模式预览面板 */}
      <div className="mode-preview">
        <h3>模式预览</h3>
        {selectedMode === GameModeType.FREE ? (
          <div className="preview-content">
            <h4>自由模式体验</h4>
            <p>在这个模式下，你将享受到：</p>
            <ul>
              <li>完全的创作自由，没有预设的故事限制</li>
              <li>动态生成的世界和角色</li>
              <li>根据你的行动自适应的游戏环境</li>
              <li>个性化的故事发展路径</li>
            </ul>
            <div className="preview-tip">
              💡 建议新手玩家先尝试较低的随机事件频率，熟悉后再提高。
            </div>
          </div>
        ) : (
          <div className="preview-content">
            <h4>剧本模式体验</h4>
            <p>在这个模式下，你将体验到：</p>
            <ul>
              <li>精心设计的故事情节和角色发展</li>
              <li>智能导演系统的适时引导</li>
              <li>多种结局和分支路径</li>
              <li>平衡的自由度和故事连贯性</li>
            </ul>
            <div className="preview-tip">
              💡 导演干预程度可以随时在游戏中调整，找到最适合你的平衡点。
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameModeSelection;