# 🎮 AI角色驱动开放世界游戏 - 快速启动指南

## 📋 系统概述

这是一个基于大型语言模型(LLM)的AI角色驱动开放世界叙事游戏系统。通过领域驱动设计(DDD)架构，系统整合了游戏引擎、AI角色系统、动态世界环境和多用户支持，为玩家提供沉浸式的交互式叙事体验。

### 🌟 主要特性

- **🤖 智能AI角色**: 每个NPC都具有独特的个性、记忆和情感系统
- **🌍 动态开放世界**: 环境会根据玩家行动和时间变化
- **💬 自然语言交互**: 支持自由文本输入和对话
- **🔄 实时多用户**: WebSocket支持多玩家同时在线
- **🧠 多LLM支持**: 支持OpenAI、Anthropic、Gemini等多种AI提供商
- **📊 完整状态管理**: 持久化角色关系、记忆和故事进展

## 🚀 快速启动

### 方式一：一键启动（推荐）

```bash
# 克隆或进入项目目录
cd AI-character-driven-open-world-game

# 安装依赖
npm install

# 配置环境变量（复制并编辑）
cp .env.example .env

# 一键启动游戏系统
npm run game
```

### 方式二：分步启动

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置API密钥和数据库

# 3. 初始化数据库（可选）
npm run init:db

# 4. 启动游戏服务器
npm run dev:server

# 5. 在另一个终端运行示例
npm run dev:example
```

### 方式三：Web界面启动

```bash
# 启动游戏服务器
npm run dev:server

# 打开浏览器访问 web-interface.html 文件
# 或者在浏览器中打开：file:///path/to/project/web-interface.html
```

## ⚙️ 环境配置

### 必需配置

创建 `.env` 文件并配置以下内容：

```bash
# LLM服务配置（至少配置一个）
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# 默认LLM提供商
DEFAULT_LLM_PROVIDER=OPENAI
```

### 可选配置

```bash
# 数据库配置（使用真实数据库）
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=ai_narrative_game
DATABASE_USER=app_user
DATABASE_PASSWORD=app_password

# Redis缓存（可选）
REDIS_HOST=localhost
REDIS_PORT=6379

# 游戏服务器配置
GAME_SERVER_PORT=8080
WEBSOCKET_URL=ws://localhost:8080
```

## 📂 项目结构

```
AI-character-driven-open-world-game/
├── src/
│   ├── domains/           # 领域层（DDD架构）
│   │   ├── character/     # 角色域
│   │   ├── world/         # 世界域
│   │   ├── input/         # 输入域
│   │   └── operations/    # 运维域
│   ├── engine/            # 游戏引擎
│   ├── services/          # 服务层
│   ├── client/            # 游戏客户端
│   ├── server/            # 游戏服务器
│   ├── ui/                # 用户界面
│   └── examples/          # 示例代码
├── database/              # 数据库脚本
├── scripts/               # 工具脚本
├── web-interface.html     # Web游戏界面
├── game-launcher.ts       # 游戏启动器
└── test-system.ts         # 系统测试
```

## 🎯 使用方式

### 1. 命令行模式

```bash
# 运行完整游戏流程示例
npm run dev:example

# 运行系统测试
ts-node test-system.ts
```

### 2. Web界面模式

1. 启动游戏服务器：`npm run dev:server`
2. 在浏览器中打开 `web-interface.html`
3. 点击"连接"按钮连接到游戏服务器
4. 开始你的AI驱动冒险！

### 3. 编程接口模式

```typescript
import { Orchestrator } from './src/Orchestrator';
import { GameClient } from './src/client/GameClient';

// 创建游戏协调器
const orchestrator = new Orchestrator();
await orchestrator.initializeGame();

// 创建游戏会话
const session = await orchestrator.createSession('player1');

// 处理玩家输入
const result = await orchestrator.runOnce(
  '你好，我是新来的冒险者',
  session.id,
  'player1'
);

console.log(result.coordinationResult?.responses.narrative);
```

## 🧪 系统测试

运行完整的系统测试来验证所有组件：

```bash
# 运行系统集成测试
ts-node test-system.ts

# 或使用npm脚本
npm run test:system
```

测试包括：
- ✅ 系统初始化测试
- ✅ LLM服务连接测试
- ✅ 数据库连接测试
- ✅ 游戏会话管理测试
- ✅ 域协调器功能测试
- ✅ WebSocket通信测试
- ✅ 客户端连接测试
- ✅ 完整游戏流程测试

## 🎮 游戏玩法

### 基本操作

1. **自由对话**: 直接输入你想说的话与NPC对话
2. **动作指令**: 描述你想执行的动作（如"观察周围"、"前往图书馆"）
3. **快捷操作**: 使用界面提供的快捷按钮
4. **环境探索**: 游戏世界会动态响应你的行动

### 游戏特色

- **智能NPC**: 每个角色都有独特的个性和记忆
- **持续记忆**: 角色会记住之前的对话和互动
- **动态故事**: 故事情节根据你的选择发展
- **开放世界**: 自由探索不同地点和场景

## 🔧 故障排除

### 常见问题

**Q: 游戏服务器启动失败**
```bash
# 检查端口是否被占用
netstat -an | grep 8080

# 更改端口（在.env中）
GAME_SERVER_PORT=8081
```

**Q: LLM服务连接失败**
```bash
# 检查API密钥配置
echo $OPENAI_API_KEY

# 测试网络连接
curl -H \"Authorization: Bearer $OPENAI_API_KEY\" https://api.openai.com/v1/models
```

**Q: 数据库连接问题**
```bash
# 启动PostgreSQL（如果需要）
# Windows: net start postgresql
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql

# 或使用模拟模式（无需数据库）
# 删除.env中的DATABASE_*配置项
```

**Q: Web界面无法连接**
- 确保游戏服务器正在运行
- 检查浏览器控制台是否有错误
- 验证WebSocket URL配置

### 调试模式

```bash
# 启用详细日志
DEBUG_MODE=true npm run dev:server

# 查看系统状态
ts-node test-system.ts
```

## 📚 API参考

### 核心类

- **`Orchestrator`**: 游戏系统的主要协调器
- **`GameClient`**: 游戏客户端类
- **`DomainCoordinator`**: 领域间协调管理
- **`LLMService`**: LLM服务接口

### 主要方法

```typescript
// 初始化游戏
await orchestrator.initializeGame();

// 创建会话
const session = await orchestrator.createSession(playerId);

// 处理玩家输入
const result = await orchestrator.runOnce(input, sessionId, playerId);

// 获取系统状态
const status = await orchestrator.getSystemStatus();
```

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 🆘 获取帮助

- 📧 邮件支持: [your-email@example.com]
- 🐛 问题报告: [GitHub Issues]
- 📖 详细文档: [Documentation Link]
- 💬 社区讨论: [Discord/Forum Link]

---

**享受你的AI驱动冒险之旅！** 🎮✨

---

*最后更新: 2024年*