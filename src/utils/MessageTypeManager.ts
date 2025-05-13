/**
 * 消息类型管理器
 *
 * 这个文件实现了一个统一的消息类型管理系统，用于集中管理所有消息类型定义、
 * 提供类型守卫函数和统一的消息转换接口。
 */

import {
  DatabaseMessage,
  DisplayMessage,
  LLMHistoryMessage,
  MessageRole,
  MessageVisibility,
  ToolCall
} from '../types/messageStructures';
import {
  MessageContent,
  ToolCallContent,
  ToolCallsContent,
  ToolResultContent,
  DataRequestContent,
  DataResponseContent,
  ErrorMessageContent
} from '../types/messageContentTypes';
import logger from './logger';

/**
 * 消息类型枚举
 */
export enum MessageType {
  TEXT = 'text',
  TOOL_CALL = 'tool_call',
  TOOL_CALLS = 'tool_calls',
  TOOL_RESULT = 'tool_result',
  DATA_REQUEST = 'data_request',
  DATA_RESPONSE = 'data_response',
  ERROR = 'error'
}

/**
 * 消息类型管理器
 * 提供统一的消息类型定义、类型守卫和转换方法
 */
export class MessageTypeManager {
  /**
   * 类型守卫：检查内容是否为工具调用内容
   */
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

  /**
   * 类型守卫：检查内容是否为多个工具调用内容
   */
  static isToolCalls(content: any): content is ToolCallsContent {
    // 支持两种格式的多工具调用：
    // 1. 标准格式：{ type: 'tool_calls', tool_calls: [...] }
    // 2. 测试格式：{ type: 'tool_calls', calls: [...] }
    return (
      typeof content === 'object' &&
      content !== null &&
      'type' in content &&
      content.type === MessageType.TOOL_CALLS &&
      (
        // 标准格式
        ('tool_calls' in content && Array.isArray(content.tool_calls)) ||
        // 测试格式
        ('calls' in content && Array.isArray(content.calls))
      )
    );
  }

  /**
   * 类型守卫：检查内容是否为工具调用结果内容
   */
  static isToolResult(content: any): content is ToolResultContent {
    return (
      typeof content === 'object' &&
      content !== null &&
      'type' in content &&
      content.type === MessageType.TOOL_RESULT &&
      'tool_call_id' in content &&
      'status' in content &&
      'message' in content
    );
  }

  /**
   * 类型守卫：检查内容是否为数据请求内容
   */
  static isDataRequest(content: any): content is DataRequestContent {
    return (
      typeof content === 'object' &&
      content !== null &&
      'type' in content &&
      content.type === MessageType.DATA_REQUEST &&
      'query' in content
    );
  }

  /**
   * 类型守卫：检查内容是否为数据响应内容
   */
  static isDataResponse(content: any): content is DataResponseContent {
    return (
      typeof content === 'object' &&
      content !== null &&
      'type' in content &&
      content.type === MessageType.DATA_RESPONSE &&
      'data' in content
    );
  }

  /**
   * 类型守卫：检查内容是否为错误消息内容
   */
  static isError(content: any): content is ErrorMessageContent {
    return (
      typeof content === 'object' &&
      content !== null &&
      'type' in content &&
      content.type === MessageType.ERROR &&
      'message' in content
    );
  }

  /**
   * 类型守卫：检查内容是否为有效的消息内容对象
   */
  static isValidMessageContent(content: any): content is MessageContent {
    if (typeof content === 'string') {
      return true;
    }

    if (typeof content !== 'object' || content === null) {
      return false;
    }

    if (!('type' in content)) {
      return false;
    }

    // 根据类型检查是否符合对应的结构
    switch (content.type) {
      case MessageType.TOOL_CALL:
        return this.isToolCall(content);
      case MessageType.TOOL_CALLS:
        return this.isToolCalls(content);
      case MessageType.TOOL_RESULT:
        return this.isToolResult(content);
      case MessageType.DATA_REQUEST:
        return this.isDataRequest(content);
      case MessageType.DATA_RESPONSE:
        return this.isDataResponse(content);
      case MessageType.ERROR:
        return this.isError(content);
      default:
        return false;
    }
  }

