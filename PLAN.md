# 系统重构与改进计划

本文档详细列出了对聊天系统的长期改进计划，重点关注事件处理系统、消息处理流程和测试覆盖率的提升。

## 1. 事件处理系统重构

当前的事件处理系统基于单例模式和全局事件总线，存在初始化顺序依赖、错误处理不完善等问题。

### 1.1 引入依赖注入模式

- [ ] 创建`EventBusProvider`接口和实现类，替代当前的单例模式
- [ ] 修改`MessageEventBus`类，使其实现`IMessageEventBus`接口
- [ ] 在应用初始化时创建`MessageEventBus`实例，并通过依赖注入传递给需要的组件
- [ ] 移除所有对`getMessageEventBus()`的直接调用

```typescript
// 示例代码
interface IEventBusProvider {
  getEventBus(): IMessageEventBus;
}

class EventBusProvider implements IEventBusProvider {
  private eventBus: IMessageEventBus;

  constructor() {
    this.eventBus = new MessageEventBus();
  }

  getEventBus(): IMessageEventBus {
    return this.eventBus;
  }
}
```

### 1.2 简化事件处理器初始化流程

- [ ] 创建`EventHandlerRegistry`类，负责管理所有事件处理器
- [ ] 实现`registerHandler`和`getHandler`方法
- [ ] 在应用启动时一次性注册所有事件处理器
- [ ] 移除当前的动态导入和延迟初始化逻辑

```typescript
// 示例代码
class EventHandlerRegistry {
  private handlers: Map<string, any> = new Map();

  registerHandler(type: string, handler: any): void {
    this.handlers.set(type, handler);
  }

  getHandler(type: string): any {
    return this.handlers.get(type);
  }
}
```

### 1.3 增强错误处理和用户反馈

- [ ] 为每个事件处理器添加专门的错误处理逻辑
- [ ] 实现统一的错误报告机制，直接向用户展示错误信息
- [ ] 添加事件处理超时机制，避免处理器长时间阻塞
- [ ] 实现事件处理状态监控，记录错误类型和频率

```typescript
// 示例代码
class ErrorReportingEventHandler {
  private errorReporter: ErrorReporter;

  constructor(errorReporter: ErrorReporter) {
    this.errorReporter = errorReporter;
  }

  async handleEvent(event: MessageEvent): Promise<void> {
    try {
      // 尝试处理事件
      await this.processEvent(event);
    } catch (error) {
      // 记录错误日志
      console.error(`[EventHandler] Error handling event ${event.type}:`, error);

      // 向用户报告错误
      this.errorReporter.reportToUI({
        title: '操作失败',
        message: `处理${this.getEventName(event.type)}时出错: ${error.message}`,
        level: 'error',
        details: error.stack,
        actionType: event.type
      });

      // 直接抛出错误，不进行重试
      throw error;
    }
  }

  private async processEvent(event: MessageEvent): Promise<void> {
    // 具体的事件处理逻辑
  }

  private getEventName(eventType: string): string {
    // 将事件类型转换为用户友好的名称
    const eventNames = {
      'tool_result_sent': '工具调用结果',
      'user_message_sent': '用户消息',
      // 其他事件类型...
    };
    return eventNames[eventType] || '未知操作';
  }
}
```

### 1.4 事件总线增强

- [ ] 实现事件优先级机制，确保关键事件优先处理
- [ ] 添加事件过滤器，支持更精细的事件订阅
- [ ] 实现事件持久化，确保重要事件不会丢失
- [ ] 添加事件处理性能监控，记录处理时间和资源消耗

## 2. 消息处理流程改进

当前的消息处理流程涉及多种消息格式转换，逻辑分散在多个文件中，增加了维护难度。

### 2.1 统一消息类型和转换逻辑

- [ ] 创建`MessageTypeManager`类，集中管理所有消息类型定义
- [ ] 实现统一的消息转换接口，如`convertToDisplayMessage`、`convertToLLMMessage`等
- [ ] 移除重复的类型定义和转换逻辑
- [ ] 使用类型守卫函数确保类型安全

```typescript
// 示例代码
class MessageTypeManager {
  // 消息类型定义
  static readonly MESSAGE_TYPES = {
    TEXT: 'text',
    TOOL_CALL: 'tool_call',
    TOOL_RESULT: 'tool_result',
    // 其他类型...
  };

  // 类型守卫函数
  static isToolResult(content: any): content is ToolResultContent {
    return (
      typeof content === 'object' &&
      content !== null &&
      'type' in content &&
      content.type === this.MESSAGE_TYPES.TOOL_RESULT &&
      'tool_call_id' in content &&
      'status' in content &&
      'message' in content
    );
  }

  // 统一的转换方法
  static convertToLLMMessage(dbMessage: DatabaseMessage): LLMHistoryMessage {
    // 转换逻辑...
  }
}
```

### 2.2 简化消息发送流程

- [ ] 创建`MessageSender`类，负责所有消息的发送逻辑
- [ ] 实现`sendToLLM`、`sendToUI`等方法
- [ ] 统一处理工具调用和工具调用结果的发送逻辑
- [ ] 添加消息发送队列，确保消息按顺序发送

```typescript
// 示例代码
class MessageSender {
  constructor(
    private messageRepository: IMessageRepository,
    private aiService: AIService
  ) {}

  async sendToLLM(threadId: string, userId: string): Promise<LLMMessage> {
    // 1. 获取消息历史
    const { messages } = await this.messageRepository.getLLMHistoryMessages(threadId);

    // 2. 发送给大模型
    return this.aiService.sendMessage(messages);
  }

  async sendToolResult(toolResult: ToolResultData, threadId: string, userId: string): Promise<void> {
    // 1. 保存工具调用结果
    await this.saveToolResult(toolResult, threadId, userId);

    // 2. 发送给大模型并处理响应
    const response = await this.sendToLLM(threadId, userId);

    // 3. 保存大模型响应
    await this.saveAssistantResponse(response, threadId, userId);
  }
}
```

