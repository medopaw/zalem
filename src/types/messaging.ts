/**
 * 消息系统类型定义
 * 
 * 定义了消息系统中使用的各种类型和接口
 */

import { DatabaseMessage, MessageRole, LLMHistoryMessage } from './messageStructures';

/**
 * 消息事件类型
 */
export enum MessageEventType {
  USER_MESSAGE_SENT = 'user_message_sent',
  ASSISTANT_MESSAGE_RECEIVED = 'assistant_message_received',
  TOOL_CALL_RECEIVED = 'tool_call_received',
  TOOL_RESULT_SENT = 'tool_result_sent',
  MESSAGES_UPDATED = 'messages_updated',
  ERROR_OCCURRED = 'error_occurred'
}

/**
 * 消息事件数据基础接口
 */
export interface MessageEventData {
  threadId: string;
  userId: string;
}

/**
 * 用户消息事件数据
 */
export interface UserMessageEventData extends MessageEventData {
  content: string;
  messageId: string;
}

/**
 * 助手消息事件数据
 */
export interface AssistantMessageEventData extends MessageEventData {
  content: string | null;
  messageId: string;
  toolCalls?: ToolCallData[];
}

/**
 * 工具调用数据
 */
export interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

/**
 * 工具调用事件数据
 */
export interface ToolCallEventData extends MessageEventData {
  toolCall: ToolCallData;
  messageId: string;
}

/**
 * 工具调用结果数据
 */
export interface ToolResultData {
  toolCallId: string;
  status: 'success' | 'error';
  result: any;
  message: string;
}

/**
 * 工具调用结果事件数据
 */
export interface ToolResultEventData extends MessageEventData {
  toolResult: ToolResultData;
  messageId: string;
}

/**
 * 消息更新事件数据
 */
export interface MessagesUpdatedEventData extends MessageEventData {
  messages: DatabaseMessage[];
}

/**
 * 错误事件数据
 */
export interface ErrorEventData extends MessageEventData {
  error: Error;
  context: string;
}

/**
 * 消息事件联合类型
 */
export type MessageEvent = 
  | { type: MessageEventType.USER_MESSAGE_SENT; data: UserMessageEventData }
  | { type: MessageEventType.ASSISTANT_MESSAGE_RECEIVED; data: AssistantMessageEventData }
  | { type: MessageEventType.TOOL_CALL_RECEIVED; data: ToolCallEventData }
  | { type: MessageEventType.TOOL_RESULT_SENT; data: ToolResultEventData }
  | { type: MessageEventType.MESSAGES_UPDATED; data: MessagesUpdatedEventData }
  | { type: MessageEventType.ERROR_OCCURRED; data: ErrorEventData };

/**
 * 消息事件监听器类型
 */
export type MessageEventListener = (event: MessageEvent) => void;

/**
 * 消息事件总线接口
 */
export interface IMessageEventBus {
  /**
   * 发布消息事件
   */
  publish(event: MessageEvent): void;
  
  /**
   * 订阅特定类型的消息事件
   */
  subscribe(eventType: MessageEventType, listener: MessageEventListener): () => void;
  
  /**
   * 订阅所有消息事件
   */
  subscribeAll(listener: MessageEventListener): () => void;
}

/**
 * 消息服务接口
 */
export interface IMessageService {
  /**
   * 发送用户消息
   */
  sendUserMessage(content: string, threadId: string, userId: string): Promise<string>;
  
  /**
   * 发送工具调用结果
   */
  sendToolResult(
    toolResult: ToolResultData, 
    threadId: string, 
    userId: string
  ): Promise<string>;
  
  /**
   * 获取线程的消息
   */
  getMessages(threadId: string, options?: {
    includeHidden?: boolean;
    forLLM?: boolean;
  }): Promise<DatabaseMessage[]>;
}

/**
 * 工具调用处理器接口
 */
export interface IToolCallProcessor {
  /**
   * 处理工具调用
   */
  processToolCall(
    toolCall: ToolCallData, 
    threadId: string, 
    userId: string
  ): Promise<ToolResultData>;
  
  /**
   * 检查是否可以处理特定工具
   */
  canProcess(toolName: string): boolean;
}
