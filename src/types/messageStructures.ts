/**
 * 消息结构类型定义
 *
 * 本文件定义了三种主要的消息结构：
 * 1. 存储在数据库的消息结构 (DatabaseMessage)
 * 2. 用于显示会话内容的消息结构 (DisplayMessage)
 * 3. 用于发送给大模型的消息结构 (LLMHistoryMessage)
 */

import {
  MessageContent,
  isToolCallsContent
} from './messageContentTypes';
import { MessageType } from '../utils/MessageTypeRegistry';
import { ChatMessage } from './chat';
import logger from '../utils/logger';

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
 */
export function toDisplayMessage(dbMessage: DatabaseMessage | ChatMessage): DisplayMessage {
  let parsedContent: MessageContent;

  // 使用智能日志系统，避免重复日志
  logger.info('Converting DB message to display message:', [{
    id: dbMessage.id,
    role: dbMessage.role,
    contentLength: dbMessage.content.length,
    isJSON: dbMessage.content.trim().startsWith('{') && dbMessage.content.trim().endsWith('}')
  }], 'messageStructures');

  // 如果是tool角色或者assistant角色，尝试解析JSON内容
  if (dbMessage.role === 'tool' || dbMessage.role === 'assistant') {
    try {
      // 检查内容是否已经是对象
      let parsed;
      if (typeof dbMessage.content === 'object') {
        console.log('Content is already an object, no need to parse');
        parsed = dbMessage.content;
      } else {
        // 检查内容是否看起来像JSON
        const contentStr = String(dbMessage.content).trim();
        if (contentStr.startsWith('{') && contentStr.endsWith('}')) {
          // 使用智能日志系统，避免重复日志
          logger.debug('Attempting to parse JSON content', undefined, 'messageStructures');
          parsed = JSON.parse(contentStr);
        } else {
          // 不是JSON格式，直接使用原始内容
          // 使用智能日志系统，避免重复日志
          logger.debug('Content does not look like JSON, using as plain text', undefined, 'messageStructures');
          parsedContent = dbMessage.content;
          return {
            id: dbMessage.id,
            content: parsedContent,
            role: dbMessage.role,
            created_at: dbMessage.created_at,
            user_id: dbMessage.user_id,
            metadata: dbMessage.metadata
          };
        }
      }

      // 使用智能日志系统，避免重复日志
      logger.debug('Successfully parsed JSON content:', [{
        hasTypeField: parsed && typeof parsed === 'object' && 'type' in parsed,
        type: parsed && typeof parsed === 'object' && 'type' in parsed ? parsed.type : 'none'
      }], 'messageStructures');

      // 检查是否包含type字段
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        // 根据type字段创建适当的消息内容对象
        switch (parsed.type) {
          case 'tool_call':
            // 验证工具调用消息
            if ('name' in parsed && 'parameters' in parsed) {
              parsedContent = {
                type: MessageType.TOOL_CALL,
                name: parsed.name,
                parameters: parsed.parameters
              };
              console.log('Created tool_call content:', parsedContent);
            } else {
              console.log('Invalid tool_call content, missing required fields');
              parsedContent = dbMessage.content;
            }
            break;

          case 'tool_result':
            // 验证工具结果消息
            if ('tool_call_id' in parsed && 'status' in parsed && 'message' in parsed) {
              // 使用枚举值确保类型安全
              parsedContent = {
                type: MessageType.TOOL_RESULT,
                tool_call_id: parsed.tool_call_id,
                status: parsed.status as 'success' | 'error',
                message: parsed.message,
                details: parsed.details
              };
              console.log('Created tool_result content:', parsedContent);
              console.log('Tool result content type:', typeof parsedContent);
              console.log('Tool result content keys:', Object.keys(parsedContent));
            } else {
              console.log('Invalid tool_result content, missing required fields');
              parsedContent = dbMessage.content;
            }
            break;

          case 'tool_calls':
            // 验证多个工具调用消息
            if ('calls' in parsed && Array.isArray(parsed.calls)) {
              parsedContent = {
                type: MessageType.TOOL_CALLS,
                calls: parsed.calls
              };
              console.log('Created tool_calls content:', parsedContent);
            } else {
              console.log('Invalid tool_calls content, missing required fields');
              parsedContent = dbMessage.content;
            }
            break;

          case 'data_request':
            // 验证数据请求消息
            if ('fields' in parsed && Array.isArray(parsed.fields)) {
              parsedContent = {
                type: MessageType.DATA_REQUEST,
                fields: parsed.fields
              };
              console.log('Created data_request content:', parsedContent);
            } else {
              console.log('Invalid data_request content, missing required fields');
              parsedContent = dbMessage.content;
            }
            break;

          case 'data_response':
            // 验证数据响应消息
            if ('data' in parsed && typeof parsed.data === 'object') {
              parsedContent = {
                type: MessageType.DATA_RESPONSE,
                data: parsed.data
              };
              console.log('Created data_response content:', parsedContent);
            } else {
              console.log('Invalid data_response content, missing required fields');
              parsedContent = dbMessage.content;
            }
            break;

          case 'text':
            // 验证文本消息
            if ('text' in parsed && typeof parsed.text === 'string') {
              parsedContent = {
                type: MessageType.TEXT,
                text: parsed.text
              };
              console.log('Created text content:', parsedContent);
            } else {
              console.log('Invalid text content, missing required fields');
              parsedContent = dbMessage.content;
            }
            break;

          default:
            console.log(`Unknown message type: ${parsed.type}, creating error message`);
            parsedContent = {
              type: MessageType.ERROR,
              message: `无法识别的消息类型: ${parsed.type}`,
              originalContent: JSON.stringify(parsed, null, 2)
            };
        }
      } else {
        // 如果没有type字段，创建错误消息
        console.log('No type field in parsed content, creating error message');
        parsedContent = {
          type: MessageType.ERROR,
          message: '无法识别的消息格式: 缺少类型字段',
          originalContent: JSON.stringify(parsed, null, 2)
        };
      }
    } catch (e) {
      // 如果解析失败，但内容看起来像JSON，创建错误消息
      console.error('JSON解析失败:', e);
      console.log('原始内容:', dbMessage.content);

      if (dbMessage.content.trim().startsWith('{') && dbMessage.content.trim().endsWith('}')) {
        console.log('内容看起来像JSON，创建错误消息');
        parsedContent = {
          type: MessageType.ERROR,
          message: 'JSON解析失败: 无效的JSON格式',
          originalContent: dbMessage.content
        };
        console.log('创建的错误消息内容:', parsedContent);
      } else {
        // 否则视为纯文本
        console.log('内容不是JSON格式，视为纯文本');
        parsedContent = dbMessage.content;
      }
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

    // 使用isToolCallsContent类型守卫函数验证
    if (dbMessage.role === 'assistant' && isToolCallsContent(parsedContent)) {
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
  } catch (error) {
    // 如果解析失败，保持原始内容
    console.log('Failed to parse JSON in toLLMHistoryMessage:', error);
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
  metadata?: Record<string, unknown>;
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
