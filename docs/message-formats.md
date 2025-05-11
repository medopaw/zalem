# 消息格式与转换机制文档

## 1. 三种消息格式

在我们的聊天系统中，存在三种主要的消息格式，每种格式服务于不同的目的：

### 1.1 数据库消息 (DatabaseMessage)

这是存储在数据库中的原始消息格式，包含所有必要的元数据。

```typescript
interface DatabaseMessage {
  /** 消息的唯一标识符 */
  id: string;
  /** 消息内容 - 可以是字符串或JSON字符串 */
  content: string;
  /** 消息发送者的角色 */
  role: MessageRole;  // 'user' | 'assistant' | 'system' | 'tool'
  /** 消息创建时间 */
  created_at: string;
  /** 发送/接收消息的用户ID */
  user_id: string;
  /** 消息所属的会话ID */
  thread_id: string;
  /** 消息在UI中的可见性 */
  is_visible: boolean;
  /** 消息是否应该发送给大模型 */
  send_to_llm: boolean;
  /** 关联的工具调用ID，用于tool角色的消息 */
  tool_call_id?: string;
  /** 消息的排序顺序 */
  sequence?: number;
  /** 消息的元数据，可用于存储额外信息 */
  metadata?: Record<string, unknown>;
}
```

### 1.2 显示消息 (DisplayMessage)

这是用于在UI中显示的消息格式，包含渲染所需的信息。内容已经被解析为适合显示的格式。

```typescript
interface DisplayMessage {
  /** 消息的唯一标识符 */
  id: string;
  /** 消息内容 - 已解析为适合显示的格式 */
  content: MessageContent;  // 字符串或特定类型的对象
  /** 消息发送者的角色 */
  role: MessageRole;
  /** 消息创建时间 */
  created_at: string;
  /** 发送/接收消息的用户ID */
  user_id: string;
  /** 消息是否正在加载中 */
  isLoading?: boolean;
  /** 消息的元数据，可用于显示额外信息 */
  metadata?: Record<string, unknown>;
}
```

其中，`MessageContent`可以是以下类型之一：
- 字符串（纯文本内容）
- `ToolCallContent`（单个工具调用）
- `ToolCallsContent`（多个工具调用）
- `ToolResultContent`（工具调用结果）
- `DataRequestContent`（数据请求）
- `DataResponseContent`（数据响应）

### 1.3 LLM历史消息 (LLMHistoryMessage)

这是发送给大模型的消息格式，符合大模型API的要求。

```typescript
interface LLMHistoryMessage {
  /** 消息发送者的角色 */
  role: MessageRole;
  /** 消息内容 - 纯文本 */
  content: string | null;
  /** 工具调用，仅在assistant角色且有工具调用时存在 */
  tool_calls?: ToolCall[];
  /** 工具调用ID，仅在tool角色时存在 */
  tool_call_id?: string;
}
```

## 2. 消息转换规则

### 2.1 数据库消息 → 显示消息 (toDisplayMessage)

转换过程：
1. 根据消息角色决定如何处理内容
2. 对于`tool`和`assistant`角色的消息，尝试解析JSON内容
3. 验证解析后的对象是否具有有效的`type`字段
4. 如果是有效的消息类型，则使用解析后的对象作为内容
5. 否则，使用原始内容作为纯文本

```typescript
export function toDisplayMessage(dbMessage: DatabaseMessage): DisplayMessage {
  let parsedContent: MessageContent;

  // 如果是tool角色或者assistant角色，尝试解析JSON内容
  if (dbMessage.role === 'tool' || dbMessage.role === 'assistant') {
    try {
      const parsed = JSON.parse(dbMessage.content);

      // 验证解析的内容是否有效
      if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
        // 检查是否是有效的消息类型
        const validTypes = ['tool_call', 'tool_calls', 'tool_result', 'data_request', 'data_response'];
        if (validTypes.includes(parsed.type)) {
          parsedContent = parsed;
        } else {
          parsedContent = dbMessage.content;
        }
      } else {
        parsedContent = dbMessage.content;
      }
    } catch (e) {
      parsedContent = dbMessage.content;
    }
  } else {
    // 如果是user或system角色，直接使用原始内容
    parsedContent = dbMessage.content;
  }

  return {
    id: dbMessage.id,
    content: parsedContent,
    role: dbMessage.role,
    created_at: dbMessage.created_at,
    user_id: dbMessage.user_id,
    metadata: dbMessage.metadata
  };
}
```

