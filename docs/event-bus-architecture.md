# 事件总线架构设计

## 1. 概述

事件总线是一种软件架构模式，它允许不同的组件通过发布和订阅事件来进行通信，而不需要直接依赖彼此。在我们的聊天应用中，事件总线用于处理消息流转、工具调用和结果处理等复杂交互。

## 2. 核心组件

### 2.1 事件总线 (MessageEventBus)

事件总线是整个架构的核心，负责事件的发布和订阅。

```typescript
// 事件总线接口
interface IMessageEventBus {
  publish(event: MessageEvent): void;
  subscribe(eventType: MessageEventType, handler: MessageEventHandler): void;
  unsubscribe(eventType: MessageEventType, handler: MessageEventHandler): void;
}

// 事件总线实现
class MessageEventBus implements IMessageEventBus {
  private handlers = new Map<MessageEventType, Set<MessageEventHandler>>();

  publish(event: MessageEvent): void {
    const eventHandlers = this.handlers.get(event.type);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        handler(event);
      }
    }
  }

  subscribe(eventType: MessageEventType, handler: MessageEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  unsubscribe(eventType: MessageEventType, handler: MessageEventHandler): void {
    const eventHandlers = this.handlers.get(eventType);
    if (eventHandlers) {
      eventHandlers.delete(handler);
    }
  }
}
```

### 2.2 事件类型 (MessageEventType)

定义了系统中所有可能的事件类型。

```typescript
enum MessageEventType {
  USER_MESSAGE_SENT = 'user_message_sent',
  ASSISTANT_MESSAGE_RECEIVED = 'assistant_message_received',
  TOOL_CALL_RECEIVED = 'tool_call_received',
  TOOL_RESULT_SENT = 'tool_result_sent',
  MESSAGES_UPDATED = 'messages_updated',
  ERROR_OCCURRED = 'error_occurred'
}
```

### 2.3 事件处理器 (EventHandler)

事件处理器负责响应特定类型的事件，并执行相应的业务逻辑。

- `ToolCallEventHandler`: 处理工具调用事件
- `ToolResultEventHandler`: 处理工具调用结果事件

### 2.4 工具处理器注册表 (ToolCallProcessorRegistry)

工具处理器注册表负责管理所有工具处理器，并根据工具名称找到对应的处理器。

```typescript
interface IToolCallProcessorRegistry {
  registerProcessor(processor: IToolCallProcessor): void;
  getProcessor(toolName: string): IToolCallProcessor | undefined;
  getAllProcessors(): IToolCallProcessor[];
}
```

### 2.5 消息服务 (MessageService)

消息服务是应用程序与事件总线之间的接口，负责发送消息和处理响应。

```typescript
interface IMessageService {
  sendUserMessage(content: string, threadId: string, userId: string): Promise<string>;
  sendToolResult(toolResult: ToolResultData, threadId: string, userId: string): Promise<string>;
  getMessages(threadId: string, options?: { includeHidden?: boolean; forLLM?: boolean; }): Promise<DatabaseMessage[]>;
}
```

## 3. 消息流程

### 3.1 用户发送消息

1. 用户在界面上输入消息并点击发送
2. `MessageService.sendUserMessage` 方法被调用
3. 用户消息被保存到数据库
4. 发布 `USER_MESSAGE_SENT` 事件到事件总线
5. 获取消息历史
6. 发送消息历史给大模型
7. 处理大模型的响应

### 3.2 大模型响应处理

1. 在 `MessageService.handleAssistantResponse` 中处理响应
2. 如果响应包含文本内容，保存为助手消息并发布 `ASSISTANT_MESSAGE_RECEIVED` 事件
3. 如果响应包含工具调用，创建工具调用消息并保存到数据库
4. 对每个工具调用，发布 `TOOL_CALL_RECEIVED` 事件

### 3.3 工具调用处理

1. `ToolCallEventHandler` 订阅了 `TOOL_CALL_RECEIVED` 事件
2. 在 `handleToolCallEvent` 方法中处理工具调用
3. 从工具处理器注册表中获取对应的处理器
4. 处理器执行工具调用并返回结果
5. 发布 `TOOL_RESULT_SENT` 事件，包含工具调用结果

### 3.4 工具调用结果处理

1. `ToolResultEventHandler` 订阅了 `TOOL_RESULT_SENT` 事件
2. 在 `handleToolResultEvent` 方法中处理工具调用结果
3. 创建工具调用结果内容对象
4. 将对象转换为 JSON 字符串
5. 保存工具调用结果消息到数据库，使用 `tool` 角色和对应的 `tool_call_id`
6. 获取更新后的消息历史，包括工具调用结果
7. 发送更新后的消息历史给大模型，获取新的响应
8. 保存大模型的后续响应
9. 发布 `ASSISTANT_MESSAGE_RECEIVED` 事件

## 4. 消息显示流程

1. `useMessages` hook 从数据库加载消息
2. 使用 `getDisplayMessages` 方法将数据库消息转换为显示消息
3. 对每条消息调用 `toDisplayMessage` 函数进行转换
4. `MessageList` 组件接收显示消息并渲染
5. 对每条消息，`UnifiedMessageContent` 组件负责渲染
6. `UnifiedMessageContent` 使用 `messageTypeRegistry.render` 方法渲染消息内容
7. `messageTypeRegistry` 根据消息类型找到对应的处理器并渲染

## 5. 消息类型系统

### 5.1 数据库消息 (DatabaseMessage)

存储在数据库中的原始消息格式。

### 5.2 显示消息 (DisplayMessage)

用于在UI中显示的消息格式，包含已解析的消息内容。

### 5.3 LLM历史消息 (LLMHistoryMessage)

发送给大模型的消息格式，符合大模型API的要求。

### 5.4 消息内容类型

- `TextMessageContent`: 纯文本消息
- `ToolCallContent`: 单个工具调用消息
- `ToolCallsContent`: 多个工具调用消息
- `ToolResultContent`: 工具调用结果消息
- `DataRequestContent`: 数据请求消息
- `DataResponseContent`: 数据响应消息
- `ErrorMessageContent`: 错误消息

## 6. 消息类型注册表 (MessageTypeRegistry)

消息类型注册表负责管理所有消息类型的处理器，并根据消息类型找到对应的处理器进行渲染。

```typescript
class MessageTypeRegistry {
  private handlers = new Map<string, MessageHandler<MessageContent>>();

  register<T extends MessageContent>(type: string, handler: MessageHandler<T>): void {
    this.handlers.set(type, handler as unknown as MessageHandler<MessageContent>);
  }

  render(content: MessageContent, message?: DisplayMessage): ReactNode | DefaultTextMark {
    // 根据消息类型找到对应的处理器并渲染
    const handler = this.handlers.get(content.type);
    if (handler) {
      return handler.render(content, message);
    }
    // 处理找不到处理器的情况
  }
}
```

## 7. 初始化流程

1. 在应用启动时，`initializeMessageHandlers` 函数被调用
2. 注册所有消息类型的处理器
3. 初始化事件处理器
4. 注册所有工具处理器
