# AI角色驱动开放世界游戏 - 用户界面设计

## 概述
本设计文档描述了AI角色驱动开放世界游戏的用户界面设计方案。界面将采用现代化的Web技术构建，提供直观、沉浸式的游戏体验。

## 技术选型
- 前端框架：React + TypeScript
- UI库：Material-UI (用于基础组件)
- 状态管理：Redux Toolkit
- 实时通信：WebSocket
- 构建工具：Vite
- 样式：CSS Modules + Sass

## 整体布局设计

### 主界面结构
```
+---------------------------------------------------+
| 顶部导航栏                                        |
| [游戏标题] [角色选择] [设置] [帮助] [退出]        |
+-------------------+-------------------------------+
| 左侧面板          | 主内容区域                    |
|                   |                               |
| 角色信息          | 场景描述                      |
| - 角色头像        |                               |
| - 角色名称        | [场景图像/插图]               |
| - 情绪状态        |                               |
| - 关系状态        | [场景描述文本]                |
|                   |                               |
|                   | [玩家输入区域]                |
|                   |                               |
|                   | [角色回应区域]                |
|                   |                               |
|                   | [操作选项区域]                |
+-------------------+-------------------------------+
| 底部状态栏                                        |
| [游戏状态] [时间] [位置] [提示信息]               |
+---------------------------------------------------+
```

## 组件设计

### 1. 顶部导航栏 (Top Navigation)
**功能：**
- 显示游戏标题
- 提供角色选择、设置、帮助和退出功能

**组件结构：**
```tsx
interface TopNavigationProps {
  gameTitle: string;
  onCharacterSelect: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onExit: () => void;
}

const TopNavigation: React.FC<TopNavigationProps> = ({
  gameTitle,
  onCharacterSelect,
  onSettings,
  onHelp,
  onExit
}) => {
  // 实现细节
}
```

### 2. 左侧面板 (Left Sidebar)
**功能：**
- 显示当前交互角色的信息
- 展示角色的情绪状态和关系状态

**组件结构：**
```tsx
interface CharacterInfoPanelProps {
  character: {
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
  };
}

const CharacterInfoPanel: React.FC<CharacterInfoPanelProps> = ({ character }) => {
  // 实现细节
}
```

### 3. 主内容区域 (Main Content Area)
**功能：**
- 显示当前场景的描述和图像
- 展示玩家输入区域
- 显示角色回应
- 提供操作选项

#### 3.1 场景描述组件 (SceneDisplay)
```tsx
interface SceneDisplayProps {
  scene: {
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
  };
}

const SceneDisplay: React.FC<SceneDisplayProps> = ({ scene }) => {
  // 实现细节
}
```

#### 3.2 玩家输入组件 (PlayerInput)
```tsx
interface PlayerInputProps {
  onSubmit: (input: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const PlayerInput: React.FC<PlayerInputProps> = ({ 
  onSubmit, 
  placeholder = "输入你的行动或对话...", 
  disabled = false 
}) => {
  // 实现细节
}
```

#### 3.3 角色回应组件 (CharacterResponse)
```tsx
interface CharacterResponseProps {
  responses: Array<{
    characterId: string;
    characterName: string;
    content: string;
    type: 'dialogue' | 'action' | 'narration';
    timestamp: Date;
  }>;
}

const CharacterResponse: React.FC<CharacterResponseProps> = ({ responses }) => {
  // 实现细节
}
```

#### 3.4 操作选项组件 (ActionOptions)
```tsx
interface ActionOption {
  id: string;
  label: string;
  type: 'movement' | 'interaction' | 'dialogue' | 'custom';
  action: () => void;
}

interface ActionOptionsProps {
  options: ActionOption[];
  onOptionSelect: (option: ActionOption) => void;
}

const ActionOptions: React.FC<ActionOptionsProps> = ({ options, onOptionSelect }) => {
  // 实现细节
}
```

### 4. 底部状态栏 (Bottom Status Bar)
**功能：**
- 显示游戏状态信息
- 显示当前时间、位置等信息

**组件结构：**
```tsx
interface StatusBarProps {
  gameState: {
    status: 'playing' | 'paused' | 'ended';
    currentTime: string;
    currentLocation: string;
    hints: string[];
  };
}

const StatusBar: React.FC<StatusBarProps> = ({ gameState }) => {
  // 实现细节
}
```

