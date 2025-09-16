# 游戏模式系统设计

## 概述

本设计定义了一个包含两种主要游戏模式的系统：**自由模式**和**剧本模式**。系统核心在于保证用户选择的无限自由性，同时通过智能导演系统在剧本模式中引导玩家体验完整的故事线。

## 架构设计

### 游戏模式枚举定义

```mermaid
graph TD
    A[GameMode] --> B[FreeMode 自由模式]
    A --> C[ScriptMode 剧本模式]
    
    B --> D[无剧情约束]
    B --> E[自主创建角色]
    B --> F[自由探索世界]
    
    C --> G[剧情大纲引导]
    C --> H[导演智能干预]
    C --> I[故事线收束]
```

### 系统组件关系

```mermaid
graph TB
    GM[GameModeManager] --> FME[FreeModeEngine]
    GM --> SME[ScriptModeEngine]
    
    SME --> DE[DirectorEngine 导演引擎]
    SME --> SPS[StoryProgressionService 剧情进展服务]
    SME --> SOS[StoryOutlineService 剧情大纲服务]
    
    DE --> IDS[InterventionDecisionService 干预决策服务]
    DE --> EGS[EventGenerationService 事件生成服务]
    DE --> DGS[DialogueGuidanceService 话术引导服务]
    DE --> IIS[InformationInterferenceService 信息干扰服务]
    
    FME --> WM[WorldManager 世界管理器]
    FME --> CM[CharacterManager 角色管理器]
    
    SME --> WM
    SME --> CM
```

## 数据模型

### 游戏模式配置

| 字段 | 类型 | 描述 |
|------|------|------|
| mode | GameModeType | 游戏模式类型 |
| sessionId | string | 会话标识 |
| worldSeed | string | 世界生成种子 |
| playerPreferences | PlayerPreferences | 玩家偏好设置 |
| modeSpecificConfig | ModeConfig | 模式特定配置 |

### 自由模式配置

| 字段 | 类型 | 描述 |
|------|------|------|
| worldGenerationType | string | 世界生成类型 |
| characterCreationEnabled | boolean | 是否允许创建角色 |
| locationAccessLevel | string | 位置访问权限级别 |
| eventRandomness | number | 随机事件频率 |

### 剧本模式配置

| 字段 | 类型 | 描述 |
|------|------|------|
| storyOutlineId | string | 剧情大纲ID |
| directorInterventionLevel | number | 导演干预程度(0-100) |
| storyDeviationTolerance | number | 剧情偏离容忍度(0-100) |
| targetStoryLength | number | 目标故事长度 |
| keyPlotPoints | PlotPoint[] | 关键剧情节点 |

### 剧情大纲结构

| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 大纲唯一标识 |
| title | string | 故事标题 |
| genre | string | 故事类型 |
| acts | StoryAct[] | 故事章节 |
| characters | StoryCharacter[] | 剧本角色 |
| locations | StoryLocation[] | 剧本地点 |
| themes | string[] | 故事主题 |

### 导演干预类型

```mermaid
graph TD
    A[导演干预类型] --> B[事件生成]
    A --> C[话术引导]
    A --> D[信息干扰]
    A --> E[环境操控]
    
    B --> B1[突发事件]
    B --> B2[角色介入]
    B --> B3[情节转折]
    
    C --> C1[NPC引导对话]
    C --> C2[选项暗示]
    C --> C3[情感引导]
    
    D --> D1[选择性信息披露]
    D --> D2[注意力转移]
    D --> D3[假信息干扰]
    
    E --> E1[天气变化]
    E --> E2[场景调整]
    E --> E3[道具出现]
```

## 核心功能设计

### 1. 游戏模式管理器

```typescript
interface GameModeManager {
  // 模式切换
  switchMode(newMode: GameModeType, config: ModeConfig): Promise<void>
  
  // 获取当前模式
  getCurrentMode(): GameModeType
  
  // 验证模式配置
  validateModeConfig(config: ModeConfig): boolean
  
  // 获取模式状态
  getModeState(): GameModeState
}
```

### 2. 自由模式引擎

#### 特性
- **无剧情约束**：不设定固定剧情线，允许玩家完全自由发挥
- **动态世界生成**：根据玩家行为动态生成新的地点和角色
- **开放式创作**：支持玩家创建自定义角色和场景
- **随机事件系统**：基于玩家行为和环境生成随机事件

#### 核心机制
```mermaid
sequenceDiagram
    participant Player as 玩家
    participant FME as 自由模式引擎
    participant WM as 世界管理器
    participant CM as 角色管理器
    
    Player->>FME: 发起行动
    FME->>WM: 检查世界状态
    FME->>CM: 检查角色状态
    FME->>FME: 生成响应
    FME->>Player: 返回结果
    
    Note over FME: 无剧情约束检查
    Note over FME: 完全自由响应
```

### 3. 剧本模式引擎

#### 特性
- **剧情大纲引导**：根据预设的故事大纲推进剧情
- **智能导演系统**：监控玩家选择并进行适当干预
- **偏离检测**：实时检测玩家行为是否偏离剧情主线
- **无感干预**：通过自然的方式引导玩家回到预设轨道