### 2.2 数据库消息 → LLM历史消息 (toLLMHistoryMessage)

转换过程：
1. 创建基本的LLM消息结构
2. 如果是`tool`角色，添加`tool_call_id`
3. 尝试解析内容，检查是否包含工具调用
4. 如果是`assistant`角色且内容是工具调用，将内容设为null，添加`tool_calls`

```typescript
export function toLLMHistoryMessage(dbMessage: DatabaseMessage): LLMHistoryMessage {
  // 基本消息结构
  const llmMessage: LLMHistoryMessage = {
    role: dbMessage.role,
    content: dbMessage.content
  };

  // 如果是tool角色，添加tool_call_id
  if (dbMessage.role === 'tool' && dbMessage.tool_call_id) {
    llmMessage.tool_call_id = dbMessage.tool_call_id;
  }

  // 尝试解析内容，检查是否包含工具调用
  try {
    const parsedContent = JSON.parse(dbMessage.content);

    // 如果是assistant角色且内容是工具调用
    if (dbMessage.role === 'assistant' && parsedContent.type === 'tool_calls') {
      // 将内容设为null，添加tool_calls
      llmMessage.content = null;
      llmMessage.tool_calls = parsedContent.calls.map((call) => ({
        id: call.id || `call_${Math.random().toString(36).substring(2)}`,
        type: 'function',
        function: {
          name: call.name,
          arguments: JSON.stringify(call.parameters)
        }
      }));
    }
  } catch (e) {
    // 如果解析失败，保持原始内容
  }

  return llmMessage;
}
```

## 3. 消息显示机制

消息显示过程：
1. `useMessages` hook从数据库加载消息
2. 使用`getDisplayMessages`方法将数据库消息转换为显示消息
3. `MessageList`组件接收显示消息并渲染
4. `MessageContent`组件根据消息内容类型选择合适的渲染方法

```typescript
// MessageContent组件中的渲染逻辑
const renderContent = (content: MessageContentType): JSX.Element | null => {
  // 如果是字符串，直接渲染文本
  if (typeof content === 'string') {
    return renderTextContent(content);
  }

  // 根据内容类型渲染不同的组件
  switch (content.type) {
    case 'data_request':
      return renderDataRequest(content as DataRequestContent);
    case 'data_response':
      return renderDataResponse(content as DataResponseContent);
    case 'tool_call':
      return renderToolCall(content as ToolCallContent);
    case 'tool_calls':
      return renderToolCalls(content as ToolCallsContent);
    case 'tool_result':
      return renderToolResult(content as ToolResultContent);
    default:
      return null;
  }
};
```

不同类型的消息有不同的显示样式：
- 纯文本消息：根据角色显示为蓝色（用户）或灰色（助手）背景的文本框
- 工具调用消息：显示为蓝色渐变背景的按钮，点击可展开查看详情
- 工具调用结果消息：显示为居中的灰色或红色背景的消息，根据状态显示不同的样式
- 数据请求消息：显示为紫色渐变背景的按钮，点击可展开查看详情
- 数据响应消息：显示为绿色渐变背景的按钮，点击可展开查看详情

## 4. 消息历史发送给大模型的机制

消息历史发送过程：
1. `ChatManager`类的`sendMessage`方法调用`prepareChatHistory`方法准备消息历史
2. `prepareChatHistory`方法从数据库获取消息，并使用`toLLMHistoryMessage`方法转换为LLM历史消息
3. 添加系统提示作为第一条消息
4. 添加当前用户消息作为最后一条消息
5. 将消息历史发送给大模型

```typescript
private async prepareChatHistory(includeHidden: boolean = true): Promise<ChatHistoryMessage[]> {
  // 获取消息历史，包含隐藏消息，并且只包含需要发送给LLM的消息
  const { messages } = await this.messageRepository.getMessages(this.threadId, {
    includeHidden,
    forLLM: true
  });

  const history = messages
    .slice(-HISTORY_LIMIT)
    .map(msg => ({
      role: msg.role as MessageRole,
      content: msg.content
    }));

  return [
    { role: 'system' as MessageRole, content: SYSTEM_PROMPT },
    ...history
  ];
}
```

