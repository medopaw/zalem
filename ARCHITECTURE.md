# 项目架构文档

## 1. 项目概述

这是一个基于React、TypeScript和Supabase构建的任务管理应用，具有聊天界面和报表功能。应用使用DeepSeek AI进行自然语言交互，帮助用户管理任务。

## 2. 技术栈

- **前端框架**：React 18 + TypeScript
- **构建工具**：Vite
- **样式**：Tailwind CSS
- **状态管理**：React Context + React Query
- **路由**：React Router
- **后端服务**：Supabase (PostgreSQL + 认证 + 存储)
- **AI服务**：DeepSeek API (通过OpenAI兼容接口)
- **测试**：Vitest

## 3. 项目结构

项目采用以下目录结构组织代码：

```
src/
├── components/       # 可复用UI组件
├── constants/        # 常量定义
├── contexts/         # React Context定义
├── hooks/            # 自定义React Hooks
├── lib/              # 第三方库配置
├── pages/            # 页面组件
├── repositories/     # 数据访问层
├── services/         # 业务逻辑服务
│   ├── ai/           # AI相关服务
│   ├── chat/         # 聊天相关服务
│   └── messageHandlers/ # 消息处理器
├── types/            # TypeScript类型定义
└── utils/            # 工具函数
```

## 4. 核心模块

### 4.1 认证模块

认证模块使用Supabase Auth服务，通过`AuthContext`提供全局认证状态和方法。

**主要文件**：
- `src/contexts/AuthContext.tsx` - 提供认证状态和方法
- `src/components/ProtectedRoute.tsx` - 路由保护组件
- `src/components/AdminRoute.tsx` - 管理员路由保护组件
- `src/pages/Login.tsx` - 登录/注册页面

### 4.2 聊天模块

聊天模块处理用户与AI助手的对话，包括消息的发送、接收和处理。

**主要文件**：
- `src/services/ai/AIService.ts` - 与AI服务通信的核心实现
- `src/services/ChatService.ts` - AIService的兼容层
- `src/services/chat/ChatManager.ts` - 管理聊天会话
- `src/services/MessageParser.ts` - 解析AI响应
- `src/services/messageHandlers/` - 消息处理器目录，包含各种专用处理器
- `src/repositories/SupabaseMessageRepository.ts` - 消息数据访问
- `src/repositories/SupabaseThreadRepository.ts` - 会话数据访问
- `src/pages/Chat.tsx` - 聊天界面
- `src/components/MessageList.tsx` - 消息列表组件
- `src/components/ThreadList.tsx` - 会话列表组件

### 4.3 任务管理模块

任务管理模块处理用户任务的创建、更新和查询。

**主要文件**：
- `src/services/messageHandlers/TaskHandler.ts` - 处理任务相关消息和操作

### 4.4 报表模块

报表模块提供任务和工作量的可视化展示。

**主要文件**：
- `src/pages/Reports.tsx` - 报表页面

## 5. 数据流

### 5.1 聊天数据流

1. 用户在聊天界面输入消息
2. 消息通过`ChatManager`发送到AI服务(`AIService`)
3. AI响应由`MessageParser`解析
4. 解析后的消息通过各种`MessageHandler`(如`TextHandler`、`TaskHandler`等)处理特定操作
5. 处理结果通过`MessageRepository`保存到Supabase并更新UI

### 5.2 任务数据流

1. 用户通过聊天界面描述任务
2. AI助手通过`TaskHandler`创建或更新任务
3. 任务数据保存到Supabase
4. 任务列表和报表更新以反映变化

## 6. 依赖注入模式

项目使用简单的依赖注入模式，通过构造函数参数传递依赖：

```typescript
class ChatManager {
  constructor(
    userId: string,
    threadId: string,
    messageRepo?: IMessageRepository,
    threadRepo?: IThreadRepository
  ) {
    this.userId = userId;
    this.threadId = threadId;
    this.messageParser = new MessageParser();
    this.messageRepository = messageRepo || new SupabaseMessageRepository(supabase);
    this.threadRepository = threadRepo || new SupabaseThreadRepository(supabase);
  }
}
```

这种模式使得组件更容易测试和维护，因为依赖可以被模拟。同时，通过可选参数和默认实现，保持了使用便利性。

## 7. 测试策略

项目使用Vitest进行单元测试，主要测试以下内容：

- 服务层逻辑
- 数据访问层
- 工具函数

UI组件测试计划在未来添加。

## 8. 未来改进

- 实现更完善的错误处理机制
- 添加更多单元测试和集成测试
- 优化性能，特别是大量消息的加载
- 改进UI/UX设计
- 添加更多报表类型
- 完全移除兼容层，使用新的模块化架构