#### 核心流程
```mermaid
sequenceDiagram
    participant Player as 玩家
    participant SME as 剧本模式引擎
    participant DE as 导演引擎
    participant SO as 剧情大纲
    participant IDS as 干预决策服务
    
    Player->>SME: 发起行动
    SME->>SO: 检查剧情状态
    SME->>DE: 计算偏离程度
    
    alt 偏离程度低
        DE->>SME: 正常推进
        SME->>Player: 标准响应
    else 偏离程度中等
        DE->>IDS: 请求干预方案
        IDS->>DE: 返回引导策略
        DE->>SME: 应用引导
        SME->>Player: 引导性响应
    else 偏离程度高
        DE->>IDS: 请求强干预
        IDS->>DE: 返回纠正策略
        DE->>SME: 应用强制引导
        SME->>Player: 事件干预响应
    end
```

### 4. 导演引擎详细设计

#### 偏离度计算算法
```mermaid
graph TD
    A[玩家行动] --> B[提取行动意图]
    B --> C[对比剧情大纲]
    C --> D[计算偏离度]
    
    D --> E{偏离度 < 30%}
    D --> F{30% ≤ 偏离度 < 70%}
    D --> G{偏离度 ≥ 70%}
    
    E --> H[无需干预]
    F --> I[温和引导]
    G --> J[积极干预]
    
    I --> K[话术引导]
    I --> L[信息暗示]
    
    J --> M[事件生成]
    J --> N[角色介入]
    J --> O[环境变化]
```

#### 干预策略矩阵

| 偏离程度 | 干预类型 | 干预强度 | 实施方式 |
|----------|----------|----------|----------|
| 0-30% | 无干预 | 0% | 自然推进 |
| 30-50% | 信息引导 | 25% | 对话暗示、选项调整 |
| 50-70% | 事件引导 | 50% | 生成相关事件、NPC介入 |
| 70-85% | 强制引导 | 75% | 环境限制、强制事件 |
| 85-100% | 紧急纠正 | 100% | 剧情重置、直接干预 |

### 5. 干预技术实现

#### 事件生成服务
- **突发事件**：创建与剧情相关的紧急情况
- **角色介入**：让关键NPC出现并引导对话
- **环境事件**：通过环境变化影响玩家决策

#### 话术引导服务
- **选项优化**：调整选择项的表述和顺序
- **情感引导**：通过NPC情感表达影响玩家
- **信息披露**：选择性提供关键信息

#### 信息干扰服务
- **注意力转移**：通过其他事件分散注意力
- **假信息注入**：提供误导性信息引导回归
- **信息缺失**：暂时隐藏某些关键信息

## 状态管理

### 游戏模式状态

```mermaid
stateDiagram-v2
    [*] --> ModeSelection
    ModeSelection --> FreeMode
    ModeSelection --> ScriptMode
    
    FreeMode --> WorldGeneration
    FreeMode --> CharacterCreation
    FreeMode --> FreeExploration
    
    ScriptMode --> StoryInitialization
    ScriptMode --> PlotProgression
    ScriptMode --> DirectorMonitoring
    
    FreeExploration --> [*]
    DirectorMonitoring --> PlotProgression
    PlotProgression --> StoryCompletion
    StoryCompletion --> [*]
```

### 剧情进展跟踪

| 字段 | 类型 | 描述 |
|------|------|------|
| currentAct | number | 当前章节 |
| completedPlotPoints | string[] | 已完成的剧情点 |
| activeQuests | Quest[] | 活跃任务 |
| storyFlags | Record<string, boolean> | 故事标记 |
| deviationHistory | DeviationRecord[] | 偏离历史记录 |
| interventionHistory | InterventionRecord[] | 干预历史记录 |

## 用户交互设计

### 模式选择界面

```mermaid
graph TD
    A[游戏开始] --> B[模式选择]
    B --> C[自由模式]
    B --> D[剧本模式]
    
    C --> E[世界类型选择]
    C --> F[角色创建设置]
    C --> G[开始自由游戏]
    
    D --> H[剧本选择]
    D --> I[导演设置]
    D --> J[开始剧本游戏]
    
    H --> H1[奇幻冒险]
    H --> H2[科幻探索]
    H --> H3[现代悬疑]
    H --> H4[历史传奇]
    
    I --> I1[干预程度调节]
    I --> I2[偏离容忍度]
    I --> I3[故事长度设置]
```

### 实时状态显示

#### 自由模式界面元素
- 当前位置信息
- 角色状态面板
- 世界探索进度
- 随机事件提示

#### 剧本模式界面元素
- 故事进度条
- 当前章节信息
- 剧情偏离指示器（仅调试模式显示）
- 关键选择提示

## 测试策略

### 自由模式测试

#### 功能测试
- 世界生成完整性测试
- 角色创建功能测试
- 位置连接正确性测试
- 随机事件触发测试

#### 性能测试
- 大型世界渲染性能
- 大量角色管理性能
- 长时间游戏稳定性

### 剧本模式测试

#### 故事完整性测试
- 剧情大纲执行完整性
- 关键剧情点触发准确性
- 结局达成条件验证

#### 导演系统测试
- 偏离度计算准确性
- 干预决策合理性
- 引导效果评估

#### 边界情况测试
- 极端偏离行为处理
- 系统性能极限测试
- 异常输入处理

### 集成测试场景

```mermaid
graph TD
    A[测试开始] --> B[模式切换测试]
    B --> C[跨模式数据一致性]
    C --> D[性能基准测试]
    D --> E[用户体验测试]
    E --> F[AI响应质量测试]
    F --> G[测试报告生成]
```

## 性能优化

### 内存管理
- 世界数据分块加载
- 角色状态缓存优化
- 剧情大纲预加载

### 计算优化
- 偏离度计算缓存
- LLM请求批处理
- 事件生成异步处理

### 响应时间优化
- 预测性内容生成
- 智能缓存策略
- 渐进式内容加载