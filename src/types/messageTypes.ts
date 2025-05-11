/**
 * 消息类型定义
 *
 * 这个文件包含所有与消息相关的类型定义，包括：
 * - 消息角色
 * - 消息内容
 * - LLM消息
 * - 聊天消息
 * - 消息处理器
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { ChatService } from '../services/ChatService';

/**
 * 表示消息发送者的角色
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * 表示LLM响应中的工具调用
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
 * 表示来自LLM的完整消息
 */
export interface LLMMessage {
  role: MessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
}

/**
 * 表示数据库中存储的聊天消息
 * 这与数据库表结构保持一致
 */
export interface ChatMessage {
  /** 消息的唯一标识符 */
  id: string;
  /** 消息内容 */
  content: string;
  /** 消息发送者的角色 */
  role: MessageRole;
  /** 消息创建时间 */
  created_at: string;
  /** 发送/接收消息的用户ID */
  user_id: string;
  /** 消息所属的会话ID */
  thread_id: string;
  /** 是否发送给LLM处理 */
  send_to_llm?: boolean;
  /** 工具调用ID */
  tool_call_id?: string;
  /** 消息序列号 */
  sequence?: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 表示发送给LLM的聊天历史消息
 * 这是ChatMessage的简化版本，只包含LLM需要的字段
 */
export interface ChatHistoryMessage {
  /** 消息发送者的角色 */
  role: MessageRole;
  /** 消息内容 */
  content: string;
}

/**
 * 从ChatMessage创建ChatHistoryMessage
 */
export function toChatHistoryMessage(message: ChatMessage): ChatHistoryMessage {
  return {
    role: message.role,
    content: message.content
  };
}

/**
 * 来自DeepSeek API的响应结构
 */
export interface ChatResponse {
  choices: Array<{
    message: LLMMessage;
  }>;
}

/**
 * 消息处理器接口
 */
export interface MessageHandler {
  canHandle(message: LLMMessage): boolean;
  handle(message: LLMMessage, context: MessageContext): Promise<ChatMessage[]>;
}

/**
 * 提供给消息处理器的上下文
 */
export interface MessageContext {
  /** 当前用户ID */
  userId: string;
  /** Supabase客户端实例
   * @deprecated 将在未来版本中移除，请使用存储库模式代替直接访问 Supabase
   */
  supabase: SupabaseClient;
  /** 聊天历史 */
  chatHistory: ChatHistoryMessage[];
  /** 聊天服务实例 */
  chatService: ChatService;
  /** 当前会话ID */
  threadId: string;
  /** 保存消息的回调函数 */
  saveMessage?: (content: string, role: 'user' | 'assistant' | 'tool') => Promise<ChatMessage>;
}

/**
 * 聊天服务配置
 */
export interface ChatServiceConfig {
  /** DeepSeek API的基础URL */
  baseURL?: string;
  /** 用于聊天完成的模型 */
  model?: string;
  /** 响应生成的温度 */
  temperature?: number;
  /** 响应中的最大令牌数 */
  maxTokens?: number;
}

/**
 * AI可以请求的可用数据
 */
export interface AvailableData {
  /** 用户当前昵称 */
  nickname?: string;
  /** 用户角色(admin/user) */
  role?: string;
  /** 用户创建日期 */
  created_at?: string;
}

/**
 * AI的数据请求
 */
export interface DataRequest {
  type: 'data_request';
  fields: (keyof AvailableData)[];
}

/**
 * 对AI的数据响应
 */
export interface DataResponse {
  type: 'data_response';
  data: Partial<AvailableData>;
}

/**
 * 函数定义
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required?: string[];
  };
}

/**
 * 函数调用
 */
export interface FunctionCall {
  name: string;
  arguments: string;
}
