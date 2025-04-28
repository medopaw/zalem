/**
 * 消息结构类型定义
 *
 * 本文件定义了三种主要的消息结构：
 * 1. 存储在数据库的消息结构 (DatabaseMessage)
 * 2. 用于显示会话内容的消息结构 (DisplayMessage)
 * 3. 用于发送给大模型的消息结构 (LLMHistoryMessage)
 */

/**
 * 消息角色类型
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * 消息可见性类型
 * - visible: 在UI中可见
 * - hidden: 在UI中不可见，但会发送给大模型
 * - internal: 在UI中不可见，也不会发送给大模型，仅用于内部处理
 */
export type MessageVisibility = 'visible' | 'hidden' | 'internal';

/**
 * 消息内容类型
 * - text: 纯文本内容
 * - tool_call: 工具调用
 * - tool_result: 工具调用结果
 * - data_request: 数据请求
 * - data_response: 数据响应
 */
export type MessageContentType =
  | 'text'
  | 'tool_call'
  | 'tool_result'
  | 'data_request'
  | 'data_response';

/**
 * 工具调用定义
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 工具调用内容
 */
export interface ToolCallContent {
  type: 'tool_call';
  name: string;
  parameters: Record<string, unknown>;
}

/**
 * 工具调用结果内容
 */
export interface ToolResultContent {
  type: 'tool_result';
  tool_call_id: string;
  status: 'success' | 'error';
  message: string;
  data?: unknown;
}

/**
 * 数据请求内容
 */
export interface DataRequestContent {
  type: 'data_request';
  fields: string[];
}

/**
 * 数据响应内容
 */
export interface DataResponseContent {
  type: 'data_response';
  data: Record<string, unknown>;
}

/**
 * 消息内容联合类型
 */
export type MessageContent =
  | string
  | ToolCallContent
  | ToolResultContent
  | DataRequestContent
  | DataResponseContent;

/**
 * 1. 数据库消息结构
 * 这是存储在数据库中的消息结构，包含所有必要的元数据
 */
export interface DatabaseMessage {
  /** 消息的唯一标识符 */
  id: string;
  /** 消息内容 - 可以是字符串或JSON字符串 */
  content: string;
  /** 消息发送者的角色 */
  role: MessageRole;
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

/**
 * 2. 显示消息结构
 * 这是用于在UI中显示的消息结构，包含渲染所需的信息
 */
export interface DisplayMessage {
  /** 消息的唯一标识符 */
  id: string;
  /** 消息内容 - 已解析为适合显示的格式 */
  content: MessageContent;
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

/**
 * 3. LLM历史消息结构
 * 这是发送给大模型的消息结构，符合大模型API的要求
 */
export interface LLMHistoryMessage {
  /** 消息发送者的角色 */
  role: MessageRole;
  /** 消息内容 - 纯文本 */
  content: string | null;
  /** 工具调用，仅在assistant角色且有工具调用时存在 */
  tool_calls?: ToolCall[];
  /** 工具调用ID，仅在tool角色时存在 */
  tool_call_id?: string;
}

/**
 * 从数据库消息创建显示消息
 */
export function toDisplayMessage(dbMessage: DatabaseMessage): DisplayMessage {
  let parsedContent: MessageContent;

  try {
    // 尝试解析JSON内容
    parsedContent = JSON.parse(dbMessage.content);
  } catch (e) {
    // 如果解析失败，则视为纯文本
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

/**
 * 从数据库消息创建LLM历史消息
 */
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
      llmMessage.tool_calls = parsedContent.calls.map((call: any) => ({
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

/**
 * 创建新的数据库消息
 */
export function createDatabaseMessage({
  content,
  role,
  userId,
  threadId,
  isVisible = true,
  sendToLLM = true,
  toolCallId,
  sequence,
  metadata
}: {
  content: string | object;
  role: MessageRole;
  userId: string;
  threadId: string;
  isVisible?: boolean;
  sendToLLM?: boolean;
  toolCallId?: string;
  sequence?: number;
  metadata?: Record<string, any>;
}): Omit<DatabaseMessage, 'id' | 'created_at'> {
  // 如果内容是对象，转换为JSON字符串
  const contentStr = typeof content === 'object' ? JSON.stringify(content) : content;

  return {
    content: contentStr,
    role,
    user_id: userId,
    thread_id: threadId,
    is_visible: isVisible,
    send_to_llm: sendToLLM,
    tool_call_id: toolCallId,
    sequence,
    metadata
  };
}
