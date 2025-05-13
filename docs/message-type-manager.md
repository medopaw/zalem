# 消息类型管理器

本文档介绍了新实现的`MessageTypeManager`类，该类用于集中管理所有消息类型定义、提供类型守卫函数和统一的消息转换接口。

## 1. 背景

在之前的实现中，消息类型定义和转换逻辑分散在多个文件中，导致代码重复、维护困难，并且容易出现类型不一致的问题。为了解决这些问题，我们实现了`MessageTypeManager`类，将所有消息类型定义和转换逻辑集中在一个地方。

## 2. 实现

`MessageTypeManager`类位于`src/utils/MessageTypeManager.ts`文件中，主要包含以下功能：

### 2.1 消息类型定义

使用枚举定义所有消息类型：

```typescript
export enum MessageType {
  TEXT = 'text',
  TOOL_CALL = 'tool_call',
  TOOL_CALLS = 'tool_calls',
  TOOL_RESULT = 'tool_result',
  DATA_REQUEST = 'data_request',
  DATA_RESPONSE = 'data_response',
  ERROR = 'error'
}
```

### 2.2 类型守卫函数

为每种消息类型提供类型守卫函数，用于验证消息内容是否符合特定类型：

```typescript
static isToolCall(content: any): content is ToolCallContent {
  // 支持两种格式的工具调用：
  // 1. 标准格式：{ type: 'tool_call', id, name, arguments }
  // 2. 测试格式：{ type: 'tool_call', name, parameters }
  return (
    typeof content === 'object' &&
    content !== null &&
    'type' in content &&
    content.type === MessageType.TOOL_CALL &&
    'name' in content &&
    (
      // 标准格式
      ('id' in content && 'arguments' in content) ||
      // 测试格式
      ('parameters' in content)
    )
  );
}
```

### 2.3 消息转换接口

提供统一的消息转换接口，用于在不同消息格式之间进行转换：

#### 2.3.1 数据库消息 → 显示消息

```typescript
static toDisplayMessage(dbMessage: DatabaseMessage): DisplayMessage {
  // 转换逻辑...
}
```

#### 2.3.2 数据库消息 → LLM历史消息

```typescript
static toLLMHistoryMessage(dbMessage: DatabaseMessage): LLMHistoryMessage {
  // 转换逻辑...
}
```

#### 2.3.3 创建数据库消息

```typescript
static createDatabaseMessage(params): Omit<DatabaseMessage, 'id' | 'created_at'> {
  // 创建逻辑...
}
```

## 3. 使用方法

### 3.1 导入

```typescript
import { MessageTypeManager } from '../utils/MessageTypeManager';
```

### 3.2 类型守卫

```typescript
if (MessageTypeManager.isToolCall(content)) {
  // 处理工具调用内容
}
```

### 3.3 消息转换

```typescript
// 数据库消息 → 显示消息
const displayMessage = MessageTypeManager.toDisplayMessage(dbMessage);

// 数据库消息 → LLM历史消息
const llmMessage = MessageTypeManager.toLLMHistoryMessage(dbMessage);

// 创建数据库消息
const newMessage = MessageTypeManager.createDatabaseMessage({
  content: '你好，世界！',
  role: 'user',
  userId,
  threadId
});
```

## 4. 兼容性

为了保持向后兼容性，原有的转换函数（`toDisplayMessage`、`toLLMHistoryMessage`、`createDatabaseMessage`）仍然保留在`src/types/messageStructures.ts`文件中，但已标记为废弃，并且内部实现已经改为调用`MessageTypeManager`中的对应方法。

```typescript
/**
 * 从数据库消息创建显示消息
 * @deprecated 使用 MessageTypeManager.toDisplayMessage 替代
 */
export function toDisplayMessage(dbMessage: DatabaseMessage | ChatMessage): DisplayMessage {
  return MessageTypeManager.toDisplayMessage(dbMessage as DatabaseMessage);
}
```

## 5. 测试

为`MessageTypeManager`类编写了全面的单元测试，覆盖了所有类型守卫函数和消息转换接口。测试文件位于`src/utils/MessageTypeManager.test.ts`。

## 6. 后续工作

- 逐步替换代码库中对原有转换函数的直接调用，改为使用`MessageTypeManager`
- 在消息验证和错误处理中使用`MessageTypeManager`提供的类型守卫函数
- 为`MessageTypeManager`添加更多功能，如消息验证、错误处理等