## 交互设计

### 1. 对话交互流程
1. 玩家在[PlayerInput]组件中输入对话或行动
2. 系统将输入发送到后端进行处理
3. 后端AI角色生成回应
4. 回应通过WebSocket实时推送到前端
5. [CharacterResponse]组件显示角色回应
6. 根据回应内容，[ActionOptions]组件更新可用操作选项

### 2. 场景切换流程
1. 玩家选择移动到新场景
2. 系统请求新场景数据
3. [SceneDisplay]组件更新显示新场景
4. 左侧面板更新显示新场景中的角色
5. 底部状态栏更新位置信息

### 3. 角色状态更新流程
1. 角色情绪或关系状态发生变化
2. 通过WebSocket推送状态更新
3. [CharacterInfoPanel]组件实时更新显示

## 视觉设计

### 颜色方案
- 主色调：深蓝色 (#1a237e) - 营造神秘感
- 辅助色：紫色 (#5e35b1) - 增强奇幻氛围
- 强调色：金色 (#ffb300) - 突出重要元素
- 背景色：深灰色 (#263238) - 减少视觉干扰
- 文字色：浅灰色 (#eceff1) - 提高可读性

### 字体选择
- 标题字体：'Roboto Slab' - 增强叙事感
- 正文字体：'Roboto' - 提高可读性
- 等宽字体：'Roboto Mono' - 用于代码或特殊信息

### 布局规范
- 响应式设计，支持桌面和移动设备
- 左侧面板宽度：300px (最小250px)
- 主内容区域：自适应剩余空间
- 顶部导航栏高度：60px
- 底部状态栏高度：40px

## 动画和过渡效果

### 1. 页面切换动画
- 使用淡入淡出效果切换场景
- 持续时间：300ms

### 2. 对话显示动画
- 文字逐字显示效果，模拟打字机
- 速度：每字符50ms

### 3. 状态更新动画
- 情绪状态变化使用颜色渐变
- 关系等级变化使用进度条动画

## 响应式设计

### 桌面端 (≥1024px)
- 完整三栏布局
- 大尺寸图像和文字
- 鼠标悬停效果

### 平板端 (768px - 1023px)
- 左侧面板可折叠
- 适中尺寸图像和文字
- 触摸友好的按钮尺寸

### 移动端 (<768px)
- 单栏布局
- 左侧面板信息整合到主内容区域
- 大尺寸触摸目标
- 简化操作选项

## 可访问性设计

### 1. 键盘导航
- 支持Tab键在组件间导航
- Enter键提交输入
- Escape键关闭模态框

### 2. 屏幕阅读器支持
- 为所有交互元素提供适当的文字标签
- 使用ARIA属性增强语义

### 3. 高对比度模式
- 提供高对比度主题选项
- 确保文字与背景有足够的对比度

## 性能优化

### 1. 组件懒加载
- 非关键组件使用动态导入
- 场景图像按需加载

### 2. 状态管理优化
- 使用React.memo优化组件重渲染
- 合理使用useCallback和useMemo

### 3. 网络优化
- WebSocket连接复用
- 消息压缩和批处理

## 国际化支持

### 1. 多语言支持
- 支持中英文切换
- 使用i18next管理翻译资源

### 2. 本地化适配
- 时间格式适配
- 文本方向适配（RTL/LTR）

## 安全考虑

### 1. 输入验证
- 前端输入长度和格式验证
- XSS防护

### 2. 认证授权
- 用户会话管理
- 角色权限控制

## 测试策略

### 1. 单元测试
- 使用Jest和React Testing Library
- 覆盖核心组件和业务逻辑

### 2. 集成测试
- 测试组件间交互
- 测试API集成

### 3. 端到端测试
- 使用Cypress进行E2E测试
- 覆盖主要用户流程

## 部署和维护

### 1. 构建配置
- 使用Vite进行快速构建
- 支持开发、测试、生产环境

### 2. 监控和日志
- 前端错误监控
- 用户行为分析

### 3. 更新策略
- 支持热更新
- 版本管理和回滚机制