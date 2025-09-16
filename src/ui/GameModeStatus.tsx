/**
 * 游戏模式状态显示组件
 * 显示当前游戏模式的状态信息
 */

import React, { useState, useEffect } from 'react';
import { 
  GameModeType, 
  GameModeState,
  InterventionDecision,
  StoryGenre 
} from '../domains/gameMode/valueObjects';

interface GameModeStatusProps {
  currentMode: GameModeType;
  modeState: GameModeState;
  storyProgress?: {
    currentAct: number;
    completionPercentage: number;
    currentPlotPoint: any;
    overallDeviation: number;
  };
  directorStats?: {
    totalInterventions: number;
    activeCooldowns: string[];
    isActive: boolean;
  };
  onModeSwitch?: () => void;
  className?: string;
}

export const GameModeStatus: React.FC<GameModeStatusProps> = ({
  currentMode,
  modeState,
  storyProgress,
  directorStats,
  onModeSwitch,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const formatPlayTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`;
  };

  const getDeviationColor = (deviation: number): string => {
    if (deviation < 25) return '#4CAF50'; // 绿色
    if (deviation < 50) return '#FFC107'; // 黄色
    if (deviation < 75) return '#FF9800'; // 橙色
    return '#F44336'; // 红色
  };

  const getDeviationLabel = (deviation: number): string => {
    if (deviation < 25) return '正常';
    if (deviation < 50) return '轻微偏离';
    if (deviation < 75) return '明显偏离';
    return '严重偏离';
  };

  const getModeIcon = (mode: GameModeType): string => {
    return mode === GameModeType.FREE ? '🌟' : '📖';
  };

  const getModeDisplayName = (mode: GameModeType): string => {
    return mode === GameModeType.FREE ? '自由模式' : '剧本模式';
  };

  return (
    <div className={`game-mode-status ${className} ${isExpanded ? 'expanded' : ''}`}>
      {/* 主状态栏 */}
      <div className="status-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="mode-info">
          <span className="mode-icon">{getModeIcon(currentMode)}</span>
          <span className="mode-name">{getModeDisplayName(currentMode)}</span>
          {modeState.isTransitioning && (
            <span className="transition-indicator">切换中...</span>
          )}
        </div>
        
        <div className="play-time">
          <span className="time-label">游戏时间:</span>
          <span className="time-value">{formatPlayTime(modeState.totalPlayTime)}</span>
        </div>

        <div className="expand-button">
          {isExpanded ? '▼' : '▶'}
        </div>
      </div>

      {/* 详细信息面板 */}
      {isExpanded && (
        <div className="status-details">
          {/* 通用信息 */}
          <div className="detail-section">
            <h4>会话信息</h4>
            <div className="info-grid">
              <div className="info-item">
                <label>开始时间:</label>
                <span>{modeState.sessionStartTime.toLocaleString()}</span>
              </div>
              <div className="info-item">
                <label>当前活动:</label>
                <span>{modeState.currentActivity}</span>
              </div>
            </div>
          </div>

          {/* 剧本模式特有信息 */}
          {currentMode === GameModeType.SCRIPT && storyProgress && (
            <div className="detail-section script-mode-details">
              <h4>故事进展</h4>
              
              {/* 进度条 */}
              <div className="progress-section">
                <div className="progress-header">
                  <span>完成度</span>
                  <span>{storyProgress.completionPercentage.toFixed(1)}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${storyProgress.completionPercentage}%` }}
                  />
                </div>
                <div className="progress-details">
                  <span>第 {storyProgress.currentAct} 章</span>
                  {storyProgress.currentPlotPoint && (
                    <span>• {storyProgress.currentPlotPoint.title}</span>
                  )}
                </div>
              </div>

              {/* 偏离度指示器 */}
              <div className="deviation-section">
                <div className="deviation-header">
                  <span>故事偏离度</span>
                  <span 
                    className="deviation-tooltip"
                    onMouseEnter={() => setShowTooltip('deviation')}
                    onMouseLeave={() => setShowTooltip(null)}
                  >
                    ℹ️
                  </span>
                  {showTooltip === 'deviation' && (
                    <div className="tooltip">
                      偏离度表示你的行动与预期故事路径的偏差程度
                    </div>
                  )}
                </div>
                <div className="deviation-meter">
                  <div 
                    className="deviation-indicator"
                    style={{ 
                      left: `${storyProgress.overallDeviation}%`,
                      backgroundColor: getDeviationColor(storyProgress.overallDeviation)
                    }}
                  />
                  <div className="deviation-scale">
                    <span>正常</span>
                    <span>偏离</span>
                    <span>严重</span>
                  </div>
                </div>
                <div className="deviation-value">
                  <span style={{ color: getDeviationColor(storyProgress.overallDeviation) }}>
                    {getDeviationLabel(storyProgress.overallDeviation)} ({storyProgress.overallDeviation.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* 导演系统状态 */}
              {directorStats && (
                <div className="director-section">
                  <div className="director-header">
                    <span>导演系统</span>
                    <span className={`director-status ${directorStats.isActive ? 'active' : 'inactive'}`}>
                      {directorStats.isActive ? '活跃' : '休眠'}
                    </span>
                  </div>
                  
                  <div className="director-stats">
                    <div className="stat-item">
                      <label>总干预次数:</label>
                      <span>{directorStats.totalInterventions}</span>
                    </div>
                    
                    {directorStats.activeCooldowns.length > 0 && (
                      <div className="cooldown-section">
                        <label>冷却中的干预类型:</label>
                        <div className="cooldown-list">
                          {directorStats.activeCooldowns.map(type => (
                            <span key={type} className="cooldown-item">
                              {translateInterventionType(type)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 自由模式特有信息 */}
          {currentMode === GameModeType.FREE && (
            <div className="detail-section free-mode-details">
              <h4>自由探索</h4>
              <div className="free-mode-stats">
                <div className="stat-item">
                  <label>创造的内容:</label>
                  <span>{modeState.stateVariables?.createdContent || 0} 项</span>
                </div>
                <div className="stat-item">
                  <label>探索的区域:</label>
                  <span>{modeState.stateVariables?.exploredAreas || 1} 个</span>
                </div>
                <div className="stat-item">
                  <label>创意评分:</label>
                  <span>{modeState.stateVariables?.creativityScore || 50}/100</span>
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="status-actions">
            {onModeSwitch && !modeState.isTransitioning && (
              <button 
                className="mode-switch-button"
                onClick={onModeSwitch}
              >
                切换模式
              </button>
            )}
            
            <button 
              className="save-button"
              onClick={() => {
                // 触发保存操作
                console.log('保存游戏状态');
              }}
            >
              保存游戏
            </button>
          </div>
        </div>
      )}

      {/* 模式切换提示 */}
      {modeState.isTransitioning && (
        <div className="transition-overlay">
          <div className="transition-content">
            <div className="spinner" />
            <span>正在切换游戏模式...</span>
          </div>
        </div>
      )}
    </div>
  );
};

// 辅助方法：翻译干预类型
function translateInterventionType(type: string): string {
  const translations: Record<string, string> = {
    'event_generation': '事件生成',
    'dialogue_guidance': '对话引导',
    'information_interference': '信息干预',
    'environment_control': '环境控制'
  };
  return translations[type] || type;
}

export default GameModeStatus;