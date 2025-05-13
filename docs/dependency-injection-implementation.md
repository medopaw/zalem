# 依赖注入模式实现

本文档记录了对事件处理系统的重构，引入依赖注入模式，解决初始化顺序依赖和错误处理不完善等问题。

## 已完成工作

### 1. 创建 EventBusProvider

创建了 `EventBusProvider` 接口和实现类，用于管理 `MessageEventBus` 实例：

```typescript
interface IEventBusProvider {
  getEventBus(): IMessageEventBus;
}

class EventBusProvider implements IEventBusProvider {
  private eventBus: IMessageEventBus;

  constructor(eventBus?: IMessageEventBus) {
    this.eventBus = eventBus || new MessageEventBus();
  }

  getEventBus(): IMessageEventBus {
    return this.eventBus;
  }
}
```

### 2. 增强 MessageEventBus

修改了 `MessageEventBus` 类，添加了更多的方法用于测试和调试：

```typescript
class MessageEventBus implements IMessageEventBus {
  // 原有方法...

  // 新增方法
  getListenerCount(eventType?: MessageEventType): number {
    // 实现...
  }

  hasListeners(eventType: MessageEventType): boolean {
    // 实现...
  }

  getRegisteredEventTypes(): MessageEventType[] {
    // 实现...
  }
}
```

### 3. 创建 EventHandlerRegistry

创建了 `EventHandlerRegistry` 类，用于管理事件处理器：

```typescript
interface IEventHandlerRegistry {
  registerHandler(eventType: MessageEventType, handler: MessageEventListener): () => void;
  getHandlerCount(eventType: MessageEventType): number;
  initializeAllHandlers(): void;
}

class EventHandlerRegistry implements IEventHandlerRegistry {
  constructor(private eventBus: IMessageEventBus) {}

  registerHandler(eventType: MessageEventType, handler: MessageEventListener): () => void {
    // 实现...
  }

  getHandlerCount(eventType: MessageEventType): number {
    // 实现...
  }

  initializeAllHandlers(): void {
    // 实现...
  }
}
```

### 4. 创建 MessageEventHandlerRegistry

创建了 `MessageEventHandlerRegistry` 类，扩展 `EventHandlerRegistry`，添加特定于消息系统的事件处理器初始化：

```typescript
class MessageEventHandlerRegistry extends EventHandlerRegistry {
  constructor(
    eventBus: IMessageEventBus,
    private messageRepository: IMessageRepository,
    private aiService: AIService
  ) {
    super(eventBus);
  }

  override initializeAllHandlers(): void {
    // 初始化工具调用事件处理器
    const toolCallHandler = createToolCallEventHandler(this.messageRepository);

    // 初始化工具调用结果事件处理器
    const toolResultHandler = createToolResultEventHandler(this.messageRepository, this.aiService);

    // 保存处理器引用，防止被垃圾回收
    (window as any).__toolCallHandler = toolCallHandler;
    (window as any).__toolResultHandler = toolResultHandler;
  }
}
```

### 5. 修改 AppInitializer

修改了 `AppInitializer.ts` 文件，使用新的依赖注入模式初始化事件处理器：

```typescript
// 获取事件总线提供者
const eventBusProvider = getEventBusProvider();
const eventBus = eventBusProvider.getEventBus();

// 创建事件处理器注册表
const eventHandlerRegistry = createMessageEventHandlerRegistry(
  eventBus,
  messageRepository,
  aiService
);

// 初始化所有事件处理器
eventHandlerRegistry.initializeAllHandlers();
```

### 6. 修改 MessageService

修改了 `MessageService.ts` 文件，使用依赖注入模式，接受 `IMessageEventBus` 实例作为构造函数参数：

```typescript
class MessageService implements IMessageService {
  private eventBus: IMessageEventBus;
  private aiService: AIService;

  constructor(
    private messageRepository: IMessageRepository,
    private threadRepository: IThreadRepository,
    eventBus?: IMessageEventBus,
    aiService?: AIService
  ) {
    this.eventBus = eventBus || getEventBusProvider().getEventBus();
    this.aiService = aiService || getAIService();
  }

  // 其他方法...
}
```

## 下一步工作

根据 PLAN.md 中的计划，下一步工作包括：

1. **实现统一的错误报告机制**
   - 创建 `ErrorReporter` 类，负责收集和显示错误
   - 在 UI 界面显示错误信息，而不仅仅是记录到控制台
   - 为每个事件处理器添加专门的错误处理逻辑

2. **统一消息类型和转换逻辑**
   - 创建 `MessageTypeManager` 类，集中管理所有消息类型定义
   - 实现统一的消息转换接口，如 `convertToDisplayMessage`、`convertToLLMMessage` 等
   - 移除重复的类型定义和转换逻辑
   - 使用类型守卫函数确保类型安全

3. **为关键组件添加单元测试**
   - 为 `MessageEventBus` 添加单元测试，覆盖发布、订阅等功能
   - 为 `EventHandlerRegistry` 添加单元测试
   - 为 `MessageService` 添加单元测试，特别是依赖注入相关的功能

## 总结

通过引入依赖注入模式，我们解决了以下问题：

1. **初始化顺序依赖**：通过依赖注入，组件不再依赖于全局单例的初始化顺序
2. **错误处理不完善**：添加了更多的错误处理和日志记录
3. **测试困难**：通过依赖注入，可以更容易地进行单元测试，注入模拟的依赖

这些改进使代码更加健壮、可测试和可维护。