  /**
   * 将数据库消息转换为显示消息
   */
  static toDisplayMessage(dbMessage: DatabaseMessage): DisplayMessage {
    let parsedContent: MessageContent;

    logger.info('Converting DB message to display message:', [{
      id: dbMessage.id,
      role: dbMessage.role,
      contentLength: dbMessage.content.length,
      isJSON: dbMessage.content.trim().startsWith('{') && dbMessage.content.trim().endsWith('}')
    }], 'MessageTypeManager');

    // 如果是assistant或tool角色，尝试解析JSON内容
    if (dbMessage.role === 'assistant' || dbMessage.role === 'tool') {
      try {
        // 尝试解析JSON
        if (dbMessage.content.trim().startsWith('{') && dbMessage.content.trim().endsWith('}')) {
          const parsedObject = JSON.parse(dbMessage.content);

          // 验证解析后的对象是否有效
          if (this.isValidMessageContent(parsedObject)) {
            parsedContent = parsedObject;
          } else {
            // 创建错误消息
            parsedContent = {
              type: MessageType.ERROR,
              message: '无效的消息格式: 缺少必要字段或类型不匹配',
              originalContent: dbMessage.content
            };
          }
        } else {
          // 不是JSON格式，视为纯文本
          parsedContent = dbMessage.content;
        }
      } catch (e) {
        // 如果解析失败，但内容看起来像JSON，创建错误消息
        logger.error('JSON解析失败:', e);

        if (dbMessage.content.trim().startsWith('{') && dbMessage.content.trim().endsWith('}')) {
          parsedContent = {
            type: MessageType.ERROR,
            message: 'JSON解析失败: 无效的JSON格式',
            originalContent: dbMessage.content
          };
        } else {
          // 否则视为纯文本
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
   * 将数据库消息转换为LLM历史消息
   */
  static toLLMHistoryMessage(dbMessage: DatabaseMessage): LLMHistoryMessage {
    logger.debug('Converting DB message to LLM history message:', [{
      id: dbMessage.id,
      role: dbMessage.role,
      tool_call_id: dbMessage.tool_call_id,
      content_preview: dbMessage.content.substring(0, 100) + (dbMessage.content.length > 100 ? '...' : ''),
      send_to_llm: dbMessage.send_to_llm
    }], 'MessageTypeManager');

    // 基本消息结构
    const llmMessage: LLMHistoryMessage = {
      role: dbMessage.role,
      content: dbMessage.content
    };

    // 如果是tool角色，添加tool_call_id
    if (dbMessage.role === 'tool' && dbMessage.tool_call_id) {
      llmMessage.tool_call_id = dbMessage.tool_call_id;
      logger.debug('Added tool_call_id to LLM message:', [dbMessage.tool_call_id], 'MessageTypeManager');
    }

    // 如果是assistant角色，检查是否包含工具调用
    if (dbMessage.role === 'assistant') {
      try {
        const parsedContent = JSON.parse(dbMessage.content);

        // 检查是否是工具调用内容
        if (
          this.isToolCalls(parsedContent) ||
          this.isToolCall(parsedContent)
        ) {
          // 如果是工具调用，设置content为null，添加tool_calls
          llmMessage.content = null;

          if (this.isToolCalls(parsedContent)) {
            // 处理两种格式的多工具调用
            if ('tool_calls' in parsedContent) {
              llmMessage.tool_calls = parsedContent.tool_calls;
            } else if ('calls' in parsedContent) {
              // 测试格式
              llmMessage.tool_calls = parsedContent.calls.map(call => ({
                id: call.id || `call_${Math.random().toString(36).substring(2)}`,
                type: 'function',
                function: {
                  name: call.name,
                  arguments: typeof call.parameters === 'string'
                    ? call.parameters
                    : JSON.stringify(call.parameters)
                }
              }));
            }
          } else if (this.isToolCall(parsedContent)) {
            // 处理两种格式的单工具调用
            if ('arguments' in parsedContent) {
              // 标准格式
              llmMessage.tool_calls = [{
                id: parsedContent.id,
                type: 'function',
                function: {
                  name: parsedContent.name,
                  arguments: parsedContent.arguments
                }
              }];
            } else if ('parameters' in parsedContent) {
              // 测试格式
              llmMessage.tool_calls = [{
                id: parsedContent.id || `call_${Math.random().toString(36).substring(2)}`,
                type: 'function',
                function: {
                  name: parsedContent.name,
                  arguments: typeof parsedContent.parameters === 'string'
                    ? parsedContent.parameters
                    : JSON.stringify(parsedContent.parameters)
                }
              }];
            }
          }

          logger.debug('Converted assistant message with tool calls:', [{
            tool_calls_count: llmMessage.tool_calls?.length
          }], 'MessageTypeManager');
        }
      } catch (e) {
        // 如果解析失败，保持原始内容
        logger.debug('Failed to parse assistant message content as JSON, keeping as text', undefined, 'MessageTypeManager');
      }
    }

    return llmMessage;
  }

  /**
   * 创建新的数据库消息
   */
  static createDatabaseMessage({
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
}
