# 消息处理系统设计文档

## 1. 概述

本文档描述了聊天应用中消息处理系统的设计和实现。系统采用事件驱动架构，将消息发送、工具调用处理和界面更新解耦，使代码更加模块化和可维护。

## 2. 核心组件

### 2.1 消息事件总线 (MessageEventBus)

消息事件总线是系统的核心，负责消息事件的发布和订阅，使各组件之间能够松散耦合。

```typescript
interface IMessageEventBus {
  publish(event: MessageEvent): void;
  subscribe(eventType: MessageEventType, listener: MessageEventListener): () => void;
  subscribeAll(listener: MessageEventListener): () => void;
}
```

### 2.2 消息服务 (MessageService)

消息服务负责消息的发送、接收和处理，是系统的主要业务逻辑层。

```typescript
interface IMessageService {
  sendUserMessage(content: string, threadId: string, userId: string): Promise<string>;
  sendToolResult(toolResult: ToolResultData, threadId: string, userId: string): Promise<string>;
  getMessages(threadId: string, options?: { includeHidden?: boolean; forLLM?: boolean; }): Promise<DatabaseMessage[]>;
}
```

### 2.3 工具调用处理器 (ToolCallProcessor)

工具调用处理器负责处理特定类型的工具调用，如设置昵称、数据请求等。

```typescript
interface IToolCallProcessor {
  processToolCall(toolCall: ToolCallData, threadId: string, userId: string): Promise<ToolResultData>;
  canProcess(toolName: string): boolean;
}
```

### 2.4 工具调用处理器注册表 (ToolCallProcessorRegistry)

工具调用处理器注册表负责管理和查找工具调用处理器。

```typescript
interface IToolCallProcessorRegistry {
  registerProcessor(processor: IToolCallProcessor): void;
  getProcessor(toolName: string): IToolCallProcessor | undefined;
  getAllProcessors(): IToolCallProcessor[];
}
```

### 2.5 存储库接口 (Repository Interfaces)

系统使用存储库模式访问数据，而不是直接使用 Supabase。

```typescript
interface IMessageRepository {
  getMessages(threadId: string, options?: { includeHidden?: boolean; forLLM?: boolean; }): Promise<{ messages: DatabaseMessage[], error: string | null }>;
  saveMessage(content: string | object, role: MessageRole, userId: string, threadId: string, options?: { isVisible?: boolean; sendToLLM?: boolean; toolCallId?: string; sequence?: number; metadata?: Record<string, unknown>; }): Promise<DatabaseMessage>;
  // ...
}

interface IUserRepository {
  getUserInfo(userId: string): Promise<UserInfo | null>;
  updateNickname(userId: string, nickname: string | null): Promise<void>;
  // ...
}
```

## 3. 消息流程

### 3.1 用户发送消息

1. 用户点击发送按钮，调用 `MessageService.sendUserMessage`
2. 保存用户消息到数据库
3. 发布 `USER_MESSAGE_SENT` 事件
4. 获取消息历史
5. 发送消息历史给大模型
6. 处理大模型响应

### 3.2 处理大模型响应

1. 保存大模型的文本响应（如果有）
2. 发布 `ASSISTANT_MESSAGE_RECEIVED` 事件
3. 如果有工具调用：
   - 保存工具调用消息
   - 发布 `TOOL_CALL_RECEIVED` 事件
   - 查找并执行相应的工具处理器

### 3.3 处理工具调用

1. 工具处理器执行工具调用
2. 调用 `MessageService.sendToolResult` 发送工具调用结果
3. 保存工具调用结果消息
4. 发布 `TOOL_RESULT_SENT` 事件
5. 获取更新后的消息历史
6. 发送更新后的消息历史给大模型
7. 处理大模型的后续响应

### 3.4 更新界面

1. 组件订阅相关事件
2. 当事件发生时，更新组件状态
3. 界面根据状态变化重新渲染

## 4. 消息类型

系统使用三种主要的消息结构：

### 4.1 数据库消息 (DatabaseMessage)

存储在数据库中的消息结构，包含所有必要的元数据。

```typescript
interface DatabaseMessage {
  id: string;
  content: string;
  role: MessageRole;
  created_at: string;
  user_id: string;
  thread_id: string;
  is_visible: boolean;
  send_to_llm: boolean;
  tool_call_id?: string;
  sequence?: number;
  metadata?: Record<string, unknown>;
}
```

### 4.2 显示消息 (DisplayMessage)

用于在界面上显示的消息结构，包含渲染所需的信息。

```typescript
interface DisplayMessage {
  id: string;
  content: MessageContent;
  role: MessageRole;
  created_at: string;
  user_id: string;
  metadata?: Record<string, unknown>;
}
```

### 4.3 LLM历史消息 (LLMHistoryMessage)

发送给大模型的消息结构，符合大模型API的要求。

```typescript
interface LLMHistoryMessage {
  role: MessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
```

## 5. 工具调用结果处理

工具调用结果消息必须符合大模型API的要求，包含以下字段：

```typescript
{
  role: 'tool',
  tool_call_id: '工具调用ID',
  content: '工具调用结果'
}
```

系统确保：

1. 工具调用结果消息使用 `tool` 角色
2. 工具调用结果消息设置了正确的 `tool_call_id` 字段
3. 工具调用结果消息的 `send_to_llm` 设置为 `true`，确保它们会被发送给大模型

## 6. 优势

1. **分离关注点**：消息发送、工具调用处理和界面更新逻辑分离
2. **事件驱动**：使用事件总线解耦各组件
3. **模块化**：每个组件只负责单一职责
4. **可扩展**：易于添加新的工具处理器
5. **可测试**：组件之间松散耦合，易于单元测试
6. **存储库模式**：使用接口访问数据，而不是直接使用 Supabase

## 7. 未来改进

1. **状态管理**：考虑使用状态管理库（如Redux）或React Context
2. **错误处理**：改进错误处理和恢复机制
3. **消息队列**：考虑使用消息队列处理异步操作
4. **缓存**：实现消息缓存，减少数据库访问
5. **性能优化**：优化消息历史获取和处理
