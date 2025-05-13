/**
 * 消息结构类型定义
 *
 * 本文件定义了三种主要的消息结构：
 * 1. 存储在数据库的消息结构 (DatabaseMessage)
 * 2. 用于显示会话内容的消息结构 (DisplayMessage)
 * 3. 用于发送给大模型的消息结构 (LLMHistoryMessage)
 */

import { MessageContent } from './messageContentTypes';
import { ChatMessage } from './chat';
import { MessageTypeManager } from '../utils/MessageTypeManager';

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
 *
 * @deprecated 使用 messageContentTypes.ts 中的类型定义
 * 请使用 MessageContentTypeString 替代
 */
export type MessageContentType =
  | 'text'
  | 'tool_call'
  | 'tool_calls'
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
 * @deprecated 使用 messageContentTypes.ts 中的类型定义
 * 请使用新的类型定义替代
 */

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
 * @deprecated 使用 MessageTypeManager.toDisplayMessage 替代
 */
export function toDisplayMessage(dbMessage: DatabaseMessage | ChatMessage): DisplayMessage {
  return MessageTypeManager.toDisplayMessage(dbMessage as DatabaseMessage);
}

/**
 * 从数据库消息创建LLM历史消息
 * @deprecated 使用 MessageTypeManager.toLLMHistoryMessage 替代
 */
export function toLLMHistoryMessage(dbMessage: DatabaseMessage): LLMHistoryMessage {
  return MessageTypeManager.toLLMHistoryMessage(dbMessage);
}

/**
 * 创建新的数据库消息
 * @deprecated 使用 MessageTypeManager.createDatabaseMessage 替代
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
  metadata?: Record<string, unknown>;
}): Omit<DatabaseMessage, 'id' | 'created_at'> {
  return MessageTypeManager.createDatabaseMessage({
    content,
    role,
    userId,
    threadId,
    isVisible,
    sendToLLM,
    toolCallId,
    sequence,
    metadata
  });
}