### 2.3 增强消息验证和错误反馈

- [ ] 实现消息验证器，确保消息格式正确
- [ ] 添加详细的日志记录，包括消息ID、类型、内容摘要等
- [ ] 实现消息处理错误的UI反馈机制，直接向用户展示错误信息
- [ ] 添加消息处理异常监控，记录错误类型和频率

```typescript
// 示例代码
class MessageValidator {
  constructor(private errorReporter: ErrorReporter) {}

  validateToolResult(content: any, context: string): boolean {
    if (!MessageTypeManager.isToolResult(content)) {
      const error = new Error('无效的工具调用结果格式');

      // 记录错误日志
      console.error('Invalid tool result format:', content);

      // 向用户报告错误
      this.errorReporter.reportToUI({
        title: '消息格式错误',
        message: '工具调用结果格式无效，无法处理该消息',
        level: 'error',
        details: JSON.stringify(content, null, 2),
        context: context
      });

      return false;
    }

    // 更多验证逻辑...
    return true;
  }
}

class MessageLogger {
  static logMessage(message: any, context: string): void {
    console.log(`[${context}] Message:`, {
      id: message.id,
      type: message.type,
      summary: this.getSummary(message)
    });
  }

  private static getSummary(message: any): string {
    // 生成消息摘要...
    return typeof message.content === 'string'
      ? message.content.substring(0, 50)
      : JSON.stringify(message.content).substring(0, 50);
  }
}
```

### 2.4 优化消息存储和查询

- [ ] 实现消息缓存机制，减少数据库查询
- [ ] 优化消息查询逻辑，支持分页和过滤
- [ ] 实现消息索引，提高查询性能
- [ ] 添加消息压缩和清理策略，控制存储空间使用

## 3. 测试覆盖率提升

当前系统缺乏全面的测试覆盖，特别是对事件处理系统和消息处理流程的测试。

### 3.1 单元测试

- [ ] 为`MessageEventBus`添加单元测试，覆盖发布、订阅等功能
- [ ] 为所有事件处理器添加单元测试，包括正常和异常情况
- [ ] 为消息转换逻辑添加单元测试，确保转换正确性
- [ ] 为工具调用处理器添加单元测试，覆盖各种工具类型

```typescript
// 示例测试代码
describe('MessageEventBus', () => {
  let eventBus: MessageEventBus;

  beforeEach(() => {
    eventBus = new MessageEventBus();
  });

  test('should publish and receive events', () => {
    // 准备
    const listener = vi.fn();
    eventBus.subscribe(MessageEventType.TOOL_RESULT_SENT, listener);

    // 执行
    eventBus.publish({
      type: MessageEventType.TOOL_RESULT_SENT,
      data: { /* 测试数据 */ }
    });

    // 验证
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].type).toBe(MessageEventType.TOOL_RESULT_SENT);
  });
});
```

### 3.2 集成测试

- [ ] 测试完整的工具调用流程，从调用到结果处理
- [ ] 测试消息发送和接收流程，包括与大模型的交互
- [ ] 测试事件处理系统与其他组件的集成
- [ ] 测试在各种网络条件下的系统行为

```typescript
// 示例测试代码
describe('Tool Call Integration', () => {
  let messageService: MessageService;
  let aiService: AIService;

  beforeEach(() => {
    // 设置测试环境...
  });

  test('should process tool call and send result to LLM', async () => {
    // 准备
    const toolCall = { /* 测试数据 */ };
    const mockLLMResponse = { /* 模拟大模型响应 */ };
    aiService.sendMessage = vi.fn().mockResolvedValue(mockLLMResponse);

    // 执行
    await messageService.handleToolCall(toolCall, 'thread-1', 'user-1');

    // 验证
    expect(aiService.sendMessage).toHaveBeenCalledTimes(1);
    // 验证发送给大模型的消息中包含工具调用结果...
  });
});
```

### 3.3 端到端测试

- [ ] 实现自动化UI测试，覆盖主要用户流程
- [ ] 测试工具调用的完整流程，包括UI交互
- [ ] 测试长对话场景，确保系统在长时间使用后仍然稳定
- [ ] 测试并发场景，确保系统在高负载下仍然正常工作

### 3.4 性能和负载测试

- [ ] 测试系统在高并发下的性能
- [ ] 测试长时间运行下的内存使用情况
- [ ] 测试大量消息存储和查询的性能
- [ ] 测试系统在资源受限环境下的行为

## 实施时间表

### 第一阶段（1-2周）
- 完成事件处理系统的基础重构
- 实现依赖注入模式
- 实现统一的错误报告机制，在UI界面显示错误
- 添加基本的单元测试

### 第二阶段（2-3周）
- 完成消息处理流程的改进
- 统一消息类型和转换逻辑
- 增强消息验证和错误处理
- 增加集成测试覆盖率

### 第三阶段（2-3周）
- 实现高级功能（事件优先级、消息缓存等）
- 添加性能监控和优化
- 完成端到端测试

## 优先级排序

1. **高优先级**
   - 引入依赖注入模式
   - 实现统一的错误报告机制，在UI界面显示错误
   - 统一消息类型和转换逻辑
   - 为关键组件添加单元测试

2. **中优先级**
   - 简化事件处理器初始化流程
   - 增强消息验证和错误处理
   - 实现集成测试

3. **低优先级**
   - 事件总线高级功能
   - 消息存储优化
   - 性能和负载测试