重要的是，只有`send_to_llm`标记为`true`的消息才会被包含在发送给大模型的历史中。这允许我们控制哪些消息应该影响大模型的响应。

## 5. 消息角色与类型的关系

消息角色（`role`）和消息类型（`type`）是两个不同但相关的概念：

- **消息角色**：表示消息的发送者，可以是`user`、`assistant`、`system`或`tool`
- **消息类型**：表示消息的内容格式，可以是`text`、`tool_call`、`tool_calls`、`tool_result`、`data_request`或`data_response`

角色与类型的常见组合：
- `user` + 纯文本：用户发送的普通消息
- `assistant` + 纯文本：助手的普通回复
- `assistant` + `tool_call`/`tool_calls`：助手发起的工具调用
- `tool` + `tool_result`：工具调用的结果
- `assistant` + `data_request`：助手请求数据
- `assistant` + `data_response`：数据响应

通过正确处理这些角色和类型的组合，我们可以实现丰富的交互体验，同时确保大模型能够理解对话的上下文。

## 6. 类型安全的消息内容处理

为了确保类型安全和代码可维护性，我们使用了判别联合类型（Discriminated Union Types）和类型守卫函数（Type Guards）来处理消息内容。

### 6.1 判别联合类型

每种消息类型都有明确的接口定义，包含一个`type`字段作为判别符：

```typescript
// 基础消息内容接口
interface BaseMessageContent {
  type: string;
}

// 纯文本消息内容
interface TextMessageContent extends BaseMessageContent {
  type: 'text';
  text: string;
}

// 工具调用消息内容
interface ToolCallContent extends BaseMessageContent {
  type: 'tool_call';
  name: string;
  parameters: Record<string, unknown>;
}

// ... 其他消息类型
```

### 6.2 类型守卫函数

每种消息类型都有对应的类型守卫函数，用于在运行时验证对象是否符合特定类型：

```typescript
// 类型守卫函数：检查对象是否为工具调用消息内容
function isToolCallContent(obj: unknown): obj is ToolCallContent {
  return (
    isBaseMessageContent(obj) &&
    obj.type === 'tool_call' &&
    'name' in obj &&
    typeof (obj as ToolCallContent).name === 'string' &&
    'parameters' in obj &&
    typeof (obj as ToolCallContent).parameters === 'object'
  );
}
```

### 6.3 消息内容验证

在处理从数据库获取的消息时，我们使用类型守卫函数来验证消息内容：

```typescript
// 验证消息内容
function validateMessageContent(obj: unknown): MessageContent | null {
  if (typeof obj === 'string') {
    return obj;
  }

  if (isTextMessageContent(obj)) return obj;
  if (isToolCallContent(obj)) return obj;
  if (isToolCallsContent(obj)) return obj;
  if (isToolResultContent(obj)) return obj;
  if (isDataRequestContent(obj)) return obj;
  if (isDataResponseContent(obj)) return obj;

  return null;
}
```

### 6.4 在UI中使用类型守卫

在UI组件中，我们使用类型守卫函数来确定如何渲染消息内容：

```typescript
// 根据内容类型渲染不同的组件
const renderContent = (content: MessageContent): JSX.Element | null => {
  // 如果是字符串，直接渲染文本
  if (typeof content === 'string') {
    return renderTextContent(content);
  }

  // 使用类型守卫函数进行类型检查
  if (isDataRequestContent(content)) {
    return renderDataRequest(content);
  } else if (isDataResponseContent(content)) {
    return renderDataResponse(content);
  } else if (isToolCallContent(content)) {
    return renderToolCall(content);
  } else if (isToolCallsContent(content)) {
    return renderToolCalls(content);
  } else if (isToolResultContent(content)) {
    return renderToolResult(content);
  } else if (isTextMessageContent(content)) {
    return renderTextContent(content.text);
  } else {
    console.warn('Unknown message content type:', content);
    return null;
  }
};
```

这种方式的优点是：

1. **类型安全**：TypeScript 编译器可以在编译时检查更多的类型错误
2. **代码可读性**：类型定义明确表达了每种消息类型的结构
3. **维护性**：添加新的消息类型只需要定义新的接口和类型守卫函数
4. **IDE 支持**：IDE 可以提供更准确的代码补全和类型提示
