# 错误报告系统

本文档记录了统一错误报告机制的实现，包括错误收集、显示和处理。

## 1. 系统架构

错误报告系统由以下组件组成：

1. **ErrorReporter** - 核心服务，负责收集和管理错误报告
2. **ErrorNotification** - UI组件，负责显示错误通知
3. **ErrorReportContext** - React上下文，提供错误报告服务给整个应用
4. **ErrorHandlingEnhancer** - 工具函数，为事件处理器添加统一的错误处理逻辑

## 2. ErrorReporter 服务

`ErrorReporter` 是错误报告系统的核心，负责收集、存储和分发错误报告。

### 2.1 主要功能

- 收集和存储错误报告
- 提供错误报告监听机制
- 支持不同级别的错误（信息、警告、错误、严重错误）
- 提供统一的错误处理逻辑

### 2.2 API

```typescript
interface IErrorReporter {
  // 报告错误
  report(error: Error | string, options?: Partial<ErrorReport>): ErrorReport;

  // 向UI报告错误
  reportToUI(options: Omit<ErrorReport, 'timestamp' | 'id' | 'displayed'>): ErrorReport;

  // 添加错误报告监听器
  addListener(listener: ErrorReportListener): () => void;

  // 获取所有未显示的错误报告
  getUnDisplayedReports(): ErrorReport[];

  // 标记错误报告为已显示
  markAsDisplayed(id: string): void;

  // 清除所有错误报告
  clearReports(): void;
}
```

### 2.3 错误报告数据结构

```typescript
interface ErrorReport {
  // 错误标题
  title: string;

  // 错误消息
  message: string;

  // 错误级别
  level: ErrorLevel;

  // 错误详情（可选）
  details?: string;

  // 错误上下文（可选）
  context?: string;

  // 操作类型（可选）
  actionType?: string;

  // 时间戳
  timestamp: number;

  // 错误ID
  id: string;

  // 是否已显示给用户
  displayed?: boolean;
}
```

## 3. ErrorNotification 组件

`ErrorNotification` 是一个全局错误通知组件，负责显示错误报告。

### 3.1 主要功能

- 显示错误通知，包括标题、消息和详情
- 支持不同级别的错误样式
- 支持错误详情的展开和折叠
- 支持错误的关闭和重试

### 3.2 使用方式

```tsx
// 在应用根组件中添加
<ErrorNotification />
```

## 4. ErrorReportContext

`ErrorReportContext` 是一个 React 上下文，提供错误报告服务给整个应用。

### 4.1 主要功能

- 提供错误报告服务实例
- 提供当前错误列表
- 提供清除所有错误的方法

### 4.2 使用方式

```tsx
// 在应用根组件中添加
<ErrorReportProvider>
  <App />
</ErrorReportProvider>

// 在组件中使用
const { errorReporter, errors, clearErrors } = useErrorReport();

// 报告错误
errorReporter.reportToUI({
  title: '操作失败',
  message: '无法连接到服务器',
  level: ErrorLevel.ERROR
});
```

## 5. ErrorHandlingEnhancer

`ErrorHandlingEnhancer` 提供了工具函数，为事件处理器添加统一的错误处理逻辑。

### 5.1 主要功能

- 为事件处理函数添加错误处理逻辑
- 支持可重试的错误处理
- 提供事件名称映射，将事件类型转换为用户友好的名称

### 5.2 使用方式

```typescript
// 错误处理
const enhancedHandler = withErrorHandling(
  originalHandler,
  'HandlerName'
);
```

## 6. 集成到事件处理器

错误处理逻辑已集成到以下事件处理器：

1. **ToolCallEventHandler** - 处理工具调用事件
2. **ToolResultEventHandler** - 处理工具调用结果事件

### 6.1 集成示例

```typescript
private initialize(): void {
  const eventBus = getMessageEventBus();

  // 创建带错误处理的事件处理函数
  const handleEvent = async (event: MessageEvent): Promise<void> => {
    if (event.type === MessageEventType.TOOL_CALL_RECEIVED) {
      await this.handleToolCallEvent(event.data as ToolCallEventData);
    }
  };

  // 使用错误处理增强器包装事件处理函数
  const enhancedHandler = withErrorHandling(
    handleEvent,
    'ToolCallEventHandler'
  );

  // 订阅工具调用事件
  eventBus.subscribe(MessageEventType.TOOL_CALL_RECEIVED, enhancedHandler);
}
```

## 7. 下一步改进

1. **添加事件处理超时机制** - 避免处理器长时间阻塞
2. **实现事件处理状态监控** - 记录错误类型和频率
3. **增强消息验证和错误处理** - 添加更多的验证逻辑
4. **添加单元测试** - 确保错误报告系统的可靠性
